# backend/routers/gemini/idealist_to_geo.py
import logging
import traceback
import os
import tempfile
import json
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# import the volunteering search function (same-process call)
from routers.volunteering.router import search_volunteer_links

# import the gemini wrapper (call_gemini)
import importlib

# import the helper that attaches links to parsed locations
from utils.add_links import add_links_to_locations

router = APIRouter()
logger = logging.getLogger(__name__)


class GeminiIdealistResponse(BaseModel):
    status: str
    country: str
    limit: Optional[int] = None
    idealist_json: Dict[str, Any]
    gemini_called: bool
    # raw gemini text (kept for debugging) -- may be null
    raw_gemini: Optional[str] = None
    # parsed locations: list of {"latlon": [lat, lon], "country": <lowercase string or null>, "link": <url or null>}
    locations: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


def import_call_gemini_module():
    try:
        module = importlib.import_module("gemini.call_gemini")
        return module
    except SystemExit:
        logger.exception("gemini.call_gemini attempted to exit (likely missing GEMINI_API_KEY)")
        raise
    except Exception:
        logger.exception("Failed to import gemini.call_gemini")
        logger.debug(traceback.format_exc())
        raise


def import_parser_module():
    """
    Import the parse_gemini_latlon_list module. Returns the parse function or raises.
    """
    try:
        parser_mod = importlib.import_module("gemini.parse_gemini_latlon_list")
        parse_fn = getattr(parser_mod, "parse_gemini_latlon_list", None)
        if not callable(parse_fn):
            raise ImportError("parse_gemini_latlon_list not found or not callable in gemini.parse_gemini_latlon_list")
        return parse_fn
    except Exception:
        logger.exception("Failed to import gemini.parse_gemini_latlon_list")
        logger.debug(traceback.format_exc())
        raise


def _opportunities_json_path():
    """
    Compute the path to backend/opportunities.json relative to this file.
    This file lives at backend/routers/gemini/idealist_to_geo.py, so go up two levels to backend/.
    """
    cur_dir = os.path.dirname(__file__)
    path = os.path.normpath(os.path.abspath(os.path.join(cur_dir, "..", "..", "opportunities.json")))
    return path


def _append_locations_to_opportunities(country_key: str, locations_list: List[Dict[str, Any]]) -> Optional[str]:
    """
    Append (extend) the locations_list under the country_key in backend/opportunities.json.

    Returns None on success, or an error message string on failure.
    """
    if not isinstance(locations_list, list):
        return "locations_list is not a list"

    opportunities_path = _opportunities_json_path()
    # Ensure the directory exists
    os.makedirs(os.path.dirname(opportunities_path), exist_ok=True)

    # Read existing data (if any)
    existing_data = {}
    try:
        if os.path.exists(opportunities_path):
            with open(opportunities_path, "r", encoding="utf-8") as f:
                try:
                    existing_data = json.load(f)
                    if not isinstance(existing_data, dict):
                        # If file exists but is not a dict, treat as corrupt and replace with empty dict
                        logger.warning("opportunities.json exists but does not contain a JSON object; overwriting with an object.")
                        existing_data = {}
                except json.JSONDecodeError:
                    logger.exception("opportunities.json exists but contains invalid JSON. Replacing with new object.")
                    existing_data = {}
    except Exception as e:
        logger.exception("Error while reading opportunities.json")
        return f"read_failed: {str(e)}"

    # Prepare new data: extend existing list for this country key, or create a new list
    country_key_lower = country_key.lower()
    existing_list = existing_data.get(country_key_lower)
    if existing_list is None:
        # create new list
        existing_data[country_key_lower] = list(locations_list)
    elif isinstance(existing_list, list):
        existing_list.extend(locations_list)
        existing_data[country_key_lower] = existing_list
    else:
        # If existing value for key is not a list, replace it with the new list
        existing_data[country_key_lower] = list(locations_list)

    # Write atomically: write to temp file then replace
    try:
        dir_name = os.path.dirname(opportunities_path) or "."
        fd, tmp_path = tempfile.mkstemp(prefix="opportunities_", suffix=".json", dir=dir_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tmpf:
                json.dump(existing_data, tmpf, ensure_ascii=False, indent=2)
                tmpf.flush()
                os.fsync(tmpf.fileno())
            # atomic replace
            os.replace(tmp_path, opportunities_path)
        finally:
            # If tmp_path still exists (something went wrong), try to remove it
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as e:
        logger.exception("Failed to write opportunities.json atomically")
        return f"write_failed: {str(e)}"

    return None


@router.get("/convert_idealist", response_model=GeminiIdealistResponse)
def convert_idealist_to_geo(
    country: str = Query(..., min_length=1, description="Country or location to search, e.g. 'Japan'"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Optional max number of links to return"),
    model: Optional[str] = Query(None, description="Optional Gemini model override (e.g. gemini-2.5-flash)"),
):
    """
    Run the volunteering search for `country`, take the resulting JSON, pass only the links
    to Gemini with a concise system prompt asking for ONLY valid JSON containing {"latlon": [lat, lon], "country": "country"},
    parse Gemini's output into a list of {"latlon": [lat, lon], "country": <str or None>} dicts,
    attach the original link for each entry under "link", append that list under backend/opportunities.json[country],
    and return that list under `locations`.
    """

    # 1) Call the existing volunteering search function
    try:
        search_result = search_volunteer_links(country=country, limit=limit)
        search_dict = search_result.dict()
    except HTTPException as he:
        raise he
    except Exception as exc:
        logger.exception("Error while running volunteering search")
        raise HTTPException(status_code=500, detail=f"Volunteering search failed: {str(exc)}")

    # 2) Prepare a compact payload for Gemini: only the links list
    links_list = search_dict.get("links") or search_dict.get("idealist_json", {}).get("links") or []
    links_json = json.dumps(links_list, ensure_ascii=False)

    # 3) Concise, strict system prompt. Ask Gemini to return only JSON array with objects containing "latlon": [lat, lon] and "country": "<country>"
    system_prompt = (
        "You are given a JSON array of URLs (links) pointing to volunteer opportunity pages.\n"
        "Task: For each URL produce a JSON object with these exact keys:\n"
        "  - \"latlon\": an array [lat, lon] where lat and lon are parseable floats (latitude first),\n"
        "  - \"country\": the country for that lat/lon, as a lower-case English name (for example: 'japan').\n"
        "Requirements (strict):\n"
        " - Output MUST be a single valid JSON array and nothing else. Example:\n"
        "   [ {\"latlon\": [35.6897, 139.6922], \"country\": \"japan\"}, {\"latlon\": [...], \"country\": \"country\"} ]\n"
        " - Do NOT include markdown, backticks, commentary, notes, or any extra text.\n"
        " - Ensure lat and lon are parseable floats and in the order [latitude, longitude].\n"
        " - Make sure that the countries are full English names in lower case (no country codes).\n"
        " - Return entries in the same order as the input links array. If you cannot find coordinates for a link, omit that link's object entirely.\n"
        " - Each array element MUST contain both keys: \"latlon\" and \"country\" (if country is unknown, set it to null explicitly).\n"
        "Input links array:\n"
        f"{links_json}\n"
        "Reply now with only the JSON array (no extra text)."
    )

    # 4) Import gemini wrapper and call it with a fast default model (configurable)
    try:
        cg = import_call_gemini_module()
    except SystemExit:
        return GeminiIdealistResponse(
            status="ok",
            country=country,
            limit=limit,
            idealist_json=search_dict,
            gemini_called=False,
            raw_gemini=None,
            locations=None,
            error="call_gemini attempted to exit (likely missing GEMINI_API_KEY). Check server logs."
        )
    except Exception as exc:
        return GeminiIdealistResponse(
            status="ok",
            country=country,
            limit=limit,
            idealist_json=search_dict,
            gemini_called=False,
            raw_gemini=None,
            locations=None,
            error=f"Import error for gemini wrapper: {str(exc)}"
        )

    generate_fn = getattr(cg, "generate_response", None)
    if not callable(generate_fn):
        return GeminiIdealistResponse(
            status="ok",
            country=country,
            limit=limit,
            idealist_json=search_dict,
            gemini_called=False,
            raw_gemini=None,
            locations=None,
            error="generate_response not found in gemini.call_gemini"
        )

    # Decide model: explicit query param overrides env default which overrides embedded default
    model_to_use = model or os.environ.get("GEMINI_FAST_MODEL", None)

    try:
        prompt_text = ""  # system prompt contains the instructions
        if model_to_use:
            gemini_text = generate_fn(system_prompt=system_prompt, prompt=prompt_text, model=model_to_use)
        else:
            gemini_text = generate_fn(system_prompt=system_prompt, prompt=prompt_text)
        gemini_text_str = gemini_text if isinstance(gemini_text, str) else str(gemini_text)

    except SystemExit:
        logger.exception("call_gemini requested process exit while generating response")
        return GeminiIdealistResponse(
            status="ok",
            country=country,
            limit=limit,
            idealist_json=search_dict,
            gemini_called=False,
            raw_gemini=None,
            locations=None,
            error="call_gemini requested process exit. Check GEMINI_API_KEY and call_gemini implementation."
        )
    except Exception as exc:
        logger.exception("Error while calling Gemini")
        logger.debug(traceback.format_exc())
        return GeminiIdealistResponse(
            status="ok",
            country=country,
            limit=limit,
            idealist_json=search_dict,
            gemini_called=False,
            raw_gemini=None,
            locations=None,
            error=f"Gemini generation failed: {str(exc)}"
        )

    # 5) Parse Gemini's raw response using your parser
    parsed_locations = None
    parse_error = None
    try:
        parse_fn = import_parser_module()
        parsed_locations = parse_fn(gemini_text_str)
        # parsed_locations should be list of {"latlon": [lat, lon], "country": <str or None>} dicts
        if parsed_locations is None:
            parsed_locations = []
    except Exception as pe:
        parse_error = f"Parsing failed: {str(pe)}"
        logger.exception("Error while parsing Gemini output")
        logger.debug(traceback.format_exc())
        parsed_locations = None

    # 5.5) Attach the corresponding links (by index) to each parsed location
    if parsed_locations is not None:
        try:
            parsed_locations = add_links_to_locations(parsed_locations, links_list)
        except Exception as exc:
            # If helper fails for any reason, keep parsed_locations as-is and report an error
            logger.exception("Failed to attach links to parsed locations")
            logger.debug(traceback.format_exc())
            if parse_error:
                parse_error = f"{parse_error}; attach_links_failed: {str(exc)}"
            else:
                parse_error = f"attach_links_failed: {str(exc)}"

    # Optionally: If parsed_locations length mismatches links_list length, include a warning in error
    if parsed_locations is not None and len(parsed_locations) != len(links_list):
        # keep parsed_locations but warn in error field
        warning = f"Parsed {len(parsed_locations)} entries but found {len(links_list)} links"
        if parse_error:
            parse_error = f"{parse_error}; {warning}"
        else:
            parse_error = warning

    # 5.75) Append parsed_locations to backend/opportunities.json under the country key
    append_error = None
    if parsed_locations:
        try:
            append_error = _append_locations_to_opportunities(country, parsed_locations)
            if append_error:
                logger.error("Appending to opportunities.json failed: %s", append_error)
        except Exception as e:
            append_error = f"exception_during_append: {str(e)}"
            logger.exception("Unexpected error while appending to opportunities.json")
            logger.debug(traceback.format_exc())

    # Combine parse_error and append_error into a single error message for the response if present
    combined_error = None
    if parse_error and append_error:
        combined_error = f"{parse_error}; append_error: {append_error}"
    elif parse_error:
        combined_error = parse_error
    elif append_error:
        combined_error = f"append_error: {append_error}"

    # 6) Return the parsed list under `locations`. Keep raw_gemini for debugging.
    return GeminiIdealistResponse(
        status="ok",
        country=country,
        limit=limit,
        idealist_json=search_dict,
        gemini_called=True,
        raw_gemini=gemini_text_str,
        locations=parsed_locations,
        error=combined_error
    )

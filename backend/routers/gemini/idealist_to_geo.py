# backend/routers/gemini/idealist_to_geo.py
import logging
import traceback
import os
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# import the volunteering search function (same-process call)
from routers.volunteering.router import search_volunteer_links

# import the gemini wrapper (call_gemini)
import importlib
import json

# import the helper that attaches links to parsed locations
from utils.add_links import add_links_to_locations

router = APIRouter()
logger = logging.getLogger(__name__)


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


@router.get("/convert_idealist", response_model=List[Dict[str, Any]])
def convert_idealist_to_geo(
    country: str = Query(..., min_length=1, description="Country or location to search, e.g. 'Japan'"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Optional max number of links to return"),
    model: Optional[str] = Query(None, description="Optional Gemini model override (e.g. gemini-2.5-flash)"),
) -> List[Dict[str, Any]]:
    """
    Run the volunteering search for `country`, call Gemini to get coordinates, parse Gemini's output,
    attach the original link and extracted NAME to each parsed location, and return ONLY the resulting
    list of location dicts (each dict contains "latlon", "country", "link", "name").
    """

    # 1) Call the existing volunteering search function
    try:
        search_result = search_volunteer_links(country=country, limit=limit)
        search_dict = search_result.dict()
    except HTTPException as he:
        # propagate known HTTP exceptions from the search function
        raise he
    except Exception as exc:
        logger.exception("Error while running volunteering search")
        # In case of error, return empty list (caller requested only locations)
        return []

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
    except Exception:
        logger.exception("Failed to import call_gemini module")
        return []

    generate_fn = getattr(cg, "generate_response", None)
    if not callable(generate_fn):
        logger.error("generate_response not found in gemini.call_gemini")
        return []

    # Decide model: explicit query param overrides env default which overrides embedded default
    model_to_use = model or os.environ.get("GEMINI_FAST_MODEL", None)

    try:
        prompt_text = ""  # system prompt contains the instructions
        if model_to_use:
            gemini_text = generate_fn(system_prompt=system_prompt, prompt=prompt_text, model=model_to_use)
        else:
            gemini_text = generate_fn(system_prompt=system_prompt, prompt=prompt_text)
        gemini_text_str = gemini_text if isinstance(gemini_text, str) else str(gemini_text)
    except Exception:
        logger.exception("Error while calling Gemini")
        return []

    # 5) Parse Gemini's raw response using your parser
    parsed_locations: Optional[List[Dict[str, Any]]] = None
    try:
        parse_fn = import_parser_module()
        parsed_locations = parse_fn(gemini_text_str)
        if parsed_locations is None:
            parsed_locations = []
    except Exception:
        logger.exception("Error while parsing Gemini output")
        return []

    # 5.5) Attach the corresponding links (by index) and extracted names to each parsed location
    try:
        final_locations = add_links_to_locations(parsed_locations, links_list)
    except Exception:
        logger.exception("Failed to attach links to parsed locations")
        # If helper fails, fall back to parsed_locations but ensure they are returned as list of dicts
        final_locations = parsed_locations or []

    # Return ONLY the list of locations
    return final_locations

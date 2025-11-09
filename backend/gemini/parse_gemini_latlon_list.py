# gemini/parse_gemini_latlon_list.py
"""
Parse a Gemini 'latlon' response string into a Python list of dicts:
  [ {"latlon": [lat, lon], "country": "country"}, ... ]

Usage:
  >>> from gemini.parse_gemini_latlon_list import parse_gemini_latlon_list
  >>> raw = '...the Gemini response string...'
  >>> entries = parse_gemini_latlon_list(raw)
  >>> print(entries)   # list of dicts

Notes:
- The parser is tolerant of small JSON problems (like missing '[' before the pair).
- It will attempt to extract both lat/lon and an accompanying country string (lowercased).
- If "country" is missing for an entry, that entry will include "country": None.
"""
import json
import re
from typing import List, Dict, Any, Optional


def _normalize_country(val: Any) -> Optional[str]:
    """Normalize country field to lower-case string if possible, else return None."""
    if val is None:
        return None
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return None
        return s.lower()
    # sometimes JSON may have unquoted tokens; coerce to str
    try:
        s = str(val).strip()
        return s.lower() if s else None
    except Exception:
        return None


def _try_json_load(raw: str) -> Optional[List[Dict[str, Any]]]:
    """Try to load raw text as JSON, returning list if successful and well-formed."""
    try:
        obj = json.loads(raw)
        if isinstance(obj, list):
            out: List[Dict[str, Any]] = []
            for item in obj:
                if not isinstance(item, dict):
                    continue
                if "latlon" not in item:
                    # tolerate older style where latlon may be named differently? skip otherwise
                    continue
                val = item["latlon"]
                # accept lists/tuples of two numbers
                if isinstance(val, (list, tuple)) and len(val) == 2:
                    try:
                        lat = float(val[0])
                        lon = float(val[1])
                    except Exception:
                        # skip malformed numeric entries
                        continue
                    country = _normalize_country(item.get("country"))
                    out.append({"latlon": [lat, lon], "country": country})
            if out:
                return out
    except Exception:
        pass
    return None


def parse_gemini_latlon_list(raw: str) -> List[Dict[str, Any]]:
    """
    Parse Gemini response text and return a list of {"latlon": [lat, lon], "country": country} dicts.

    Arguments:
      raw: the raw string returned by Gemini (may contain backticks, markdown fences, or be slightly malformed).

    Returns:
      list of dicts with keys:
        - "latlon": [lat(float), lon(float)]
        - "country": lower-case string or None
    """
    if not isinstance(raw, str):
        raise TypeError("raw must be a string")

    text = raw.strip()

    # Remove common code fences and backticks
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text, flags=re.IGNORECASE)

    # If the string itself is a quoted JSON string with escaped newlines, try to unescape it
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        try:
            unquoted = json.loads(text)
            if isinstance(unquoted, str):
                text = unquoted
        except Exception:
            # leave text as-is if json.loads fails
            pass

    # 1) Try to parse as valid JSON and extract clean latlon pairs with country
    parsed = _try_json_load(text)
    if parsed is not None:
        return parsed

    # 2) Tolerant regex extraction:
    # Match "latlon": [<num>, <num>] optionally followed somewhere by "country": "country"
    number = r"[+-]?\d+(?:\.\d+)?"
    # Allow optional opening '[' and optional closing ']' for malformed cases
    pattern = re.compile(
        rf'"latlon"\s*:\s*\[?\s*({number})\s*,\s*({number})\s*\]?',
        flags=re.IGNORECASE
    )

    # A permissive country matcher that finds a nearby "country": value (quoted or unquoted token)
    country_pattern = re.compile(
        r'"country"\s*:\s*(?P<q>["\']?)(?P<country>[^"\'},\]]+)(?P=q)',
        flags=re.IGNORECASE
    )

    results: List[Dict[str, Any]] = []
    for m in pattern.finditer(text):
        try:
            lat_s, lon_s = m.group(1), m.group(2)
            lat = float(lat_s)
            lon = float(lon_s)

            # Search for a "country" token near the match. We'll first look forward a short distance,
            # then backwards a short distance, then globally as fallback.
            country = None
            search_span_start = max(0, m.end())
            search_span_end = min(len(text), m.end() + 200)  # 200 chars forward
            forward_chunk = text[search_span_start:search_span_end]
            fm = country_pattern.search(forward_chunk)
            if fm:
                country = _normalize_country(fm.group("country"))
            else:
                # try a backward search (200 chars)
                back_start = max(0, m.start() - 200)
                back_chunk = text[back_start:m.start()]
                bm = country_pattern.search(back_chunk)
                if bm:
                    country = _normalize_country(bm.group("country"))
                else:
                    # global fallback: first "country" anywhere in the document (less reliable)
                    gm = country_pattern.search(text)
                    if gm:
                        country = _normalize_country(gm.group("country"))

            results.append({"latlon": [lat, lon], "country": country})
        except Exception:
            # skip any entries that can't be parsed to floats
            continue

    # If regex found nothing, try a more permissive approach: find any bracketed pairs of two numbers
    if not results:
        pair_pattern = re.compile(r"\[\s*(" + number + r")\s*,\s*(" + number + r")\s*\]")
        for m in pair_pattern.finditer(text):
            try:
                lat = float(m.group(1))
                lon = float(m.group(2))
                # try to locate nearby country as above
                country = None
                search_span_start = max(0, m.end())
                search_span_end = min(len(text), m.end() + 200)
                forward_chunk = text[search_span_start:search_span_end]
                fm = country_pattern.search(forward_chunk)
                if fm:
                    country = _normalize_country(fm.group("country"))
                else:
                    back_start = max(0, m.start() - 200)
                    back_chunk = text[back_start:m.start()]
                    bm = country_pattern.search(back_chunk)
                    if bm:
                        country = _normalize_country(bm.group("country"))
                    else:
                        gm = country_pattern.search(text)
                        if gm:
                            country = _normalize_country(gm.group("country"))
                results.append({"latlon": [lat, lon], "country": country})
            except Exception:
                continue

    return results


# If executed as a script, demonstrate parsing with the sample (for quick manual test)
if __name__ == "__main__":
    sample = r"""
[ 
  { "latlon": [-1.3090, 36.7820], "country":  "kenya" },
  { "latlon": [-1.2921, 36.8219], "country": "Kenya" },
  { "latlon": [-0.7183, 36.4385] }, 
  { "latlon": [-0.5283, 34.4600], "country":  "Kenya" },
  { "latlon": [3.7222, 34.8872], "country": "Kenya" }
]
"""
    parsed = parse_gemini_latlon_list(sample)
    print("Parsed", len(parsed), "entries:")
    import json as _json
    print(_json.dumps(parsed, indent=2))

# backend/utils/add_links.py
"""
Helper to attach corresponding links to parsed location dicts and extract a human-friendly name.

The intended contract:
  - locations: list of dicts like {"latlon": [lat, lon], "country": "kenya"} (country may be None)
  - links: list of URL strings, in the same order as the original input that produced locations

Behavior:
  - locations[i]["link"] = links[i] (if not already present)
  - locations[i]["name"] = UPPERCASE human-friendly title extracted from the URL slug:
        For a URL like:
          https://.../8c16524ce0454daeb9e07eda2eb4d7e1-volunteer-pro-english-spanish-...
        the last path segment is split on the FIRST dash ('-'), the remainder is treated as
        the slug: "volunteer-pro-english-spanish-..." -> converted to
        "VOLUNTEER PRO ENGLISH SPANISH ..." and stored under "name".
  - If no slug part exists (no dash in last segment), name will be None.
  - The function returns a NEW list with shallow-copied dicts (does not mutate input).

Notes:
  - If there are more links than locations, extra links are ignored (warning logged).
  - If there are more locations than links, extra locations receive "link": None and "name": None.
"""

import logging
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse, unquote

logger = logging.getLogger(__name__)


def _extract_name_from_link(link: str) -> Optional[str]:
    """
    Extract a human-friendly uppercase name from the last segment of the URL.

    Steps:
      - parse URL and extract last path segment
      - URL-unquote it
      - partition on the first '-' (ID separator). Take the remainder after the first dash.
      - replace remaining dashes with spaces, collapse whitespace, strip, and uppercase.
      - return None if no remainder after the first dash.
    """
    if not link or not isinstance(link, str):
        return None
    try:
        parsed = urlparse(link)
        path = parsed.path or ""
        # remove trailing slashes and get last segment
        last = path.rstrip("/").split("/")[-1]
        if not last:
            return None
        last_unquoted = unquote(last)
        # partition on the first '-' to separate the id from the slug
        before, sep, after = last_unquoted.partition("-")
        if not sep or not after:
            # no dash found or nothing after dash -> can't extract a slug
            return None
        # Replace '-' with spaces, collapse multiple spaces, strip, and uppercase
        # also replace underscores with spaces just in case
        slug = after.replace("_", " ")
        # collapse multiple dashes/spaces
        parts = [p for p in slug.split("-") if p] if "-" in slug else slug.split()
        if parts:
            joined = " ".join(parts)
        else:
            # fallback: use slug with whitespace splitted
            joined = " ".join(slug.split())
        name = joined.strip().upper()
        if not name:
            return None
        return name
    except Exception as exc:
        logger.debug("Failed to extract name from link %r: %s", link, exc)
        return None


def add_links_to_locations(locations: Optional[List[Dict[str, Any]]],
                           links: Optional[List[str]]) -> List[Dict[str, Any]]:
    """
    Attach links and extracted names to parsed locations by index.

    Args:
      locations: list of dicts (may be None)
      links: list of strings (may be None)

    Returns:
      new_locations: list of dicts where each dict has added "link" and "name" keys (or None if not available)
    """
    if locations is None:
        return []

    # If no links provided: ensure explicit link=None and name=None on each location
    if not links:
        out = []
        for loc in locations:
            new_loc = dict(loc)  # shallow copy
            if "link" not in new_loc:
                new_loc["link"] = None
            if "name" not in new_loc:
                new_loc["name"] = None
            out.append(new_loc)
        return out

    out: List[Dict[str, Any]] = []
    n_locs = len(locations)
    n_links = len(links)
    n = min(n_locs, n_links)

    # Attach link and extracted name for matched indices
    for i in range(n):
        loc = dict(locations[i])  # shallow copy to avoid mutating caller
        if "link" not in loc:
            loc["link"] = links[i]
        # only add name if it's not already present
        if "name" not in loc:
            loc_name = _extract_name_from_link(links[i])
            loc["name"] = loc_name
        out.append(loc)

    # If there are extra locations without links (more locations than links),
    # append them with link=None and name=None
    if n_locs > n_links:
        logger.warning(
            "add_links_to_locations: more parsed locations (%d) than links (%d). Extra locations will have link=None and name=None.",
            n_locs, n_links
        )
        for i in range(n_links, n_locs):
            loc = dict(locations[i])
            if "link" not in loc:
                loc["link"] = None
            if "name" not in loc:
                loc["name"] = None
            out.append(loc)

    # If there are extra links (more links than parsed locations), we ignore the extra links,
    # but log it so operator can investigate.
    if n_links > n_locs:
        logger.warning(
            "add_links_to_locations: more links (%d) than parsed locations (%d). Extra links will be ignored.",
            n_links, n_locs
        )

    return out

# recommend_opportunity.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
import logging
import os
import re
import json

# server-side supabase client (optional; set env vars to enable DB chat fetch)
try:
    from supabase import create_client  # supabase-py
except Exception:
    create_client = None

# Gemini wrapper (mock or real) - see gemini/call_gemini.py
from gemini.call_gemini import generate_response

router = APIRouter()
logger = logging.getLogger("recommend_opportunity")
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

# -----------------------
# Pydantic models
# -----------------------
class OpportunityLink(BaseModel):
    id: Optional[str] = None
    name: str
    link: Optional[str] = None
    country: Optional[str] = None


class RecommendRequest(BaseModel):
    room_code: str
    displayed_opportunities: Optional[List[OpportunityLink]] = None
    fetch_url: Optional[str] = None
    opportunities_json: Optional[Dict[str, Any]] = None  # Full JSON from frontend


class RecommendResponse(BaseModel):
    recommendation: str
    analyzed_count: int


# -----------------------
# Supabase client init (server-side)
# -----------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
)

supabase = None
if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized for server-side message fetching.")
    except Exception as e:
        supabase = None
        logger.warning(f"Failed to initialize Supabase client: {e}")
else:
    logger.info("Supabase client not configured on server; message fetching disabled.")


# -----------------------
# Helpers: sanitization & truncation
# -----------------------
_control_re = re.compile(r"[\x00-\x1F\x7F]+")
try:
    _emoji_re = re.compile(r"[\U00010000-\U0010ffff]", flags=re.UNICODE)
except re.error:
    _emoji_re = re.compile(r"[^\x00-\x7F]+")


def sanitize_text(s: Optional[str]) -> str:
    if not s:
        return ""
    s = str(s)
    s = _control_re.sub(" ", s)
    try:
        s = _emoji_re.sub("", s)
    except re.error:
        s = re.sub(r"[^\x00-\x7F]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def trunc(s: Optional[str], n: int) -> str:
    if not s:
        return ""
    s2 = str(s)
    return s2 if len(s2) <= n else s2[: n - 1] + "…"


# -----------------------
# Fetch room messages from Supabase (sanitized, excludes bot recommendations)
# -----------------------
def _is_worldai_recommendation(msg: str) -> bool:
    if not msg:
        return False
    trimmed = str(msg).lstrip().lower()
    snippet = trimmed[:80]
    return "worldai recommendation" in snippet or "🤖 worldai recommendation" in snippet


def fetch_room_selected_country(room_code: str) -> Optional[str]:
    """
    Fetch the selected country for the room_code from Supabase (server-side).
    Returns the country name (lowercased) or None if not set.
    """
    if not supabase:
        logger.info("Supabase client not configured; cannot fetch selected country.")
        return None

    try:
        res = (
            supabase.table("rooms")
            .select("selected_country")
            .eq("room_code", room_code)
            .single()
            .execute()
        )
        data = None
        if isinstance(res, dict) and "data" in res:
            data = res["data"]
            error = res.get("error")
        else:
            data = getattr(res, "data", None)
            error = getattr(res, "error", None)

        if error:
            logger.warning("Error fetching selected country from supabase: %s", error)
            return None

        if not data:
            return None

        selected_country = data.get("selected_country") if isinstance(data, dict) else getattr(data, "selected_country", None)
        if selected_country and isinstance(selected_country, str):
            return selected_country.lower().strip()
        return None
    except Exception as e:
        logger.exception("Exception fetching selected country for room %s: %s", room_code, e)
        return None


def fetch_room_messages(room_code: str, limit_chars: int = 1200) -> str:
    """
    Fetch recent messages for the room_code from Supabase (server-side).
    Returns a single sanitized string of limited length suitable to include in prompts.
    If server supabase client is not configured, return empty string.
    """
    if not supabase:
        logger.info("Supabase client not configured; returning empty chat context.")
        return ""

    try:
        res = (
            supabase.table("messages")
            .select("user_id, message, created_at")
            .eq("room_code", room_code)
            .order("created_at", {"ascending": True})
            .execute()
        )
        data = None
        if isinstance(res, dict) and "data" in res:
            data = res["data"]
            error = res.get("error")
        else:
            data = getattr(res, "data", None)
            error = getattr(res, "error", None)

        if error:
            logger.warning("Error fetching messages from supabase: %s", error)
            return ""

        if not data:
            return ""

        lines = []
        total = 0
        for row in data:
            text = (row.get("message") if isinstance(row, dict) else getattr(row, "message", "")) or ""
            if _is_worldai_recommendation(text):
                # skip prior WorldAI bot messages
                continue
            user = (row.get("user_id") if isinstance(row, dict) else getattr(row, "user_id", "")) or ""
            ts = (row.get("created_at") if isinstance(row, dict) else getattr(row, "created_at", "")) or ""
            sanitized_line = f"[{sanitize_text(ts)}] {sanitize_text(user)}: {sanitize_text(text)}"
            if total + len(sanitized_line) > limit_chars:
                remaining = max(0, limit_chars - total)
                if remaining > 0:
                    lines.append(sanitized_line[:remaining] + ("…" if remaining < len(sanitized_line) else ""))
                break
            lines.append(sanitized_line)
            total += len(sanitized_line)

        return "\n".join(lines)
    except Exception as e:
        logger.exception("Exception fetching messages for room %s: %s", room_code, e)
        return ""


# -----------------------
# Fetch displayed opportunities from a frontend endpoint (optional)
# -----------------------
def fetch_from_frontend(url: str, timeout: int = 6) -> List[Dict[str, Any]]:
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()
        if isinstance(payload, dict) and "displayed_opportunities" in payload:
            arr = payload["displayed_opportunities"]
        elif isinstance(payload, list):
            arr = payload
        elif isinstance(payload, dict) and "opportunities" in payload:
            arr = payload["opportunities"]
        else:
            raise ValueError("Unexpected JSON shape from frontend endpoint")
        if not isinstance(arr, list):
            raise ValueError("Frontend endpoint did not return a list")
        normalized = []
        for i, item in enumerate(arr):
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("title")
            if not name:
                continue
            normalized.append(
                {
                    "id": item.get("id") or f"fetched-{i}",
                    "name": sanitize_text(name)[:300],
                    "link": item.get("link") or item.get("url") or "",
                    "country": sanitize_text(item.get("country") or item.get("location") or "")[:120],
                }
            )
        return normalized
    except Exception as e:
        logger.exception("Failed to fetch or parse frontend URL %s: %s", url, e)
        raise


# -----------------------
# Endpoint
# -----------------------
@router.post("/recommend-opportunity", response_model=RecommendResponse)
async def recommend_opportunity(req: RecommendRequest):
    """
    Accepts:
      - displayed_opportunities: array of up to 5 {id,name,link,country} (preferred - current page)
      OR
      - opportunities_json: full JSON object from frontend (fallback)
      OR
      - fetch_url: URL the backend will GET to retrieve the list

    Workflow:
      - Acquire OPPS (from displayed_opportunities, opportunities_json, or fetch_url)
      - Fetch USER_MESSAGES (from Supabase server-side)
      - Build system prompt that includes both variables (USER_MESSAGES and OPPS)
      - Call generate_response(system_prompt, prompt)
      - Return recommendation
    """
    logger.info("=" * 80)
    logger.info("🚀 RECOMMEND OPPORTUNITY ENDPOINT CALLED")
    logger.info("Room code: %s", req.room_code)
    logger.info("Supabase configured: %s", "YES" if supabase else "NO")
    logger.info("=" * 80)
    
    # Acquire OPPS - prioritize displayed_opportunities (current page, up to 5)
    displayed: List[Dict[str, Any]] = []
    OPPS_JSON = None
    
    if req.displayed_opportunities and len(req.displayed_opportunities) > 0:
        # Use the paginated opportunities (current page, up to 5)
        for o in req.displayed_opportunities[:5]:
            displayed.append(
                {
                    "id": getattr(o, "id", None),
                    "name": sanitize_text(getattr(o, "name", ""))[:300],
                    "link": getattr(o, "link", "") or "",
                    "country": sanitize_text(getattr(o, "country", "") or "")[:120],
                }
            )
        logger.info("Using displayed_opportunities from request (current page, count=%d)", len(displayed))
    elif req.opportunities_json:
        # Fallback: Use the full JSON from frontend
        OPPS_JSON = req.opportunities_json
        logger.info("Using opportunities_json from request (full JSON - fallback)")
    elif req.fetch_url:
        try:
            fetched = fetch_from_frontend(req.fetch_url)
            displayed = fetched[:5]
            logger.info("Fetched displayed opportunities from fetch_url (count=%d)", len(displayed))
        except Exception as e:
            logger.exception("Failed to fetch displayed opportunities from fetch_url: %s", e)
            raise HTTPException(status_code=422, detail=f"Failed to fetch displayed opportunities from fetch_url: {e}")
    else:
        raise HTTPException(status_code=400, detail="Either displayed_opportunities, opportunities_json, or fetch_url must be provided.")

    if not displayed and not OPPS_JSON:
        raise HTTPException(status_code=400, detail="No valid opportunities found (after fetching/validation).")

    # Fetch selected country from room (for context in prompt)
    selected_country = None
    if supabase:
        try:
            selected_country = fetch_room_selected_country(req.room_code)
            if selected_country:
                logger.info("Fetched selected_country from DB: '%s' (room_code: %s)", selected_country, req.room_code)
        except Exception as e:
            logger.exception("Failed to fetch selected country: %s", e)
            selected_country = None

    # Fetch USER_MESSAGES from Supabase (server-side)
    try:
        USER_MESSAGES = fetch_room_messages(req.room_code, limit_chars=1200)
        logger.info("Fetched USER_MESSAGES (len=%d)", len(USER_MESSAGES))
    except Exception as e:
        logger.exception("Failed to fetch room messages: %s", e)
        USER_MESSAGES = ""

    # Prepare OPPS variable (JSON string)
    # Prioritize displayed opportunities (current page, up to 5)
    if displayed:
        try:
            OPPS = json.dumps(displayed, ensure_ascii=False, indent=2)
            logger.info("📤 Sending to Gemini - Current page opportunities (count=%d)", len(displayed))
        except Exception:
            OPPS = str(displayed)
    elif OPPS_JSON:
        try:
            OPPS = json.dumps(OPPS_JSON, ensure_ascii=False, indent=2)
            # Log what we're sending to Gemini
            if isinstance(OPPS_JSON, dict):
                keys_in_opps = list(OPPS_JSON.keys())
                logger.info("📤 Sending to Gemini - JSON keys: %s (total opportunities: %d)", 
                           keys_in_opps, sum(len(v) if isinstance(v, list) else 0 for v in OPPS_JSON.values()))
        except Exception:
            OPPS = str(OPPS_JSON)
    else:
        OPPS = "[]"

    # Compose system prompt and user prompt. We embed USER_MESSAGES and OPPS into the system prompt
    system_prompt_template = (
        "You are a concise volunteering advisor. Output exactly one short paragraph (no more than 50 words) "
        "recommending the single best opportunity from the provided list. Start with the opportunity NAME, then a colon, "
        "then a one-sentence reason. If user's chat messages indicate a preference (e.g., 'vegan'), prefer matching opportunity "
        "and mention it in the reason. If essential details are missing, append a second very-short clause (<=15 words) saying what's missing. "
        "Do NOT include bullet lists, emojis, or extra commentary. Keep the answer compact."
    )

    # Now embed variables
    # WARNING: These inserts may be long. We sanitize to avoid control characters.
    user_messages_sanitized = sanitize_text(USER_MESSAGES)
    opps_sanitized = sanitize_text(OPPS)

    # Build context about selected country if applicable
    country_context = ""
    if selected_country:
        country_context = f"\n\nIMPORTANT: The user has selected the country '{selected_country.title()}'. Consider this when making your recommendation. "
    
    system_prompt = (
        system_prompt_template
        + "\n\n"
        + f"The current opportunities the user is viewing (up to 5 from the current page): {opps_sanitized}\n\n"
        + f"Also consider the past user conversation: {user_messages_sanitized}"
        + country_context
        + "\n\nUse the current opportunities and past user conversation to decide which single opportunity to recommend and why."
    )

    # Build a short user prompt that reiterates the task (the heavy context is in system_prompt)
    user_prompt = "Question: Which single opportunity should this user pick, and why? Answer in one short paragraph ≤50 words."

    logger.debug("System prompt length=%d", len(system_prompt))
    logger.debug("User prompt length=%d", len(user_prompt))

    # Call Gemini wrapper
    try:
        logger.info("Calling generate_response (Gemini wrapper)...")
        recommendation = generate_response(system_prompt=system_prompt, prompt=user_prompt)
        if isinstance(recommendation, str):
            recommendation = sanitize_text(recommendation)
        logger.info("Received recommendation (len=%d)", len(recommendation) if recommendation else 0)
        # Count opportunities: prioritize displayed (current page), otherwise count from full JSON
        if displayed:
            opp_count = len(displayed)
        elif OPPS_JSON and isinstance(OPPS_JSON, dict):
            opp_count = sum(len(v) if isinstance(v, list) else 0 for v in OPPS_JSON.values())
        else:
            opp_count = 0
        return RecommendResponse(recommendation=recommendation, analyzed_count=opp_count)
    except Exception as e:
        logger.exception("Error generating recommendation: %s", e)
        raise HTTPException(status_code=502, detail="Failed to generate recommendation from Gemini.")


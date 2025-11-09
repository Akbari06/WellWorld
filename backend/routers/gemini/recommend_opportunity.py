from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
from bs4 import BeautifulSoup
import logging
import os
import re

# supabase client (server-side)
try:
    from supabase import create_client  # supabase-py
except Exception:
    create_client = None

# your Gemini wrapper
from gemini.call_gemini import generate_response

router = APIRouter()
logger = logging.getLogger(__name__)

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
    displayed_opportunities: List[OpportunityLink]  # front-end should send the currently displayed (paginated) opps


class RecommendResponse(BaseModel):
    recommendation: str
    analyzed_count: int


# -----------------------
# Supabase client init
# -----------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
# prefer service role key on server, fall back to anon / generic key
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
)

supabase = None
if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized for fetching messages.")
    except Exception as e:
        supabase = None
        logger.warning(f"Failed to initialize Supabase client: {e}")
else:
    logger.warning("Supabase client not configured (missing env vars or supabase package).")


# -----------------------
# Helpers: sanitization & truncation
# -----------------------
# Remove control characters
_control_re = re.compile(r"[\x00-\x1F\x7F]+")
# Remove astral-plane emoji (some emoji live above U+10000)
_emoji_re = re.compile(r"[\U00010000-\U0010ffff]", flags=re.UNICODE)


def sanitize_text(s: Optional[str]) -> str:
    """Remove control characters and emoji and normalize whitespace."""
    if not s:
        return ""
    # Ensure string
    s = str(s)
    s = _control_re.sub(" ", s)
    try:
        s = _emoji_re.sub("", s)
    except re.error:
        # If the Python build doesn't support astral ranges, fall back to a looser removal:
        s = re.sub(r"[^\x00-\x7F]+", " ", s)
    # collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def trunc(s: Optional[str], n: int) -> str:
    if not s:
        return ""
    s2 = str(s)
    return s2 if len(s2) <= n else s2[: n - 1] + "…"


# -----------------------
# HTML description extraction
# -----------------------
def extract_description_section(html_content: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html_content, "html.parser")
    description_data: Dict[str, Any] = {}

    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "strong", "b"])

    for heading in headings:
        text = heading.get_text(strip=True).lower()

        def get_next_text(h):
            content = h.find_next_sibling(["p", "div", "ul", "ol"])
            if content:
                return content.get_text(separator=" ", strip=True)
            nxt = h.find_next(["p", "div", "span"])
            if nxt:
                return nxt.get_text(separator=" ", strip=True)
            return None

        if "available times" in text or "available time" in text or "availability" in text or text == "time":
            val = get_next_text(heading)
            if val:
                description_data["available_times"] = sanitize_text(trunc(val, 300))

        if "time commitment" in text:
            val = get_next_text(heading)
            if val:
                description_data["time_commitment"] = sanitize_text(trunc(val, 300))

        if "recurrence" in text or "recurring" in text:
            val = get_next_text(heading)
            if val:
                description_data["recurrence"] = sanitize_text(trunc(val, 300))

        if "cost" in text or "fee" in text:
            val = get_next_text(heading)
            if val:
                description_data["cost"] = sanitize_text(trunc(val, 200))

        if "cause areas" in text or "cause" in text:
            val = get_next_text(heading)
            if val:
                description_data["cause_areas"] = sanitize_text(trunc(val, 300))

        if "benefits" in text:
            val = get_next_text(heading)
            if val:
                description_data["benefits"] = sanitize_text(trunc(val, 300))

        if "good for" in text or "goodfor" in text:
            val = get_next_text(heading)
            if val:
                description_data["good_for"] = sanitize_text(trunc(val, 300))

    if not description_data:
        main_content = (
            soup.find("main")
            or soup.find("article")
            or soup.find("div", class_=lambda x: x and ("content" in x.lower() or "description" in x.lower()))
            or soup.body
        )
        if main_content:
            text = main_content.get_text(separator=" ", strip=True)
            description_data["full_text"] = sanitize_text(trunc(text, 1200))

    return description_data


def fetch_opportunity_description(url: Optional[str]) -> Dict[str, Any]:
    """
    Fetch and extract description section from an opportunity URL.
    If no URL provided, return an error note.
    """
    if not url:
        return {"error": "No link provided"}

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; OpportunitiesBot/1.0; +https://yourdomain.example)"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return extract_description_section(response.text)
    except Exception as e:
        logger.debug(f"Failed fetch for {url}: {e}")
        return {"error": str(e)}


# -----------------------
# Supabase messages fetch + filter WorldAI messages
# -----------------------
def _is_worldai_recommendation(msg: str) -> bool:
    """
    Returns True if the message appears to be a WorldAI recommendation (start of the message).
    """
    if not msg:
        return False
    trimmed = str(msg).lstrip().lower()
    snippet = trimmed[:80]
    return "worldai recommendation" in snippet or "🤖 worldai recommendation" in snippet


def fetch_room_messages(room_code: str, limit_chars: int = 1200) -> str:
    """
    Returns concatenated messages for the room (ascending by timestamp),
    truncated to limit_chars characters. Excludes messages that are WorldAI recommendations.
    """
    if not supabase:
        logger.warning("Supabase client not available; skipping message fetch.")
        return ""

    try:
        # supabase-py query
        res = (
            supabase.table("messages")
            .select("user_id, message, created_at")
            .eq("room_code", room_code)
            .order("created_at", {"ascending": True})
            .execute()
        )

        # Adapt to supabase response shapes
        data = None
        if isinstance(res, dict) and "data" in res:
            data = res["data"]
            error = res.get("error")
        else:
            data = getattr(res, "data", None)
            error = getattr(res, "error", None)

        if error:
            logger.warning(f"Error fetching messages from supabase: {error}")
            return ""

        if not data:
            return ""

        lines = []
        total = 0
        for row in data:
            text = (row.get("message") if isinstance(row, dict) else getattr(row, "message", "")) or ""
            # Exclude WorldAI messages
            if _is_worldai_recommendation(text):
                logger.debug(f"Skipping WorldAI recommendation message in room {room_code}: {text[:80]!r}")
                continue

            user = (row.get("user_id") if isinstance(row, dict) else getattr(row, "user_id", "")) or ""
            ts = (row.get("created_at") if isinstance(row, dict) else getattr(row, "created_at", "")) or ""
            # sanitize each piece
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
        logger.exception(f"Exception fetching messages for room {room_code}: {e}")
        return ""


# -----------------------
# Endpoint
# -----------------------
@router.post("/recommend-opportunity", response_model=RecommendResponse)
async def recommend_opportunity(req: RecommendRequest):
    """
    Analyze the CURRENTLY DISPLAYED volunteering opportunities (provided by frontend)
    and recommend the best one using Gemini AI. Also includes chat-room messages (context).
    """
    # Validate input
    if not req.displayed_opportunities or len(req.displayed_opportunities) == 0:
        raise HTTPException(
            status_code=400,
            detail="No displayed_opportunities provided. The frontend should send the currently visible paginated opportunities (up to 5).",
        )

    # Limit to first 5 (safety)
    displayed = req.displayed_opportunities[:5]

    # Fetch room messages (context) from Supabase (shorter default, sanitized)
    chat_context = ""
    try:
        chat_context = fetch_room_messages(req.room_code, limit_chars=1200)
    except Exception as e:
        logger.warning(f"Unable to fetch messages for room {req.room_code}: {e}")
        chat_context = ""

    # Fetch descriptions only for the provided displayed opportunities
    opportunity_data = []
    for opp in displayed:
        logger.info(f"Fetching description for displayed opportunity: {opp.name} ({opp.link})")
        description = fetch_opportunity_description(opp.link)
        # sanitize and truncate extracted fields before storing
        if isinstance(description, dict):
            sanitized_description = {}
            for k, v in description.items():
                sanitized_description[k] = sanitize_text(trunc(v, 400 if k == "full_text" else 300))
        else:
            sanitized_description = {"full_text": sanitize_text(trunc(str(description), 300))}
        opportunity_data.append(
            {
                "id": opp.id,
                "name": sanitize_text(trunc(opp.name, 200)),
                "link": opp.link,
                "country": sanitize_text(trunc(opp.country, 100)),
                "description": sanitized_description,
            }
        )

    # Build system prompt (unchanged guidance)
    system_prompt = """You are an expert advisor for volunteering opportunities.
Analyze the provided volunteering opportunities and recommend the best one based on practical criteria:
- Available Times (when volunteers can participate)
- Time Commitment (how much time is required)
- Recurrence (one-time vs recurring)
- Cost (any fees required)
- Cause Areas (what causes they support)
- Benefits (training, housing, language support, etc.)
- Good For (who can participate: kids, teens, groups, etc.)

Provide a clear, concise recommendation explaining why this opportunity is the best fit.
Focus on practical considerations that help volunteers make informed decisions.
When information is missing, be explicit about assumptions and what additional details you'd need.
"""

    # Build opportunities text for the user prompt (values already sanitized/truncated)
    opportunities_text = ""
    for i, opp_data in enumerate(opportunity_data, start=1):
        opp_text = f"\n{i}. {opp_data['name']} ({opp_data.get('country')})\n"
        opp_text += f"   Link: {opp_data.get('link')}\n"

        desc = opp_data.get("description", {})
        if isinstance(desc, dict) and "error" in desc:
            opp_text += f"   Note: Could not fetch full description ({desc.get('error')})\n"
        else:
            if isinstance(desc, dict):
                if "full_text" in desc:
                    opp_text += f"   - Full Description: {desc['full_text'][:400]}...\n"
                for key, value in desc.items():
                    if key == "full_text":
                        continue
                    opp_text += f"   - {key.replace('_', ' ').title()}: {value[:300]}\n"

        opportunities_text += opp_text

    # Build user prompt including chat context
    user_prompt = "Please analyze these volunteering opportunities and recommend the best one.\n\n"
    if chat_context:
        user_prompt += f"Chatroom context (recent messages from room `{req.room_code}`):\n{chat_context}\n\n"
    else:
        user_prompt += "No chatroom messages available.\n\n"

    user_prompt += f"Opportunities to analyze (only the ones currently displayed):\n{opportunities_text}\n\n"
    user_prompt += "Based on the available information and chat context, which opportunity would you recommend and why? Consider the criteria from the system instructions. If key details are missing, say what you'd want to know.\n"

    # Call Gemini with robust error logging and smaller prompt footprint
    try:
        recommendation = generate_response(system_prompt=system_prompt, prompt=user_prompt)
        return RecommendResponse(recommendation=recommendation, analyzed_count=len(opportunity_data))
    except Exception as e:
        # If the wrapper used requests and raised an HTTPError, try to extract response
        resp = getattr(e, "response", None)
        body_snippet = None
        status = None
        if resp is not None:
            try:
                status = getattr(resp, "status_code", None)
                body = getattr(resp, "text", None) or getattr(resp, "content", None) or ""
                body_snippet = (body[:1000] + "...") if isinstance(body, str) and len(body) > 1000 else body
            except Exception:
                body_snippet = "<unable to read response body>"
        logger.exception("Error generating recommendation (WorldAI/Gemini). status=%s body_snippet=%s err=%s", status, body_snippet, e)
        detail_msg = f"Failed to generate recommendation."
        if status:
            detail_msg += f" External service status={status}."
        if body_snippet:
            detail_msg += f" External message: {body_snippet}"
        # Return 502 (bad gateway) since upstream failed to process
        raise HTTPException(status_code=502, detail=detail_msg)

# backend/routers/gemini/recommend_opportunity.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import requests
from bs4 import BeautifulSoup
import logging

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../'))

from gemini.call_gemini import generate_response

router = APIRouter()

logger = logging.getLogger(__name__)


class OpportunityLink(BaseModel):
    name: str
    link: str
    country: Optional[str] = None


class RecommendRequest(BaseModel):
    opportunities: List[OpportunityLink]


class RecommendResponse(BaseModel):
    recommendation: str
    analyzed_count: int


def extract_description_section(html_content: str) -> Dict[str, Any]:
    """
    Extract description section from HTML content.
    Looks for sections with fields like:
    - Available Times
    - Time Commitment
    - Recurrence
    - Cost
    - Cause Areas
    - Benefits
    - Good For
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    description_data = {}
    
    # Try to find common patterns for description sections
    # Look for headings followed by content
    headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b'])
    
    for heading in headings:
        text = heading.get_text(strip=True).lower()
        
        # Check for key fields
        if 'available times' in text or 'time' in text:
            # Get next sibling or parent content
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['available_times'] = content.get_text(strip=True)
        
        if 'time commitment' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['time_commitment'] = content.get_text(strip=True)
        
        if 'recurrence' in text or 'recurring' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['recurrence'] = content.get_text(strip=True)
        
        if 'cost' in text or 'fee' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['cost'] = content.get_text(strip=True)
        
        if 'cause areas' in text or 'cause' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['cause_areas'] = content.get_text(strip=True)
        
        if 'benefits' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['benefits'] = content.get_text(strip=True)
        
        if 'good for' in text:
            content = heading.find_next_sibling(['p', 'div', 'ul', 'ol'])
            if content:
                description_data['good_for'] = content.get_text(strip=True)
    
    # Also try to extract all text content as fallback
    if not description_data:
        # Get main content area
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=lambda x: x and ('content' in x.lower() or 'description' in x.lower()))
        if main_content:
            description_data['full_text'] = main_content.get_text(separator=' ', strip=True)[:2000]  # Limit to 2000 chars
    
    return description_data


def fetch_opportunity_description(url: str) -> Dict[str, Any]:
    """
    Fetch and extract description section from an opportunity URL.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        description_data = extract_description_section(response.text)
        return description_data
    except Exception as e:
        logger.error(f"Error fetching description from {url}: {str(e)}")
        return {'error': str(e)}


@router.post("/recommend-opportunity", response_model=RecommendResponse)
async def recommend_opportunity(req: RecommendRequest):
    """
    Analyze volunteering opportunities and recommend the best one using Gemini AI.
    Only considers opportunities that are currently displayed on the right-hand side.
    """
    if not req.opportunities:
        raise HTTPException(status_code=400, detail="No opportunities provided")
    
    # Fetch descriptions for all opportunities
    opportunity_data = []
    for opp in req.opportunities:
        logger.info(f"Fetching description for {opp.name} from {opp.link}")
        description = fetch_opportunity_description(opp.link)
        
        opportunity_data.append({
            'name': opp.name,
            'link': opp.link,
            'country': opp.country,
            'description': description
        })
    
    # Build prompt for Gemini
    system_prompt = """You are an expert advisor for volunteering opportunities. 
Analyze the provided volunteering opportunities and recommend the best one based on:
- Available Times (when volunteers can participate)
- Time Commitment (how much time is required)
- Recurrence (one-time vs recurring)
- Cost (any fees required)
- Cause Areas (what causes they support)
- Benefits (training, housing, language support, etc.)
- Good For (who can participate: kids, teens, groups, etc.)

Provide a clear, concise recommendation explaining why this opportunity is the best fit.
Focus on practical considerations that help volunteers make informed decisions."""

    # Format opportunities data for the prompt
    opportunities_text = ""
    for i, opp_data in enumerate(opportunity_data, 1):
        opp_text = f"\n{i}. {opp_data['name']} ({opp_data['country']})\n"
        opp_text += f"   Link: {opp_data['link']}\n"
        
        if 'error' in opp_data['description']:
            opp_text += f"   Note: Could not fetch full description ({opp_data['description']['error']})\n"
        else:
            opp_text += "   Description Details:\n"
            for key, value in opp_data['description'].items():
                if key != 'full_text':
                    opp_text += f"   - {key.replace('_', ' ').title()}: {value}\n"
                else:
                    opp_text += f"   - Full Description: {value[:500]}...\n"  # Truncate long text
        
        opportunities_text += opp_text
    
    user_prompt = f"""Please analyze these volunteering opportunities and recommend the best one:

{opportunities_text}

Based on the available information, which opportunity would you recommend and why? 
Consider all the factors mentioned in your instructions."""

    try:
        # Call Gemini API (generate_response is synchronous)
        recommendation = generate_response(
            system_prompt=system_prompt,
            prompt=user_prompt
        )
        
        return RecommendResponse(
            recommendation=recommendation,
            analyzed_count=len(opportunity_data)
        )
    except Exception as e:
        logger.error(f"Error generating recommendation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendation: {str(e)}")


# backend/routers/volunteering/router.py
import os
import time
import urllib.parse
import platform
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

# Selenium imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

router = APIRouter()

IDEALIST_BASE = "https://www.idealist.org"


class SearchResponse(BaseModel):
    country: str
    found: int
    links: List[str]


class OpportunityLocation(BaseModel):
    url: str
    organization_name: Optional[str] = None
    address: Optional[str] = None
    error: Optional[str] = None


class LocationSearchResponse(BaseModel):
    country: str
    opportunities: List[OpportunityLocation]


def make_chrome_driver(headless: bool = True, try_alternatives: bool = True):
    """
    Create a Chrome webdriver with robust cross-platform options.
    - Use container-friendly flags on Linux.
    - Avoid flags that commonly crash Chrome on Windows/macOS.
    - Block images to speed rendering.
    - If the first startup fails, optionally retry with a safer, minimal option set.
    """
    system = platform.system()
    options = webdriver.ChromeOptions()

    # headless flag (use modern flag when available)
    if headless:
        options.add_argument("--headless=new")

    # Cross-platform safe args
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins-discovery")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--disable-component-extensions-with-background-pages")
    options.add_argument("--window-size=1400,900")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

    # Block images (speed)
    prefs = {"profile.managed_default_content_settings.images": 2}
    options.add_experimental_option("prefs", prefs)

    # Linux-only performance flags (skip on Windows/macOS to avoid crashes)
    if system == "Linux":
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

    # Attempt to set eager page loading
    try:
        options.set_capability("pageLoadStrategy", "eager")
    except Exception:
        pass

    chromedriver_path = ChromeDriverManager().install()
    service = ChromeService(chromedriver_path)

    driver = None
    last_exception = None

    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(0.2)
        return driver
    except WebDriverException as e:
        last_exception = e
        # Fallback 1: try classic '--headless'
        if headless:
            try:
                options2 = webdriver.ChromeOptions()
                options2.add_argument("--headless")
                options2.add_argument("--disable-extensions")
                options2.add_argument("--disable-plugins-discovery")
                options2.add_argument("--disable-software-rasterizer")
                options2.add_argument("--disable-background-timer-throttling")
                options2.add_argument("--disable-backgrounding-occluded-windows")
                options2.add_argument("--disable-renderer-backgrounding")
                options2.add_argument("--disable-component-extensions-with-background-pages")
                options2.add_argument("--window-size=1400,900")
                options2.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                options2.add_experimental_option("prefs", prefs)
                if system == "Linux":
                    options2.add_argument("--no-sandbox")
                    options2.add_argument("--disable-dev-shm-usage")
                driver = webdriver.Chrome(service=service, options=options2)
                driver.implicitly_wait(0.2)
                return driver
            except WebDriverException as e2:
                last_exception = e2
        # Fallback 2: try minimal non-headless (useful for local Windows debugging)
        if try_alternatives:
            try:
                options_min = webdriver.ChromeOptions()
                options_min.add_argument("--window-size=1400,900")
                options_min.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                options_min.add_experimental_option("prefs", prefs)
                driver = webdriver.Chrome(service=service, options=options_min)
                driver.implicitly_wait(0.2)
                return driver
            except WebDriverException as e3:
                last_exception = e3

    raise WebDriverException(f"Could not start Chrome webdriver on platform={system}. Last exception: {repr(last_exception)}")


def _update_query_param(url: str, key: str, value: Any) -> str:
    """Return URL with updated/added query parameter key=value."""
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    qs[key] = [str(value)]
    new_q = urllib.parse.urlencode(qs, doseq=True)
    new = urllib.parse.urlunparse(parsed._replace(query=new_q))
    return new


@router.get("/search", response_model=SearchResponse)
def search_volunteer_links(
    country: str = Query(..., min_length=1, description="Country or location to search, e.g. 'Japan'"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Optional max number of links to return"),
):
    """
    Search Idealist volunteer listings for a given country and return the listing links.
    This version paginates until the site shows the "no results" empty state, or until a safe page cap.
    """
    location_value = country.strip()

    # Build initial search URL with explicit location param
    encoded_location = urllib.parse.quote_plus(location_value)
    initial_search_url = urllib.parse.urljoin(
        IDEALIST_BASE,
        f"/en/volunteer?locale=en&locationType=ONSITE&location={encoded_location}"
    )

    headless_env = os.environ.get("HEADLESS", "1")
    headless = not (headless_env.strip() in ("0", "false", "False", "no", "NO"))

    try:
        driver = make_chrome_driver(headless=headless)
    except WebDriverException as e:
        raise HTTPException(status_code=500, detail=f"Failed to start webdriver: {e}")

    try:
        aggregated = []
        seen = set()
        page = 1
        max_pages = int(os.environ.get("IDEALIST_MAX_PAGES", "50"))  # safety cap
        result_css = 'a[href*="/volunteer-opportunity/"]'
        empty_selector_candidates = [
            'h4.sc-1oq5f4p-0.kwsGXs',  # the "No volunteer opportunities match your search" heading
            '[data-qa-id="search-results-hits-empty-clear-refinements"]'  # the clear filters button in empty state
        ]

        # We'll try the direct location-query approach first. If it doesn't resolve to results,
        # we'll fallback to typing the location into the input and then paginate from the resulting URL.
        current_base_url = initial_search_url

        # Navigate page-by-page until empty state or page cap.
        while page <= max_pages:
            # Build URL with page param
            page_url = _update_query_param(current_base_url, "page", page)
            driver.get(page_url)

            # Wait for either results anchors or the empty state to appear (short timeout)
            try:
                WebDriverWait(driver, 5).until(
                    lambda d: d.find_elements(By.CSS_SELECTOR, result_css) or
                              any(d.find_elements(By.CSS_SELECTOR, sel) for sel in empty_selector_candidates)
                )
            except Exception:
                # No immediate signal — proceed anyway and attempt to extract anchors or check empty state
                pass

            # Check for empty state first
            empty_found = False
            for sel in empty_selector_candidates:
                try:
                    elems = driver.find_elements(By.CSS_SELECTOR, sel)
                    if elems:
                        empty_found = True
                        break
                except Exception:
                    continue

            if empty_found:
                # We've reached an empty page: scrape nothing more, break loop
                break

            # Extract opportunity links quickly via one JS execution (fast)
            try:
                script = """
                const anchors = Array.from(document.querySelectorAll('a[href*="/volunteer-opportunity/"]'));
                const hrefs = anchors.map(a => a.href).filter(Boolean);
                // preserve order and dedupe locally
                const seen = new Set();
                const out = [];
                for (const h of hrefs) {
                    if (!seen.has(h)) {
                        seen.add(h);
                        out.push(h);
                    }
                }
                return out;
                """
                page_hrefs = driver.execute_script(script)
                if not isinstance(page_hrefs, list):
                    page_hrefs = []
            except Exception:
                # fallback slower method
                page_hrefs = []
                try:
                    anchors = driver.find_elements(By.CSS_SELECTOR, result_css)
                    for a in anchors:
                        try:
                            href = a.get_attribute("href")
                            if href:
                                page_hrefs.append(href)
                        except Exception:
                            continue
                except Exception:
                    page_hrefs = []

            # Add to aggregated list preserving order and dedup
            added_this_page = 0
            for h in page_hrefs:
                if h not in seen:
                    seen.add(h)
                    aggregated.append(h)
                    added_this_page += 1
                    if limit and len(aggregated) >= limit:
                        break

            # If we hit the limit, stop early
            if limit and len(aggregated) >= limit:
                break

            # Heuristic: if this page had zero new links, and we didn't hit empty state, it may be a last page —
            # still continue until we detect empty state but avoid infinite loop by checking pages with no new links.
            # We'll continue to next page to verify empty state.
            page += 1

            # If on first page we found no anchors at all, try fallback: load base search and type location
            if page == 2 and not aggregated:
                # Fallback to typing into the location input (site may require autocomplete)
                base_search_url = urllib.parse.urljoin(IDEALIST_BASE, "/en/volunteer?locale=en&locationType=ONSITE")
                driver.get(base_search_url)

                wait = WebDriverWait(driver, 6)
                input_el = None
                selectors = [
                    "#page-header-desktop-search-location",
                    'input[data-qa-id="location-input"]',
                    'input[placeholder*="Everywhere"]',
                    'input[title="Location"]'
                ]
                for selector in selectors:
                    try:
                        input_el = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                        if input_el:
                            break
                    except Exception:
                        input_el = None
                        continue

                if input_el:
                    try:
                        input_el.click()
                        input_el.send_keys(Keys.CONTROL + "a")
                        input_el.send_keys(Keys.DELETE)
                    except Exception:
                        try:
                            input_el.clear()
                        except Exception:
                            pass

                    input_el.send_keys(location_value)
                    # select first suggestion if possible
                    try:
                        input_el.send_keys(Keys.ARROW_DOWN)
                        input_el.send_keys(Keys.RETURN)
                    except Exception:
                        try:
                            suggestion_selectors = [
                                'ul[role="listbox"] li',
                                'li[role="option"]',
                                '.react-autosuggest__suggestion',
                                '.sc-6f0rgt-0 li'
                            ]
                            clicked = False
                            for ssel in suggestion_selectors:
                                try:
                                    items = driver.find_elements(By.CSS_SELECTOR, ssel)
                                    if items:
                                        items[0].click()
                                        clicked = True
                                        break
                                except Exception:
                                    continue
                            if not clicked:
                                input_el.send_keys(Keys.RETURN)
                        except Exception:
                            input_el.send_keys(Keys.RETURN)

                    # Wait briefly and then set the current_base_url to the current page URL (so pagination continues correctly)
                    try:
                        WebDriverWait(driver, 5).until(
                            lambda d: d.find_elements(By.CSS_SELECTOR, result_css) or
                                      any(d.find_elements(By.CSS_SELECTOR, sel) for sel in empty_selector_candidates)
                        )
                    except Exception:
                        pass

                    current_base_url = driver.current_url
                    # Reset page counter to 1 to begin paginating from the result URL
                    page = 1
                    continue  # continue outer while loop to handle page=1 of the typed-results

                else:
                    # input not found - nothing to do, continue paginating the URL approach
                    current_base_url = initial_search_url

        # Done paginating
        # Trim to requested limit
        if limit:
            aggregated = aggregated[:limit]

        return SearchResponse(country=country, found=len(aggregated), links=aggregated)

    except Exception as e:
        # Surface a helpful message
        raise HTTPException(status_code=500, detail=f"Error during scraping: {str(e)}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

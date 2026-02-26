"""Node 1 — Brand Researcher.

Researches a brand from its domain using Firecrawl search + homepage scraping,
then extracts structured brand context via the LLM.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from bs4 import BeautifulSoup
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.agent.state import AgentState
from app.agent.tools.web_search import search_brand
from app.config import settings

logger = logging.getLogger(__name__)


# ── Structured output schema ────────────────────────────────────────────────
class BrandInfo(BaseModel):
    """Structured information about a brand extracted by the LLM."""

    brand_name: str = Field(description="The product / brand name")
    description: str = Field(
        description="What the product is (1–2 sentences)"
    )
    problem_solved: str = Field(
        description="What pain point it addresses"
    )
    target_audience: str = Field(description="Who uses it")
    market_category: str = Field(
        description="The market/industry it operates in (e.g. B2B SaaS, e-commerce)"
    )
    key_features: list[str] = Field(
        description="Top 5 features of the product"
    )
    competitors: list[str] = Field(
        description="3–5 known competitors"
    )
    value_proposition: str = Field(
        description="The main value proposition"
    )


# ── Helper: scrape homepage ─────────────────────────────────────────────────
async def _scrape_homepage(domain: str) -> str:
    """Fetch the homepage HTML and return visible text (best-effort)."""
    url = f"https://{domain}"
    try:
        async with httpx.AsyncClient(
            timeout=15, follow_redirects=True, 
        ) as client:
            logger.info("Scraping homepage | url=%s", url)
            resp = await client.get(url)
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove script / style tags
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        # Truncate to avoid blowing up the LLM context
        return text[:6000]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to scrape homepage for %s: %s", domain, exc)
        return ""


# ── Node function ───────────────────────────────────────────────────────────
def brand_researcher(state: AgentState) -> dict[str, Any]:
    """Research the brand and store structured context in state."""
    domain = state["domain"]
    logger.info("[brand_researcher] START | domain=%s", domain)

    try:
        # 1. Web search
        search_results = search_brand(
            f'"{ domain}" product features reviews', max_results=10
        )
        search_text = "\n\n".join(
            f"**{r.get('title', '')}** ({r.get('url', '')})\n{r.get('content', '')}"
            for r in search_results
        )

        # 2. Scrape homepage
        homepage_text = _scrape_homepage(domain)

        # 3. LLM structured extraction
        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0,
            max_tokens=2048,
        )
        structured_llm = llm.with_structured_output(BrandInfo)

        extraction_prompt = (
            "You are a brand analyst. Based on the data below, extract structured "
            "information about the brand/product associated with the domain "
            f"**{domain}**.\n\n"
            "--- WEB SEARCH RESULTS ---\n"
            f"{search_text}\n\n"
            "--- HOMEPAGE TEXT ---\n"
            f"{homepage_text}\n\n"
            "Return all requested fields. If a field cannot be determined, "
            "make a reasonable inference or state 'Unknown'."
        )

        brand_info: BrandInfo = structured_llm.invoke(extraction_prompt)  # type: ignore[assignment]

        brand_context = brand_info.model_dump()
        logger.info(
            "[brand_researcher] DONE | brand_name=%s", brand_context["brand_name"]
        )
        return {
            "brand_name": brand_context["brand_name"],
            "brand_context": brand_context,
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("[brand_researcher] ERROR | domain=%s", domain)
        return {"error": f"Brand research failed: {exc}"}

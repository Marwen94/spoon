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
from app.agent.prompts import BRAND_RESEARCHER_SYSTEM, BRAND_RESEARCHER_USER_TEMPLATE
from app.config import settings
from app.services.db_service import db_service

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
            timeout=15.0, follow_redirects=True, 
        ) as client:
            logger.info("Scraping homepage | url=%s", url)
            resp = await client.get(url)
            resp.raise_for_status()
            text = resp.text
            
        soup = BeautifulSoup(text, "html.parser")
        # Remove script / style tags
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        clean_text = soup.get_text(separator=" ", strip=True)
        # Truncate to avoid blowing up the LLM context
        return clean_text[:6000]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to scrape homepage for %s: %s", domain, exc)
        return ""


# ── Node function ───────────────────────────────────────────────────────────
async def brand_researcher(state: AgentState) -> dict[str, Any]:
    """Research the brand and store structured context in state."""
    domain = state["domain"]
    logger.info("[brand_researcher] START | domain=%s", domain)

    try:
        # 0. Ensure domain exists in DB
        await db_service.ensure_domain_exists(domain)

        # 1. Web search
        # We need to run synchronous tool in a thread if we want to keep async loop clean,
        # but web_search.search_brand is likely synchronous. 
        # For simplicity in this node, we can just call it directly or wrap it if needed.
        # Assuming search_brand is blocking but fast enough or we accept it blocks loop briefly.
        search_results = search_brand(
            f'"{ domain}" product features reviews', max_results=10
        )
        search_text = "\n\n".join(
            f"**{r.get('title', '')}** ({r.get('url', '')})\n{r.get('content', '')}"
            for r in search_results
        )

        # 2. Scrape homepage
        homepage_text = await _scrape_homepage(domain)

        # 3. LLM structured extraction
        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0,
            max_tokens=2048,
        )
        structured_llm = llm.with_structured_output(BrandInfo)
        
        # Invoke LLM
        # with_structured_output returns a runnable, so we invoke it.
        # Invoke is synchronous, so we might want to wrap it in run_in_executor if we want full async,
        # but for now let's use ainvoke if available or just invoke.
        # ChatOpenAI supports ainvoke.
        
        res = await structured_llm.ainvoke(
            [
                {
                    "role": "system",
                    "content": BRAND_RESEARCHER_SYSTEM,
                },
                {
                    "role": "user",
                    "content": BRAND_RESEARCHER_USER_TEMPLATE.format(
                        domain=domain,
                        homepage_text=homepage_text,
                        search_text=search_text
                    ),
                },
            ]
        )

        brand_context = res.model_dump()
        logger.info(
            "[brand_researcher] DONE | brand=%s", brand_context.get("brand_name")
        )

        # Save brand identity to DB
        await db_service.update_brand_identity(domain, brand_context)

        return {
            "brand_name": brand_context.get("brand_name"),
            "brand_context": brand_context,
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("[brand_researcher] ERROR | domain=%s", domain)
        return {"error": f"Brand research failed: {exc}"}

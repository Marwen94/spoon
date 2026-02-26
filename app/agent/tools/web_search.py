"""Firecrawl Search API wrapper for brand research."""

from __future__ import annotations

import logging

from firecrawl import FirecrawlApp

from app.config import settings

logger = logging.getLogger(__name__)


def search_brand(query: str, max_results: int = 10) -> list[dict]:
    """Run a Firecrawl web search and return a list of result dicts.

    Each dict contains keys: ``title``, ``url``, ``content`` (snippet).
    """
    logger.info("Firecrawl search | query=%s max_results=%d", query, max_results)
    app = FirecrawlApp(api_key=settings.FIRECRAWL_API_KEY)

    response = app.search(query, params={"limit": max_results})
    results = []
    # Firecrawl search returns a SearchResponse with a `data` list
    data = response.get("data", []) if isinstance(response, dict) else getattr(response, "data", [])
    for item in data:
        if isinstance(item, dict):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("markdown", item.get("description", "")),
            })
        else:
            # Object-style response
            results.append({
                "title": getattr(item, "title", ""),
                "url": getattr(item, "url", ""),
                "content": getattr(item, "markdown", getattr(item, "description", "")),
            })

    logger.info("Firecrawl search returned %d results", len(results))
    return results

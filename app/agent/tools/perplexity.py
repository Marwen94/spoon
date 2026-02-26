"""Perplexity API tool – wrapper using the official Perplexity Python SDK."""

from __future__ import annotations

import logging
from typing import Any

from perplexity import Perplexity

from app.config import settings

logger = logging.getLogger(__name__)

INSTRUCTIONS = (
    "You are a helpful assistant. Answer the user's question thoroughly "
    "and include relevant tools, products, or services where appropriate. "
    "You have access to a web_search tool. Use it for questions about "
    "current events, products, or recent developments. "
    "NEVER ask permission to search - just search when appropriate."
)


def _get_client() -> Perplexity:
    """Build a Perplexity client.

    The SDK automatically reads the PERPLEXITY_API_KEY environment variable,
    but we pass it explicitly for clarity.
    """
    return Perplexity(api_key=settings.PERPLEXITY_API_KEY)


def _extract_citations(response: Any) -> list[str]:
    """Extract citation URLs from search_results in the response output."""
    citations: list[str] = []
    # In Agent API (responses.create), citations are often found in the 'output' items
    # specifically those of type 'search_results'
    for item in getattr(response, "output", []):
        if getattr(item, "type", None) == "search_results":
            for result in getattr(item, "results", []):
                url = getattr(result, "url", None)
                if url:
                    citations.append(url)
    # Also check if citations are directly on the response object (some SDK versions)
    if not citations:
        citations = getattr(response, "citations", [])
    return citations


def query_perplexity(prompt: str) -> dict[str, Any]:
    """Send a single prompt to Perplexity and return a normalised dict.

    Returns a dict with keys ``choices`` (for backwards-compat) and
    ``citations`` so downstream code can process the result uniformly.
    """
    logger.info("Perplexity query | prompt=%s", prompt[:80])
    client = _get_client()

    # Use the Agent API responses.create with pro-search preset
    # This automatically includes web search and optimized reasoning
    response = client.responses.create(
        preset="pro-search",
        input=prompt,
    )

    # Use the convenience property output_text as recommended in documentation
    completion_text = response.output_text or ""

    # Extract citations using the helper
    citations = _extract_citations(response)

    # Build a normalised dict (mimics old structure for downstream code)
    raw: dict[str, Any] = {
        "id": response.id,
        "model": getattr(response, "model", "pro-search"),
        "status": response.status,
        "choices": [
            {"message": {"content": completion_text}}
        ],
        "citations": citations,
        "usage": response.usage.model_dump() if response.usage else {},
    }

    logger.info("Perplexity response received | prompt=%s", prompt[:80])
    return raw

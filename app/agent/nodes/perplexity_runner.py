"""Node 3 — Perplexity Runner.

Runs all generated prompts against Perplexity in parallel using
concurrent.futures and builds a list of PerplexityResult objects.
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.agent.state import AgentState, PerplexityResult
from app.agent.tools.perplexity import query_perplexity
from app.config import settings

logger = logging.getLogger(__name__)


def _extract_mention_context(text: str, brand_name: str) -> str:
    """Return the sentence(s) in *text* that mention *brand_name*."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    matches = [
        s.strip()
        for s in sentences
        if brand_name.lower() in s.lower()
    ]
    return " ".join(matches) if matches else ""


def _run_single_prompt(
    prompt: str,
    brand_name: str,
) -> PerplexityResult:
    """Query Perplexity for a single prompt and return a PerplexityResult."""
    try:
        raw = query_perplexity(prompt)

        # Extract completion text
        completion = ""
        choices = raw.get("choices", [])
        if choices:
            completion = choices[0].get("message", {}).get("content", "")

        # Extract citations
        citations: list[str] = raw.get("citations", [])

        # Brand detection (case-insensitive)
        brand_mentioned = brand_name.lower() in completion.lower()
        mention_context = (
            _extract_mention_context(completion, brand_name)
            if brand_mentioned
            else ""
        )

        return PerplexityResult(
            prompt=prompt,
            raw_response=raw,
            completion=completion,
            citations=citations,
            brand_mentioned=brand_mentioned,
            brand_mention_context=mention_context,
        )

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Perplexity sub-task failed | prompt=%s error=%s",
            prompt[:60],
            exc,
        )
        return PerplexityResult(
            prompt=prompt,
            raw_response={"error": str(exc)},
            completion="",
            citations=[],
            brand_mentioned=False,
            brand_mention_context="",
        )


def perplexity_runner(state: AgentState) -> dict[str, Any]:
    """Run all prompts against Perplexity in parallel."""
    prompts = state["generated_prompts"]
    brand_name = state["brand_name"]
    domain = state["domain"]
    logger.info(
        "[perplexity_runner] START | domain=%s prompts=%d",
        domain,
        len(prompts),
    )

    try:
        results: list[PerplexityResult] = []
        max_workers = min(settings.PERPLEXITY_MAX_WORKERS, len(prompts))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(_run_single_prompt, prompt, brand_name): prompt
                for prompt in prompts
            }
            for future in as_completed(futures):
                results.append(future.result())

        mentioned = sum(1 for r in results if r.brand_mentioned)
        logger.info(
            "[perplexity_runner] DONE | mentioned=%d/%d",
            mentioned,
            len(results),
        )
        return {"perplexity_results": results}

    except Exception as exc:  # noqa: BLE001
        logger.exception("[perplexity_runner] ERROR | domain=%s", domain)
        return {"error": f"Perplexity runner failed: {exc}"}

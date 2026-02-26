"""Node 4 — Report Generator.

Aggregates Perplexity results into a structured ExposureReport.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from langchain_openai import ChatOpenAI

from app.agent.state import AgentState
from app.config import settings

logger = logging.getLogger(__name__)


def report_generator(state: AgentState) -> dict[str, Any]:
    """Compute metrics and build the final exposure report."""
    domain = state["domain"]
    brand_name = state["brand_name"]
    results = state["perplexity_results"]
    logger.info("[report_generator] START | domain=%s", domain)

    try:
        total = len(results)
        mentioned_count = sum(1 for r in results if r.brand_mentioned)
        not_mentioned_count = total - mentioned_count
        exposure_rate = (mentioned_count / total * 100) if total > 0 else 0.0

        # Build appeared / not-appeared sections
        appeared_examples: list[dict[str, Any]] = []
        not_appeared_examples: list[dict[str, Any]] = []

        for r in results:
            if r.brand_mentioned:
                appeared_examples.append(
                    {
                        "prompt": r.prompt,
                        "mention_context": r.brand_mention_context,
                        "sources": r.citations,
                    }
                )
            else:
                not_appeared_examples.append(
                    {
                        "prompt": r.prompt,
                        "sources": r.citations,
                        "completion_summary": r.completion[:300] if r.completion else "",
                    }
                )

        # LLM-generated narrative summary
        summary_input = (
            f"Brand: {brand_name}\n"
            f"Domain: {domain}\n"
            f"Exposure rate: {exposure_rate:.1f}% ({mentioned_count}/{total} prompts)\n\n"
            "The brand appeared in the following prompts:\n"
            + "\n".join(f"- {e['prompt']}" for e in appeared_examples)
            + "\n\nThe brand did NOT appear in:\n"
            + "\n".join(f"- {e['prompt']}" for e in not_appeared_examples)
        )

        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0,
            max_tokens=512,
        )
        summary_response = llm.invoke(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a marketing analyst. Write a concise 2–3 sentence "
                        "narrative summarising the brand's exposure on Perplexity AI. "
                        "Be factual and actionable."
                    ),
                },
                {"role": "user", "content": summary_input},
            ]
        )
        summary_text = str(summary_response.content).strip()

        report = {
            "domain": domain,
            "brand_name": brand_name,
            "exposure_rate": round(exposure_rate, 1),
            "total_prompts": total,
            "brand_mentioned_count": mentioned_count,
            "brand_not_mentioned_count": not_mentioned_count,
            "appeared_examples": appeared_examples,
            "not_appeared_examples": not_appeared_examples,
            "summary": summary_text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(
            "[report_generator] DONE | exposure_rate=%.1f%%", exposure_rate
        )
        return {"report": report}

    except Exception as exc:  # noqa: BLE001
        logger.exception("[report_generator] ERROR | domain=%s", domain)
        return {"error": f"Report generation failed: {exc}"}

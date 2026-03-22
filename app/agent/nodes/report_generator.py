"""Node 4 — Report Generator.

Aggregates Perplexity results into a structured ExposureReport.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from langchain_openai import ChatOpenAI

from app.agent.state import AgentState
from app.agent.prompts import REPORT_SUMMARY_SYSTEM, REPORT_SUMMARY_USER_TEMPLATE
from app.config import settings
from app.services.db_service import db_service

logger = logging.getLogger(__name__)


async def report_generator(state: AgentState) -> dict[str, Any]:
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
                        "completion_summary": r.completion if r.completion else "",
                    }
                )

        # LLM-generated narrative summary
        summary_input = REPORT_SUMMARY_USER_TEMPLATE.format(
            brand_name=brand_name,
            domain=domain,
            exposure_rate=exposure_rate,
            mentioned_count=mentioned_count,
            total=total,
            appeared_list="\n".join(f"- {e['prompt']}" for e in appeared_examples) if appeared_examples else "None",
            not_appeared_list="\n".join(f"- {e['prompt']}" for e in not_appeared_examples) if not_appeared_examples else "None"
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
                    "content": REPORT_SUMMARY_SYSTEM,
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
            "[report_generator] DONE | domain=%s | rate=%.1f%%",
            domain,
            exposure_rate,
        )

        # Persist results to Database (Prisma)
        await db_service.save_analysis_result(domain, report)

        return {"report": report}

    except Exception as exc:  # noqa: BLE001
        logger.exception("[report_generator] ERROR | domain=%s", domain)
        return {"error": f"Report generation failed: {exc}"}

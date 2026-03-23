"""Node 2 — Prompt Generator.

Generates 10 realistic user prompts that someone might type into Perplexity
where the brand *should ideally* appear — without mentioning the brand by name.
"""

from __future__ import annotations

import json
import logging
import asyncio
from typing import Any

from langchain_openai import ChatOpenAI

from app.agent.state import AgentState
from app.agent.prompts import PROMPT_GENERATOR_SYSTEM, PROMPT_GENERATOR_USER_TEMPLATE
from app.config import settings
from app.services.db_service import db_service

logger = logging.getLogger(__name__)


async def prompt_generator(state: AgentState) -> dict[str, Any]:
    """Generate Perplexity-style prompts from the brand context."""
    brand_context = state["brand_context"]
    domain = state["domain"]
    count = state.get("prompts_count", settings.PROMPTS_COUNT)
    logger.info("[prompt_generator] START | domain=%s | count=%d", domain, count)

    try:
        # Fetch previously generated prompts
        previous_prompts = await db_service.get_previous_prompts_for_domain(domain)
        previous_prompts_list = "\n".join([f"- {p}" for p in previous_prompts]) if previous_prompts else "None"

        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
            max_tokens=2048,
        )

        user_msg = PROMPT_GENERATOR_USER_TEMPLATE.format(
            brand_context_json=json.dumps(brand_context, indent=2),
            previous_prompts_list=previous_prompts_list,
            count=count
        )

        response = await llm.ainvoke(
            [
                {"role": "system", "content": PROMPT_GENERATOR_SYSTEM.format(count=count)},
                {"role": "user", "content": user_msg},
            ]
        )

        # Parse the JSON array from the response
        raw = response.content
        if isinstance(raw, list):
            # LangChain may return content blocks
            raw = "".join(
                block["text"] if isinstance(block, dict) else str(block)
                for block in raw
            )

        # Extract JSON array from potential markdown fences
        text = str(raw).strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]  # remove opening fence line
            text = text.rsplit("```", 1)[0]  # remove closing fence
        prompts: list[str] = json.loads(text)

        if not isinstance(prompts, list) or len(prompts) == 0:
            raise ValueError("LLM did not return a valid list of prompts")

        # Enforce exact count
        prompts = prompts[:count]

        logger.info(
            "[prompt_generator] DONE | generated %d prompts", len(prompts)
        )
        return {"generated_prompts": prompts}

    except Exception as exc:  # noqa: BLE001
        logger.exception("[prompt_generator] ERROR | domain=%s", domain)
        return {"error": f"Prompt generation failed: {exc}"}

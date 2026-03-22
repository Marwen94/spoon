"""Node 2 — Prompt Generator.

Generates 10 realistic user prompts that someone might type into Perplexity
where the brand *should ideally* appear — without mentioning the brand by name.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import ChatOpenAI

from app.agent.state import AgentState
from app.agent.prompts import PROMPT_GENERATOR_SYSTEM, PROMPT_GENERATOR_USER_TEMPLATE
from app.config import settings

logger = logging.getLogger(__name__)


def prompt_generator(state: AgentState) -> dict[str, Any]:
    """Generate Perplexity-style prompts from the brand context."""
    brand_context = state["brand_context"]
    domain = state["domain"]
    count = state.get("prompts_count", settings.PROMPTS_COUNT)
    logger.info("[prompt_generator] START | domain=%s | count=%d", domain, count)

    try:
        llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
            max_tokens=2048,
        )

        user_msg = PROMPT_GENERATOR_USER_TEMPLATE.format(
            brand_context_json=json.dumps(brand_context, indent=2),
            count=count
        )

        response = llm.invoke(
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

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
from app.config import settings

logger = logging.getLogger(__name__)

GENERATION_SYSTEM = (
    "You are an expert at writing realistic search queries that real people "
    "type into AI assistants like Perplexity. You will be given context about "
    "a brand and must generate exactly {count} prompts.\n\n"
    "RULES:\n"
    "- Prompts must NOT mention the brand by name.\n"
    "- They should be generic queries in the brand's domain/market.\n"
    "- Cover a variety of intents:\n"
    "  • Comparison queries (\"What is the best X for Y use case?\")\n"
    "  • Problem-solving queries (\"How do I solve X problem?\")\n"
    "  • Recommendation queries (\"What tools do professionals use for X?\")\n"
    "  • Alternative queries (\"What are alternatives to [competitor]?\")\n"
    "  • Discovery queries (\"What are the top X tools in [market category]?\")\n"
    "- Prompts should be at the difficulty/specificity level an informed user "
    "in this domain would ask.\n\n"
    "Return ONLY a JSON array of exactly {count} strings. No explanation."
)


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

        user_msg = (
            "Here is the brand context:\n\n"
            f"{json.dumps(brand_context, indent=2)}\n\n"
            f"Generate exactly {count} prompts following the rules in the system message."
        )

        response = llm.invoke(
            [
                {"role": "system", "content": GENERATION_SYSTEM.format(count=count)},
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

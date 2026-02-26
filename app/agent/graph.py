"""LangGraph graph definition.

Builds a sequential StateGraph with conditional error handling:

    START → brand_researcher → prompt_generator → perplexity_runner → report_generator → END

If any node sets ``state["error"]``, the graph short-circuits to END.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from langgraph.graph import END, StateGraph

from app.agent.nodes.brand_researcher import brand_researcher
from app.agent.nodes.perplexity_runner import perplexity_runner
from app.agent.nodes.prompt_generator import prompt_generator
from app.agent.nodes.report_generator import report_generator
from app.agent.state import AgentState
from app.config import settings

logger = logging.getLogger(__name__)


# ── Conditional edges ───────────────────────────────────────────────────────

def _check_error(state: AgentState) -> Literal["continue", "end"]:
    """Route to END if an error has been recorded, otherwise continue."""
    if state.get("error"):
        return "end"
    return "continue"


# ── Graph construction ──────────────────────────────────────────────────────

def build_graph() -> Any:
    """Construct and compile the LangGraph StateGraph."""
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("brand_researcher", brand_researcher)
    graph.add_node("prompt_generator", prompt_generator)
    graph.add_node("perplexity_runner", perplexity_runner)
    graph.add_node("report_generator", report_generator)

    # Entry point
    graph.set_entry_point("brand_researcher")

    # Conditional edges: after each node, check for errors
    graph.add_conditional_edges(
        "brand_researcher",
        _check_error,
        {"continue": "prompt_generator", "end": END},
    )
    graph.add_conditional_edges(
        "prompt_generator",
        _check_error,
        {"continue": "perplexity_runner", "end": END},
    )
    graph.add_conditional_edges(
        "perplexity_runner",
        _check_error,
        {"continue": "report_generator", "end": END},
    )
    graph.add_edge("report_generator", END)

    return graph.compile()


# Compiled graph singleton
compiled_graph = build_graph()


# ── Public interface ────────────────────────────────────────────────────────

async def run_graph(domain: str, prompts_count: int = 5) -> dict[str, Any]:
    """Run the full evaluation workflow for *domain*.

    The graph nodes are synchronous, so we run the compiled graph
    in a thread to keep the FastAPI event loop free.
    """
    initial_state: AgentState = {
        "domain": domain,
        "prompts_count": prompts_count,
        "brand_name": "",
        "brand_context": {},
        "generated_prompts": [],
        "perplexity_results": [],
        "report": {},
        "error": None,
    }

    logger.info("Starting graph for domain=%s", domain)

    result = await asyncio.wait_for(
        asyncio.to_thread(compiled_graph.invoke, initial_state),
        timeout=settings.WORKFLOW_TIMEOUT,
    )

    logger.info("Graph finished for domain=%s", domain)
    return dict(result)

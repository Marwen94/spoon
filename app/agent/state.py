"""Agent state definition that flows through the LangGraph graph."""

from __future__ import annotations

from typing import Optional, TypedDict

from pydantic import BaseModel


class PerplexityResult(BaseModel):
    """Result of a single Perplexity API query."""

    prompt: str
    raw_response: dict  # full API response from Perplexity
    completion: str  # the text answer
    citations: list[str]  # list of source URLs
    brand_mentioned: bool  # whether the brand appeared
    brand_mention_context: str  # the sentence(s) where brand was mentioned


class AgentState(TypedDict):
    """Shared state that is passed between every node in the graph."""

    domain: str
    brand_name: str
    brand_context: dict  # researched brand info
    prompts_count: int  # number of prompts to generate
    generated_prompts: list[str]
    perplexity_results: list[PerplexityResult]
    report: dict  # final computed report
    error: Optional[str]

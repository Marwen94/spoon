"""Tests for individual agent nodes."""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from app.agent.state import AgentState, PerplexityResult


# ── Helpers ──────────────────────────────────────────────────────────────────

def _base_state(**overrides) -> AgentState:
    """Return a minimal AgentState with sensible defaults."""
    state: AgentState = {
        "domain": "example.com",
        "brand_name": "Example",
        "brand_context": {
            "brand_name": "Example",
            "description": "An example product.",
            "problem_solved": "Testing.",
            "target_audience": "Developers",
            "market_category": "B2B SaaS",
            "key_features": ["Fast", "Reliable"],
            "competitors": ["Rival"],
            "value_proposition": "Best example ever.",
        },
        "generated_prompts": [],
        "perplexity_results": [],
        "report": {},
        "error": None,
    }
    state.update(overrides)  # type: ignore[typeddict-item]
    return state


# ── brand_researcher tests ───────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _mock_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-key")
    monkeypatch.setenv("PERPLEXITY_API_KEY", "test-key")


@pytest.mark.asyncio
async def test_brand_researcher_success() -> None:
    """brand_researcher returns brand_name and brand_context on success."""
    from app.agent.nodes.brand_researcher import brand_researcher, BrandInfo

    fake_info = BrandInfo(
        brand_name="TestBrand",
        description="A testing tool.",
        problem_solved="Automated QA.",
        target_audience="QA engineers",
        market_category="B2B SaaS",
        key_features=["Feature 1", "Feature 2", "Feature 3", "Feature 4", "Feature 5"],
        competitors=["Rival1", "Rival2", "Rival3"],
        value_proposition="Best QA tool.",
    )

    with (
        patch(
            "app.agent.nodes.brand_researcher.search_brand",
            return_value=[{"title": "T", "url": "https://example.com", "content": "C"}],
        ),
        patch(
            "app.agent.nodes.brand_researcher._scrape_homepage",
            return_value="Welcome to TestBrand",
        ),
        patch(
            "app.agent.nodes.brand_researcher.ChatOpenAI"
        ) as mock_llm_cls,
    ):
        # Mock the structured LLM chain
        mock_structured = MagicMock(return_value=fake_info)
        mock_llm_instance = MagicMock()
        mock_llm_instance.with_structured_output.return_value = MagicMock(
            invoke=mock_structured
        )
        mock_llm_cls.return_value = mock_llm_instance

        state = _base_state()
        result = brand_researcher(state)

    assert result["brand_name"] == "TestBrand"
    assert result["brand_context"]["market_category"] == "B2B SaaS"


# ── perplexity_runner tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_perplexity_runner_detects_brand() -> None:
    """perplexity_runner sets brand_mentioned=True when brand name appears."""
    from app.agent.nodes.perplexity_runner import perplexity_runner

    fake_perplexity_response = {
        "choices": [
            {
                "message": {
                    "content": (
                        "There are many great tools. Example is one of the "
                        "best options for this use case. It provides fast results."
                    )
                }
            }
        ],
        "citations": ["https://example.com", "https://other.com"],
    }

    with patch(
        "app.agent.nodes.perplexity_runner.query_perplexity",
        return_value=fake_perplexity_response,
    ):
        state = _base_state(
            generated_prompts=["What are the best tools for testing?"]
        )
        result = perplexity_runner(state)

    results = result["perplexity_results"]
    assert len(results) == 1
    assert results[0].brand_mentioned is True
    assert "Example" in results[0].brand_mention_context


@pytest.mark.asyncio
async def test_perplexity_runner_no_mention() -> None:
    """perplexity_runner sets brand_mentioned=False when brand is absent."""
    from app.agent.nodes.perplexity_runner import perplexity_runner

    fake_perplexity_response = {
        "choices": [
            {
                "message": {
                    "content": "Some tools include Rival and OtherTool."
                }
            }
        ],
        "citations": ["https://rival.com"],
    }

    with patch(
        "app.agent.nodes.perplexity_runner.query_perplexity",
        return_value=fake_perplexity_response,
    ):
        state = _base_state(
            generated_prompts=["What are the best tools?"]
        )
        result = perplexity_runner(state)

    results = result["perplexity_results"]
    assert len(results) == 1
    assert results[0].brand_mentioned is False

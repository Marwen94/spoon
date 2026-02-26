"""Tests for the FastAPI endpoints."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


# We need to mock settings before importing the app so it doesn't fail
# when .env is missing in the test environment.
@pytest.fixture(autouse=True)
def _mock_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-key")
    monkeypatch.setenv("PERPLEXITY_API_KEY", "test-key")


@pytest.fixture()
def client() -> TestClient:
    # Import inside fixture so env vars are already patched
    from app.main import app

    return TestClient(app)


def test_health(client: TestClient) -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_evaluate_invalid_domain(client: TestClient) -> None:
    resp = client.post("/api/v1/evaluate", json={"domain": "not valid!"})
    assert resp.status_code == 422  # Pydantic validation error


def test_evaluate_success(client: TestClient) -> None:
    """POST /evaluate returns an ExposureReport when the graph succeeds."""
    fake_report = {
        "domain": "example.com",
        "brand_name": "Example",
        "exposure_rate": 40.0,
        "total_prompts": 10,
        "brand_mentioned_count": 4,
        "brand_not_mentioned_count": 6,
        "appeared_examples": [
            {
                "prompt": "What are the best widgets?",
                "mention_context": "Example is a top widget.",
                "sources": ["https://example.com"],
            }
        ],
        "not_appeared_examples": [
            {
                "prompt": "How to fix a broken widget?",
                "sources": ["https://other.com"],
                "completion_summary": "You can try ...",
            }
        ],
        "summary": "Example appears in 40% of queries.",
        "generated_at": "2026-02-25T10:00:00+00:00",
    }

    mock_run = AsyncMock(
        return_value={"report": fake_report, "error": None}
    )

    with patch("app.api.routes.run_graph", mock_run):
        resp = client.post(
            "/api/v1/evaluate", json={"domain": "example.com"}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["domain"] == "example.com"
    assert data["exposure_rate"] == 40.0
    assert len(data["appeared_examples"]) == 1


def test_evaluate_graph_error(client: TestClient) -> None:
    """POST /evaluate returns 500 when the graph sets an error."""
    mock_run = AsyncMock(
        return_value={"report": {}, "error": "Something broke"}
    )

    with patch("app.api.routes.run_graph", mock_run):
        resp = client.post(
            "/api/v1/evaluate", json={"domain": "example.com"}
        )

    assert resp.status_code == 500
    assert "Something broke" in resp.json()["detail"]

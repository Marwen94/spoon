"""FastAPI route definitions."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.agent.graph import run_graph
from app.models.requests import EvaluateRequest
from app.models.responses import ErrorResponse, ExposureReport, HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Simple liveness / readiness probe."""
    return HealthResponse()


@router.post(
    "/evaluate",
    response_model=ExposureReport,
    responses={500: {"model": ErrorResponse}},
)
async def evaluate(body: EvaluateRequest) -> ExposureReport:
    """Evaluate brand exposure on Perplexity AI for the given domain."""
    logger.info("POST /evaluate | domain=%s", body.domain)

    try:
        state = await run_graph(body.domain, body.prompts_count)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Workflow timed out")
    except Exception as exc:
        logger.exception("Workflow failed for domain=%s", body.domain)
        raise HTTPException(status_code=500, detail=str(exc))

    if state.get("error"):
        raise HTTPException(status_code=500, detail=state["error"])

    report_data = state.get("report")
    if not report_data:
        raise HTTPException(
            status_code=500, detail="No report generated — unknown error"
        )

    return ExposureReport(**report_data)

"""FastAPI route definitions."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.agent.graph import run_graph
from app.models.requests import EvaluateRequest, DomainCreateRequest, DomainUpdateRequest
from app.models.responses import (
    ErrorResponse, ExposureReport, HealthResponse, 
    DomainListResponse, DomainResponse, DomainReportsResponse, ReportHistoryResponse
)
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Simple liveness / readiness probe."""
    return HealthResponse()


@router.get("/domains", response_model=DomainListResponse)
async def list_domains() -> DomainListResponse:
    """Get all registered domains."""
    domains = await db_service.get_all_domains()
    return DomainListResponse(
        domains=[
            DomainResponse(
                id=d.id, 
                name=d.name, 
                created_at=d.createdAt,
                brand_identity=d.brandIdentity
            )
            for d in domains
        ]
    )

@router.post("/domains", response_model=DomainResponse)
async def create_domain(body: DomainCreateRequest) -> DomainResponse:
    """Register a new domain."""
    try:
        domain = await db_service.ensure_domain_exists(body.domain)
        return DomainResponse(
            id=domain.id, 
            name=domain.name, 
            created_at=domain.createdAt,
            brand_identity=domain.brandIdentity
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/domains/{domain_name}/reports", response_model=DomainReportsResponse)
async def list_domain_reports(domain_name: str) -> DomainReportsResponse:
    """Get all previous reports for a domain."""
    reports = await db_service.get_reports_for_domain(domain_name)
    
    response_reports = []
    for r in reports:
        appeared = []
        not_appeared = []
        
        # Ensure promptResponses exists before iterating
        prompt_responses = getattr(r, "promptResponses", [])
        if prompt_responses:
            for pr in prompt_responses:
                # Extract sources and competitors from nested relations
                sources = [s.url for s in getattr(pr, "sources", [])]
                competitors = [c.name for s in getattr(pr, "competitors", []) for c in [s]] # slight hack to handle Prisma typing
                competitors = [c.name for c in getattr(pr, "competitors", [])]

                # Construct PromptResult matching the model
                pr_dict = {
                    "prompt": pr.prompt,
                    "sources": sources,
                    "competitors_mentioned": competitors
                }
                
                if pr.brandMentioned:
                    pr_dict["mention_context"] = pr.mentionContext
                    appeared.append(pr_dict)
                else:
                    pr_dict["completion_summary"] = pr.completion
                    not_appeared.append(pr_dict)
                    
        response_reports.append(
            ReportHistoryResponse(
                id=r.id,
                exposure_rate=r.exposureRate,
                total_prompts=r.totalPrompts,
                brand_mentioned_count=r.brandMentionedCount,
                brand_not_mentioned_count=r.brandNotMentionedCount,
                summary=r.summary,
                created_at=r.createdAt,
                appeared_examples=appeared,
                not_appeared_examples=not_appeared
            )
        )
        
    return DomainReportsResponse(reports=response_reports)


@router.delete("/domains/{domain_name}")
async def delete_domain(domain_name: str):
    """Delete a domain and all its history."""
    try:
        success = await db_service.delete_domain(domain_name)
        if not success:
            raise HTTPException(status_code=404, detail="Domain not found")
        return {"status": "success", "message": f"Domain {domain_name} deleted"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.put("/domains/{domain_name}/brand-identity")
async def update_domain_brand_identity(domain_name: str, body: DomainUpdateRequest):
    """Update the brand identity for a domain."""
    try:
        await db_service.update_brand_identity(domain_name, body.brand_identity)
        return {"status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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

"""API response schemas."""

from datetime import datetime
from pydantic import BaseModel


class DomainResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

class DomainListResponse(BaseModel):
    domains: list[DomainResponse]

class PromptResult(BaseModel):
    """A single prompt result shown in the report."""

    prompt: str
    mention_context: str | None = None
    sources: list[str] = []
    completion_summary: str | None = None

class ReportHistoryResponse(BaseModel):
    id: int
    exposure_rate: float
    total_prompts: int
    brand_mentioned_count: int
    brand_not_mentioned_count: int
    summary: str
    created_at: datetime
    appeared_examples: list[PromptResult] = []
    not_appeared_examples: list[PromptResult] = []

class DomainReportsResponse(BaseModel):
    reports: list[ReportHistoryResponse]

class ExposureReport(BaseModel):
    """Full brand-exposure report returned by the /evaluate endpoint."""

    domain: str
    brand_name: str
    exposure_rate: float  # e.g. 40.0 for 40%
    total_prompts: int
    brand_mentioned_count: int
    brand_not_mentioned_count: int
    appeared_examples: list[PromptResult]
    not_appeared_examples: list[PromptResult]
    summary: str
    generated_at: datetime


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    detail: str

"""API request schemas."""

import re
from pydantic import BaseModel, field_validator


class EvaluateRequest(BaseModel):
    """Request body for the /evaluate endpoint."""

    domain: str
    prompts_count: int = 5

    @field_validator("prompts_count")
    @classmethod
    def validate_count(cls, v: int) -> int:
        if not (1 <= v <= 20):
            raise ValueError("Prompts count must be between 1 and 20")
        return v

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        v = v.strip().lower()
        # Strip protocol if the user provided a full URL
        v = re.sub(r"^https?://", "", v)
        # Strip trailing slash / path
        v = v.split("/")[0]
        pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError(f"Invalid domain: {v}")
        return v

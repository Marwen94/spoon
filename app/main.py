"""FastAPI application entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import configure_langsmith, settings

# ── LangSmith tracing ───────────────────────────────────────────────────────────
configure_langsmith()

# ── Logging setup ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Perplexity Brand Exposure Evaluator",
    description=(
        "A LangGraph multi-agent workflow that evaluates how well a brand "
        "is exposed on Perplexity AI."
    ),
    version="1.0.0",
)

# CORS — allow all origins for now (easy UI integration later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API router
app.include_router(router)

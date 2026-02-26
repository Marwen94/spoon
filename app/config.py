"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    Values are loaded from a `.env` file at the project root (if present)
    and can be overridden by real environment variables.
    """

    OPENAI_API_KEY: str
    FIRECRAWL_API_KEY: str
    PERPLEXITY_API_KEY: str
    LLM_MODEL: str = "gpt-4o"
    LOG_LEVEL: str = "INFO"

    # LangSmith tracing (optional)
    LANGSMITH_API_KEY: str = ""
    LANGSMITH_PROJECT: str = "gen-seo-metric"
    LANGSMITH_TRACING: bool = False
    LANGSMITH_ENDPOINT: str = "https://smith.langchain.com"

    # Perplexity & Prompts
    PERPLEXITY_TIMEOUT: int = 30
    PERPLEXITY_MAX_WORKERS: int = 1
    PROMPTS_COUNT: int = 1
    WORKFLOW_TIMEOUT: int = 300  # 5 minutes

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


# Singleton – imported throughout the app
settings = Settings()  # type: ignore[call-arg]


def configure_langsmith() -> None:
    """Set LangSmith env vars so LangChain/LangGraph pick them up."""
    import os

    if settings.LANGSMITH_TRACING and settings.LANGSMITH_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
        os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGSMITH_ENDPOINT

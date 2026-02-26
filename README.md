# gen-seo-metric — Perplexity Brand Exposure Evaluator

A **LangGraph multi-agent workflow** that evaluates how well a product or brand is exposed on [Perplexity AI](https://www.perplexity.ai/).  
Given a domain name, the system automatically:

1. **Researches** the brand (web search + homepage scraping → LLM extraction)
2. **Generates** 10 realistic user prompts a real person might ask Perplexity
3. **Queries** Perplexity with all 10 prompts in parallel
4. **Produces** a structured exposure report with metrics, examples, and a narrative summary

All of this is exposed via a simple **FastAPI REST API**.

---

## Agent Workflow

```
┌─────────────────┐
│     START        │
└────────┬────────┘
         ▼
┌─────────────────┐    Firecrawl Search + homepage scrape
│ Brand Researcher │──► LLM structured extraction
└────────┬────────┘
         ▼
┌─────────────────┐
│ Prompt Generator │──► 10 realistic user prompts
└────────┬────────┘
         ▼
┌─────────────────┐    asyncio.gather (10 concurrent calls)
│ Perplexity Runner│──► brand detection per response
└────────┬────────┘
         ▼
┌─────────────────┐
│ Report Generator │──► metrics + LLM summary
└────────┬────────┘
         ▼
┌─────────────────┐
│      END         │
└─────────────────┘
```

If any node fails, the graph short-circuits to END and the error is returned in the API response.

---

## Tech Stack

| Layer         | Technology                                   |
|---------------|----------------------------------------------|
| Orchestration | LangGraph + LangChain                        |
| LLM           | OpenAI GPT-4o via `langchain-openai`          |
| Web Search    | Firecrawl Search API                          |
| Perplexity    | Perplexity API (`llama-3.1-sonar-large-128k-online`) |
| API Framework | FastAPI                                       |
| Async         | Python `asyncio` with `asyncio.gather`        |
| Validation    | Pydantic v2                                   |
| Config        | `pydantic-settings`                           |

---

## Project Structure

```
gen-seo-metric/
├── app/
│   ├── main.py                  # FastAPI entrypoint
│   ├── config.py                # Settings (pydantic-settings)
│   ├── api/
│   │   └── routes.py            # /evaluate & /health endpoints
│   ├── agent/
│   │   ├── graph.py             # LangGraph graph definition
│   │   ├── state.py             # AgentState (TypedDict)
│   │   ├── nodes/
│   │   │   ├── brand_researcher.py
│   │   │   ├── prompt_generator.py
│   │   │   ├── perplexity_runner.py
│   │   │   └── report_generator.py
│   │   └── tools/
│   │       ├── web_search.py    # Firecrawl wrapper
│   │       └── perplexity.py    # Perplexity API wrapper
│   └── models/
│       ├── requests.py          # API request schemas
│       └── responses.py         # API response schemas
├── tests/
│   ├── test_api.py
│   └── test_agent.py
├── .env.example
├── pyproject.toml
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.11+
- [Poetry](https://python-poetry.org/docs/#installation)

### 1. Clone & enter the project

```bash
cd gen-seo-metric
```

### 2. Install dependencies

```bash
poetry install
```

This creates a virtual environment and installs all dependencies (including dev dependencies).

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

| Variable              | Description                                    | Required |
|-----------------------|------------------------------------------------|----------|
| `OPENAI_API_KEY`      | OpenAI API key                                 | ✅       |
| `FIRECRAWL_API_KEY`   | Firecrawl API key                              | ✅       |
| `PERPLEXITY_API_KEY`  | Perplexity API key                             | ✅       |
| `LLM_MODEL`          | OpenAI model identifier                        | No (default: `gpt-4o`) |
| `LOG_LEVEL`          | Python log level                               | No (default: `INFO`) |
| `LANGSMITH_TRACING`  | Enable LangSmith tracing (`true`/`false`)      | No (default: `false`) |
| `LANGSMITH_API_KEY`  | LangSmith API key                              | No (required if tracing enabled) |
| `LANGSMITH_PROJECT`  | LangSmith project name                         | No (default: `gen-seo-metric`) |

### 4. Run the server

```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`.

---

## Usage

### Health check

```bash
curl http://localhost:8000/api/v1/health
```

```json
{"status": "ok", "version": "1.0.0"}
```

### Evaluate brand exposure

```bash
curl -X POST http://localhost:8000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"domain": "linear.app"}'
```

**Example response** (truncated):

```json
{
  "domain": "linear.app",
  "brand_name": "Linear",
  "exposure_rate": 60.0,
  "total_prompts": 10,
  "brand_mentioned_count": 6,
  "brand_not_mentioned_count": 4,
  "appeared_examples": [
    {
      "prompt": "What are the best project management tools for engineering teams?",
      "mention_context": "Linear is a popular choice among engineering teams for its speed and keyboard-first design.",
      "sources": ["https://linear.app", "https://techcrunch.com/..."]
    }
  ],
  "not_appeared_examples": [
    {
      "prompt": "How do I set up agile sprints for a small startup?",
      "sources": ["https://atlassian.com/..."],
      "completion_summary": "To set up agile sprints, start by defining your backlog..."
    }
  ],
  "summary": "Linear appears in 60% of relevant Perplexity queries, performing well in tool-comparison and recommendation prompts but less so in generic process-oriented questions.",
  "generated_at": "2026-02-25T10:00:00+00:00"
}
```

> **Note:** A full evaluation typically takes 30–90 seconds depending on API latencies.

---

## Running Tests

```bash
poetry run pytest -v
```

---

## Architecture Notes

- **Agent ↔ API separation** — The agent (`app/agent/`) is fully independent of FastAPI. You can run the graph standalone: `await run_graph("example.com")`.
- **Repository pattern ready** — Storage is in-memory today, but the clean interface makes it straightforward to swap in PostgreSQL or Redis.
- **Error isolation** — Each node catches exceptions and sets `state["error"]`; the graph short-circuits to END, and the API returns 500 with details.
- **Timeouts** — 30 s per Perplexity call, 5 min for the full workflow (configurable via env vars).

---

## License

MIT

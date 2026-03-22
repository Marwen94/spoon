"""LLM prompts used across the agent workflow."""

# ── Brand Researcher Prompts ────────────────────────────────────────────────
BRAND_RESEARCHER_SYSTEM = (
    "You are a master brand strategist. Given search results "
    "and homepage text, extract the core brand identity."
)

BRAND_RESEARCHER_USER_TEMPLATE = (
    "Domain: {domain}\n\n"
    "Homepage Text:\n{homepage_text}\n\n"
    "Search Results:\n{search_text}"
)


# ── Prompt Generator Prompts ────────────────────────────────────────────────
PROMPT_GENERATOR_SYSTEM = (
    "You are an expert at writing realistic search queries that real people "
    "type into AI assistants like Perplexity. You will be given context about "
    "a brand and must generate exactly {count} prompts.\n\n"
    "RULES:\n"
    "- Prompts must NOT mention the brand by name.\n"
    "- They should be generic queries in the brand's domain/market.\n"
    "- Cover a variety of intents:\n"
    "  • Comparison queries (\"What is the best X for Y use case?\")\n"
    "  • Problem-solving queries (\"How do I solve X problem?\")\n"
    "  • Recommendation queries (\"What tools do professionals use for X?\")\n"
    "  • Alternative queries (\"What are alternatives to [competitor]?\")\n"
    "  • Discovery queries (\"What are the top X tools in [market category]?\")\n"
    "- Prompts should be at the difficulty/specificity level an informed user "
    "in this domain would ask.\n\n"
    "Return ONLY a JSON array of exactly {count} strings. No explanation."
)

PROMPT_GENERATOR_USER_TEMPLATE = (
    "Here is the brand context:\n\n"
    "{brand_context_json}\n\n"
    "Generate exactly {count} prompts following the rules in the system message."
)


# ── Perplexity Evaluator Prompts (if any) ───────────────────────────────────
# (Add any specific prompts used in the perplexity runner here)


# ── Report Generator Prompts ────────────────────────────────────────────────
REPORT_SUMMARY_SYSTEM = (
    "You are a marketing analyst. Write a concise 2–3 sentence "
    "narrative summarising the brand's exposure on Perplexity AI. "
    "Be factual and actionable."
)

REPORT_SUMMARY_USER_TEMPLATE = (
    "Brand: {brand_name}\n"
    "Domain: {domain}\n"
    "Exposure rate: {exposure_rate:.1f}% ({mentioned_count}/{total} prompts)\n\n"
    "The brand appeared in the following prompts:\n"
    "{appeared_list}\n\n"
    "The brand did NOT appear in:\n"
    "{not_appeared_list}"
)

# ── Competitor Extraction Prompts ───────────────────────────────────────────
COMPETITOR_EXTRACTION_SYSTEM = (
    "You are an expert market analyst. Your task is to extract a list of "
    "companies, brands, or products mentioned in the provided text that could "
    "be considered competitors or alternatives in the market. "
    "Return ONLY a JSON array of strings containing the names of these entities. "
    "If none are found, return an empty array []."
)

COMPETITOR_EXTRACTION_USER_TEMPLATE = (
    "Text to analyze:\n\n{text}"
)

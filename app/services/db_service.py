"""Database service using Prisma ORM."""

import logging
from typing import Any

from prisma import Prisma

logger = logging.getLogger(__name__)


class DBService:
    """Service to interact with the database using Prisma."""

    def __init__(self) -> None:
        self._connected = False

    async def connect(self) -> None:
        """Connect to the database."""
        if not self._connected:
            self.client = Prisma()
            await self.client.connect()
            self._connected = True
            logger.info("Prisma client connected")

    async def disconnect(self) -> None:
        """Disconnect from the database."""
        if self._connected:
            await self.client.disconnect()
            self._connected = False
            logger.info("Prisma client disconnected")

    async def get_all_domains(self) -> list[Any]:
        """Get all registered domains ordered by creation date."""
        try:
            await self.connect()
            domains = await self.client.domain.find_many(
                include={
                    "context": {
                        "include": {
                            "sources": True,
                            "competitors": True
                        }
                    }
                },
                order={"createdAt": "desc"}
            )
            return domains
        except Exception as e:
            logger.error(f"Failed to fetch domains: {e}")
            return []

    async def get_domain_by_name(self, domain_name: str) -> Any:
        """Get a domain by name."""
        try:
            await self.connect()
            return await self.client.domain.find_unique(
                where={"name": domain_name},
                include={
                    "context": {
                        "include": {
                            "sources": True,
                            "competitors": True
                        }
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to get domain {domain_name}: {e}")
            return None

    async def add_source_to_context(self, domain_name: str, url: str) -> Any:
        """Add a source URL to the domain's context."""
        await self.connect()
        domain = await self.client.domain.find_unique(where={"name": domain_name})
        if not domain:
            raise ValueError(f"Domain {domain_name} not found")
            
        context = await self.client.context.find_unique(where={"domainId": domain.id})
        if not context:
            context = await self.client.context.create(data={"domainId": domain.id})
            
        # Optional: check if already exists to avoid dupes in context
        existing = await self.client.source.find_first(
            where={"contextId": context.id, "url": url}
        )
        if not existing:
            existing = await self.client.source.create(
                data={"url": url, "contextId": context.id}
            )
                
        return existing

    async def add_competitor_to_context(self, domain_name: str, name: str) -> Any:
        """Add a competitor name to the domain's context."""
        await self.connect()
        domain = await self.client.domain.find_unique(where={"name": domain_name})
        if not domain:
            raise ValueError(f"Domain {domain_name} not found")
            
        context = await self.client.context.find_unique(where={"domainId": domain.id})
        if not context:
            context = await self.client.context.create(data={"domainId": domain.id})
            
        existing = await self.client.competitor.find_first(
            where={"contextId": context.id, "name": name}
        )
        if not existing:
            existing = await self.client.competitor.create(
                data={"name": name, "contextId": context.id}
            )
                
        return existing

    async def clear_domain_context(self, domain_name: str) -> bool:
        """Clear all sources and competitors from a domain's context."""
        try:
            await self.connect()
            domain = await self.client.domain.find_unique(where={"name": domain_name})
            if not domain:
                return False
                
            context = await self.client.context.find_unique(where={"domainId": domain.id})
            if not context:
                return True # Nothing to clear
                
            # Delete associated sources and competitors
            await self.client.source.delete_many(where={"contextId": context.id})
            await self.client.competitor.delete_many(where={"contextId": context.id})
            
            logger.info(f"Successfully cleared context for domain: {domain_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear context for domain {domain_name}: {e}")
            raise

    async def get_reports_for_domain(self, domain_name: str) -> list[Any]:
        """Get all reports for a specific domain."""
        try:
            await self.connect()
            reports = await self.client.report.find_many(
                where={
                    "domain": {
                        "name": domain_name
                    }
                },
                include={
                    "promptResponses": {
                        "include": {
                            "sources": True,
                            "competitors": True
                        }
                    }
                },
                order={"createdAt": "desc"}
            )
            return reports
        except Exception as e:
            logger.error(f"Failed to fetch reports for domain {domain_name}: {e}")
            return []

    async def get_previous_prompts_for_domain(self, domain_name: str) -> list[str]:
        """Get a flat list of all prompts previously generated for a domain."""
        try:
            reports = await self.get_reports_for_domain(domain_name)
            previous_prompts = []
            for report in reports:
                if getattr(report, "promptResponses", None):
                    for pr in report.promptResponses:
                        if pr.prompt and pr.prompt not in previous_prompts:
                            previous_prompts.append(pr.prompt)
            return previous_prompts
        except Exception as e:
            logger.error(f"Failed to fetch previous prompts for domain {domain_name}: {e}")
            return []

    async def delete_domain(self, domain_name: str) -> bool:
        """Delete a domain and all its cascading data (reports, prompt responses)."""
        try:
            await self.connect()
            
            # Find the domain first
            domain = await self.client.domain.find_unique(
                where={"name": domain_name},
                include={"reports": True}
            )
            
            if not domain:
                return False
                
            # Prisma handles cascading deletes if configured in schema,
            # but Prisma python client sometimes needs manual cleanup for relations
            # Let's delete prompt responses first
            report_ids = [r.id for r in domain.reports] if domain.reports else []
            if report_ids:
                await self.client.promptresponse.delete_many(
                    where={"reportId": {"in": report_ids}}
                )
                
                # Delete reports
                await self.client.report.delete_many(
                    where={"domainId": domain.id}
                )
            
            # Finally delete the domain
            await self.client.domain.delete(
                where={"id": domain.id}
            )
            logger.info(f"Successfully deleted domain and all related data: {domain_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete domain {domain_name}: {e}")
            raise

    async def ensure_domain_exists(self, domain: str) -> Any:
        """Ensure the domain exists in the database.
        
        Returns the domain record.
        """
        try:
            await self.connect()
            
            # Upsert ensures we get the domain whether it exists or we create it
            db_domain = await self.client.domain.upsert(
                where={
                    "name": domain,
                },
                data={
                    "create": {"name": domain},
                    "update": {},
                },
            )
            logger.info(f"Domain ensured in DB: {domain}")
            return db_domain
        except Exception as e:
            logger.error(f"Failed to ensure domain {domain}: {e}")
            raise

    async def update_brand_identity(self, domain: str, brand_identity: dict[str, Any]) -> Any:
        """Update the brand identity for a domain.
        
        Args:
            domain: The domain to update
            brand_identity: The structured brand identity dictionary
            
        Returns:
            The updated domain object, or None if not found/failed
        """
        try:
            await self.connect()
            
            # Ensure domain exists first
            existing = await self.client.domain.find_unique(where={"name": domain})
            if not existing:
                logger.warning(f"Domain not found for brand identity update: {domain}")
                return None
                
            # Since brandIdentity is a Json field, we pass the dict directly
            # Prisma Python client handles JSON serialization
            import json
            
            updated_domain = await self.client.domain.update(
                where={
                    "name": domain,
                },
                data={
                    "brandIdentity": json.dumps(brand_identity),
                },
            )
            logger.info(f"Brand identity updated for domain: {domain}")
            return updated_domain
        except Exception as e:
            logger.error(f"Failed to update brand identity for {domain}: {e}")
            return None

    async def save_analysis_result(self, domain: str, report: dict[str, Any], prompt_results: list[Any] = None) -> None:
        """Persist the analysis result to the database (Domain -> Report -> PromptResponses).

        Args:
            domain: The domain that was analyzed
            report: The full analysis report dictionary
            prompt_results: List of PerplexityResult objects (optional, but recommended for full data)
        """
        try:
            await self.connect()

            # 1. Get Domain (it should already exist if ensure_domain_exists was called, but let's be safe)
            db_domain = await self.ensure_domain_exists(domain)

            # 2. Create Report linked to Domain
            report_data = {
                "exposureRate": report.get("exposure_rate", 0.0),
                "totalPrompts": report.get("total_prompts", 0),
                "brandMentionedCount": report.get("brand_mentioned_count", 0),
                "brandNotMentionedCount": report.get("brand_not_mentioned_count", 0),
                "summary": report.get("summary", ""),
                "domain": {
                    "connect": {"id": db_domain.id}
                },
            }

            db_report = await self.client.report.create(data=report_data)

            # 3. Create PromptResponses linked to Report
            # Use raw prompt_results if available for better fidelity
            items_to_process = []
            if prompt_results:
                for r in prompt_results:
                    items_to_process.append({
                        "prompt": r.prompt,
                        "completion": r.completion or "",
                        "brandMentioned": r.brand_mentioned,
                        "mentionContext": r.brand_mention_context,
                        "citations": r.citations,
                        "competitorsMentioned": getattr(r, "competitors_mentioned", []),
                    })
            else:
                # Fallback to report dict if raw results not provided
                appeared = report.get("appeared_examples", [])
                not_appeared = report.get("not_appeared_examples", [])

                for item in appeared:
                    items_to_process.append({
                        "prompt": item.get("prompt", ""),
                        "completion": "", # Missing in this view
                        "brandMentioned": True,
                        "mentionContext": item.get("mention_context", ""),
                        "citations": item.get("sources", []),
                        "competitorsMentioned": item.get("competitors_mentioned", []),
                    })

                for item in not_appeared:
                    items_to_process.append({
                        "prompt": item.get("prompt", ""),
                        "completion": item.get("completion_summary", ""),
                        "brandMentioned": False,
                        "mentionContext": "",
                        "citations": item.get("sources", []),
                        "competitorsMentioned": item.get("competitors_mentioned", []),
                    })
            
            # Insert each prompt response and its nested relations
            for item in items_to_process:
                # Prepare nested creates for sources
                sources_data = [{"url": url} for url in item["citations"]]
                
                # Prepare nested creates for competitors
                competitors_data = [{"name": comp} for comp in item["competitorsMentioned"]]
                
                create_data = {
                    "report": {
                        "connect": {"id": db_report.id}
                    },
                    "prompt": item["prompt"],
                    "completion": item["completion"],
                    "brandMentioned": item["brandMentioned"],
                    "mentionContext": item["mentionContext"]
                }
                
                if sources_data:
                    create_data["sources"] = {"create": sources_data}
                    
                if competitors_data:
                    create_data["competitors"] = {"create": competitors_data}
                    
                await self.client.promptresponse.create(data=create_data)

            logger.info(f"Analysis result persisted for domain: {domain} (Report ID: {db_report.id})")

        except Exception as e:
            logger.error(f"Failed to persist analysis result for {domain}: {e}")
            # Don't raise, just log error so we don't crash the API response


# Singleton instance
db_service = DBService()

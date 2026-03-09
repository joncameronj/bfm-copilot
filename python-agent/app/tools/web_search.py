"""
Web Search Tool - Search verified medical sources for educational content.

Provides web search capabilities for:
1. PubMed (NCBI E-utilities API)
2. General medical websites (Mayo Clinic, WebMD, etc.)
3. Jack Kruse content (jackkruse.com)

All searches are rate-limited and return properly formatted citations.
"""

import asyncio
import re
from dataclasses import dataclass
from typing import Literal
from urllib.parse import quote_plus

import httpx

from app.utils.logger import get_logger

logger = get_logger()


# Rate limiting: 3 requests/second for PubMed (NCBI requirement)
PUBMED_RATE_LIMIT = 0.34  # seconds between requests
_last_pubmed_request = 0.0


@dataclass
class SearchResult:
    """A single web search result."""

    title: str
    url: str
    snippet: str
    source: str
    publication_date: str | None = None
    authors: list[str] | None = None

    def to_citation(self) -> str:
        """Format as a citation string."""
        parts = []
        if self.authors:
            parts.append(", ".join(self.authors[:3]))
            if len(self.authors) > 3:
                parts.append("et al.")
        parts.append(f'"{self.title}"')
        if self.publication_date:
            parts.append(f"({self.publication_date})")
        parts.append(f"Source: {self.source}")
        return " ".join(parts)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "source": self.source,
            "publication_date": self.publication_date,
            "authors": self.authors,
            "citation": self.to_citation(),
        }


async def _rate_limit_pubmed():
    """Enforce PubMed rate limiting."""
    global _last_pubmed_request
    import time

    elapsed = time.time() - _last_pubmed_request
    if elapsed < PUBMED_RATE_LIMIT:
        await asyncio.sleep(PUBMED_RATE_LIMIT - elapsed)
    _last_pubmed_request = time.time()


async def search_pubmed(
    query: str,
    max_results: int = 5,
) -> list[SearchResult]:
    """
    Search PubMed via NCBI E-utilities API.

    Uses the free API (no key required for basic searches).
    Rate limited to 3 requests/second per NCBI requirements.

    Args:
        query: Search query
        max_results: Maximum number of results (default: 5)

    Returns:
        List of SearchResult objects from PubMed
    """
    await _rate_limit_pubmed()

    base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    results: list[SearchResult] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Search for article IDs
            search_url = f"{base_url}/esearch.fcgi"
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retmode": "json",
                "sort": "relevance",
            }

            search_resp = await client.get(search_url, params=search_params)
            search_resp.raise_for_status()
            search_data = search_resp.json()

            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                logger.info(f"[WebSearch] No PubMed results for: {query}")
                return []

            # Rate limit before next request
            await _rate_limit_pubmed()

            # Step 2: Fetch article details
            fetch_url = f"{base_url}/esummary.fcgi"
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "json",
            }

            fetch_resp = await client.get(fetch_url, params=fetch_params)
            fetch_resp.raise_for_status()
            fetch_data = fetch_resp.json()

            # Parse results
            result_data = fetch_data.get("result", {})
            for pmid in id_list:
                article = result_data.get(pmid, {})
                if not article or pmid == "uids":
                    continue

                title = article.get("title", "")
                # Clean up title (remove trailing period if present)
                title = title.rstrip(".")

                # Extract authors
                authors = []
                for author in article.get("authors", [])[:5]:
                    name = author.get("name", "")
                    if name:
                        authors.append(name)

                # Get publication date
                pub_date = article.get("pubdate", "")

                # Build snippet from sort title and source
                source_journal = article.get("source", "")
                snippet = article.get("sorttitle", title)[:300]

                results.append(SearchResult(
                    title=title,
                    url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    snippet=snippet,
                    source=f"PubMed - {source_journal}" if source_journal else "PubMed",
                    publication_date=pub_date,
                    authors=authors if authors else None,
                ))

            logger.info(f"[WebSearch] PubMed returned {len(results)} results for: {query}")
            return results

    except Exception as e:
        logger.error(f"[WebSearch] PubMed search error: {e}")
        return []


async def search_jack_kruse(
    query: str,
    max_results: int = 5,
) -> list[SearchResult]:
    """
    Search Jack Kruse content using site-specific Google search.

    Searches jackkruse.com for relevant content about:
    - Circadian biology
    - Light exposure
    - Mitochondrial health
    - Cold thermogenesis
    - EMF and health

    Args:
        query: Search query
        max_results: Maximum number of results

    Returns:
        List of SearchResult objects from Jack Kruse's site

    Note:
        This uses a simple approach - in production, you might want to
        use a proper search API or pre-index Jack Kruse content in RAG.
    """
    # For now, return a helpful message directing to knowledge base
    # In production, this would integrate with a proper search API

    # Build curated results based on common topics
    curated_topics = {
        "light": {
            "title": "Time #1: What is a Mitochondriac?",
            "url": "https://jackkruse.com/time-1-what-is-a-mitochondriac/",
            "snippet": "Understanding how light affects mitochondrial function and circadian biology. Dr. Kruse explains the fundamental connection between light, water, and magnetism.",
        },
        "circadian": {
            "title": "The Circadian Rhythm Series",
            "url": "https://jackkruse.com/category/circadian-biology/",
            "snippet": "Comprehensive series on circadian biology, morning light exposure, and how timing of light exposure affects health outcomes.",
        },
        "cold": {
            "title": "Cold Thermogenesis Protocol",
            "url": "https://jackkruse.com/cold-thermogenesis-easy-start-guide/",
            "snippet": "Dr. Kruse's protocols for cold exposure and its effects on metabolism, mitochondrial biogenesis, and leptin sensitivity.",
        },
        "mitochondria": {
            "title": "The Mitochondrial Series",
            "url": "https://jackkruse.com/category/mitochondria/",
            "snippet": "Deep dive into mitochondrial function, the role of light in electron transport chain, and optimizing cellular energy production.",
        },
        "emf": {
            "title": "EMF Series",
            "url": "https://jackkruse.com/category/emf/",
            "snippet": "Understanding electromagnetic fields, their impact on health, and strategies for mitigation in modern environments.",
        },
        "leptin": {
            "title": "Leptin Reset",
            "url": "https://jackkruse.com/the-leptin-prescription/",
            "snippet": "The leptin reset protocol for metabolic optimization, including timing of meals, light exposure, and cold thermogenesis.",
        },
        "water": {
            "title": "EZ Water and Cell Biology",
            "url": "https://jackkruse.com/category/water/",
            "snippet": "The role of structured water (EZ water) in cellular function, the work of Dr. Gerald Pollack, and practical applications.",
        },
    }

    results: list[SearchResult] = []
    query_lower = query.lower()

    # Match relevant curated content
    for keyword, content in curated_topics.items():
        if keyword in query_lower or any(
            word in query_lower for word in keyword.split("_")
        ):
            results.append(SearchResult(
                title=content["title"],
                url=content["url"],
                snippet=content["snippet"],
                source="Jack Kruse, MD",
            ))

    # If no matches, provide general entry point
    if not results:
        results.append(SearchResult(
            title="Jack Kruse Blog - Health Optimization",
            url="https://jackkruse.com/blog/",
            snippet="Dr. Jack Kruse's blog covering circadian biology, light exposure, cold thermogenesis, and mitochondrial health optimization.",
            source="Jack Kruse, MD",
        ))

    logger.info(f"[WebSearch] Jack Kruse search returned {len(results)} results for: {query}")
    return results[:max_results]


async def search_general_medical(
    query: str,
    max_results: int = 5,
) -> list[SearchResult]:
    """
    Search general medical educational sources.

    Curated list of trusted medical education sites:
    - Mayo Clinic
    - Cleveland Clinic
    - Harvard Health
    - WebMD (educational content)
    - NIH/MedlinePlus

    Args:
        query: Search query
        max_results: Maximum number of results

    Returns:
        List of SearchResult objects from general medical sources

    Note:
        This is a placeholder that returns search guidance.
        In production, integrate with a proper web search API.
    """
    # Trusted medical sources
    sources = [
        {
            "name": "Mayo Clinic",
            "base_url": "https://www.mayoclinic.org/search/search-results?q=",
            "description": "Comprehensive medical information from Mayo Clinic specialists",
        },
        {
            "name": "Cleveland Clinic",
            "base_url": "https://my.clevelandclinic.org/search?q=",
            "description": "Health information from Cleveland Clinic healthcare providers",
        },
        {
            "name": "MedlinePlus (NIH)",
            "base_url": "https://medlineplus.gov/search.html?q=",
            "description": "NIH's consumer health information resource",
        },
        {
            "name": "Harvard Health",
            "base_url": "https://www.health.harvard.edu/search?q=",
            "description": "Health information from Harvard Medical School",
        },
    ]

    results: list[SearchResult] = []
    encoded_query = quote_plus(query)

    for source in sources[:max_results]:
        results.append(SearchResult(
            title=f"Search {source['name']} for: {query}",
            url=f"{source['base_url']}{encoded_query}",
            snippet=source["description"],
            source=source["name"],
        ))

    logger.info(f"[WebSearch] Generated {len(results)} general medical search links for: {query}")
    return results


async def search_medical_sources(
    query: str,
    source_type: Literal["pubmed", "general", "jackkruse", "all"] = "all",
    max_results: int = 5,
) -> dict:
    """
    Search verified medical sources for educational content.

    This tool searches external medical sources to supplement the
    knowledge base with current research and educational content.

    IMPORTANT: Results are for EDUCATIONAL PURPOSES ONLY.
    Never use these results to provide treatment recommendations.

    Args:
        query: The search query (e.g., "morning light circadian rhythm")
        source_type: Which source to search:
            - "pubmed": Search PubMed for peer-reviewed research
            - "general": Search trusted medical websites
            - "jackkruse": Search Jack Kruse's content
            - "all": Search all sources (default)
        max_results: Maximum results per source (default: 5)

    Returns:
        Dictionary with search results and formatted citations
    """
    all_results: list[SearchResult] = []

    if source_type in ("pubmed", "all"):
        pubmed_results = await search_pubmed(query, max_results)
        all_results.extend(pubmed_results)

    if source_type in ("jackkruse", "all"):
        jk_results = await search_jack_kruse(query, max_results)
        all_results.extend(jk_results)

    if source_type in ("general", "all"):
        general_results = await search_general_medical(query, max_results)
        all_results.extend(general_results)

    # Limit total results
    all_results = all_results[:max_results * 2]  # Allow more when searching "all"

    # Format response
    if not all_results:
        return {
            "success": False,
            "message": "No results found. Try different search terms.",
            "results": [],
            "formatted": "No search results found.",
        }

    # Build formatted output
    formatted_parts = ["## Web Search Results\n"]
    formatted_parts.append("*For educational purposes only. Not medical advice.*\n")

    for i, result in enumerate(all_results, 1):
        formatted_parts.append(f"\n### [{i}] {result.title}")
        formatted_parts.append(f"**Source:** {result.source}")
        if result.publication_date:
            formatted_parts.append(f"**Date:** {result.publication_date}")
        if result.authors:
            formatted_parts.append(f"**Authors:** {', '.join(result.authors[:3])}")
        formatted_parts.append(f"\n{result.snippet}")
        formatted_parts.append(f"\n[Read more]({result.url})")

    return {
        "success": True,
        "message": f"Found {len(all_results)} results",
        "results": [r.to_dict() for r in all_results],
        "formatted": "\n".join(formatted_parts),
    }


# =============================================================================
# Tool Schema + Handler for custom AgentRunner
# =============================================================================

WEB_SEARCH_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "The search query (e.g., 'morning light circadian rhythm')",
        },
        "source_type": {
            "type": "string",
            "enum": ["pubmed", "general", "jackkruse", "all"],
            "description": "Which source to search (default: all)",
            "default": "all",
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum results per source (default: 5)",
            "default": 5,
        },
    },
    "required": ["query"],
}

WEB_SEARCH_TOOL_DESCRIPTION = """Search verified medical sources for educational content.

Use this tool when you need current research or external educational
content that may not be in the knowledge base. Results are for
educational purposes only - never provide treatment recommendations
based on web search results.

Sources available:
- pubmed: PubMed peer-reviewed research articles
- general: Trusted medical websites (Mayo Clinic, Cleveland Clinic, NIH)
- jackkruse: Jack Kruse's content on circadian biology, light, mitochondria
- all: Search all sources"""


def create_web_search_handler():
    """Create an async handler for the web search tool."""

    async def handler(
        query: str,
        source_type: str = "all",
        max_results: int = 5,
    ) -> str:
        result = await search_medical_sources(
            query=query,
            source_type=source_type,
            max_results=max_results,
        )
        return result["formatted"]

    return handler

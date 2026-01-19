#!/usr/bin/env python3
"""
RAG Test CLI - Test and diagnose RAG search efficacy.

Usage:
    # Test a single query
    python scripts/test_rag.py "diabetes insulin resistance"

    # Verbose output with content previews
    python scripts/test_rag.py "thyroid" --verbose

    # Verify a specific source appears in results
    python scripts/test_rag.py "diabetes" --verify "Diabetes 2025"

    # Test with different roles
    python scripts/test_rag.py "protocol" --role practitioner
    python scripts/test_rag.py "protocol" --role member

    # Run batch test suite
    python scripts/test_rag.py --batch

    # List all protocols in the knowledge base
    python scripts/test_rag.py --list-protocols

    # Search with lower threshold
    python scripts/test_rag.py "HRV" --threshold 0.3 --limit 20
"""

import argparse
import asyncio
import os
import sys
from typing import Literal

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

# ANSI colors for terminal output
COLORS = {
    "RESET": "\033[0m",
    "BOLD": "\033[1m",
    "DIM": "\033[2m",
    "RED": "\033[31m",
    "GREEN": "\033[32m",
    "YELLOW": "\033[33m",
    "BLUE": "\033[34m",
    "MAGENTA": "\033[35m",
    "CYAN": "\033[36m",
    "WHITE": "\033[37m",
}


def c(text: str, color: str, bold: bool = False) -> str:
    """Apply color to text."""
    prefix = COLORS.get(color, "")
    if bold:
        prefix = COLORS["BOLD"] + prefix
    return f"{prefix}{text}{COLORS['RESET']}"


def print_header(title: str) -> None:
    """Print a section header."""
    print(f"\n{c('=' * 60, 'CYAN')}")
    print(c(f"  {title}", "CYAN", bold=True))
    print(c("=" * 60, "CYAN"))


def print_subheader(title: str) -> None:
    """Print a subsection header."""
    print(f"\n{c(title, 'BLUE', bold=True)}")
    print(c("-" * 40, "BLUE"))


async def run_test(
    query: str,
    verbose: bool = False,
    verify_source: str | None = None,
    role: Literal["admin", "practitioner", "member"] = "practitioner",
    limit: int = 10,
    threshold: float = 0.40,
    category: str | None = None,
) -> bool:
    """
    Run a single RAG test query.

    Returns True if test passes (or no verification), False if verification fails.
    """
    from app.tools.rag_search import smart_search
    from app.tools.query_analyzer import analyze_query

    print_header(f"RAG Test: {query}")
    print(f"Role: {c(role, 'YELLOW')} | Threshold: {c(str(threshold), 'YELLOW')} | Limit: {limit}")

    # Step 1: Query Analysis
    print_subheader("1. Query Analysis")
    analysis = await analyze_query(query)

    print(f"  Conditions:   {c(str(analysis.conditions), 'YELLOW') if analysis.conditions else c('(none)', 'DIM')}")
    print(f"  Symptoms:     {c(str(analysis.symptoms), 'YELLOW') if analysis.symptoms else c('(none)', 'DIM')}")
    print(f"  Lab Markers:  {c(str(analysis.lab_markers), 'YELLOW') if analysis.lab_markers else c('(none)', 'DIM')}")
    print(f"  Body Systems: {c(str(analysis.body_systems), 'MAGENTA') if analysis.body_systems else c('(none)', 'DIM')}")
    print(f"  All Tags:     {c(str(analysis.all_tags()), 'CYAN') if analysis.all_tags() else c('(none)', 'DIM')}")
    print(f"  Intent:       {analysis.intent or '(not specified)'}")
    print(f"  Should Expand: {c('Yes', 'GREEN') if analysis.should_expand else c('No', 'YELLOW')}")

    # Step 2: Build document categories filter if specified
    document_categories = None
    if category:
        category_map = {
            "protocol": ["protocol", "frequency_reference"],
            "lab": ["lab_guide"],
            "care": ["care_guide"],
            "reference": ["reference"],
        }
        document_categories = category_map.get(category, [category])
        print(f"\n  Category Filter: {c(str(document_categories), 'MAGENTA')}")

    # Step 3: Execute Search
    print_subheader("2. Search Execution")

    results = await smart_search(
        query=query,
        user_id="00000000-0000-0000-0000-000000000000",  # Test UUID
        user_role=role,
        analysis=analysis,
        document_categories=document_categories,
        limit=limit,
        threshold=threshold,
    )

    # Step 4: Display Results
    print_subheader(f"3. Results ({len(results)} found)")

    if not results:
        print(c("  No results found!", "RED", bold=True))
        print(c("  Possible reasons:", "YELLOW"))
        print("    - Content doesn't exist in the knowledge base")
        print("    - Similarity threshold too high (try --threshold 0.3)")
        print("    - Query terms don't match embedded content")
        print("    - Role filtering excludes content (try --role admin)")
    else:
        for i, r in enumerate(results, 1):
            sim_pct = int(r.similarity * 100)
            sim_color = "GREEN" if sim_pct >= 60 else "YELLOW" if sim_pct >= 40 else "RED"

            match_color = {
                "direct": "GREEN",
                "related": "CYAN",
                "semantic": "YELLOW",
            }.get(r.match_type, "WHITE")

            print(f"\n  [{i}] {c(r.title, 'WHITE', bold=True)}")
            print(f"      Similarity: {c(f'{sim_pct}%', sim_color, bold=True)} | Match: {c(r.match_type, match_color)}")
            print(f"      File: {c(r.filename, 'DIM')}")

            if r.body_system:
                print(f"      System: {c(r.body_system, 'MAGENTA')}", end="")
            if r.document_category:
                print(f" | Category: {c(r.document_category, 'BLUE')}", end="")
            if r.role_scope:
                print(f" | Scope: {c(r.role_scope, 'YELLOW')}", end="")
            print()

            if r.matched_tags:
                print(f"      Tags: {c(', '.join(r.matched_tags[:5]), 'CYAN')}")

            if verbose:
                preview = r.content[:300].replace("\n", " ")
                if len(r.content) > 300:
                    preview += "..."
                print(f"      {c('Content:', 'DIM')} {preview}")

    # Step 5: Verification (optional)
    if verify_source:
        print_subheader("4. Verification")
        found = any(verify_source.lower() in r.filename.lower() for r in results)

        if found:
            print(f"  {c('PASS', 'GREEN', bold=True)} - Found source containing '{verify_source}'")
            return True
        else:
            print(f"  {c('FAIL', 'RED', bold=True)} - Source containing '{verify_source}' NOT FOUND")
            print(f"  {c('Sources searched:', 'DIM')}")
            for r in results:
                print(f"    - {r.filename}")
            return False

    return True


async def run_batch_tests() -> None:
    """Run the full test suite."""
    print_header("RAG Batch Test Suite")

    # Test cases: (query, verify_source, role, should_pass)
    test_cases = [
        # Rob's FAILING queries (HRV)
        ("HRV implosion eminent pay more attention to this patient", None, "practitioner", None),
        ("HRV finding what setting would run", None, "practitioner", None),
        ("HRV testing protocols", None, "practitioner", None),
        ("HRV", None, "practitioner", None),

        # Rob's WORKING queries (sanity checks)
        ("heart was low on depulse FSM protocol", None, "practitioner", None),
        ("high beta waves protocol", None, "practitioner", None),

        # PPTX ingestion efficacy tests
        ("diabetes insulin protocol", "Diabetes", "practitioner", True),
        ("thyroid hashimotos", "Thyroid", "practitioner", True),
        ("hormone adrenal fatigue", "Hormone", "practitioner", True),
        ("neurological brain fog", "Neuro", "practitioner", True),

        # Role filtering tests
        ("protocol frequency settings", None, "practitioner", None),
        ("protocol frequency settings", None, "member", None),
    ]

    results = []

    for query, verify, role, expected in test_cases:
        print(f"\n{c('Testing:', 'CYAN')} {query[:50]}{'...' if len(query) > 50 else ''}")
        print(f"  Role: {role}, Verify: {verify or '(none)'}")

        passed = await run_test(
            query=query,
            verify_source=verify,
            role=role,
            verbose=False,
            limit=5,
        )

        if verify:
            status = c("PASS", "GREEN") if passed else c("FAIL", "RED")
            results.append((query, verify, passed))
        else:
            status = c("RAN", "BLUE")
            results.append((query, "(no verify)", True))

        print(f"  Result: {status}")

    # Summary
    print_header("Test Summary")

    passed_count = sum(1 for _, _, p in results if p)
    total_count = len(results)

    print(f"  Total: {total_count} tests")
    print(f"  Passed: {c(str(passed_count), 'GREEN')}")
    print(f"  Failed: {c(str(total_count - passed_count), 'RED' if total_count > passed_count else 'GREEN')}")

    if passed_count < total_count:
        print(f"\n{c('Failed Tests:', 'RED', bold=True)}")
        for query, verify, passed in results:
            if not passed:
                print(f"  - {query[:40]}... (expected: {verify})")


async def list_protocols() -> None:
    """List all protocols in the knowledge base."""
    from app.services.supabase import get_supabase_client

    print_header("Protocols in Knowledge Base")

    client = get_supabase_client()

    # Query documents table directly for protocol-related categories
    result = client.table("documents").select(
        "id, title, filename, document_category, role_scope, body_system"
    ).in_(
        "document_category", ["protocol", "frequency_reference", "lab_guide", "care_guide"]
    ).eq("status", "completed").execute()

    if not result.data:
        # Try also indexed status
        result = client.table("documents").select(
            "id, title, filename, document_category, role_scope, body_system"
        ).in_(
            "document_category", ["protocol", "frequency_reference", "lab_guide", "care_guide"]
        ).eq("status", "indexed").execute()

    if not result.data:
        print(c("  No protocol documents found in the knowledge base", "YELLOW"))
        return

    # Get chunk counts for each document
    doc_ids = [row["id"] for row in result.data]
    chunk_result = client.table("document_chunks").select(
        "document_id"
    ).in_("document_id", doc_ids).execute()

    # Count chunks per document
    chunk_counts = {}
    for row in chunk_result.data:
        doc_id = row["document_id"]
        chunk_counts[doc_id] = chunk_counts.get(doc_id, 0) + 1

    # Build docs dict
    docs = {}
    for row in result.data:
        filename = row["filename"]
        docs[filename] = {
            "title": row["title"] or filename,
            "category": row["document_category"],
            "role_scope": row["role_scope"],
            "body_system": row["body_system"],
            "chunk_count": chunk_counts.get(row["id"], 0),
        }

    # Sort by category then title
    sorted_docs = sorted(docs.items(), key=lambda x: (x[1]["category"] or "", x[1]["title"]))

    current_category = None
    for filename, info in sorted_docs:
        if info["category"] != current_category:
            current_category = info["category"]
            print_subheader(f"Category: {current_category or 'Uncategorized'}")

        scope_color = {
            "clinical": "YELLOW",
            "educational": "GREEN",
            "both": "CYAN",
        }.get(info["role_scope"], "WHITE")

        print(f"  {c(info['title'], 'WHITE', bold=True)}")
        print(f"    File: {c(filename, 'DIM')}")
        print(f"    Scope: {c(info['role_scope'] or 'unknown', scope_color)} | Chunks: {info['chunk_count']}")
        if info["body_system"]:
            print(f"    System: {c(info['body_system'], 'MAGENTA')}")

    print(f"\n{c('Total:', 'CYAN', bold=True)} {len(docs)} documents")


async def search_content(
    search_term: str,
    limit: int = 20,
) -> None:
    """Search for specific content in the knowledge base (direct text search)."""
    from app.services.supabase import get_supabase_client

    print_header(f"Content Search: {search_term}")

    client = get_supabase_client()

    # Direct text search in content - join with documents table for metadata
    result = client.table("document_chunks").select(
        "content, document_id, documents(title, filename, document_category, body_system)"
    ).ilike(
        "content", f"%{search_term}%"
    ).limit(limit).execute()

    if not result.data:
        print(c(f"  No content found containing '{search_term}'", "RED"))
        print(c("  The content may not exist in the knowledge base", "YELLOW"))
        return

    print(f"  Found {c(str(len(result.data)), 'GREEN', bold=True)} chunks containing '{search_term}'")

    for i, row in enumerate(result.data, 1):
        doc = row.get("documents", {}) or {}
        title = doc.get("title") or doc.get("filename") or "Unknown"
        filename = doc.get("filename") or "Unknown"
        document_category = doc.get("document_category")

        print(f"\n  [{i}] {c(title, 'WHITE', bold=True)}")
        print(f"      File: {c(filename, 'DIM')}")
        if document_category:
            print(f"      Category: {c(document_category, 'BLUE')}")

        # Show snippet with search term highlighted
        content = row["content"]
        lower_content = content.lower()
        lower_term = search_term.lower()

        idx = lower_content.find(lower_term)
        if idx != -1:
            start = max(0, idx - 100)
            end = min(len(content), idx + len(search_term) + 100)
            snippet = content[start:end]

            # Highlight the term
            term_start = snippet.lower().find(lower_term)
            if term_start != -1:
                highlighted = (
                    snippet[:term_start]
                    + c(snippet[term_start : term_start + len(search_term)], "YELLOW", bold=True)
                    + snippet[term_start + len(search_term) :]
                )
                print(f"      ...{highlighted}...")


def main():
    parser = argparse.ArgumentParser(
        description="RAG Test CLI - Test and diagnose RAG search efficacy",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "query",
        nargs="?",
        help="Search query to test",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show content previews in results",
    )
    parser.add_argument(
        "--verify",
        type=str,
        help="Verify this source appears in results (partial match on filename)",
    )
    parser.add_argument(
        "--role",
        choices=["admin", "practitioner", "member"],
        default="practitioner",
        help="User role for content filtering (default: practitioner)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum results to return (default: 10)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.40,
        help="Minimum similarity threshold (default: 0.40)",
    )
    parser.add_argument(
        "--category",
        choices=["protocol", "lab", "care", "reference"],
        help="Filter by document category",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Run the full test suite",
    )
    parser.add_argument(
        "--list-protocols",
        action="store_true",
        help="List all protocols in the knowledge base",
    )
    parser.add_argument(
        "--search-content",
        type=str,
        help="Direct text search in knowledge base content",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.batch and not args.list_protocols and not args.search_content and not args.query:
        parser.error("Please provide a query, or use --batch, --list-protocols, or --search-content")

    # Run the appropriate command
    if args.batch:
        asyncio.run(run_batch_tests())
    elif args.list_protocols:
        asyncio.run(list_protocols())
    elif args.search_content:
        asyncio.run(search_content(args.search_content, limit=args.limit))
    else:
        asyncio.run(
            run_test(
                query=args.query,
                verbose=args.verbose,
                verify_source=args.verify,
                role=args.role,
                limit=args.limit,
                threshold=args.threshold,
                category=args.category,
            )
        )


if __name__ == "__main__":
    main()

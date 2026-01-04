#!/usr/bin/env python3
"""
BFM Asset Ingestion CLI

Processes all assets in the agent-assets directory and indexes them
into the Supabase vector database for RAG retrieval.

Usage:
    # Process all assets
    python scripts/ingest_assets.py --assets-dir ../agent-assets

    # Dry run (scan only, don't index)
    python scripts/ingest_assets.py --assets-dir ../agent-assets --dry-run

    # Process specific category
    python scripts/ingest_assets.py --assets-dir ../agent-assets --category diabetes

    # Skip image processing (no Vision API calls)
    python scripts/ingest_assets.py --assets-dir ../agent-assets --skip-images

Requirements:
    - OPENAI_API_KEY environment variable
    - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
    - poppler installed for PDF image conversion (brew install poppler)
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.embeddings.ingestion import IngestionPipeline


def parse_args():
    parser = argparse.ArgumentParser(
        description="Ingest BFM assets into the RAG vector database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Full ingestion
    python scripts/ingest_assets.py --assets-dir ../agent-assets

    # Preview what would be processed
    python scripts/ingest_assets.py --assets-dir ../agent-assets --dry-run

    # Only process diabetes content
    python scripts/ingest_assets.py --assets-dir ../agent-assets --category diabetes

    # Skip Vision API processing (faster, cheaper)
    python scripts/ingest_assets.py --assets-dir ../agent-assets --skip-images
        """
    )

    parser.add_argument(
        "--assets-dir",
        type=Path,
        required=True,
        help="Path to the agent-assets directory"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and report what would be processed without indexing"
    )

    parser.add_argument(
        "--category",
        choices=["diabetes", "thyroid", "hormones", "neurological"],
        help="Only process a specific care category"
    )

    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Skip Vision API processing for images (faster, no API cost)"
    )

    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=5,
        help="Maximum concurrent API calls (default: 5)"
    )

    return parser.parse_args()


async def main():
    args = parse_args()

    # Validate assets directory
    if not args.assets_dir.exists():
        print(f"Error: Assets directory not found: {args.assets_dir}")
        sys.exit(1)

    # Check for required environment variables
    import os
    required_vars = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("\nSet these in your .env file or environment:")
        for var in missing:
            print(f"  export {var}=your_value")
        sys.exit(1)

    # Create pipeline
    pipeline = IngestionPipeline(
        assets_dir=args.assets_dir,
        skip_images=args.skip_images,
        dry_run=args.dry_run,
    )

    # Run ingestion
    try:
        results = await pipeline.process_all()

        # Return appropriate exit code
        failed = sum(1 for r in results if not r.success)
        if failed > 0:
            print(f"\n⚠️  Completed with {failed} errors")
            sys.exit(1)
        else:
            print("\n✅ Ingestion completed successfully!")
            sys.exit(0)

    except KeyboardInterrupt:
        print("\n\n❌ Ingestion interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Ingestion failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

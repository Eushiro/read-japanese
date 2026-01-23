#!/usr/bin/env python3
"""
Upload Generated Deck Content to Convex

Uploads the generated sentences, audio, and images to Convex.

Usage:
    python scripts/upload_to_convex.py --results generated/results.json --deck jlpt_n5
"""

import os
import sys
import json
import argparse
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import httpx

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

CONVEX_URL = os.getenv("CONVEX_URL") or os.getenv("VITE_CONVEX_URL")

if not CONVEX_URL:
    logger.error("CONVEX_URL or VITE_CONVEX_URL environment variable required")
    sys.exit(1)

# Extract deployment URL for HTTP API
# e.g., "https://academic-fox-331.convex.cloud" -> use as-is
CONVEX_HTTP_URL = CONVEX_URL.rstrip("/")


# ============================================
# CONVEX HTTP CLIENT
# ============================================

class ConvexClient:
    """Simple Convex HTTP client for mutations and file uploads"""

    def __init__(self, deployment_url: str):
        self.deployment_url = deployment_url
        self.client = httpx.AsyncClient(timeout=120.0)

    async def mutation(self, function_path: str, args: Dict[str, Any]) -> Any:
        """Call a Convex mutation"""
        url = f"{self.deployment_url}/api/mutation"

        payload = {
            "path": function_path,
            "args": args,
            "format": "json"
        }

        response = await self.client.post(url, json=payload)
        response.raise_for_status()

        result = response.json()
        if "error" in result:
            raise Exception(f"Convex error: {result['error']}")

        return result.get("value")

    async def upload_file(self, file_path: Path, mime_type: str) -> str:
        """Upload a file to Convex storage and return the storage ID"""
        # Step 1: Get upload URL
        url = f"{self.deployment_url}/api/storage/generateUploadUrl"
        response = await self.client.post(url, json={})
        response.raise_for_status()
        upload_url = response.json()

        # Step 2: Upload file
        with open(file_path, "rb") as f:
            file_data = f.read()

        upload_response = await self.client.post(
            upload_url,
            content=file_data,
            headers={"Content-Type": mime_type}
        )
        upload_response.raise_for_status()

        # Step 3: Get storage ID from response
        result = upload_response.json()
        storage_id = result.get("storageId")

        if not storage_id:
            raise Exception(f"No storage ID in upload response: {result}")

        return storage_id

    async def get_storage_url(self, storage_id: str) -> str:
        """Get the public URL for a storage ID"""
        url = f"{self.deployment_url}/api/storage/getUrl"
        response = await self.client.post(url, json={"storageId": storage_id})
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()


# ============================================
# UPLOAD PIPELINE
# ============================================

async def upload_results(
    results_path: Path,
    deck_id: str,
    upload_audio: bool = True,
    upload_images: bool = True,
):
    """Upload generated content to Convex"""

    # Load results
    with open(results_path, 'r', encoding='utf-8') as f:
        results = json.load(f)

    logger.info(f"Loaded {len(results)} items from {results_path}")

    client = ConvexClient(CONVEX_HTTP_URL)

    try:
        success = 0
        failed = 0

        for i, item in enumerate(results):
            logger.info(f"[{i+1}/{len(results)}] Uploading: {item['word']}")

            try:
                # Prepare update data
                update_data = {
                    "sentence": item.get("sentence"),
                    "sentenceTranslation": item.get("sentence_translation"),
                    "generationStatus": "complete" if item.get("sentence") else "failed",
                }

                # Upload audio files if present
                if upload_audio and item.get("audio_path"):
                    audio_path = Path(item["audio_path"])
                    if audio_path.exists():
                        storage_id = await client.upload_file(audio_path, "audio/mpeg")
                        audio_url = await client.get_storage_url(storage_id)
                        update_data["audioUrl"] = audio_url
                        logger.info(f"  Uploaded sentence audio")

                if upload_audio and item.get("word_audio_path"):
                    word_audio_path = Path(item["word_audio_path"])
                    if word_audio_path.exists():
                        storage_id = await client.upload_file(word_audio_path, "audio/mpeg")
                        word_audio_url = await client.get_storage_url(storage_id)
                        update_data["wordAudioUrl"] = word_audio_url
                        logger.info(f"  Uploaded word audio")

                # Upload image if present
                if upload_images and item.get("image_path"):
                    image_path = Path(item["image_path"])
                    if image_path.exists():
                        storage_id = await client.upload_file(image_path, "image/webp")
                        image_url = await client.get_storage_url(storage_id)
                        update_data["imageUrl"] = image_url
                        logger.info(f"  Uploaded image")

                # Update Convex (need to match by word since we don't have Convex ID)
                # This requires a custom mutation that finds by deck + word
                await client.mutation("premadeDecks:updateItemByWord", {
                    "deckId": deck_id,
                    "word": item["word"],
                    **update_data
                })

                success += 1

            except Exception as e:
                logger.error(f"  Failed: {e}")
                failed += 1

        logger.info(f"\nUpload complete: {success} succeeded, {failed} failed")

        # Update deck stats
        await client.mutation("premadeDecks:updateDeckStats", {"deckId": deck_id})

    finally:
        await client.close()


# ============================================
# CLI
# ============================================

def main():
    parser = argparse.ArgumentParser(description="Upload generated content to Convex")
    parser.add_argument("--results", type=Path, required=True, help="Path to results.json")
    parser.add_argument("--deck", type=str, required=True, help="Deck ID in Convex")
    parser.add_argument("--no-audio", action="store_true", help="Skip audio upload")
    parser.add_argument("--no-images", action="store_true", help="Skip image upload")

    args = parser.parse_args()

    if not args.results.exists():
        logger.error(f"Results file not found: {args.results}")
        return

    asyncio.run(upload_results(
        results_path=args.results,
        deck_id=args.deck,
        upload_audio=not args.no_audio,
        upload_images=not args.no_images,
    ))


if __name__ == "__main__":
    main()

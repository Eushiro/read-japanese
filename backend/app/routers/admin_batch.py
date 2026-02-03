"""
Admin Batch Generation Router

Endpoints for triggering content generation from the admin UI.
Generates sentences, audio, and images for vocabulary decks.
"""

import asyncio
import json
import logging
import os

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin Batch"])

# Configuration
CONVEX_URL = os.getenv("VITE_CONVEX_URL") or os.getenv("CONVEX_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# Track active jobs
active_jobs: dict[str, dict] = {}


class GenerateRequest(BaseModel):
    deckId: str
    count: int = 50
    model: str | None = None


class GenerateResponse(BaseModel):
    success: bool
    message: str
    jobId: str | None = None
    itemsQueued: int = 0


class HealthResponse(BaseModel):
    status: str
    version: str
    convex_configured: bool
    gemini_configured: bool


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check for admin batch server"""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        convex_configured=bool(CONVEX_URL),
        gemini_configured=bool(GEMINI_API_KEY),
    )


async def call_convex_query(function_name: str, args: dict) -> dict:
    """Call a Convex query function"""
    if not CONVEX_URL:
        raise HTTPException(status_code=500, detail="CONVEX_URL not configured")

    # Convert CONVEX_URL to HTTP API URL
    # e.g., https://xxx.convex.cloud -> https://xxx.convex.cloud/api/query
    base_url = CONVEX_URL.rstrip("/")
    url = f"{base_url}/api/query"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json={
                "path": function_name,
                "args": args,
            },
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )

        if response.status_code != 200:
            logger.error(f"Convex query failed: {response.text}")
            raise HTTPException(status_code=500, detail=f"Convex query failed: {response.text}")

        result = response.json()
        if "value" in result:
            return result["value"]
        return result


async def call_convex_mutation(function_name: str, args: dict) -> dict:
    """Call a Convex mutation function"""
    if not CONVEX_URL:
        raise HTTPException(status_code=500, detail="CONVEX_URL not configured")

    base_url = CONVEX_URL.rstrip("/")
    url = f"{base_url}/api/mutation"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json={
                "path": function_name,
                "args": args,
            },
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )

        if response.status_code != 200:
            logger.error(f"Convex mutation failed: {response.text}")
            raise HTTPException(status_code=500, detail=f"Convex mutation failed: {response.text}")

        result = response.json()
        if "value" in result:
            return result["value"]
        return result


def build_sentence_prompt(
    word: str, reading: str | None, definitions: list[str], language: str, level: str
) -> str:
    """Build prompt for sentence generation"""
    lang_names = {"japanese": "Japanese", "english": "English", "french": "French"}
    lang_name = lang_names.get(language, "English")
    reading_info = f" (reading: {reading})" if reading else ""
    level_info = f" at {level} level" if level else ""
    definition_list = ", ".join(definitions)

    return f"""Create an example sentence for the {lang_name} word "{word}"{reading_info}{level_info}.

The word means: {definition_list}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners{level_info}.

Respond with JSON:
{{
  "sentence": "the example sentence in {lang_name}",
  "translation": "the English translation"
}}"""


async def generate_sentence_for_item(item: dict, model: str) -> dict:
    """Generate a sentence for a single vocabulary item using Gemini"""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    prompt = build_sentence_prompt(
        word=item["word"],
        reading=item.get("reading"),
        definitions=item.get("definitions", []),
        language=item.get("language", "japanese"),
        level=item.get("level", ""),
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"key": GEMINI_API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.7,
                },
            },
            timeout=30.0,
        )

        if response.status_code != 200:
            logger.error(f"Gemini API error: {response.text}")
            return {"error": response.text}

        result = response.json()

        try:
            # Extract the generated text
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            # Parse as JSON
            data = json.loads(text)
            return {
                "sentence": data.get("sentence", ""),
                "translation": data.get("translation", ""),
            }
        except (KeyError, json.JSONDecodeError) as e:
            logger.error(f"Failed to parse Gemini response: {e}")
            return {"error": str(e)}


async def process_sentences_batch(deck_id: str, count: int, model: str, job_id: str):
    """Background task to process sentence generation"""
    logger.info(f"Starting sentence generation for deck {deck_id}, count={count}")

    try:
        # Get pending items from Convex
        items = await call_convex_query(
            "premadeDecks:getVocabularyForDeck",
            {"deckId": deck_id, "limit": count, "status": "pending"},
        )

        if not items:
            logger.info("No pending items found")
            active_jobs[job_id]["status"] = "completed"
            active_jobs[job_id]["message"] = "No pending items"
            return

        logger.info(f"Processing {len(items)} items")
        active_jobs[job_id]["total"] = len(items)

        # Process items one by one (could be parallelized with rate limiting)
        for i, item in enumerate(items):
            if active_jobs.get(job_id, {}).get("cancelled"):
                logger.info("Job cancelled")
                break

            try:
                result = await generate_sentence_for_item(item, model)

                if "error" not in result:
                    # Update item in Convex
                    await call_convex_mutation(
                        "premadeDecks:updateItemByWord",
                        {
                            "deckId": deck_id,
                            "word": item["word"],
                            "sentence": result["sentence"],
                            "sentenceTranslation": result["translation"],
                            "generationStatus": "complete",
                        },
                    )
                    active_jobs[job_id]["processed"] = i + 1
                else:
                    logger.error(f"Failed to generate for {item['word']}: {result['error']}")
                    # Mark as failed
                    await call_convex_mutation(
                        "premadeDecks:updateItemByWord",
                        {
                            "deckId": deck_id,
                            "word": item["word"],
                            "generationStatus": "failed",
                        },
                    )

                # Small delay to avoid rate limits
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"Error processing {item.get('word', 'unknown')}: {e}")

        # Update deck stats
        await call_convex_mutation("premadeDecks:updateDeckStats", {"deckId": deck_id})

        active_jobs[job_id]["status"] = "completed"
        logger.info(f"Completed sentence generation for deck {deck_id}")

    except Exception as e:
        logger.error(f"Batch processing error: {e}")
        active_jobs[job_id]["status"] = "failed"
        active_jobs[job_id]["error"] = str(e)


@router.post("/generate/sentences", response_model=GenerateResponse)
async def generate_sentences(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Trigger sentence generation for a deck"""
    if not CONVEX_URL:
        raise HTTPException(status_code=500, detail="CONVEX_URL not configured")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    model = request.model or GEMINI_MODEL
    job_id = f"sentences_{request.deckId}_{int(asyncio.get_event_loop().time())}"

    # Track the job
    active_jobs[job_id] = {
        "type": "sentences",
        "deckId": request.deckId,
        "status": "running",
        "processed": 0,
        "total": request.count,
    }

    # Start background task
    background_tasks.add_task(
        process_sentences_batch,
        request.deckId,
        request.count,
        model,
        job_id,
    )

    return GenerateResponse(
        success=True,
        message=f"Started generating sentences for {request.count} items",
        jobId=job_id,
        itemsQueued=request.count,
    )


@router.post("/generate/audio", response_model=GenerateResponse)
async def generate_audio(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Trigger audio generation for a deck (not yet implemented)"""
    return GenerateResponse(
        success=False,
        message="Audio generation not yet implemented. Use CLI: python backend/scripts/generate_audio.py",
        itemsQueued=0,
    )


@router.post("/generate/images", response_model=GenerateResponse)
async def generate_images(request: GenerateRequest, background_tasks: BackgroundTasks):
    """Trigger image generation for a deck (not yet implemented)"""
    return GenerateResponse(
        success=False,
        message="Image generation not yet implemented. Use CLI scripts.",
        itemsQueued=0,
    )


@router.get("/jobs")
async def list_jobs():
    """List active generation jobs"""
    return {"jobs": active_jobs}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get status of a specific job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return active_jobs[job_id]


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    active_jobs[job_id]["cancelled"] = True
    return {"success": True, "message": "Job cancellation requested"}

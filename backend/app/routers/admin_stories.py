"""
Admin Stories Router

Endpoints for story generation, content analysis, and AI suggestions from the admin UI.
"""

import asyncio
import logging
from collections import defaultdict
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.generation.story_generator import StoryGenerator
from app.services.story_service import get_story_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/stories", tags=["Admin Stories"])

# Track active story generation jobs
active_story_jobs: dict[str, dict] = {}

# Type definitions
Language = Literal["japanese", "english", "french"]


class GenerateStoryRequest(BaseModel):
    """Request body for story generation."""

    language: Language = "japanese"
    level: str  # JLPT (N5-N1) or CEFR (A1-C2)
    genre: str = "slice of life"
    detailed_prompt: str  # The detailed story description
    image_style: str = "anime"
    num_chapters: int = 5
    words_per_chapter: int = 150
    generate_audio: bool = False
    generate_images: bool = False


class GenerateStoryResponse(BaseModel):
    """Response for story generation request."""

    success: bool
    message: str
    job_id: str | None = None
    story_id: str | None = None


class TopologyResponse(BaseModel):
    """Response for content topology."""

    total_stories: int
    by_language: dict[str, int]
    by_level: dict[str, int]
    by_genre: dict[str, int]
    gaps: list[dict]


class SuggestionRequest(BaseModel):
    """Request for AI story suggestions."""

    language: Language = "japanese"
    level: str = "N4"
    count: int = 5


class StorySuggestion(BaseModel):
    """A single story suggestion."""

    prompt: str
    genre: str
    reason: str
    vocabulary_themes: list[str] = []


class SuggestionsResponse(BaseModel):
    """Response for AI suggestions."""

    suggestions: list[StorySuggestion]


async def generate_story_task(
    job_id: str,
    language: Language,
    level: str,
    genre: str,
    detailed_prompt: str,
    num_chapters: int,
    words_per_chapter: int,
    generate_audio: bool,
    generate_images: bool,
):
    """Background task for story generation."""
    logger.info(f"Starting story generation job {job_id}")

    try:
        active_story_jobs[job_id]["status"] = "generating_story"
        active_story_jobs[job_id]["message"] = "Generating story content..."

        generator = StoryGenerator()
        story = await generator.generate_story(
            level=level,
            genre=genre,
            detailed_prompt=detailed_prompt,
            num_chapters=num_chapters,
            words_per_chapter=words_per_chapter,
            language=language,
        )

        active_story_jobs[job_id]["story_id"] = story["id"]
        active_story_jobs[job_id]["message"] = "Story generated successfully"

        # Save story to disk
        stories_dir = Path(__file__).parent.parent / "data" / "stories"
        stories_dir.mkdir(parents=True, exist_ok=True)

        import json

        story_path = stories_dir / f"{story['id']}.json"
        with open(story_path, "w", encoding="utf-8") as f:
            json.dump(story, f, ensure_ascii=False, indent=2)

        logger.info(f"Story saved to {story_path}")

        # TODO: Generate audio if requested
        if generate_audio:
            active_story_jobs[job_id]["message"] = "Audio generation not yet implemented"

        # TODO: Generate images if requested
        if generate_images:
            active_story_jobs[job_id]["message"] = "Image generation not yet implemented"

        active_story_jobs[job_id]["status"] = "completed"
        active_story_jobs[job_id]["message"] = f"Story {story['id']} generated successfully"
        logger.info(f"Story generation job {job_id} completed")

    except Exception as e:
        logger.error(f"Story generation failed: {e}")
        active_story_jobs[job_id]["status"] = "failed"
        active_story_jobs[job_id]["error"] = str(e)
        active_story_jobs[job_id]["message"] = f"Generation failed: {str(e)}"


@router.post("/generate", response_model=GenerateStoryResponse)
async def generate_story(request: GenerateStoryRequest, background_tasks: BackgroundTasks):
    """
    Generate a new story from a detailed prompt.

    This triggers an async background task to generate the story content.
    Poll the /generate/{job_id}/status endpoint to check progress.
    """
    if not request.detailed_prompt or len(request.detailed_prompt.strip()) < 10:
        raise HTTPException(
            status_code=400, detail="detailed_prompt must be at least 10 characters"
        )

    # Create job ID
    job_id = f"story_{request.language}_{request.level}_{int(asyncio.get_event_loop().time())}"

    # Track the job
    active_story_jobs[job_id] = {
        "type": "story_generation",
        "language": request.language,
        "level": request.level,
        "genre": request.genre,
        "status": "queued",
        "message": "Story generation queued",
        "story_id": None,
        "error": None,
    }

    # Start background task
    background_tasks.add_task(
        generate_story_task,
        job_id,
        request.language,
        request.level,
        request.genre,
        request.detailed_prompt,
        request.num_chapters,
        request.words_per_chapter,
        request.generate_audio,
        request.generate_images,
    )

    return GenerateStoryResponse(
        success=True,
        message=f"Story generation started for {request.language} {request.level}",
        job_id=job_id,
    )


@router.get("/generate/{job_id}/status")
async def get_generation_status(job_id: str):
    """Get the status of a story generation job."""
    if job_id not in active_story_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return active_story_jobs[job_id]


@router.get("/topology", response_model=TopologyResponse)
async def get_story_topology():
    """
    Get content distribution analysis for stories.

    Returns counts by language, level, and genre, plus identified content gaps.
    """
    service = get_story_service()
    stories = service.get_all_stories()

    # Aggregate counts
    by_language: dict[str, int] = defaultdict(int)
    by_level: dict[str, int] = defaultdict(int)
    by_genre: dict[str, int] = defaultdict(int)

    for story in stories:
        # Get language (default to japanese for backward compatibility)
        lang = getattr(story, "language", None) or "japanese"
        by_language[lang] += 1

        # Get level (try both level and jlptLevel for compatibility)
        level = getattr(story, "level", None) or getattr(story, "jlptLevel", None) or "unknown"
        by_level[level] += 1

        # Get genre
        genre = getattr(story, "genre", None) or "unknown"
        by_genre[genre] += 1

    # Identify gaps
    gaps = []

    # Expected levels per language
    expected_levels = {
        "japanese": ["N5", "N4", "N3", "N2", "N1"],
        "english": ["A1", "A2", "B1", "B2", "C1", "C2"],
        "french": ["A1", "A2", "B1", "B2", "C1", "C2"],
    }

    # Expected genres
    expected_genres = [
        "slice of life",
        "mystery",
        "adventure",
        "romance",
        "comedy",
        "fantasy",
        "school life",
        "travel",
    ]

    # Check level gaps for each language
    for lang, levels in expected_levels.items():
        for level in levels:
            count = by_level.get(level, 0)
            if count < 3:  # Want at least 3 stories per level
                gaps.append(
                    {
                        "type": "level",
                        "language": lang,
                        "value": level,
                        "current": count,
                        "suggested": 5,
                        "severity": "high" if count == 0 else "medium",
                    }
                )

    # Check genre gaps
    for genre in expected_genres:
        count = by_genre.get(genre, 0)
        if count < 2:
            gaps.append(
                {
                    "type": "genre",
                    "value": genre,
                    "current": count,
                    "suggested": 3,
                    "severity": "low" if count > 0 else "medium",
                }
            )

    # Sort gaps by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    gaps.sort(key=lambda g: severity_order.get(g.get("severity", "low"), 3))

    return TopologyResponse(
        total_stories=len(stories),
        by_language=dict(by_language),
        by_level=dict(by_level),
        by_genre=dict(by_genre),
        gaps=gaps,
    )


@router.get("/suggestions", response_model=SuggestionsResponse)
async def get_story_suggestions(
    language: Language = "japanese",
    level: str = "N4",
    count: int = 5,
):
    """
    Get AI-generated story prompt suggestions.

    Suggestions are based on content gaps and common user interests.
    """
    from app.services.openrouter_client import get_openrouter_client

    # Get current topology to identify gaps
    topology = await get_story_topology()
    relevant_gaps = [
        g for g in topology.gaps if g.get("language") == language or g.get("type") == "genre"
    ]

    # Build prompt for AI
    client = get_openrouter_client()

    language_name = {"japanese": "Japanese", "english": "English", "french": "French"}[language]
    level_system = "JLPT" if language == "japanese" else "CEFR"

    gaps_text = "\n".join(
        [
            f"- {g['type']}: {g.get('value', 'unknown')} (current: {g['current']}, need: {g['suggested']})"
            for g in relevant_gaps[:5]
        ]
    )

    prompt = f"""Generate {count} story prompt suggestions for a {language_name} language learning platform.

Target audience: {level_system} {level} learners

Content gaps to fill (prioritize these):
{gaps_text if gaps_text else "No specific gaps identified"}

Popular interests to consider:
- Daily life and slice of life scenarios
- Food and cooking
- Travel and exploration
- Friendship and relationships
- Work and school life
- Nature and seasons
- Culture and traditions

For each suggestion, provide:
1. A detailed story prompt (2-3 sentences describing the story)
2. The best genre for this story
3. Why this suggestion is valuable (fills a gap, appeals to learners, etc.)
4. Key vocabulary themes the story would cover

Output as JSON:
{{
  "suggestions": [
    {{
      "prompt": "detailed story description...",
      "genre": "slice of life",
      "reason": "why this story would be valuable",
      "vocabulary_themes": ["food", "cooking", "family"]
    }}
  ]
}}"""

    try:
        result = await client.generate_json(
            prompt=prompt,
            system_prompt="You generate creative, educational story ideas for language learners. Always output valid JSON.",
            temperature=0.9,
        )

        suggestions = []
        for s in result.get("suggestions", [])[:count]:
            suggestions.append(
                StorySuggestion(
                    prompt=s.get("prompt", ""),
                    genre=s.get("genre", "slice of life"),
                    reason=s.get("reason", ""),
                    vocabulary_themes=s.get("vocabulary_themes", []),
                )
            )

        return SuggestionsResponse(suggestions=suggestions)

    except Exception as e:
        logger.error(f"Failed to generate suggestions: {e}")
        # Return fallback suggestions
        return SuggestionsResponse(
            suggestions=[
                StorySuggestion(
                    prompt=f"A {level} learner discovers a hidden cafe in their neighborhood and befriends the owner.",
                    genre="slice of life",
                    reason="Classic language learning scenario with everyday vocabulary",
                    vocabulary_themes=["food", "conversation", "neighborhood"],
                ),
                StorySuggestion(
                    prompt="A mystery unfolds at a local library when books start disappearing.",
                    genre="mystery",
                    reason="Engaging plot with academic vocabulary",
                    vocabulary_themes=["books", "investigation", "buildings"],
                ),
            ]
        )


@router.get("/jobs")
async def list_story_jobs():
    """List all active story generation jobs."""
    return {"jobs": active_story_jobs}


@router.post("/jobs/{job_id}/cancel")
async def cancel_story_job(job_id: str):
    """Cancel a running story generation job."""
    if job_id not in active_story_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    active_story_jobs[job_id]["cancelled"] = True
    active_story_jobs[job_id]["status"] = "cancelled"
    active_story_jobs[job_id]["message"] = "Job cancelled by user"

    return {"success": True, "message": "Job cancellation requested"}

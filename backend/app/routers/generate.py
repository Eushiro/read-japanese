"""
Story generation API endpoints
"""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.services.generation.audio_generator import AudioGenerator
from app.services.generation.pipeline import StoryPipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/generate", tags=["Generation"])

# Store generation status
_generation_status = {}


class StoryGenerationRequest(BaseModel):
    """Request body for story generation"""

    jlpt_level: str = Field(..., pattern="^N[1-5]$", description="JLPT level (N5-N1)")
    genre: str = Field(..., min_length=2, description="Story genre")
    theme: str | None = Field(None, description="Optional theme/topic")
    num_chapters: int = Field(5, ge=1, le=10, description="Number of chapters")
    words_per_chapter: int = Field(100, ge=50, le=500, description="Approx characters per chapter")
    voice: str = Field("makoto", description="TTS voice name")
    image_style: str = Field("anime", description="Cover art style")
    generate_audio: bool = Field(True, description="Generate audio narration")
    generate_image: bool = Field(True, description="Generate cover image")
    generate_chapter_images: bool = Field(True, description="Generate chapter illustrations")
    align_audio: bool = Field(True, description="Align audio with text for word-level timestamps")


class IdeaGenerationRequest(BaseModel):
    """Request body for idea generation"""

    jlpt_level: str = Field(..., pattern="^N[1-5]$")


class StoryGenerationResponse(BaseModel):
    """Response for story generation"""

    status: str
    story_id: str | None = None
    message: str


@router.post("/story", response_model=StoryGenerationResponse)
async def generate_story(request: StoryGenerationRequest, background_tasks: BackgroundTasks):
    """
    Generate a complete story with audio and cover image.

    This endpoint starts generation in the background and returns immediately.
    Use GET /generate/status/{story_id} to check progress.
    """
    import uuid

    # Generate a temporary ID for tracking
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    _generation_status[job_id] = {"status": "pending", "progress": "Starting..."}

    # Run generation in background
    background_tasks.add_task(_generate_story_task, job_id, request)

    return StoryGenerationResponse(
        status="pending",
        story_id=job_id,
        message="Story generation started. Check /generate/status/{story_id} for progress.",
    )


async def _generate_story_task(job_id: str, request: StoryGenerationRequest):
    """Background task for story generation"""
    try:
        _generation_status[job_id] = {"status": "running", "progress": "Generating story..."}

        pipeline = StoryPipeline()
        story = await pipeline.generate_complete_story(
            jlpt_level=request.jlpt_level,
            genre=request.genre,
            theme=request.theme,
            num_chapters=request.num_chapters,
            words_per_chapter=request.words_per_chapter,
            voice=request.voice,
            image_style=request.image_style,
            generate_audio=request.generate_audio,
            generate_image=request.generate_image,
            generate_chapter_images=request.generate_chapter_images,
            align_audio=request.align_audio,
        )

        _generation_status[job_id] = {
            "status": "completed",
            "progress": "Done",
            "story_id": story["id"],
            "story": story,
        }

    except Exception as e:
        logger.error(f"Story generation failed: {e}")
        _generation_status[job_id] = {"status": "failed", "progress": str(e), "error": str(e)}


@router.post("/story/sync")
async def generate_story_sync(request: StoryGenerationRequest):
    """
    Generate a complete story synchronously.
    Warning: This can take several minutes. Use /story for background generation.
    """
    try:
        pipeline = StoryPipeline()
        story = await pipeline.generate_complete_story(
            jlpt_level=request.jlpt_level,
            genre=request.genre,
            theme=request.theme,
            num_chapters=request.num_chapters,
            words_per_chapter=request.words_per_chapter,
            voice=request.voice,
            image_style=request.image_style,
            generate_audio=request.generate_audio,
            generate_image=request.generate_image,
            generate_chapter_images=request.generate_chapter_images,
            align_audio=request.align_audio,
        )

        return {"status": "completed", "story": story}

    except Exception as e:
        logger.error(f"Story generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/status/{job_id}")
async def get_generation_status(job_id: str):
    """Get the status of a story generation job"""
    if job_id not in _generation_status:
        raise HTTPException(status_code=404, detail="Job not found")

    return _generation_status[job_id]


@router.post("/ideas")
async def generate_ideas(request: IdeaGenerationRequest):
    """Generate story ideas for a given JLPT level"""
    try:
        pipeline = StoryPipeline()
        ideas = await pipeline.generate_ideas(request.jlpt_level)
        return ideas

    except Exception as e:
        logger.error(f"Idea generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/voices")
async def get_voices():
    """Get available TTS voices"""
    return AudioGenerator.get_available_voices()


@router.get("/genres")
async def get_genres():
    """Get suggested story genres"""
    return StoryPipeline.get_available_genres()


@router.get("/styles")
async def get_image_styles():
    """Get available cover art styles"""
    return StoryPipeline.get_available_image_styles()

"""Story endpoints"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.story import Story, StoryListItem
from app.services.story_service import get_story_service

router = APIRouter()


@router.get("/stories", response_model=List[StoryListItem])
async def list_stories(
    level: Optional[str] = Query(None, description="Filter by JLPT level (N5, N4, N3, N2, N1)")
):
    """
    Get list of all available stories.
    Optionally filter by JLPT level.
    """
    service = get_story_service()

    if level:
        return service.get_stories_by_level(level)

    return service.get_all_stories()


@router.get("/stories/{story_id}", response_model=Story)
async def get_story(story_id: str):
    """
    Get a specific story by ID with full content.
    """
    service = get_story_service()
    story = service.get_story_by_id(story_id)

    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    return story


@router.post("/stories/reload")
async def reload_stories():
    """
    Reload all stories from disk.
    Useful after adding new story files.
    """
    service = get_story_service()
    service.reload_stories()
    return {"message": "Stories reloaded", "count": len(service.get_all_stories())}

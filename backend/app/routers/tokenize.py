"""Tokenization endpoints for story creation"""
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

from app.models.story import Token
from app.services.tokenizer import get_tokenizer_service

router = APIRouter()


class TokenizeRequest(BaseModel):
    """Request body for tokenization"""
    text: str


class TokenizeResponse(BaseModel):
    """Response with tokenized text"""
    tokens: List[Token]
    original: str


@router.post("/tokenize", response_model=TokenizeResponse)
async def tokenize_text(request: TokenizeRequest):
    """
    Tokenize Japanese text into words with readings.

    Useful for creating new stories - paste raw Japanese text
    and get back tokenized output with furigana readings.
    """
    service = get_tokenizer_service()
    tokens = service.tokenize_text(request.text)

    return TokenizeResponse(
        tokens=tokens,
        original=request.text
    )

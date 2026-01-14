"""Dictionary lookup endpoint - proxies Jisho API to avoid CORS issues."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter()


class DictionaryEntry(BaseModel):
    word: str
    reading: str
    meanings: list[str]
    partOfSpeech: str | None = None


class DictionaryResponse(BaseModel):
    entries: list[DictionaryEntry]


@router.get("/dictionary/{word}", response_model=DictionaryResponse)
async def lookup_word(word: str):
    """Look up a Japanese word using Jisho API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://jisho.org/api/v1/search/words",
                params={"keyword": word},
            )
            response.raise_for_status()
            data = response.json()

        entries = []
        for item in data.get("data", [])[:3]:  # Limit to 3 results
            japanese = item.get("japanese", [{}])[0]
            word_text = japanese.get("word", japanese.get("reading", ""))
            reading = japanese.get("reading", word_text)

            senses = item.get("senses", [])
            meanings = []
            parts_of_speech = []

            for sense in senses[:3]:  # Limit meanings per entry
                english_defs = sense.get("english_definitions", [])
                if english_defs:
                    meanings.append(", ".join(english_defs[:3]))
                pos = sense.get("parts_of_speech", [])
                if pos:
                    parts_of_speech.extend(pos)

            # Deduplicate and clean up parts of speech
            parts_of_speech = list(dict.fromkeys(parts_of_speech))[:2]

            if meanings:
                entries.append(DictionaryEntry(
                    word=word_text,
                    reading=reading,
                    meanings=meanings,
                    partOfSpeech=", ".join(parts_of_speech) if parts_of_speech else None,
                ))

        return DictionaryResponse(entries=entries)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Dictionary lookup timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Dictionary lookup failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

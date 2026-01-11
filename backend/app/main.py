"""
Japanese Reader API
FastAPI backend for serving stories, audio, and images
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.routers import stories, health, tokenize

app = FastAPI(
    title="Japanese Reader API",
    description="API for Japanese graded reader stories with audio and images",
    version="0.1.0"
)

# CORS middleware for iOS app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(stories.router, prefix="/api", tags=["Stories"])
app.include_router(tokenize.router, prefix="/api", tags=["Tokenization"])

# Mount static files for audio and images
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/cdn", StaticFiles(directory=str(static_path)), name="static")

@app.get("/")
async def root():
    return {
        "name": "Japanese Reader API",
        "version": "0.1.0",
        "docs": "/docs"
    }

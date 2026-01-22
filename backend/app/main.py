"""
Japanese Reader API
FastAPI backend for serving stories, audio, and images
"""
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from .env file
load_dotenv()

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from app.routers import stories, health, tokenize, generate, dictionary

# Environment configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
RATE_LIMIT = os.getenv("RATE_LIMIT", "100/minute")  # Default: 100 requests per minute

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Japanese Reader API",
    description="API for Japanese graded reader stories with audio and images",
    version="0.1.0",
    docs_url="/docs" if ENVIRONMENT == "development" else None,  # Disable docs in production
    redoc_url="/redoc" if ENVIRONMENT == "development" else None,
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression for JSON responses (70-80% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware for iOS app
# In production, set ALLOWED_ORIGINS to your specific domain(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

logger.info(f"Starting in {ENVIRONMENT} mode")
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
logger.info(f"Rate limit: {RATE_LIMIT}")

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(stories.router, prefix="/api", tags=["Stories"])
app.include_router(tokenize.router, prefix="/api", tags=["Tokenization"])
app.include_router(generate.router, prefix="/api", tags=["Generation"])
app.include_router(dictionary.router, prefix="/api", tags=["Dictionary"])

# Mount static files for audio and images
static_path = Path(__file__).parent / "static"
static_path = static_path.resolve()  # Make absolute
logger.info(f"Static files path: {static_path} (exists: {static_path.exists()})")
if static_path.exists():
    app.mount("/cdn", StaticFiles(directory=str(static_path)), name="static")
    logger.info("Static files mounted at /cdn")


@app.on_event("startup")
async def startup_event():
    """Pre-warm dictionary indexes on startup for fast autocomplete."""
    import asyncio

    async def warm_dictionaries():
        try:
            # Import and build Japanese index in background
            from app.routers.dictionary import build_japanese_index
            logger.info("Pre-warming Japanese dictionary index...")
            build_japanese_index()
            logger.info("Japanese dictionary index ready")
        except Exception as e:
            logger.warning(f"Failed to pre-warm dictionary: {e}")

    # Run in background so startup isn't blocked
    asyncio.create_task(warm_dictionaries())


@app.get("/")
@limiter.limit(RATE_LIMIT)
async def root(request: Request):
    return {
        "name": "Japanese Reader API",
        "version": "0.1.0",
        "docs": "/docs" if ENVIRONMENT == "development" else None
    }


# Debug endpoint (only in development)
if ENVIRONMENT == "development":
    @app.get("/debug/static")
    async def debug_static():
        """Debug endpoint to check static file configuration"""
        static_path = Path(__file__).parent / "static"
        audio_path = static_path / "audio"
        return {
            "cwd": os.getcwd(),
            "__file__": str(Path(__file__).resolve()),
            "static_path": str(static_path.resolve()),
            "static_exists": static_path.exists(),
            "audio_path": str(audio_path.resolve()) if audio_path.exists() else None,
            "audio_files": [f.name for f in audio_path.iterdir()] if audio_path.exists() else []
        }

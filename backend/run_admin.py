#!/usr/bin/env python3
"""
Run the Admin Batch Server

A lightweight server for triggering batch generation from the admin UI.
Runs on port 8001 by default.

Usage:
    python run_admin.py

Or with custom port:
    API_PORT=8002 python run_admin.py
"""

import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from web/.env.local (shared with frontend)
env_path = Path(__file__).parent.parent / "web" / ".env.local"
load_dotenv(env_path)

# Import the admin batch router
from app.routers.admin_batch import router as admin_router  # noqa: E402

# Create a minimal FastAPI app
app = FastAPI(
    title="SanLang Admin Batch Server",
    description="API for triggering batch content generation from the admin UI",
    version="1.0.0",
    docs_url="/docs",
)

# CORS - allow admin panel requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include admin router (without prefix since it already has /admin)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {
        "name": "SanLang Admin Batch Server",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "/admin/health",
            "generate_sentences": "POST /admin/generate/sentences",
            "generate_audio": "POST /admin/generate/audio",
            "generate_images": "POST /admin/generate/images",
            "list_jobs": "/admin/jobs",
        },
    }


@app.get("/health")
async def health():
    """Root health check (alias for /admin/health)"""
    convex_url = os.getenv("VITE_CONVEX_URL") or os.getenv("CONVEX_URL")
    gemini_key = os.getenv("GEMINI_API_KEY")
    return {
        "status": "ok",
        "version": "1.0.0",
        "convex_configured": bool(convex_url),
        "gemini_configured": bool(gemini_key),
    }


if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("ADMIN_PORT", os.getenv("API_PORT", "8001")))

    print(f"Starting Admin Batch Server on {host}:{port}")
    print(f"Docs available at http://localhost:{port}/docs")
    print()
    print("Environment:")
    print(
        f"  CONVEX_URL: {'configured' if os.getenv('VITE_CONVEX_URL') or os.getenv('CONVEX_URL') else 'NOT SET'}"
    )
    print(f"  GEMINI_API_KEY: {'configured' if os.getenv('GEMINI_API_KEY') else 'NOT SET'}")
    print()

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )

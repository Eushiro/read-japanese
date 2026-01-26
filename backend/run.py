#!/usr/bin/env python3
"""Run the Japanese Reader API server"""
import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from web/.env.local (shared with frontend)
env_path = Path(__file__).parent.parent / "web" / ".env.local"
load_dotenv(env_path)

if __name__ == "__main__":
    # Configuration from environment
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    environment = os.getenv("ENVIRONMENT", "development")

    # Only enable reload in development
    reload = environment == "development"

    # Workers: only use multiple workers in production
    workers = int(os.getenv("WORKERS", "1")) if not reload else 1

    print(f"Starting server on {host}:{port} ({environment} mode)")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        workers=workers if not reload else 1,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )

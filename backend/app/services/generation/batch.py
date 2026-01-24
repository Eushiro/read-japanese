"""
Google Gemini Batch API wrapper for cost-efficient bulk generation.

The Batch API processes requests asynchronously at 50% of the standard cost.
Use this for generating content for many items (100+ sentences, etc.).

Usage:
    from app.services.generation.batch import BatchJobRunner

    runner = BatchJobRunner()

    # Create and run a batch job
    results = await runner.run_batch(
        requests=[
            {"key": "word_1", "prompt": "Generate a sentence for 食べる"},
            {"key": "word_2", "prompt": "Generate a sentence for 飲む"},
        ],
        system_prompt="You are a Japanese language teacher...",
        model="gemini-3-flash-preview",
    )

    # Results is a dict: {"word_1": "response text", "word_2": "response text"}
"""

import asyncio
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Batch API configuration
BATCH_API_POLL_INTERVAL = 30  # seconds
BATCH_API_MAX_WAIT = 24 * 60 * 60  # 24 hours (batch jobs can take a while)


@dataclass
class BatchRequest:
    """A single request in a batch job"""

    key: str  # Unique identifier to match response
    prompt: str  # User prompt
    system_prompt: Optional[str] = None  # Optional system instruction


@dataclass
class BatchJobStatus:
    """Status of a batch job"""

    name: str
    state: str  # PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED, EXPIRED
    total_requests: int = 0
    succeeded_requests: int = 0
    failed_requests: int = 0


class BatchJobRunner:
    """
    Runs batch jobs using Google Gemini Batch API.

    This provides 50% cost savings for large generation tasks.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not set")
        self.client = genai.Client(api_key=self.api_key)

    def _build_jsonl_content(
        self,
        requests: List[BatchRequest],
        model: str,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Any] = None,
    ) -> str:
        """Build JSONL content for batch upload"""
        lines = []

        for req in requests:
            # Build the request object
            request_obj: Dict[str, Any] = {
                "contents": [{"role": "user", "parts": [{"text": req.prompt}]}],
            }

            # Add system instruction if provided
            if req.system_prompt:
                request_obj["systemInstruction"] = {
                    "parts": [{"text": req.system_prompt}]
                }

            # Add generation config for structured output
            if response_mime_type or response_schema:
                gen_config: Dict[str, Any] = {}
                if response_mime_type:
                    gen_config["responseMimeType"] = response_mime_type
                if response_schema:
                    gen_config["responseSchema"] = response_schema
                request_obj["generationConfig"] = gen_config

            # Build the full line with key
            line = {"key": req.key, "request": request_obj}
            lines.append(json.dumps(line, ensure_ascii=False))

        return "\n".join(lines)

    async def _upload_batch_file(self, jsonl_content: str, display_name: str) -> str:
        """Upload JSONL content to Gemini Files API"""
        # Write to temp file
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False, encoding="utf-8"
        ) as f:
            f.write(jsonl_content)
            temp_path = Path(f.name)

        try:
            # Upload using Files API
            uploaded_file = self.client.files.upload(
                file=temp_path,
                config=types.UploadFileConfig(
                    display_name=display_name,
                    mime_type="application/jsonl",
                ),
            )
            logger.info(f"Uploaded batch file: {uploaded_file.name}")
            return uploaded_file.name
        finally:
            temp_path.unlink(missing_ok=True)

    async def create_batch_job(
        self,
        requests: List[BatchRequest],
        model: str = "gemini-3-flash-preview",
        display_name: Optional[str] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Any] = None,
    ) -> BatchJobStatus:
        """
        Create a batch job from a list of requests.

        Args:
            requests: List of BatchRequest objects
            model: Model to use (default: gemini-3-flash-preview)
            display_name: Optional name for the job
            response_mime_type: Optional MIME type for structured output
            response_schema: Optional JSON schema for structured output

        Returns:
            BatchJobStatus with job name and initial state
        """
        if not requests:
            raise ValueError("No requests provided")

        display_name = display_name or f"batch_{int(time.time())}"

        # Build and upload JSONL
        jsonl_content = self._build_jsonl_content(
            requests, model, response_mime_type, response_schema
        )
        file_name = await self._upload_batch_file(jsonl_content, f"{display_name}.jsonl")

        # Create batch job
        batch_job = self.client.batches.create(
            model=f"models/{model}",
            src=file_name,
            config=types.CreateBatchJobConfig(display_name=display_name),
        )

        logger.info(f"Created batch job: {batch_job.name} (state: {batch_job.state})")

        return BatchJobStatus(
            name=batch_job.name,
            state=str(batch_job.state),
        )

    async def get_job_status(self, job_name: str) -> BatchJobStatus:
        """Get the current status of a batch job"""
        job = self.client.batches.get(name=job_name)

        return BatchJobStatus(
            name=job.name,
            state=str(job.state),
        )

    async def wait_for_completion(
        self,
        job_name: str,
        poll_interval: int = BATCH_API_POLL_INTERVAL,
        max_wait: int = BATCH_API_MAX_WAIT,
        on_progress: Optional[Callable[[BatchJobStatus], None]] = None,
    ) -> Dict[str, str]:
        """
        Wait for a batch job to complete and return results.

        Args:
            job_name: Name of the batch job
            poll_interval: Seconds between status checks
            max_wait: Maximum seconds to wait
            on_progress: Optional callback for progress updates

        Returns:
            Dict mapping request keys to response texts
        """
        start_time = time.time()
        final_states = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"}

        while True:
            elapsed = time.time() - start_time
            if elapsed > max_wait:
                raise TimeoutError(f"Batch job {job_name} did not complete within {max_wait}s")

            job = self.client.batches.get(name=job_name)
            state = str(job.state)

            if on_progress:
                on_progress(BatchJobStatus(name=job.name, state=state))

            logger.info(f"Batch job {job_name}: {state} ({elapsed:.0f}s elapsed)")

            if state in final_states:
                break

            await asyncio.sleep(poll_interval)

        # Check final state
        if state != "JOB_STATE_SUCCEEDED":
            raise RuntimeError(f"Batch job failed with state: {state}")

        # Download results
        return await self._download_results(job)

    async def _download_results(self, job) -> Dict[str, str]:
        """Download and parse batch job results"""
        results = {}

        # Get result file
        if hasattr(job, "dest") and hasattr(job.dest, "file_name"):
            result_file_name = job.dest.file_name

            # Download file content
            file_content = self.client.files.download(file=result_file_name)

            # Parse JSONL results
            for line in file_content.decode("utf-8").strip().split("\n"):
                if not line:
                    continue
                try:
                    result = json.loads(line)
                    key = result.get("key", "")
                    response = result.get("response", {})

                    # Extract text from response
                    text = ""
                    candidates = response.get("candidates", [])
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        if parts:
                            text = parts[0].get("text", "")

                    if key:
                        results[key] = text
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse result line: {line[:100]}")

        # Handle inline responses (for smaller batches)
        elif hasattr(job, "dest") and hasattr(job.dest, "inlined_responses"):
            for response in job.dest.inlined_responses:
                key = response.key
                text = ""
                if response.response and response.response.candidates:
                    candidate = response.response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        text = candidate.content.parts[0].text
                results[key] = text

        logger.info(f"Downloaded {len(results)} results")
        return results

    async def run_batch(
        self,
        requests: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        model: str = "gemini-3-flash-preview",
        display_name: Optional[str] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Any] = None,
        poll_interval: int = BATCH_API_POLL_INTERVAL,
        on_progress: Optional[Callable[[BatchJobStatus], None]] = None,
    ) -> Dict[str, str]:
        """
        Convenience method to create, run, and get results from a batch job.

        Args:
            requests: List of dicts with "key" and "prompt" fields
            system_prompt: Optional system instruction for all requests
            model: Model to use
            display_name: Optional job name
            response_mime_type: Optional MIME type for structured output
            response_schema: Optional JSON schema for structured output
            poll_interval: Seconds between status checks
            on_progress: Optional callback for progress updates

        Returns:
            Dict mapping request keys to response texts
        """
        # Convert to BatchRequest objects
        batch_requests = [
            BatchRequest(
                key=r["key"],
                prompt=r["prompt"],
                system_prompt=system_prompt,
            )
            for r in requests
        ]

        # Create job
        job = await self.create_batch_job(
            requests=batch_requests,
            model=model,
            display_name=display_name,
            response_mime_type=response_mime_type,
            response_schema=response_schema,
        )

        # Wait for completion
        return await self.wait_for_completion(
            job_name=job.name,
            poll_interval=poll_interval,
            on_progress=on_progress,
        )


# Convenience function for simple text generation batches
async def run_text_batch(
    prompts: Dict[str, str],
    system_prompt: Optional[str] = None,
    model: str = "gemini-3-flash-preview",
) -> Dict[str, str]:
    """
    Simple wrapper for running a batch of text generation requests.

    Args:
        prompts: Dict mapping keys to prompts
        system_prompt: Optional system instruction
        model: Model to use

    Returns:
        Dict mapping keys to generated texts

    Example:
        results = await run_text_batch({
            "word_1": "Generate a sentence using 食べる",
            "word_2": "Generate a sentence using 飲む",
        })
    """
    runner = BatchJobRunner()
    requests = [{"key": k, "prompt": v} for k, v in prompts.items()]
    return await runner.run_batch(requests, system_prompt=system_prompt, model=model)

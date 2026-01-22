"""
OpenRouter API client for accessing free and paid LLM models.
Uses OpenAI-compatible API format.
"""
import os
import json
import logging
from typing import Optional
from openai import AsyncOpenAI

from ..config.models import ModelConfig

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """
    Client for OpenRouter API.
    Provides access to various LLMs including Gemini models.
    """

    def __init__(self, model: Optional[str] = None):
        """
        Initialize OpenRouter client.

        Args:
            model: Model to use. Defaults to TEXT_MODEL from config.
        """
        if not ModelConfig.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY environment variable not set")

        self.client = AsyncOpenAI(
            base_url=ModelConfig.OPENROUTER_BASE_URL,
            api_key=ModelConfig.OPENROUTER_API_KEY
        )
        self.model = model or ModelConfig.TEXT_MODEL

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        temperature: float = 0.7
    ) -> str:
        """
        Generate text completion.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            json_mode: Whether to request JSON output
            temperature: Sampling temperature (0-1)

        Returns:
            Generated text response
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        logger.info(f"OpenRouter request: model={self.model}, json_mode={json_mode}")

        response = await self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content

        logger.info(f"OpenRouter response: {len(content)} chars")
        return content

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ) -> dict:
        """
        Generate JSON response.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Sampling temperature

        Returns:
            Parsed JSON response as dict
        """
        response = await self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            json_mode=True,
            temperature=temperature
        )
        return json.loads(response)


# Singleton instance
_client: Optional[OpenRouterClient] = None


def get_openrouter_client() -> OpenRouterClient:
    """Get or create singleton OpenRouter client."""
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client

"""AI-powered PDF parser for blood test results - supports multiple providers."""

import httpx
import base64
import json
import logging
from typing import List, Dict, Any, Optional
from app.config import settings


SYSTEM_PROMPT = """You are a medical lab result extractor. Extract all blood test markers from the provided document and return them as a JSON array of objects with these fields:
- marker_name: The exact name of the test (e.g., "HbA1c", "Fasting Glucose")
- value: The numeric value measured
- unit: Units like mg/dL, mmol/L, IU/L, etc.
- category: Which category this belongs to (lipids, glucose, cbc, liver, kidney, thyroid)
- low_ref: Lower bound of normal range if shown
- high_ref: Upper bound of normal range if shown
- test_date: The date this test was performed (extract from the document header/footer). Return as YYYY-MM-DD string or null if not found. Include this field on every marker object.

Return ONLY the JSON array, nothing else."""


def _get_api_url() -> str:
    """Get the API base URL based on configured provider."""
    if settings.AI_BASE_URL:
        return settings.AI_BASE_URL.rstrip('/') + '/v1/chat/completions'

    provider = settings.AI_PROVIDER.lower()
    urls = {
        'abacusai': 'https://routellm.abacus.ai/v1/chat/completions',
        'openai': 'https://api.openai.com/v1/chat/completions',
        'anthropic': None,  # Anthropic uses different API, handled separately
    }

    if provider in urls:
        return urls[provider]
    raise ValueError(f"Unknown AI provider: {settings.AI_PROVIDER}")


async def call_ai_api(messages: list, model: str = None) -> str:
    """Universal AI chat completion caller - works with OpenAI-compatible APIs."""
    api_key = settings.AI_API_KEY
    if not api_key:
        raise ValueError(f"AI_API_KEY not configured for provider {settings.AI_PROVIDER}")

    model_name = model or settings.AI_MODEL
    url = _get_api_url()

    # Check if this is Anthropic (different API format)
    if settings.AI_PROVIDER.lower() == 'anthropic':
        return await _call_anthropic(messages, model_name)

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 16384,
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"{settings.AI_PROVIDER.title()} API error: {response.text}")

        return _parse_response(response.json())


async def _call_anthropic(messages: list, model_name: str) -> str:
    """Call Anthropic's native API (non-OpenAI format)."""
    # Convert messages format if needed - Anthropic uses content blocks
    system_prompt = SYSTEM_PROMPT  # Will be set by caller or use default
    payload_messages = [msg for msg in messages if msg['role'] != 'system']

    # Extract system message if present
    system_msg = ""
    for msg in messages:
        if msg.get('role') == 'system':
            system_msg = msg.get('content', '')
            break

    payload = {
        "model": model_name,
        "system": system_msg or SYSTEM_PROMPT,
        "messages": payload_messages,
        "max_tokens": 4096,
        "temperature": 0.1
    }

    async with httpx.AsyncClient(timeout=600.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.AI_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            },
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"Anthropic API error: {response.text}")

        result = response.json()
        # Parse Anthropic response format
        try:
            return result['content'][0]['text']
        except (KeyError, IndexError):
            raise Exception("Invalid Anthropic response structure")


def _parse_response(api_result: Dict[str, Any]) -> str:
    """Extract text content from OpenAI-compatible response."""
    try:
        content = api_result['choices'][0]['message']['content']
        return content if content else ""
    except (KeyError, IndexError):
        raise Exception(f"Invalid AI response structure: {api_result}")


async def parse_pdf_with_ai(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Parse blood test PDF using configured AI provider."""
    pages = _convert_pdf_to_images(pdf_bytes)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if pages:
        content = [
            {"type": "text", "text": "Please read this medical laboratory report image and extract all test results into a JSON array."},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{pages[0]}",
                    "detail": "high"
                }
            }
        ]
        messages.append({"role": "user", "content": content})

        if len(pages) > 1:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{pages[1]}", "detail": "high"}}
                ]
            })

        messages.append({"role": "user", "content": [{"type": "text", "text": "Return ONLY a JSON array of all the test markers you see."}]})
    else:
        try:
            from PyPDF2 import PdfReader
            import io
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = "\n".join(page.extract_text() for page in reader.pages[:3])
            messages.append({"role": "user", "content": f"Extract blood test markers from this text:\n{text}"})
        except ImportError:
            raise Exception("No PDF processing libraries available")

    # Call the AI API
    raw_text = await call_ai_api(messages)

    # Parse JSON response
    return _extract_markers_from_text(raw_text)


def _convert_pdf_to_images(pdf_bytes: bytes) -> List[str]:
    """Convert PDF pages to base64 PNG images."""
    try:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(pdf_bytes, first_page=1, last_page=2, dpi=300)
        import io
        b64_images = []
        for page in pages:
            buffer = io.BytesIO()
            page.save(buffer, format="PNG")
            b64_images.append(base64.b64encode(buffer.getvalue()).decode('utf-8'))
        return b64_images
    except ImportError:
        return []


def _extract_markers_from_text(content: str) -> List[Dict[str, Any]]:
    """Parse AI response text into marker objects."""
    import re

    if not content or not isinstance(content, str):
        raise Exception("Empty or invalid response content from AI provider")

    try:
        markers = json.loads(content)
        return [m for m in markers if isinstance(m, dict)]
    except json.JSONDecodeError:
        # Try to find JSON-like structure in the response
        match = re.search(r'\[\s*{.*}\s*\]', content, re.DOTALL)
        if match:
            try:
                return [m for m in json.loads(match.group(0)) if isinstance(m, dict)]
            except json.JSONDecodeError:
                pass

        raise Exception(f"Could not parse response as JSON. AI returned: {content[:200]}...")


def get_supported_categories() -> List[str]:
    """Return list of known blood test categories for validation."""
    return ["lipids", "glucose", "cbc", "liver", "kidney", "thyroid"]

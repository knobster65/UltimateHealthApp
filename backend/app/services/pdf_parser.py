"""AbacusAI-powered PDF parser for blood test results."""

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

Return ONLY the JSON array, nothing else."""


async def parse_pdf_with_abacusai(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Send PDF pages to AbacusAI for intelligent extraction of blood test markers."""
    if not settings.ABACUSAI_API_KEY:
        raise ValueError("ABACUSAI_API_KEY not configured")

    # Extract text from PDF pages as base64 images for vision model
    pages = _convert_pdf_to_images(pdf_bytes)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if pages:
        # Send first page as image (covers most lab reports)
        content = [
            {"type": "text", "text": "Extract all blood test markers from this lab report."},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{pages[0]}",
                    "detail": "high"
                }
            }
        ]
        messages.append({"role": "user", "content": content})
    else:
        # Fallback to raw PDF text extraction attempt
        try:
            from PyPDF2 import PdfReader
            import io
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = "\n".join(page.extract_text() for page in reader.pages[:3])
            messages.append({"role": "user", "content": f"Extract blood test markers from this text:\n{text}"})
        except ImportError:
            raise Exception("No PDF processing libraries available")

    payload = {
        "model": settings.ABACUSAI_MODEL,
        "messages": messages,
        "temperature": 0.1
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://routellm.abacus.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.ABACUSAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"AbacusAI API error: {response.text}")

        raw_result = response.json()
        # Debug logging: save raw response to file for inspection
        try:
            with open("/tmp/abacusai_debug_response.txt", "w") as f:
                json.dump(raw_result, f, indent=2)
        except Exception:
            pass

        return _extract_markers_from_response(raw_result)


def _convert_pdf_to_images(pdf_bytes: bytes) -> List[str]:
    """Convert PDF pages to base64 PNG images."""
    try:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=200)
        import io
        b64_images = []
        for page in pages:
            buffer = io.BytesIO()
            page.save(buffer, format="PNG")
            b64_images.append(base64.b64encode(buffer.getvalue()).decode('utf-8'))
        return b64_images
    except ImportError:
        return []


def _extract_markers_from_response(api_response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse the AbacusAI response into marker objects."""
    import re

    try:
        content = api_response["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        logging.error(f"AbacusAI raw response structure: {api_response}")
        raise Exception("Invalid response structure from AbacusAI API")

    if not content or not isinstance(content, str):
        raise Exception("Empty or invalid response content from AbacusAI")

    try:
        markers = json.loads(content)
        return [m for m in markers if isinstance(m, dict)]
    except json.JSONDecodeError:
        # Try to find JSON-like structure in the response
        match = re.search(r'\[\s*{.*}\s*\]', content, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group(0))
                return [m for m in result if isinstance(m, dict)]
            except json.JSONDecodeError:
                pass

        raise Exception(f"Could not parse response as JSON. Model returned: {content[:200]}...")


def get_supported_categories() -> List[str]:
    """Return list of known blood test categories for validation."""
    return ["lipids", "glucose", "cbc", "liver", "kidney", "thyroid"]
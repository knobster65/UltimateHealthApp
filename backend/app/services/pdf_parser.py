"""AbacusAI-powered PDF parser for blood test results."""

import httpx
import base64
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
    """Send PDF to AbacusAI for intelligent extraction of blood test markers."""
    if not settings.ABACUSAI_API_KEY:
        raise ValueError("ABACUSAI_API_KEY not configured")

    # Convert PDF to base64 for API
    pdf_b64 = base64.b64encode(pdf_bytes).decode('utf-8')

    payload = {
        "model": settings.ABACUSAI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "document", "source": pdf_b64}
            ]}
        ],
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.abacus.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.ABACUSAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"AbacusAI API error: {response.text}")

        result = response.json()
        return _extract_markers_from_response(result)


def _extract_markers_from_response(api_response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse the AbacusAI response into marker objects."""
    import json

    try:
        content = api_response["choices"][0]["message"]["content"]
        markers = json.loads(content)
        return [m for m in markers if isinstance(m, dict)]
    except (KeyError, IndexError, json.JSONDecodeError):
        raise Exception("Failed to parse AbacusAI response")


def get_supported_categories() -> List[str]:
    """Return list of known blood test categories for validation."""
    return ["lipids", "glucose", "cbc", "liver", "kidney", "thyroid"]

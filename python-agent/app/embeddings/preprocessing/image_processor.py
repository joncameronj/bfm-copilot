"""
Image Processor - Extract content from images using GPT-4 Vision API.

Handles various medical test result images:
- HRV (Heart Rate Variability) tests
- Depulse waveform analysis
- UA (Urinalysis) results
- Lab/Blood test results
"""

import base64
from pathlib import Path
from typing import Optional

from openai import OpenAI


# Prompts optimized for different image types
IMAGE_ANALYSIS_PROMPTS = {
    "hrv": """Analyze this HRV (Heart Rate Variability) test image and extract ALL information:

1. **Metrics & Values**: List every numerical metric shown with its value and units
2. **Interpretation Text**: Capture any interpretation or analysis text visible
3. **Status Indicators**: Note any colors, symbols, or status markers (normal/abnormal/warning)
4. **Test Type**: Identify if this is ortho, valsalva, baseline, or other test type
5. **Patient Info**: Note any visible patient identifiers (anonymize if needed)

Format as structured markdown with clear sections. Be thorough - this will be used for clinical reference.""",

    "depulse": """Analyze this Depulse pulse waveform image and extract:

1. **Waveform Characteristics**: Describe the pulse wave pattern and morphology
2. **Numerical Metrics**: List all visible metrics, values, and percentages
3. **Interpretation**: Capture any analysis or status indicators
4. **Arterial Assessment**: Note any assessments of arterial stiffness or vascular health

Format as structured clinical notes in markdown.""",

    "ua": """Extract all information from this Urinalysis (UA) test result:

1. **Test Parameters**: List each parameter tested
2. **Values**: Record the value for each parameter
3. **Reference Ranges**: Note normal ranges if shown
4. **Flags**: Mark any abnormal values (high/low/critical)
5. **Overall Interpretation**: Capture any summary or interpretation text

Format as a structured markdown table with columns: Parameter | Value | Reference | Flag""",

    "lab": """Extract all laboratory values from this lab result image:

1. **Test Name**: Full name of each test
2. **Value**: The measured value with units
3. **Reference Range**: Normal range if shown
4. **Flag Status**: High (H), Low (L), Normal, or Critical
5. **Panel/Category**: Group tests by panel if applicable

Format as structured markdown. Include a table for easy reference.
Pay special attention to any values flagged as abnormal.""",

    "blood": """Extract blood work results from this image:

1. **CBC (if present)**: WBC, RBC, Hemoglobin, Hematocrit, Platelets, etc.
2. **Metabolic Panel (if present)**: Glucose, BUN, Creatinine, Electrolytes, etc.
3. **Lipid Panel (if present)**: Total Cholesterol, LDL, HDL, Triglycerides
4. **Other Markers**: Any additional blood tests shown

For each value include: Test Name | Value | Units | Reference Range | Flag

Format as structured markdown tables grouped by panel.""",

    "nes": """Extract information from this NES (Neuro-Energetic Scan) template or result:

1. **Assessment Categories**: List all assessment areas
2. **Scores/Values**: Record any numerical scores or readings
3. **Interpretations**: Capture any text interpretations
4. **Recommendations**: Note any suggested interventions

Format as structured markdown.""",

    "general": """Analyze this medical/health-related image and extract all relevant information:

1. **Document Type**: What type of result/report is this?
2. **Key Metrics**: List all numerical values with their labels
3. **Interpretation**: Capture any analysis or interpretation text
4. **Notable Findings**: Highlight any abnormal or significant findings

Format as structured markdown. Be comprehensive - this will be used for clinical reference.""",
}


def detect_image_type(filename: str) -> str:
    """
    Infer image type from filename.

    Args:
        filename: The image filename

    Returns:
        Image type string (hrv, depulse, ua, lab, blood, nes, general)
    """
    filename_lower = filename.lower()

    type_keywords = {
        "hrv": ["hrv", "heart rate", "variability", "valsalva", "ortho"],
        "depulse": ["depulse", "pulse wave", "arterial"],
        "ua": ["ua", "urinalysis", "urine"],
        "lab": ["lab"],
        "blood": ["blood", "cbc", "metabolic", "lipid"],
        "nes": ["nes", "neuro", "scan", "template"],
    }

    for image_type, keywords in type_keywords.items():
        for keyword in keywords:
            if keyword in filename_lower:
                return image_type

    return "general"


async def process_image_with_vision(
    image_path: Path,
    image_type: Optional[str] = None,
    additional_context: Optional[str] = None,
) -> dict:
    """
    Process an image using GPT-4 Vision API to extract structured content.

    Args:
        image_path: Path to the image file
        image_type: Type of image (hrv, depulse, ua, lab, blood, nes, general)
                   If None, will be auto-detected from filename
        additional_context: Optional additional context to include in the prompt

    Returns:
        Dictionary with:
        - extracted_text: Markdown formatted content extracted from image
        - image_type: The type of image processed
        - original_path: Path to the original image
        - tokens_used: Approximate tokens used for the request
    """
    if image_type is None:
        image_type = detect_image_type(image_path.name)

    # Read and encode image
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    # Determine MIME type
    suffix = image_path.suffix.lower()
    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    mime_type = mime_types.get(suffix, "image/png")

    # Get appropriate prompt
    prompt = IMAGE_ANALYSIS_PROMPTS.get(image_type, IMAGE_ANALYSIS_PROMPTS["general"])

    if additional_context:
        prompt = f"{prompt}\n\nAdditional context: {additional_context}"

    # Call Vision API
    client = OpenAI()

    response = client.chat.completions.create(
        model="gpt-4o",  # Vision-capable model
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}",
                            "detail": "high",  # Use high detail for medical images
                        },
                    },
                ],
            }
        ],
        max_tokens=2000,
    )

    extracted_text = response.choices[0].message.content

    return {
        "extracted_text": extracted_text,
        "image_type": image_type,
        "original_path": str(image_path),
        "tokens_used": response.usage.total_tokens if response.usage else 0,
    }


async def process_images_batch(
    image_paths: list[Path],
    max_concurrent: int = 5,
) -> list[dict]:
    """
    Process multiple images with rate limiting.

    Args:
        image_paths: List of image file paths
        max_concurrent: Maximum concurrent API calls

    Returns:
        List of extraction results
    """
    import asyncio

    semaphore = asyncio.Semaphore(max_concurrent)
    results = []

    async def process_with_semaphore(path: Path) -> dict:
        async with semaphore:
            try:
                result = await process_image_with_vision(path)
                result["success"] = True
                return result
            except Exception as e:
                return {
                    "original_path": str(path),
                    "success": False,
                    "error": str(e),
                }

    tasks = [process_with_semaphore(path) for path in image_paths]
    results = await asyncio.gather(*tasks)

    return results

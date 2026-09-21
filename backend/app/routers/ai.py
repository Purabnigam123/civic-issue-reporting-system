import os
from fastapi import APIRouter, UploadFile, File
from ..services.ai_service import analyze_image
from ..middleware.upload import save_upload_file, ALLOWED_IMAGE_TYPES
from ..config.env import env
from ..utils.response import success_response, error_response

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/verify-issue")
async def verify_issue(image: UploadFile = File(...)):
    """
    AI issue verification endpoint. Accepts a single image via multipart/form-data
    and runs computer vision inference to detect civic issues.
    """
    if not image or not image.filename:
        return error_response(
            "No image file provided. Please upload an image for AI analysis.",
            status_code=400
        )

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        return error_response(
            f"Invalid file type: {image.content_type}. Supported: JPEG, PNG, WebP, GIF.",
            status_code=400
        )

    # Save the uploaded image to uploads directory
    saved_filename, _ = await save_upload_file(image, fieldname="image")
    file_path = str(env.UPLOADS_DIR / saved_filename)

    # Run AI vision analysis
    result = await analyze_image(file_path)

    # Compute severity from confidence and category
    conf = result.get("confidence", 0.0)
    mapped_cat = result.get("mappedCategory", "other")
    if conf >= 0.9 or mapped_cat in ["water_issue", "drainage"]:
        severity = "HIGH" if conf < 0.95 else "CRITICAL"
    elif conf >= 0.7:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    return success_response(
        data={
            "verified": result["verified"],
            "category": result["category"],
            "mappedCategory": result["mappedCategory"],
            "confidence": result["confidence"],
            "severity": severity,
            "message": result["message"],
            "boundingBox": result.get("boundingBox") or None,
        },
        message="Issue detected and verified." if result["verified"] else "Verification failed.",
        status_code=200,
    )

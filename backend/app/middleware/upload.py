import uuid
from io import BytesIO
from fastapi import UploadFile
from ..config.env import env

ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
}

async def save_upload_file(file: UploadFile, fieldname: str = "file") -> tuple[str, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in CONTENT_TYPE_EXTENSIONS:
        raise ValueError("Unsupported upload type.")

    content = await file.read()
    if not content:
        raise ValueError("Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("Each upload must be 10 MB or smaller.")

    if content_type in ALLOWED_IMAGE_TYPES:
        try:
            from PIL import Image
            Image.open(BytesIO(content)).verify()
        except Exception as exc:
            raise ValueError("The uploaded image is invalid or corrupted.") from exc

    ext = CONTENT_TYPE_EXTENSIONS[content_type]
    unique_filename = f"{fieldname}_{uuid.uuid4().hex[:12]}{ext}"
    target_path = env.UPLOADS_DIR / unique_filename

    with open(target_path, "wb") as f:
        f.write(content)

    return unique_filename, str(target_path)

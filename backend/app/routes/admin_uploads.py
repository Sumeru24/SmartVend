import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from app.core.deps import require_staff

router = APIRouter(prefix="/admin/uploads", tags=["Admin · Uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads"
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_BYTES = 5 * 1024 * 1024


@router.post("/image", summary="Upload a product image")
async def upload_product_image(
    request: Request,
    file: UploadFile = File(...),
    _=Depends(require_staff),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, or WebP images are supported.",
        )
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be smaller than 5 MB.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    extension = ALLOWED_TYPES[file.content_type]
    filename = f"{uuid.uuid4().hex}{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(content)
    path = f"/static/uploads/{filename}"
    return {
        "filename": filename,
        "path": path,
        "url": str(request.base_url).rstrip("/") + path,
    }

from typing import Optional
from pydantic import BaseModel


class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class AIDetectionResult(BaseModel):
    verified: bool
    category: str
    mappedCategory: str
    confidence: float
    message: str
    boundingBox: Optional[BoundingBox] = None

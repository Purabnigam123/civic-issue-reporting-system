import os
import secrets
from pathlib import Path

class EnvConfig:
    def __init__(self):
        self.BASE_DIR = Path(__file__).resolve().parent.parent.parent
        self.UPLOADS_DIR = self.BASE_DIR / "uploads"
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.PORT = int(os.getenv("PORT", "5000"))
        self.MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/civic-issue-reporting")
        # Never ship a reusable default signing key. Development instances get a
        # per-process key; deployed instances must set JWT_SECRET explicitly.
        self.JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
        self.JWT_ALGORITHM = "HS256"
        self.JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))

env = EnvConfig()

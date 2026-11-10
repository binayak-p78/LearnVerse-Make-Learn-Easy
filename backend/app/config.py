import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
SHARED_DIR = Path(os.environ.get("MLE_SHARED_DIR", ROOT_DIR / "shared"))
CONTENT_DIR = Path(os.environ.get("MLE_CONTENT_DIR", BACKEND_DIR / "content"))
FRONTEND_DIST = Path(os.environ.get("MLE_FRONTEND_DIST", ROOT_DIR / "frontend" / "dist"))
CORS_ORIGINS = os.environ.get(
    "MLE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

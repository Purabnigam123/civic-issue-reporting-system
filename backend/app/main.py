from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config.db import connect_to_mongo, close_mongo_connection
from .config.env import env
from .routers import ai, auth, complaints, admin, zonal, worker, notifications, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()


app = FastAPI(
    title="Civic Issue Reporting System API",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(admin.router)
app.include_router(zonal.router)
app.include_router(worker.router)
app.include_router(notifications.router)
app.include_router(websocket.router)

# Upload names are generated server-side and uploads are limited to raster
# images/audio by the upload middleware. Keep this mount after API routers.
app.mount("/uploads", StaticFiles(directory=str(env.UPLOADS_DIR)), name="uploads")


@app.get("/api/health")
async def health_check():
    return {
        "success": True,
        "message": "Civic Issue Reporting API is running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "message": "Route not found"},
    )

"""UDAAN prototype API. Run: uvicorn app.main:app --reload (from backend/)."""
import logging
import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from pymongo.errors import PyMongoError  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from . import mongo, seed  # noqa: E402
from .llm import gemini  # noqa: E402
from .routers import account, admin, escalations, parent, reports, sessions, speech, student, teacher  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await mongo.init_mongo_indexes()
    except Exception as e:
        logging.warning("Could not initialize MongoDB indexes on startup: %s", str(e))
    seed.seed()
    yield


app = FastAPI(title="UDAAN API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
for r in (account.router, student.router, parent.router, reports.router, teacher.router, sessions.router,
          escalations.router, admin.router, speech.router):
    app.include_router(r)


@app.exception_handler(PyMongoError)
async def mongo_unavailable(_: Request, exc: PyMongoError):
    # Sign-in data lives in MongoDB; say so plainly instead of a bare 500 when it is missing or unreachable.
    logging.getLogger("udaan.mongo").error("MongoDB error: %s", str(exc)[:300])
    return JSONResponse(status_code=503, content={
        "detail": "Sign-in service unavailable: the account database (MongoDB) is not reachable. "
                  "Check MONGO_URI in the server settings."})


@app.get("/api/health")
async def health():
    return {"ok": True, "gemini": gemini.status(), "mongo": await mongo.status()}


# In production (one container on Render) the API also serves the built frontend from frontend/dist.
# Unknown paths fall back to index.html so React Router deep links like /student/stories work.
mimetypes.add_type("application/geo+json", ".geojson")
STATIC_DIR = Path(os.getenv("UDAAN_STATIC", Path(__file__).resolve().parents[2] / "frontend" / "dist")).resolve()
if (STATIC_DIR / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (STATIC_DIR / path).resolve()
        if path and file.is_file() and STATIC_DIR in file.parents:
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")

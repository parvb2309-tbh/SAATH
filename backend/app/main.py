"""SAATH prototype API. Run: uvicorn app.main:app --reload (from backend/)."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from . import seed  # noqa: E402
from .llm import gemini  # noqa: E402
from .routers import admin, escalations, sessions, speech  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed.seed()
    yield


app = FastAPI(title="SAATH API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
for r in (sessions.router, escalations.router, admin.router, speech.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True, "gemini": gemini.status()}

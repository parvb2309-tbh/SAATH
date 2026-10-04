"""Family-facing API: metadata, sessions, chat turns, pathway, manual escalation, parent updates."""
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db
from ..engine import quiz, responder, templates
from ..engine.concerns import LABELS, OBJECTIONS
from ..llm import gemini

router = APIRouter(prefix="/api", tags=["family"])

Member = Literal["learner", "mother", "father", "guardian"]
Lang = Literal["hi", "en"]
INCOME = [("lt10", "Below ₹10,000 / month", "₹10,000 महीना से कम"),
          ("10_25", "₹10,000–25,000 / month", "₹10,000–25,000 महीना"),
          ("25_50", "₹25,000–50,000 / month", "₹25,000–50,000 महीना"),
          ("gt50", "Above ₹50,000 / month", "₹50,000 महीना से ज़्यादा")]
SCHOOLING = [("8", "Class 8", "8वीं"), ("10", "Class 10", "10वीं"), ("12", "Class 12", "12वीं"),
             ("grad", "Graduate", "ग्रेजुएट")]


@router.get("/meta")
def meta():
    return {
        "districts": db.query("SELECT * FROM districts ORDER BY state, name_en"),
        "trades": db.query("SELECT id, name_en, name_hi, icon, sector_en, sector_hi, nsqf_level, duration_months, "
                           "min_schooling FROM trades"),
        "concerns": LABELS, "objections": OBJECTIONS,
        "income_brackets": [{"id": i, "en": e, "hi": h} for i, e, h in INCOME],
        "schooling": [{"id": i, "en": e, "hi": h} for i, e, h in SCHOOLING],
        "engine": gemini.status(),
    }


@router.get("/quiz")
def get_quiz():
    return quiz.public()


class SessionIn(BaseModel):
    members: list[Member] = Field(min_length=1)
    learner_gender: Literal["m", "f", "x"] = "x"
    district_id: str
    trade_id: str | None = None
    income_bracket: str = "lt10"
    schooling: str = "10"
    language: Lang = "hi"
    consent: bool
    phone: str = ""
    learner_age: int | None = Field(default=None, ge=10, le=60)
    quiz_answers: list[int | None] | None = None


@router.post("/sessions")
def create_session(body: SessionIn):
    if not body.consent:
        raise HTTPException(400, "Consent is required before we keep any information.")
    if not db.get_district(body.district_id):
        raise HTTPException(400, "Unknown district")
    if body.trade_id and not db.get_trade(body.trade_id):
        raise HTTPException(400, "Unknown trade")
    sid = uuid.uuid4().hex[:12]
    data = body.model_dump(exclude={"quiz_answers"})
    result = quiz.score(body.quiz_answers) if body.quiz_answers else None
    if result and not data["trade_id"] and result["matches"]:
        data["trade_id"] = result["matches"][0]["trade_id"]
    row = {**data, "id": sid, "created_at": db.now(), "consent": 1, "status": "active",
           "first_sentiment": result["keenness"] if result else None,
           "last_sentiment": result["keenness"] if result else None, "synthetic": 0,
           "quiz": {"answers": body.quiz_answers, "matches": result["matches"], "worries": result["worries"],
                    "keenness": result["keenness"]} if result else None}
    db.insert("sessions", row)
    if result and result["picked"]:
        # the quiz answers become the first entry of the conversation, so counsellors and the dashboard see them
        db.insert("messages", {"session_id": sid, "created_at": db.now(), "role": "user", "speaker": "family",
                               "text": quiz.summary_text(result["picked"], body.language), "lang": body.language,
                               "concerns": result["worries"] or ["other"], "sentiment": result["keenness"],
                               "engine": "quiz", "cards": []})
    responder.start_message(sid)
    return session_detail(sid)


@router.get("/sessions/{sid}")
def session_detail(sid: str):
    s = db.get_session(sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return {"session": s, "messages": db.get_messages(sid), "escalation": db.open_escalation(sid),
            "updates": db.query("SELECT * FROM updates WHERE session_id = ? ORDER BY id DESC", (sid,))}


class SessionPatch(BaseModel):
    trade_id: str | None = None
    language: Lang | None = None
    status: Literal["active", "interested", "thinking", "not_interested"] | None = None
    phone: str | None = None


@router.patch("/sessions/{sid}")
def patch_session(sid: str, body: SessionPatch):
    s = db.get_session(sid)
    if not s:
        raise HTTPException(404, "Session not found")
    changes = body.model_dump(exclude_none=True)
    if "trade_id" in changes and not db.get_trade(changes["trade_id"]):
        raise HTTPException(400, "Unknown trade")
    if changes:
        db.update("sessions", "id", sid, changes)
    if "trade_id" in changes and changes["trade_id"] != s.get("trade_id"):
        responder.start_message(sid)
    return session_detail(sid)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    speaker: Member = "learner"
    lang: Lang | None = None


@router.post("/sessions/{sid}/messages")
def post_message(sid: str, body: MessageIn):
    try:
        return responder.handle_turn(sid, body.text.strip(), body.speaker, body.lang)
    except KeyError:
        raise HTTPException(404, "Session not found")


class EscalateIn(BaseModel):
    phone: str = ""
    callback_time: str = ""
    note: str = ""


@router.post("/sessions/{sid}/escalate")
def manual_escalate(sid: str, body: EscalateIn):
    if not db.get_session(sid):
        raise HTTPException(404, "Session not found")
    if body.phone:
        db.update("sessions", "id", sid, {"phone": body.phone})
    return responder.escalate(sid, "manual", 2, body.phone, body.callback_time, body.note)


@router.get("/sessions/{sid}/pathway")
def session_pathway(sid: str):
    s = db.get_session(sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return pathway(s)


def pathway(session: dict) -> dict:
    """The Seedhi ladder: course → first job → growth → next options, with earnings from the fact pack."""
    facts = templates.build_facts(session)
    t, o, lad = facts.get("trade"), facts.get("outcome"), facts.get("ladder")
    if not t:
        return {"trade": None, "steps": []}
    hi = facts["language"] == "hi"
    steps = []
    if lad.get("before_course"):
        steps.append({"kind": "pre", "title": "पहले यह करें" if hi else "First step", "text": lad["before_course"]})
    steps.append({"kind": "course", "title": "कोर्स" if hi else "Course",
                  "text": lad["course"], "sub": f"NSQF {t['nsqf_level']}"})
    steps.append({"kind": "job", "title": "पहली नौकरी" if hi else "First job", "text": lad["first_job"],
                  "earn": templates.band(*o["first_year_monthly"]) if o else None,
                  "earn_label": "पहला साल, हर महीना" if hi else "Year 1, per month"})
    steps.append({"kind": "growth", "title": "आगे बढ़ना" if hi else "Growing", "text": lad["growth"],
                  "earn": templates.band(*o["after_3_years_monthly"]) if o else None,
                  "earn_label": "3 साल बाद" if hi else "After 3 years",
                  "earn2": templates.band(*o["after_5_years_monthly"]) if o else None,
                  "earn2_label": "5 साल बाद" if hi else "After 5 years"})
    steps.append({"kind": "next", "title": "और भी रास्ते" if hi else "More paths", "options": lad["next_options"]})
    return {"trade": t, "steps": steps, "outcome": o and templates.outcome_meta(o)}

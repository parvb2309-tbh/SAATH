"""Small helpers shared by the role routers: profiles, guardian links and each user's SAATH chat session."""
import secrets
import uuid

from fastapi import HTTPException

from . import db
from .engine import responder

DEFAULT_PERMISSIONS = {"dna": True, "simulations": True, "pathway": True, "chosen_trade": True}
LINK_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I to misread


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def profile_for(user: dict) -> dict:
    p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user["id"],))
    if not p:
        raise HTTPException(404, "Finish your profile first")
    return p


def consents_for(user_id: str) -> dict:
    return db.one("SELECT * FROM consents WHERE user_id = ?", (user_id,)) or {
        "user_id": user_id, "ai_guidance": 0, "counsellor_share": 0, "parent_link": 0, "research": 0,
        "guardian_approved": 0}


def link_for_student(profile_id: str) -> dict | None:
    return db.one("SELECT * FROM guardian_links WHERE student_id = ? ORDER BY linked_at IS NULL, created_at DESC LIMIT 1",
                  (profile_id,))


def ensure_link_code(profile_id: str) -> dict:
    link = link_for_student(profile_id)
    if link:
        return link
    code = "".join(secrets.choice(LINK_ALPHABET) for _ in range(6))
    row = {"id": new_id(), "student_id": profile_id, "parent_id": None, "code": code, "consent_status": "pending",
           "shared_permissions": DEFAULT_PERMISSIONS, "linked_at": None, "created_at": db.now()}
    db.insert("guardian_links", row)
    return row


def linked_student(parent: dict) -> tuple[dict, dict] | None:
    """(link, student profile) for a parent, or None when not linked yet."""
    link = db.one("SELECT * FROM guardian_links WHERE parent_id = ? AND consent_status = 'linked' "
                  "ORDER BY linked_at DESC LIMIT 1", (parent["id"],))
    if not link:
        return None
    return link, db.one("SELECT * FROM student_profiles WHERE id = ?", (link["student_id"],))


def ensure_chat(user: dict) -> str:
    """The user's own SAATH conversation, created on first use with what UDAAN already knows."""
    existing = db.one("SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user["id"],))
    if existing:
        return existing["id"]
    if user["role"] == "student":
        p = profile_for(user)
        members, gender, profile_id = ["learner"], p.get("gender") or "x", p["id"]
    else:
        pair = linked_student(user)
        p = pair[1] if pair else {"district_id": user.get("district_id"), "chosen_trade": None,
                                  "education_level": "10", "gender": "x", "id": None}
        members, gender, profile_id = [user.get("relation") or "guardian"], p.get("gender") or "x", p["id"]
    if not p.get("district_id"):
        raise HTTPException(400, "Choose your district first")
    sid = new_id()
    db.insert("sessions", {
        "id": sid, "created_at": db.now(), "district_id": p["district_id"], "trade_id": p.get("chosen_trade"),
        "income_bracket": None, "schooling": p.get("education_level") or "10", "language": user.get("preferred_lang") or "hi",
        "members": members, "learner_gender": gender, "consent": 1, "status": "active", "synthetic": 0,
        "phone": "", "learner_age": p.get("age"), "user_id": user["id"], "profile_id": profile_id,
        "trade_changes": 0, "halted": 0,
    })
    responder.start_message(sid)
    return sid


def sync_chat_trade(profile: dict, trade_id: str) -> None:
    """Keep the student's chat on the chosen trade and count switches (a decision-paralysis signal)."""
    for s in db.query("SELECT * FROM sessions WHERE profile_id = ?", (profile["id"],)):
        if s.get("trade_id") != trade_id:
            db.update("sessions", "id", s["id"], {"trade_id": trade_id, "trade_changes": (s.get("trade_changes") or 0) + 1})

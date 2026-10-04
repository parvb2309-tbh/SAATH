"""Counsellor console API."""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db

router = APIRouter(prefix="/api/escalations", tags=["counsellor"])

_LIST_SQL = """
SELECT e.*, s.district_id, s.trade_id, s.members, s.learner_gender, s.language, s.synthetic,
       s.first_sentiment, s.last_sentiment, d.name_en AS district_en, d.name_hi AS district_hi, d.state,
       t.name_en AS trade_en, t.name_hi AS trade_hi, t.icon AS trade_icon
FROM escalations e
JOIN sessions s ON s.id = e.session_id
LEFT JOIN districts d ON d.id = s.district_id
LEFT JOIN trades t ON t.id = s.trade_id
"""


@router.get("")
def list_escalations(status: str = "open"):
    where = {"open": "WHERE e.status != 'resolved'", "resolved": "WHERE e.status = 'resolved'"}.get(status, "")
    return db.query(f"{_LIST_SQL} {where} ORDER BY e.status = 'resolved', e.priority, e.created_at DESC")


@router.get("/{eid}")
def get_escalation(eid: int):
    row = db.one(f"{_LIST_SQL} WHERE e.id = ?", (eid,))
    if not row:
        raise HTTPException(404, "Escalation not found")
    row["messages"] = db.get_messages(row["session_id"])
    return row


class EscalationPatch(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None
    notes: str | None = None


@router.patch("/{eid}")
def patch_escalation(eid: int, body: EscalationPatch):
    if not db.one("SELECT id FROM escalations WHERE id = ?", (eid,)):
        raise HTTPException(404, "Escalation not found")
    changes = body.model_dump(exclude_none=True)
    if changes:
        db.update("escalations", "id", eid, changes)
    return get_escalation(eid)

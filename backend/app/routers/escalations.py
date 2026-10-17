"""Counsellor portal API: priority referral queue, consented case view with XAI, session notes and SLA."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import auth, db
from ..engine import dna, match
from ..services import consents_for

router = APIRouter(prefix="/api/escalations", tags=["counsellor"],
                   dependencies=[Depends(auth.require("counsellor", "admin"))])

_LIST_SQL = """
SELECT e.*, s.district_id, s.trade_id, s.members, s.learner_gender, s.language, s.synthetic, s.profile_id, s.user_id,
       s.first_sentiment, s.last_sentiment, s.halted, d.name_en AS district_en, d.name_hi AS district_hi, d.state,
       t.name_en AS trade_en, t.name_hi AS trade_hi, t.icon AS trade_icon
FROM escalations e
JOIN sessions s ON s.id = e.session_id
LEFT JOIN districts d ON d.id = s.district_id
LEFT JOIN trades t ON t.id = s.trade_id
"""


@router.get("")
def list_escalations(status: str = "open"):
    where = {"open": "WHERE e.status != 'resolved'", "resolved": "WHERE e.status = 'resolved'"}.get(status, "")
    return db.query(f"{_LIST_SQL} {where} ORDER BY e.status = 'resolved', e.risk_level DESC, e.priority, e.created_at DESC")


def _case_profile(row: dict) -> dict | None:
    """The student's Career DNA and recommendation factors, only if the student agreed to share with counsellors."""
    if not row.get("profile_id"):
        return None
    p = db.one("SELECT * FROM student_profiles WHERE id = ?", (row["profile_id"],))
    if not p:
        return None
    if not consents_for(p["user_id"]).get("counsellor_share") and row.get("risk_level", 0) < 3:
        return {"consented": False}
    d = dna.get(p["id"])
    if not d or not d.get("riasec"):
        return {"consented": True, "dna": None}
    ranked = match.rank(p, d)
    focus = next((r for r in ranked if r["trade_id"] == p.get("chosen_trade")), ranked[0])
    name = db.one("SELECT name FROM users WHERE id = ?", (p["user_id"],))
    return {
        "consented": True, "name": name and name["name"], "age": p.get("age"), "education_level": p.get("education_level"),
        "dna": {"riasec": d["riasec"], "skills": dna.skill_vector(d), "competencies": d.get("competencies") or {}},
        "matches": [{"trade_id": r["trade_id"], "score": r["score"]} for r in ranked[:5]],
        "focus_trade": focus["trade_id"], "focus_score": focus["score"],
        "attribution": [{**t, "label": match.feature_label(t["key"], t["group"], "en")}
                        for t in match.attribution(focus, p["district_id"])],
        "constraints": {k: p.get(k) for k in ("max_travel_km", "budget_limit", "max_months", "needs_stipend",
                                              "min_earning", "work_setting")},
    }


@router.get("/{eid}")
def get_escalation(eid: int):
    row = db.one(f"{_LIST_SQL} WHERE e.id = ?", (eid,))
    if not row:
        raise HTTPException(404, "Escalation not found")
    row["messages"] = db.get_messages(row["session_id"])
    row["profile"] = _case_profile(row)
    return row


class EscalationPatch(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None
    notes: str | None = None
    first_contact: bool | None = None


@router.patch("/{eid}")
def patch_escalation(eid: int, body: EscalationPatch):
    row = db.one("SELECT * FROM escalations WHERE id = ?", (eid,))
    if not row:
        raise HTTPException(404, "Escalation not found")
    changes = body.model_dump(exclude_none=True, exclude={"first_contact"})
    if (body.first_contact or body.status in ("in_progress", "resolved")) and not row.get("first_contact_at"):
        changes["first_contact_at"] = db.now()
    if changes:
        db.update("escalations", "id", eid, changes)
    if body.status == "resolved":
        # a resolved safeguarding case lets the student use the career chat again
        db.update("sessions", "id", row["session_id"], {"halted": 0})
    return get_escalation(eid)

"""Public, read-only Parent Proof report behind a share token (for WhatsApp or print)."""
from typing import Literal

from fastapi import APIRouter, HTTPException

from .. import db
from ..engine import evidence

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{token}")
def shared_report(token: str, lang: Literal["hi", "en"] = "hi"):
    share = db.one("SELECT * FROM report_shares WHERE token = ?", (token,))
    if not share:
        raise HTTPException(404, "This report link is not valid")
    p = db.one("SELECT district_id, education_level FROM student_profiles WHERE id = ?", (share["profile_id"],))
    if not p:
        raise HTTPException(404, "This report is no longer available")
    db.update("report_shares", "token", token, {"views": (share["views"] or 0) + 1})
    db.event("report_viewed", None, share["profile_id"], {"trade": share["trade_id"], "via": "share"})
    # The shared copy carries no name or personal details: only the trade, district and schooling level.
    return evidence.build(share["trade_id"], p["district_id"], lang, p.get("education_level"))

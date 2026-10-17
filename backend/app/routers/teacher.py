"""Teacher / institution portal: class interest metrics, engagement, group guidance toolkit, referral tracking."""
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException

from .. import auth, db
from ..catalog import RIASEC, TOOLKIT
from ..engine import dna, pathway

router = APIRouter(prefix="/api/teacher", tags=["teacher"])
teacher = auth.require("teacher")


def _class(user: dict) -> dict:
    c = db.one("SELECT * FROM classes WHERE teacher_id = ?", (user["id"],))
    if not c:
        raise HTTPException(404, "No class is assigned to you yet")
    return c


@router.get("/class")
def class_overview(user: dict = Depends(teacher)):
    c = _class(user)
    lang = user.get("preferred_lang") or "en"
    students = db.query("SELECT p.*, u.name FROM student_profiles p JOIN users u ON u.id = p.user_id WHERE p.class_id = ? "
                        "ORDER BY u.name", (c["id"],))
    ids = [s["id"] for s in students]
    marks = ",".join("?" for _ in ids) or "''"
    dnas = {d["profile_id"]: d for d in db.query(f"SELECT * FROM career_dna WHERE profile_id IN ({marks})", ids)}
    attempts = db.query(f"SELECT profile_id, sim_id, completed_at FROM simulation_attempts WHERE profile_id IN ({marks})", ids)
    started, completed = Counter(), Counter()
    for a in attempts:
        started[a["profile_id"]] += 1
        completed[a["profile_id"]] += bool(a["completed_at"])

    riasec_sum = {d: 0.0 for d in RIASEC}
    top_dim = Counter()
    rows = []
    for s in students:
        d = dnas.get(s["id"])
        r = d and d.get("riasec")
        if r:
            for k in RIASEC:
                riasec_sum[k] += r.get(k, 0)
            top_dim[dna.top_dims(r, 1)[0]] += 1
        stage = pathway.compute(s, lang)["completed"]
        rows.append({"id": s["id"], "name": s["name"], "gender": s.get("gender"), "dna_done": bool(r),
                     "top": dna.top_dims(r, 2) if r else [], "chosen_trade": s.get("chosen_trade"),
                     "sims_completed": completed[s["id"]], "sims_started": started[s["id"]], "stage": stage})
    with_dna = sum(1 for r in rows if r["dna_done"]) or 1
    trades = Counter(r["chosen_trade"] for r in rows if r["chosen_trade"])
    referrals = db.query(f"""SELECT e.id, e.created_at, e.status, e.risk_level, e.first_contact_at, s.profile_id
                             FROM escalations e JOIN sessions s ON s.id = e.session_id
                             WHERE s.profile_id IN ({marks}) ORDER BY e.created_at DESC""", ids)
    names = {s["id"]: s["name"] for s in students}
    return {
        "class": c, "size": len(students),
        "dna_completion": round(100 * sum(r["dna_done"] for r in rows) / max(len(rows), 1)),
        "sim_completion": round(100 * sum(completed.values()) / max(sum(started.values()), 1)),
        "riasec_mean": {k: round(v / with_dna, 3) for k, v in riasec_sum.items()},
        "top_dims": dict(top_dim), "trade_interest": dict(trades.most_common()),
        "stage_counts": dict(Counter(r["stage"] for r in rows)),
        "students": rows,
        # Teachers see that a referral exists and its status, never the conversation or its reason.
        "referrals": [{"id": r["id"], "student": names.get(r["profile_id"]), "created_at": r["created_at"],
                       "status": r["status"], "first_contact_at": r["first_contact_at"],
                       "urgent": (r["risk_level"] or 0) >= 2} for r in referrals],
    }


@router.get("/toolkit")
def toolkit(user: dict = Depends(teacher)):
    data = class_overview(user)
    return {"sheets": TOOLKIT, "top_dims": data["top_dims"], "size": data["size"]}

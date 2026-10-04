"""Scheme administrator API: resistance dashboard, families and parent updates, outcome data import."""
import csv
import io
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .. import db
from ..engine.concerns import OBJECTIONS

router = APIRouter(prefix="/api/admin", tags=["admin"])

INTERESTED = {"interested", "enrolled", "retained"}
ENROLLED = {"enrolled", "retained"}


def _resistant(s: dict) -> bool:
    return s["status"] == "not_interested" or (s["last_sentiment"] is not None and s["last_sentiment"] < -0.1)


def _avg(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 2) if xs else None


@router.get("/summary")
def summary(include_demo: bool = True):
    where = "" if include_demo else "WHERE synthetic = 0"
    sessions = db.query(f"SELECT * FROM sessions {where}")
    ids = {s["id"] for s in sessions}
    concern_by_session: dict[str, Counter] = defaultdict(Counter)
    for m in db.query("SELECT session_id, concerns FROM messages WHERE role = 'user'"):
        if m["session_id"] in ids:
            concern_by_session[m["session_id"]].update(c for c in (m["concerns"] or []) if c in OBJECTIONS)

    districts = {d["id"]: d for d in db.query("SELECT * FROM districts")}
    by_d: dict[str, list] = defaultdict(list)
    for s in sessions:
        by_d[s["district_id"]].append(s)

    district_rows = []
    for did, d in districts.items():
        ss = by_d.get(did, [])
        cc = Counter()
        for s in ss:
            cc.update(concern_by_session[s["id"]])
        n = len(ss)
        district_rows.append({
            "id": did, "name_en": d["name_en"], "name_hi": d["name_hi"], "state": d["state"],
            "lat": d["lat"], "lng": d["lng"], "sessions": n,
            "resistance": round(100 * sum(_resistant(s) for s in ss) / n) if n else None,
            "avg_shift": _avg([(s["last_sentiment"] - s["first_sentiment"]) for s in ss
                               if s["first_sentiment"] is not None and s["last_sentiment"] is not None]),
            "concerns": {c: cc.get(c, 0) for c in OBJECTIONS},
            "top_concern": cc.most_common(1)[0][0] if cc else None,
            "interested": sum(s["status"] in INTERESTED for s in ss),
        })
    district_rows.sort(key=lambda r: -(r["resistance"] or 0))

    totals = Counter()
    for c in concern_by_session.values():
        totals.update(c)

    today = datetime.now(timezone.utc).date()
    weeks = []
    for w in range(7, -1, -1):
        start = today - timedelta(days=today.weekday() + 7 * w)
        end = start + timedelta(days=7)
        ws = [s for s in sessions if start <= datetime.fromisoformat(s["created_at"]).date() < end]
        weeks.append({"week": start.isoformat(), "sessions": len(ws),
                      "resistance": round(100 * sum(_resistant(s) for s in ws) / len(ws)) if ws else None})

    open_esc = db.query("SELECT priority FROM escalations WHERE status != 'resolved'")
    return {
        "kpis": {
            "sessions": len(sessions),
            "live_sessions": sum(1 for s in sessions if not s["synthetic"]),
            "interested_pct": round(100 * sum(s["status"] in INTERESTED for s in sessions) / len(sessions)) if sessions else 0,
            "resistance_pct": round(100 * sum(_resistant(s) for s in sessions) / len(sessions)) if sessions else 0,
            "avg_first": _avg([s["first_sentiment"] for s in sessions]),
            "avg_last": _avg([s["last_sentiment"] for s in sessions]),
            "open_escalations": len(open_esc),
            "urgent_escalations": sum(1 for e in open_esc if e["priority"] <= 2),
        },
        "districts": district_rows,
        "concerns": {c: totals.get(c, 0) for c in OBJECTIONS},
        "funnel": [
            {"stage": "sessions", "count": len(sessions)},
            {"stage": "interested", "count": sum(s["status"] in INTERESTED for s in sessions)},
            {"stage": "enrolled", "count": sum(s["status"] in ENROLLED for s in sessions)},
            {"stage": "retained", "count": sum(s["status"] == "retained" for s in sessions)},
        ],
        "weeks": weeks,
    }


@router.get("/families")
def families(include_demo: bool = True):
    demo = "" if include_demo else "AND s.synthetic = 0"
    return db.query(f"""
        SELECT s.*, d.name_en AS district_en, d.name_hi AS district_hi, t.name_en AS trade_en, t.name_hi AS trade_hi,
               t.icon AS trade_icon, (SELECT COUNT(*) FROM updates u WHERE u.session_id = s.id) AS update_count
        FROM sessions s LEFT JOIN districts d ON d.id = s.district_id LEFT JOIN trades t ON t.id = s.trade_id
        WHERE (s.synthetic = 0 OR s.status IN ('interested', 'enrolled', 'retained')) {demo}
        ORDER BY s.synthetic, s.created_at DESC LIMIT 60""")


class StatusIn(BaseModel):
    status: Literal["active", "interested", "thinking", "not_interested", "enrolled", "retained", "dropped"]


@router.post("/sessions/{sid}/status")
def set_status(sid: str, body: StatusIn):
    if not db.get_session(sid):
        raise HTTPException(404, "Session not found")
    db.update("sessions", "id", sid, {"status": body.status})
    return db.get_session(sid)


UPDATE_TEMPLATES = {
    "progress": ("{name} is doing well in the {trade} course and has completed this week's practical work.",
                 "{name} {trade} कोर्स में अच्छा कर रहे हैं और इस हफ़्ते का प्रैक्टिकल काम पूरा कर लिया है।"),
    "attendance": ("{name} missed a few classes this week. Please encourage them to attend; the centre is happy to help.",
                   "{name} इस हफ़्ते कुछ कक्षाओं में नहीं आए। कृपया उन्हें आने के लिए कहें; सेंटर मदद के लिए तैयार है।"),
    "placement": ("A placement drive for {trade} trainees is coming up at the centre. Families are welcome to attend.",
                  "सेंटर पर {trade} के विद्यार्थियों के लिए प्लेसमेंट ड्राइव होने वाली है। परिवार भी आ सकते हैं।"),
    "certificate": ("Congratulations! {name} has passed the {trade} assessment and will receive a government-recognised certificate.",
                    "बधाई हो! {name} ने {trade} का मूल्यांकन पास कर लिया है और उन्हें सरकारी मान्यता वाला सर्टिफ़िकेट मिलेगा।"),
}


class UpdateIn(BaseModel):
    session_id: str
    kind: Literal["progress", "attendance", "placement", "certificate", "custom"]
    text_en: str = ""
    text_hi: str = ""


@router.get("/update-templates")
def update_templates():
    return {k: {"en": en, "hi": hi} for k, (en, hi) in UPDATE_TEMPLATES.items()}


@router.post("/updates")
def send_update(body: UpdateIn):
    s = db.get_session(body.session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    t = db.get_trade(s["trade_id"]) or {"name_en": "the", "name_hi": ""}
    if body.kind == "custom":
        if not (body.text_en or body.text_hi):
            raise HTTPException(400, "Write the update text")
        en, hi = body.text_en or body.text_hi, body.text_hi or body.text_en
    else:
        en_t, hi_t = UPDATE_TEMPLATES[body.kind]
        name_en = "Your daughter" if s["learner_gender"] == "f" else "Your son" if s["learner_gender"] == "m" else "Your child"
        name_hi = "आपकी बेटी" if s["learner_gender"] == "f" else "आपका बेटा" if s["learner_gender"] == "m" else "आपके बच्चे"
        en = en_t.format(name=name_en, trade=t["name_en"])
        hi = hi_t.format(name=name_hi, trade=t["name_hi"])
    row = {"session_id": body.session_id, "created_at": db.now(), "kind": body.kind, "text_en": en, "text_hi": hi}
    row["id"] = db.insert("updates", row)
    return row


@router.get("/outcomes")
def outcomes():
    return db.query("""SELECT o.*, d.name_en AS district_en, d.state, t.name_en AS trade_en FROM outcomes o
                       JOIN districts d ON d.id = o.district_id JOIN trades t ON t.id = o.trade_id
                       ORDER BY t.name_en, d.state, d.name_en""")


CSV_FIELDS = ["trade_id", "district_id", "provider", "earn_low", "earn_high", "earn3_low", "earn3_high",
              "earn5_low", "earn5_high", "placement_pct", "local_pct", "women_pct", "cohort", "source", "year", "status"]
INT_FIELDS = set(CSV_FIELDS) - {"trade_id", "district_id", "provider", "source", "status"}


@router.post("/import-outcomes")
async def import_outcomes(request: Request, replace: bool = False):
    """Load real outcome data from a CSV body (columns: CSV_FIELDS). Rows with problems are reported, not loaded."""
    text = (await request.body()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    missing = [f for f in CSV_FIELDS if f not in (reader.fieldnames or [])]
    if missing:
        raise HTTPException(400, f"Missing columns: {', '.join(missing)}")
    trades = {t["id"] for t in db.query("SELECT id FROM trades")}
    districts = {d["id"] for d in db.query("SELECT id FROM districts")}
    good, errors = [], []
    for i, row in enumerate(reader, start=2):
        try:
            rec = {f: row[f].strip() for f in CSV_FIELDS}
            if rec["trade_id"] not in trades:
                raise ValueError(f"unknown trade_id {rec['trade_id']}")
            if rec["district_id"] not in districts:
                raise ValueError(f"unknown district_id {rec['district_id']}")
            if rec["status"] not in ("verified", "self-reported", "estimate"):
                raise ValueError("status must be verified, self-reported or estimate")
            for f in INT_FIELDS:
                rec[f] = int(float(rec[f]))
            if not (rec["earn_low"] <= rec["earn_high"]):
                raise ValueError("earn_low is above earn_high")
            good.append(rec)
        except (ValueError, KeyError) as e:
            errors.append({"line": i, "error": str(e)})
    if good and replace:
        with db.connect() as c:
            for rec in good:
                c.execute("DELETE FROM outcomes WHERE trade_id = ? AND district_id = ?", (rec["trade_id"], rec["district_id"]))
    db.insert_many("outcomes", good)
    return {"loaded": len(good), "errors": errors}

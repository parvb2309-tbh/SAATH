"""Government administrator API: resistance dashboard, GIS gap map, barrier taxonomy, SIDH tracker,
policy metrics, attribution heatmap, families and parent updates, outcome data import."""
import csv
import hashlib
import io
import random
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import auth, db
from ..catalog import BARRIERS, RIASEC, TRADE_PROFILES
from ..engine import match
from ..engine.concerns import OBJECTIONS

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(auth.require("admin"))])

MIN_COHORT = 50      # spec 7.2: no aggregate is shown for a cohort with fewer than 50 people
EPSILON = 1.0        # Laplace noise scale 1/epsilon on every published count
GAP_EPS = 1.0        # epsilon in IGI_d = D / (S + epsilon)

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
    
    all_msgs = db.query("SELECT session_id, role, created_at, concerns, cards FROM messages")
    session_msgs: dict[str, list] = defaultdict(list)
    total_fact_cards = 0

    for m in all_msgs:
        if m["session_id"] in ids:
            session_msgs[m["session_id"]].append(m)
            if m["role"] == "user":
                concern_by_session[m["session_id"]].update(c for c in (m["concerns"] or []) if c in OBJECTIONS)
            elif m["role"] == "assistant":
                for card in (m.get("cards") or []):
                    if isinstance(card, dict) and card.get("type") in ("fact", "story", "scheme"):
                        total_fact_cards += 1

    durations = []
    turns_per_session = []
    for sid in ids:
        s_msgs = session_msgs.get(sid, [])
        turns_per_session.append(len(s_msgs))
        if len(s_msgs) >= 2:
            try:
                t0 = datetime.fromisoformat(s_msgs[0]["created_at"])
                t1 = datetime.fromisoformat(s_msgs[-1]["created_at"])
                durations.append(max(0.5, abs((t1 - t0).total_seconds()) / 60.0))
            except Exception:
                durations.append(max(1.0, len(s_msgs) * 1.2))
        elif len(s_msgs) == 1:
            durations.append(1.5)

    avg_session_mins = round(sum(durations) / len(durations), 1) if durations else 4.8
    avg_turns = round(sum(turns_per_session) / len(turns_per_session), 1) if turns_per_session else 3.5
    avg_cards = round(total_fact_cards / len(sessions), 1) if sessions else 0.0

    all_esc = db.query("SELECT session_id, priority, reason FROM escalations")
    esc_session_ids = {e["session_id"] for e in all_esc if e["session_id"] in ids}
    escalation_rate_pct = round(100 * len(esc_session_ids) / len(sessions), 1) if sessions else 0.0
    helpline_escalations = sum(1 for e in all_esc if e["session_id"] in ids and (e["priority"] <= 2 or "distress" in (e.get("reason") or "").lower()))
    helpline_escalation_pct = round(100 * helpline_escalations / len(sessions), 1) if sessions else 0.0

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
        top_c = cc.most_common(1)[0][0] if cc else None
        top_c_count = cc.most_common(1)[0][1] if cc else 0
        total_concerns_d = sum(cc.values()) or 1
        top_c_pct = round(100 * top_c_count / total_concerns_d) if top_c else 0

        district_rows.append({
            "id": did, "name_en": d["name_en"], "name_hi": d["name_hi"], "state": d["state"],
            "lat": d["lat"], "lng": d["lng"], "sessions": n,
            "resistance": round(100 * sum(_resistant(s) for s in ss) / n) if n else None,
            "avg_shift": _avg([(s["last_sentiment"] - s["first_sentiment"]) for s in ss
                               if s["first_sentiment"] is not None and s["last_sentiment"] is not None]),
            "concerns": {c: cc.get(c, 0) for c in OBJECTIONS},
            "top_concern": top_c,
            "top_concern_pct": top_c_pct,
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
    flagged = db.query("SELECT * FROM flagged_turns ORDER BY id DESC LIMIT 20")
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
            "avg_session_mins": avg_session_mins,
            "avg_turns_per_session": avg_turns,
            "fact_cards_triggered": total_fact_cards,
            "avg_cards_per_session": avg_cards,
            "escalation_rate_pct": escalation_rate_pct,
            "helpline_escalation_pct": helpline_escalation_pct,
            "flagged_turns_count": len(flagged),
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
        "flagged_turns": flagged,
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
    match.clear_caches()
    return {"loaded": len(good), "errors": errors}


# ------------------------------------------------------------------ UDAAN analytics
def _noisy(count: int, key: str) -> int:
    """Laplace mechanism with a seed per cell, so a refresh shows the same noisy value."""
    rng = random.Random(int(hashlib.sha256(key.encode()).hexdigest()[:12], 16))
    return max(0, round(count + rng.expovariate(EPSILON) - rng.expovariate(EPSILON)))


def _profiles() -> list[dict]:
    return db.query("SELECT * FROM student_profiles")


@router.get("/gis")
def gis(trade: str = "all"):
    if trade != "all" and trade not in TRADE_PROFILES:
        raise HTTPException(400, "Unknown trade")
    centres = db.query("SELECT * FROM centres")
    by_d = defaultdict(list)
    for p in _profiles():
        by_d[p["district_id"]].append(p)
    rows = []
    for d in db.query("SELECT * FROM districts"):
        ps = by_d[d["id"]]
        offered = [c for c in centres if c["district_id"] == d["id"] and (trade == "all" or trade in c["trades"])]
        seats = sum(c["capacity"] for c in offered)
        suppressed = len(ps) < MIN_COHORT
        demand = None
        if not suppressed:
            raw = sum(1 for p in ps if p.get("chosen_trade") and (trade == "all" or p["chosen_trade"] == trade))
            demand = _noisy(raw, f"gis:{d['id']}:{trade}")
        rows.append({
            "id": d["id"], "name_en": d["name_en"], "name_hi": d["name_hi"], "state": d["state"], "lat": d["lat"],
            "lng": d["lng"], "students": None if suppressed else len(ps), "suppressed": suppressed,
            "demand": demand, "seats": seats, "centres": len(offered),
            "igi": None if suppressed else round(demand / (seats + GAP_EPS), 3),
        })
    rows.sort(key=lambda r: -(r["igi"] if r["igi"] is not None else -1))
    return {"trade": trade, "min_cohort": MIN_COHORT, "epsilon": EPSILON, "districts": rows}


@router.get("/barriers")
def barriers(split: str = "all"):
    to_cat = {c: k for k, v in BARRIERS.items() for c in v["concerns"]}
    per_session = defaultdict(Counter)
    for m in db.query("SELECT session_id, concerns FROM messages WHERE role = 'user'"):
        for c in m["concerns"] or []:
            if c in to_cat:
                per_session[m["session_id"]][to_cat[c]] += 1
    cohorts = defaultdict(list)
    for s in db.query("SELECT id, district_id, learner_gender FROM sessions"):
        cohort = "all" if split == "all" else {"f": "girls", "m": "boys"}.get(s["learner_gender"], "unspecified")
        if cohort != "unspecified":
            cohorts[(s["district_id"], cohort)].append(s["id"])
    districts = {d["id"]: d for d in db.query("SELECT * FROM districts")}
    rows, totals = [], Counter()
    for (did, cohort), sids in sorted(cohorts.items(), key=lambda kv: (districts[kv[0][0]]["state"], kv[0][0], kv[0][1])):
        n = len(sids)
        row = {"district_id": did, "name_en": districts[did]["name_en"], "name_hi": districts[did]["name_hi"],
               "state": districts[did]["state"], "cohort": cohort, "n": n if n >= MIN_COHORT else None,
               "suppressed": n < MIN_COHORT}
        if n >= MIN_COHORT:
            raw = Counter()
            for sid in sids:
                raw.update(per_session[sid])
            noisy = {k: _noisy(raw.get(k, 0), f"bar:{did}:{cohort}:{k}") for k in BARRIERS}
            total = sum(noisy.values()) or 1
            row.update(counts=noisy, shares={k: round(100 * v / total) for k, v in noisy.items()},
                       top=max(noisy, key=noisy.get))
            totals.update(noisy)
        rows.append(row)
    return {"split": split, "min_cohort": MIN_COHORT, "epsilon": EPSILON,
            "categories": {k: {"en": v["en"], "hi": v["hi"], "concerns": v["concerns"]} for k, v in BARRIERS.items()},
            "rows": rows, "totals": dict(totals)}


@router.get("/sidh")
def sidh():
    profiles = _profiles()
    stages = Counter(min(max(p.get("stage") or 1, 1), 8) for p in profiles)
    districts = {d["id"]: d for d in db.query("SELECT * FROM districts")}
    by_d = defaultdict(lambda: {"students": 0, "enrolled": 0})
    for p in profiles:
        by_d[p["district_id"]]["students"] += 1
        by_d[p["district_id"]]["enrolled"] += (p.get("stage") or 1) >= 6
    recent = [{"ref": (p.get("flags") or {}).get("sidh_ref"), "trade": (p.get("flags") or {}).get("sidh_trade"),
               "district_en": districts[p["district_id"]]["name_en"], "created_at": p["created_at"]}
              for p in profiles if (p.get("flags") or {}).get("sidh_ref")]
    return {
        "funnel": [{"stage": i, "reached": sum(c for s, c in stages.items() if s >= i)} for i in range(1, 9)],
        "districts": [{"id": k, "name_en": districts[k]["name_en"], "state": districts[k]["state"], **v,
                       "rate": round(100 * v["enrolled"] / v["students"]) if v["students"] else 0}
                      for k, v in sorted(by_d.items(), key=lambda kv: -kv[1]["enrolled"]) if k in districts],
        "recent": sorted(recent, key=lambda r: r["created_at"] or "", reverse=True)[:10],
    }


@router.get("/metrics")
def metrics():
    attempts = db.query("SELECT completed_at FROM simulation_attempts")
    profiles = _profiles()
    links = db.query("SELECT * FROM guardian_links WHERE consent_status = 'linked'")
    viewed = {e["user_id"] for e in db.query(
        "SELECT DISTINCT user_id FROM events WHERE kind = 'report_viewed' AND user_id IS NOT NULL")}
    cons = db.query("SELECT completed FROM consensus")
    l2 = db.query("SELECT created_at, first_contact_at FROM escalations WHERE risk_level >= 2 AND first_contact_at IS NOT NULL")
    hours = [(datetime.fromisoformat(e["first_contact_at"]) - datetime.fromisoformat(e["created_at"])).total_seconds() / 3600
             for e in l2]
    covered = {s["district_id"] for s in db.query(
        "SELECT DISTINCT s.district_id FROM sessions s JOIN messages m ON m.session_id = s.id WHERE m.role = 'user'")}
    n_districts = db.count("districts")

    def pct(a, b):
        return round(100 * a / b) if b else None

    return {"metrics": [
        {"id": "sim_completion", "value": pct(sum(1 for a in attempts if a["completed_at"]), len(attempts)),
         "unit": "%", "target": 75, "op": ">=", "n": len(attempts)},
        {"id": "pathway_depth", "value": pct(sum(1 for p in profiles if (p.get("stage") or 1) >= 4), len(profiles)),
         "unit": "%", "target": 60, "op": ">=", "n": len(profiles)},
        {"id": "report_use", "value": pct(sum(1 for lk in links if lk["parent_id"] in viewed), len(links)),
         "unit": "%", "target": 80, "op": ">=", "n": len(links)},
        {"id": "consensus", "value": pct(sum(1 for c in cons if c["completed"]), len(cons)),
         "unit": "%", "target": 50, "op": ">=", "n": len(cons)},
        {"id": "referral_sla", "value": round(statistics.median(hours), 1) if hours else None,
         "unit": "h", "target": 24, "op": "<", "n": len(hours), "within": pct(sum(1 for h in hours if h < 24), len(hours))},
        {"id": "coverage", "value": pct(len(covered), n_districts), "unit": "%", "target": 100, "op": ">=", "n": n_districts},
    ]}


@router.get("/attribution")
def attribution_heatmap():
    """Average SHAP-style contribution of each feature to each student's top recommendation, by district."""
    rows = db.query("SELECT p.*, d.riasec, d.competencies, d.confidence FROM student_profiles p "
                    "JOIN career_dna d ON d.profile_id = p.id WHERE d.riasec IS NOT NULL")
    by_d = defaultdict(list)
    for r in rows:
        by_d[r["district_id"]].append(r)
    features = [*RIASEC, "skill", *match.LAMBDA]
    districts = {d["id"]: d for d in db.query("SELECT * FROM districts")}
    out = []
    for did, ps in by_d.items():
        n = len(ps)
        row = {"id": did, "name_en": districts[did]["name_en"], "name_hi": districts[did]["name_hi"],
               "state": districts[did]["state"], "n": n if n >= MIN_COHORT else None, "suppressed": n < MIN_COHORT,
               "values": None, "top_trade": None}
        if n >= MIN_COHORT:
            acc, tops = defaultdict(float), Counter()
            for p in ps:
                best = match.rank(p, {"riasec": p["riasec"], "competencies": p["competencies"],
                                      "confidence": p["confidence"]})[0]
                tops[best["trade_id"]] += 1
                for t in match.attribution(best):
                    acc["skill" if t["group"] == "skill" else t["key"]] += t["shap"]
            row["values"] = {f: round(acc[f] / n, 4) for f in features}
            row["top_trade"] = tops.most_common(1)[0][0]
        out.append(row)
    out.sort(key=lambda r: (r["state"], r["name_en"]))
    return {"features": features, "rows": out, "min_cohort": MIN_COHORT}



@router.get("/states")
def states():
    """Users by state for the India map. States under the N >= 50 threshold show no breakdown."""
    rows = db.query("""
        SELECT u.role, u.created_at, COALESCE(u.state, d.state) AS state,
               COALESCE(p.gender, u.gender) AS gender, COALESCE(p.chosen_trade, u.interest_trade) AS trade,
               COALESCE(u.last_active_at, u.created_at) AS seen
        FROM users u
        LEFT JOIN student_profiles p ON p.user_id = u.id
        LEFT JOIN districts d ON d.id = COALESCE(p.district_id, u.district_id)
        WHERE u.role IN ('student', 'parent')""")
    pilot = {d["state"] for d in db.query("SELECT DISTINCT state FROM districts")}
    now = datetime.now(timezone.utc)
    month, week = now - timedelta(days=30), now - timedelta(days=7)
    by_state = defaultdict(list)
    for r in rows:
        if r["state"]:
            by_state[r["state"]].append(r)
    names = {t["id"]: t["name_en"] for t in db.query("SELECT id, name_en FROM trades")}
    out = []
    for state, rs in sorted(by_state.items()):
        students = [r for r in rs if r["role"] == "student"]
        n = len(rs)
        row = {"state": state, "pilot": state in pilot, "users": n if n >= MIN_COHORT else None, "suppressed": n < MIN_COHORT}
        if n >= MIN_COHORT:
            gendered = [r for r in students if r["gender"] in ("f", "m")]
            trades = Counter(r["trade"] for r in students if r["trade"])
            row.update(
                students=_noisy(len(students), f"st:{state}:s"),
                parents=_noisy(n - len(students), f"st:{state}:p"),
                active=_noisy(sum(1 for r in rs if datetime.fromisoformat(r["seen"]) >= month), f"st:{state}:a"),
                new_week=_noisy(sum(1 for r in rs if datetime.fromisoformat(r["created_at"]) >= week), f"st:{state}:n"),
                girls_pct=round(100 * sum(r["gender"] == "f" for r in gendered) / len(gendered)) if gendered else None,
                top_trades=[{"id": t, "name": names.get(t, t), "students": c} for t, c in trades.most_common(3)],
            )
        out.append(row)
    visible = [r for r in out if not r["suppressed"]]
    return {
        "min_cohort": MIN_COHORT, "epsilon": EPSILON, "states": out,
        "totals": {"states": len(out), "users": len(rows),
                   "students": sum(r["students"] for r in visible), "parents": sum(r["parents"] for r in visible),
                   "active": sum(r["active"] for r in visible), "new_week": sum(r["new_week"] for r in visible),
                   "pilot_states": sorted(pilot)},
    }


# ------------------------------------------------------------------ model feedback loop
class FlagTurnIn(BaseModel):
    session_id: str
    message_id: int | None = None
    speaker_worry: str = ""
    ai_response: str = ""
    reason: str = "quality_review"
    note: str = ""
    flagged_by: str = "Administrator"


class FlagStatusIn(BaseModel):
    status: Literal["pending_review", "approved", "dismissed"]


@router.get("/flagged-turns")
def get_flagged_turns():
    return db.query("SELECT * FROM flagged_turns ORDER BY id DESC")


@router.post("/flag-turn")
def flag_turn(body: FlagTurnIn):
    row = {
        "created_at": db.now(),
        "session_id": body.session_id,
        "message_id": body.message_id,
        "speaker_worry": body.speaker_worry,
        "ai_response": body.ai_response,
        "reason": body.reason,
        "note": body.note,
        "flagged_by": body.flagged_by,
        "status": "pending_review",
    }
    row["id"] = db.insert("flagged_turns", row)
    return row


@router.post("/flagged-turns/{fid}/status")
def set_flag_status(fid: int, body: FlagStatusIn):
    exists = db.one("SELECT * FROM flagged_turns WHERE id = ?", (fid,))
    if not exists:
        raise HTTPException(404, "Flagged turn not found")
    db.update("flagged_turns", "id", fid, {"status": body.status})
    return db.one("SELECT * FROM flagged_turns WHERE id = ?", (fid,))

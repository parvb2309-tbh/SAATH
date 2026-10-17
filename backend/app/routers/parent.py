"""Parent / guardian portal: link to the child, consented overview, evidence report, What-If and consensus."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import auth, db
from ..catalog import PRIORITIES, SIM_BY_ID, TRADE_PROFILES
from ..engine import consensus, dna, evidence, match, pathway, responder, whatif
from ..services import ensure_chat, linked_student

router = APIRouter(prefix="/api/parent", tags=["parent"])
parent = auth.require("parent")


def _lang(user: dict) -> str:
    return user.get("preferred_lang") or "hi"


def _pair(user: dict) -> tuple[dict, dict]:
    pair = linked_student(user)
    if not pair:
        raise HTTPException(409, "Link your child's account first")
    return pair


class LinkIn(BaseModel):
    code: str


@router.post("/link")
def link(body: LinkIn, user: dict = Depends(parent)):
    code = body.code.strip().upper().replace(" ", "")
    lk = db.one("SELECT * FROM guardian_links WHERE code = ?", (code,))
    if not lk:
        raise HTTPException(404, "No student has this code. Check it with your child.")
    if lk["parent_id"] and lk["parent_id"] != user["id"]:
        raise HTTPException(409, "This code is already linked to another guardian")
    db.update("guardian_links", "id", lk["id"], {"parent_id": user["id"], "consent_status": "linked", "linked_at": db.now()})
    student_user = db.one("SELECT user_id FROM student_profiles WHERE id = ?", (lk["student_id"],))["user_id"]
    # DPDP: a minor's data processing needs a guardian's consent; linking is that approval.
    with db.connect() as c:
        c.execute("INSERT OR IGNORE INTO consents (user_id, ai_guidance, counsellor_share, parent_link, research, "
                  "guardian_approved, updated_at) VALUES (?, 0, 0, 1, 0, 0, ?)", (student_user, db.now()))
        c.execute("UPDATE consents SET guardian_approved = 1, updated_at = ? WHERE user_id = ?", (db.now(), student_user))
    s = db.one("SELECT district_id FROM student_profiles WHERE id = ?", (lk["student_id"],))
    if not user.get("district_id"):
        db.update("users", "id", user["id"], {"district_id": s["district_id"]})
    return overview(db.one("SELECT * FROM users WHERE id = ?", (user["id"],)))


@router.get("/overview")
def overview(user: dict = Depends(parent)):
    lk, p = _pair(user)
    lang = _lang(user)
    perms = lk["shared_permissions"] or {}
    su = db.one("SELECT name FROM users WHERE id = ?", (p["user_id"],))
    out = {"student": {"name": su["name"], "age": p.get("age"), "gender": p.get("gender"),
                       "education_level": p.get("education_level"), "district_id": p["district_id"]},
           "permissions": perms}
    if perms.get("chosen_trade") and p.get("chosen_trade"):
        t = db.get_trade(p["chosen_trade"])
        out["chosen_trade"] = {"id": t["id"], "name": t[f"name_{lang}"], "icon": t["icon"], "nsqf_level": t["nsqf_level"]}
    if perms.get("dna"):
        d = dna.get(p["id"])
        out["dna"] = d and {"riasec": d["riasec"], "top": dna.top_dims(d["riasec"] or {})}
        out["top_matches"] = [{"trade_id": r["trade_id"], "score": r["score"],
                               "name": db.get_trade(r["trade_id"])[f"name_{lang}"], "icon": db.get_trade(r["trade_id"])["icon"],
                               "why": match.explain(r, p, lang)} for r in match.rank(p, d)[:3]] if d and d.get("riasec") else []
    if perms.get("simulations"):
        att = db.query("SELECT sim_id, accuracy, safety_score, completed_at FROM simulation_attempts "
                       "WHERE profile_id = ? AND completed_at IS NOT NULL ORDER BY id DESC", (p["id"],))
        out["simulations"] = [{**a, "title": SIM_BY_ID[a["sim_id"]][f"title_{lang}"]} for a in att]
    if perms.get("pathway"):
        out["pathway"] = pathway.compute(p, lang)
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (lk["id"],))
    out["consensus"] = {"student_answered": bool(c and c["student_answers"]), "parent_answered": bool(c and c["parent_answers"]),
                        "completed": bool(c and c["completed"])}
    return out


@router.get("/report")
def report(trade: str | None = None, user: dict = Depends(parent)):
    lk, p = _pair(user)
    trade = trade or p.get("chosen_trade")
    if not trade or not db.get_trade(trade):
        raise HTTPException(400, "Your child has not chosen a trade yet")
    db.event("report_viewed", user["id"], p["id"], {"trade": trade})
    return evidence.build(trade, p["district_id"], _lang(user), p.get("education_level"))


@router.get("/whatif")
def get_whatif(trade: str | None = None, band: Literal["low", "mid", "high"] = "mid", ba_fee: int | None = None,
               iti_fee: int | None = None, diploma_fee: int | None = None, naps_stipend: int | None = None,
               school_fee: int | None = None, user: dict = Depends(parent)):
    lk, p = _pair(user)
    trade = trade or p.get("chosen_trade") or "electrician"
    db.event("whatif_viewed", user["id"], p["id"], {"trade": trade})
    return whatif.simulate(trade, p["district_id"], dict(band=band, ba_fee=ba_fee, iti_fee=iti_fee, diploma_fee=diploma_fee,
                                                         naps_stipend=naps_stipend, school_fee=school_fee))


@router.get("/consensus")
def get_consensus(user: dict = Depends(parent)):
    lk, p = _pair(user)
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (lk["id"],))
    # The student's own ratings stay private until both have answered; their private notes never leave.
    both = bool(c and c["student_answers"] and c["parent_answers"])
    return {"priorities": PRIORITIES, "my_answers": c and c["parent_answers"],
            "student_answered": bool(c and c["student_answers"]), "plan": c["plan"] if both else None,
            "completed": bool(c and c["completed"]), "trade_id": p.get("chosen_trade"),
            "sim": TRADE_PROFILES.get(p.get("chosen_trade") or "", {}).get("sim")}


class ConsensusIn(BaseModel):
    answers: dict[str, int]


@router.put("/consensus")
def put_consensus(body: ConsensusIn, user: dict = Depends(parent)):
    lk, p = _pair(user)
    answers = {k: max(1, min(5, int(v))) for k, v in body.answers.items() if k in {x["id"] for x in PRIORITIES}}
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (lk["id"],))
    plan = consensus.build_plan(c["student_answers"], answers, p.get("chosen_trade")) if c and c["student_answers"] else None
    row = {"parent_answers": answers, "plan": plan, "trade_id": p.get("chosen_trade"), "updated_at": db.now()}
    if c:
        db.update("consensus", "link_id", lk["id"], row)
    else:
        db.insert("consensus", {"link_id": lk["id"], "student_answers": None, "completed": 0, **row})
    return get_consensus(user)


@router.post("/consensus/accept")
def accept_plan(user: dict = Depends(parent)):
    lk, _ = _pair(user)
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (lk["id"],))
    if not c or not c["plan"]:
        raise HTTPException(400, "Both of you need to answer first")
    db.update("consensus", "link_id", lk["id"], {"completed": 1, "updated_at": db.now()})
    return get_consensus(user)


class EscalateItem(BaseModel):
    item: str


@router.post("/consensus/escalate")
def escalate_item(body: EscalateItem, user: dict = Depends(parent)):
    lk, _ = _pair(user)
    sid = ensure_chat(user)
    label = next((x["en"] for x in PRIORITIES if x["id"] == body.item), body.item)
    return responder.escalate(sid, "consensus", 2, note=f"Disagreement on: {label}")

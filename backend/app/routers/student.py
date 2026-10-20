"""Student portal: Career DNA, Reverse Career Search, the Lab, pathway, evidence, What-If and Family Space."""
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import auth, db
from ..catalog import PRIORITIES, RIASEC_ITEMS, SIM_BY_ID, SIMULATIONS, TRADE_PROFILES
from ..engine import consensus, dna, evidence, match, pathway, stories, whatif
from ..services import ensure_link_code, link_for_student, profile_for

router = APIRouter(prefix="/api/student", tags=["student"])
student = auth.require("student")
Vote = Literal["like", "meh", "no"]


def _lang(user: dict) -> str:
    return user.get("preferred_lang") or "hi"


class DnaIn(BaseModel):
    answers: dict[str, Vote]
    confidence: dict[str, int] = Field(default_factory=dict)


@router.put("/dna")
def put_dna(body: DnaIn, user: dict = Depends(student)):
    p = profile_for(user)
    unknown = set(body.answers) - {i["id"] for i in RIASEC_ITEMS}
    if unknown:
        raise HTTPException(400, f"Unknown items: {', '.join(sorted(unknown))}")
    conf = {k: max(1, min(5, int(v))) for k, v in body.confidence.items() if k in dna.CONFIDENCE_DIMS}
    saved = dna.save(p["id"], answers=body.answers, riasec=dna.riasec_from_answers(body.answers), confidence=conf)
    return {"dna": saved, "top": dna.top_dims(saved["riasec"])}


@router.get("/dna")
def get_dna(user: dict = Depends(student)):
    p = profile_for(user)
    d = dna.get(p["id"])
    return {"dna": d, "skills": dna.skill_vector(d), "top": dna.top_dims((d or {}).get("riasec") or {})}


@router.get("/matches")
def matches(user: dict = Depends(student), max_travel_km: int | None = None, budget_limit: int | None = None,
            max_months: int | None = None, needs_stipend: bool | None = None, min_earning: int | None = None,
            work_setting: Literal["indoor", "outdoor", "any"] | None = None, save: bool = False):
    p = profile_for(user)
    overrides = {k: v for k, v in dict(max_travel_km=max_travel_km, budget_limit=budget_limit, max_months=max_months,
                                         needs_stipend=needs_stipend, min_earning=min_earning,
                                         work_setting=work_setting).items() if v is not None}
    if save and overrides:
        db.update("student_profiles", "id", p["id"], {k: int(v) if isinstance(v, bool) else v for k, v in overrides.items()})
    profile = {**p, **overrides}
    lang = _lang(user)
    d = dna.get(p["id"])
    out = []
    for r in match.rank(profile, d):
        t = db.get_trade(r["trade_id"])
        out.append({**r, "name": t[f"name_{lang}"], "icon": t["icon"], "nsqf_level": t["nsqf_level"],
                    "why": match.explain(r, profile, lang), "sim": TRADE_PROFILES[r["trade_id"]]["sim"],
                    "labels": {t_["key"]: match.feature_label(t_["key"], t_["group"], lang) for t_ in r["terms"]}})
    return {"constraints": {k: profile.get(k) for k in ("max_travel_km", "budget_limit", "max_months", "needs_stipend",
                                                         "min_earning", "work_setting")},
            "has_dna": bool(d and d.get("riasec")), "results": out}


@router.get("/sims")
def sims(user: dict = Depends(student)):
    p = profile_for(user)
    attempts = db.query("SELECT * FROM simulation_attempts WHERE profile_id = ? ORDER BY id DESC", (p["id"],))
    out = []
    for s in SIMULATIONS:
        done = [a for a in attempts if a["sim_id"] == s["id"] and a["completed_at"]]
        out.append({**s, "attempts": len(done), "best_accuracy": max((a["accuracy"] for a in done), default=None),
                    "best_safety": max((a["safety_score"] for a in done), default=None)})
    return out


@router.post("/sims/{sim_id}/start")
def start_sim(sim_id: str, user: dict = Depends(student)):
    if sim_id not in SIM_BY_ID:
        raise HTTPException(404, "Unknown simulation")
    p = profile_for(user)
    aid = db.insert("simulation_attempts", {"profile_id": p["id"], "sim_id": sim_id, "started_at": db.now(),
                                            "completed_at": None, "time_s": None, "accuracy": None,
                                            "safety_score": None, "telemetry": {}})
    return {"attempt_id": aid}


class AttemptIn(BaseModel):
    time_s: float = Field(ge=0, le=7200)
    accuracy: float = Field(ge=0, le=1)
    safety_score: float = Field(ge=0, le=1)
    telemetry: dict = Field(default_factory=dict)
    indicators: list[dict] = Field(default_factory=list)


@router.post("/sims/{sim_id}/attempts/{attempt_id}")
def complete_sim(sim_id: str, attempt_id: int, body: AttemptIn, user: dict = Depends(student)):
    p = profile_for(user)
    a = db.one("SELECT * FROM simulation_attempts WHERE id = ? AND profile_id = ? AND sim_id = ?", (attempt_id, p["id"], sim_id))
    if not a:
        raise HTTPException(404, "Attempt not found")
    if a["completed_at"]:
        raise HTTPException(409, "This attempt is already recorded")
    db.update("simulation_attempts", "id", attempt_id, {
        "completed_at": db.now(), "time_s": round(body.time_s, 1), "accuracy": round(body.accuracy, 3),
        "safety_score": round(body.safety_score, 3), "telemetry": {**body.telemetry, "indicators": body.indicators}})
    before = (dna.get(p["id"]) or {}).get("competencies") or {}
    d = dna.save(p["id"], competencies=dna.update_competencies(before, sim_id, body.accuracy, body.safety_score))
    dna.record_exploration(p["id"], sim=sim_id)
    match.clear_baseline_cache()
    return {"competencies_before": before, "competencies": d["competencies"],
            "pathway": pathway.compute(profile_for(user), _lang(user))}


def _stage_details(p: dict, lang: str) -> dict:
    """What each pathway stage shows besides its status: eligibility, centres, schemes, the ladder."""
    if not p.get("chosen_trade"):
        return {}
    t = db.get_trade(p["chosen_trade"])
    rep = evidence.build(t["id"], p["district_id"], lang, p.get("education_level"))
    sec = {s["id"]: s["data"] for s in rep["sections"]}
    return {"prerequisites": sec["prerequisites"], "centres": sec["accreditation"]["centres"],
            "schemes": sec["assistance"]["schemes"], "fees": sec["fees"], "progression": sec["progression"],
            "sim": TRADE_PROFILES[t["id"]]["sim"], "sidh_ref": (p.get("flags") or {}).get("sidh_ref")}


@router.get("/pathway")
def get_pathway(user: dict = Depends(student)):
    p = profile_for(user)
    lang = _lang(user)
    return {**pathway.compute(p, lang), "details": _stage_details(p, lang)}


class StageAction(BaseModel):
    action: Literal["prereq_checked", "finance_viewed", "enrol"]


@router.post("/pathway")
def pathway_action(body: StageAction, user: dict = Depends(student)):
    p = profile_for(user)
    flags = dict(p.get("flags") or {})
    if body.action == "enrol":
        if not p.get("chosen_trade"):
            raise HTTPException(400, "Choose a trade first")
        # Phase 1 stand-in for the Skill India Digital Hub registration API: a clearly marked demo reference.
        flags["sidh_ref"] = flags.get("sidh_ref") or f"SIDH-DEMO-{secrets.token_hex(3).upper()}"
        flags["sidh_trade"] = p["chosen_trade"]
    else:
        flags[body.action] = True
        if body.action == "finance_viewed":
            db.event("finance_viewed", user["id"], p["id"])
    db.update("student_profiles", "id", p["id"], {"flags": flags})
    return get_pathway(user)


@router.get("/report")
def report(trade: str | None = None, user: dict = Depends(student)):
    p = profile_for(user)
    trade = trade or p.get("chosen_trade")
    if not trade or not db.get_trade(trade):
        raise HTTPException(400, "Choose a trade first")
    dna.record_exploration(p["id"], trade=trade)
    return evidence.build(trade, p["district_id"], _lang(user), p.get("education_level"))


class ShareIn(BaseModel):
    trade: str


@router.post("/report/share")
def share_report(body: ShareIn, user: dict = Depends(student)):
    p = profile_for(user)
    if not db.get_trade(body.trade):
        raise HTTPException(400, "Unknown trade")
    existing = db.one("SELECT * FROM report_shares WHERE profile_id = ? AND trade_id = ?", (p["id"], body.trade))
    if existing:
        return existing
    row = {"token": secrets.token_urlsafe(9), "profile_id": p["id"], "trade_id": body.trade, "created_at": db.now(), "views": 0}
    db.insert("report_shares", row)
    return row


@router.get("/whatif")
def get_whatif(trade: str | None = None, band: Literal["low", "mid", "high"] = "mid", ba_fee: int | None = None,
               iti_fee: int | None = None, diploma_fee: int | None = None, naps_stipend: int | None = None,
               school_fee: int | None = None, user: dict = Depends(student)):
    p = profile_for(user)
    trade = trade or p.get("chosen_trade") or "electrician"
    db.event("whatif_viewed", user["id"], p["id"], {"trade": trade})
    return whatif.simulate(trade, p["district_id"], dict(band=band, ba_fee=ba_fee, iti_fee=iti_fee, diploma_fee=diploma_fee,
                                                         naps_stipend=naps_stipend, school_fee=school_fee))


@router.get("/family")
def family(user: dict = Depends(student)):
    p = profile_for(user)
    link = ensure_link_code(p["id"])
    parent = link.get("parent_id") and db.one("SELECT name, relation FROM users WHERE id = ?", (link["parent_id"],))
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (link["id"],))
    return {"link": {"code": link["code"], "status": link["consent_status"], "permissions": link["shared_permissions"],
                     "parent": parent, "linked_at": link["linked_at"]},
            "priorities": PRIORITIES, "my_answers": c and c["student_answers"], "parent_answered": bool(c and c["parent_answers"]),
            "plan": c and c["plan"], "completed": bool(c and c["completed"]), "private_notes": p.get("private_notes") or ""}


class PermissionsIn(BaseModel):
    dna: bool
    simulations: bool
    pathway: bool
    chosen_trade: bool


@router.put("/family/permissions")
def set_permissions(body: PermissionsIn, user: dict = Depends(student)):
    p = profile_for(user)
    link = ensure_link_code(p["id"])
    db.update("guardian_links", "id", link["id"], {"shared_permissions": body.model_dump()})
    return family(user)


class ConsensusIn(BaseModel):
    answers: dict[str, int]
    private_notes: str = Field(default="", max_length=2000)


@router.put("/consensus")
def student_consensus(body: ConsensusIn, user: dict = Depends(student)):
    p = profile_for(user)
    link = ensure_link_code(p["id"])
    answers = {k: max(1, min(5, int(v))) for k, v in body.answers.items() if k in {x["id"] for x in PRIORITIES}}
    db.update("student_profiles", "id", p["id"], {"private_notes": body.private_notes})
    c = db.one("SELECT * FROM consensus WHERE link_id = ?", (link["id"],))
    plan = consensus.build_plan(answers, c["parent_answers"], p.get("chosen_trade")) if c and c["parent_answers"] else None
    row = {"student_answers": answers, "plan": plan, "trade_id": p.get("chosen_trade"), "updated_at": db.now()}
    if c:
        db.update("consensus", "link_id", link["id"], row)
    else:
        db.insert("consensus", {"link_id": link["id"], "parent_answers": None, "completed": 0, **row})
    return family(user)


@router.get("/stories")
def career_stories(user: dict = Depends(student)):
    p = profile_for(user)
    db.event("story_viewed", user["id"], p["id"])
    return stories.rank(p, _lang(user))


@router.get("/progress")
def progress(user: dict = Depends(student)):
    p = profile_for(user)
    lang = _lang(user)
    attempts = db.query("SELECT * FROM simulation_attempts WHERE profile_id = ? AND completed_at IS NOT NULL "
                        "ORDER BY id DESC", (p["id"],))
    d = dna.get(p["id"])
    return {"attempts": [{**a, "title": SIM_BY_ID[a["sim_id"]][f"title_{lang}"]} for a in attempts],
            "dna": d, "skills": dna.skill_vector(d), "pathway": pathway.compute(p, lang),
            "link": (lambda lk: lk and {"status": lk["consent_status"]})(link_for_student(p["id"]))}

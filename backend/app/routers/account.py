"""Sign-in, the signed-in user's profile and consents, and self-service privacy (spec §4.3, §6.2)."""
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import auth, db
from ..services import consents_for, ensure_chat, link_for_student, linked_student, new_id, sync_chat_trade

router = APIRouter(prefix="/api", tags=["account"])

Role = Literal["student", "parent", "counsellor", "teacher", "admin"]
Lang = Literal["hi", "en"]
PROFILE_FIELDS = ("education_level", "study_mode", "age", "gender", "budget_limit", "max_travel_km", "needs_stipend",
                  "min_earning", "max_months", "work_setting", "chosen_trade", "district_id")


class OtpRequest(BaseModel):
    mobile: str


class OtpVerify(BaseModel):
    mobile: str
    code: str
    role: Role
    lang: Lang = "hi"
    name: str = Field(default="", max_length=60)


def _me(user: dict) -> dict:
    out = {"user": {k: user.get(k) for k in ("id", "role", "name", "relation", "preferred_lang", "district_id")},
           "consents": consents_for(user["id"])}
    if user["role"] == "student":
        p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user["id"],))
        out["profile"] = p and {k: v for k, v in p.items() if k != "private_notes"}
        dna = p and db.one("SELECT riasec FROM career_dna WHERE profile_id = ?", (p["id"],))
        out["has_dna"] = bool(dna and dna["riasec"])
        minor = bool(p and (p.get("age") or 18) < 18)
        out["minor"] = minor
        out["guardian_needed"] = minor and not out["consents"]["guardian_approved"]
        link = p and link_for_student(p["id"])
        out["link"] = link and {"code": link["code"], "status": link["consent_status"]}
        out["onboarded"] = bool(p and p.get("district_id") and p.get("education_level"))
    else:
        out["onboarded"] = bool(user.get("district_id")) or user["role"] in ("counsellor", "admin", "teacher")
        if user["role"] == "parent":
            pair = linked_student(user)
            if pair:
                su = db.one("SELECT name FROM users WHERE id = ?", (pair[1]["user_id"],))
                out["linked_student"] = {"profile_id": pair[1]["id"], "name": su and su["name"],
                                         "chosen_trade": pair[1].get("chosen_trade")}
    return out


@router.post("/auth/otp/request")
def otp_request(body: OtpRequest):
    code = auth.request_otp(body.mobile)
    # No SMS gateway in the prototype: the code comes back so the screen can show it as a demo code.
    return {"sent": True, "demo_code": code}


@router.post("/auth/otp/verify")
def otp_verify(body: OtpVerify):
    mh = auth.verify_otp(body.mobile, body.code)
    user = db.one("SELECT * FROM users WHERE mobile_hash = ?", (mh,))
    is_new = user is None
    if is_new:
        if body.role in ("counsellor", "teacher", "admin"):
            raise HTTPException(403, "Staff accounts are created by the institution. Use the demo staff login.")
        user = {"id": new_id(), "role": body.role, "mobile_hash": mh, "name": body.name.strip(), "relation": None,
                "preferred_lang": body.lang, "district_id": None, "created_at": db.now(), "synthetic": 0, "demo_key": None}
        db.insert("users", user)
        if body.role == "student":
            db.insert("student_profiles", {"id": new_id(), "user_id": user["id"], "created_at": db.now(), "synthetic": 0,
                                           "flags": {}, "stage": 1})
    db.update("users", "id", user["id"], {"last_active_at": db.now()})
    return {"token": auth.issue_token(user["id"]), "is_new": is_new, **_me(user)}


@router.post("/auth/demo/{role}")
def demo_login(role: Role):
    user = db.one("SELECT * FROM users WHERE demo_key = ?", (role,))
    if not user:
        raise HTTPException(404, "Demo account missing; reseed the database")
    return {"token": auth.issue_token(user["id"]), "is_new": False, **_me(user)}


@router.post("/auth/logout")
def logout(user: dict = Depends(auth.require())):
    with db.connect() as c:
        c.execute("DELETE FROM auth_tokens WHERE user_id = ?", (user["id"],))
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(auth.require())):
    return _me(user)


class MePatch(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    preferred_lang: Lang | None = None
    district_id: str | None = None
    relation: Literal["mother", "father", "guardian"] | None = None
    education_level: Literal["8", "10", "12", "iti", "grad"] | None = None
    study_mode: Literal["full_time", "part_time", "weekend"] | None = None
    age: int | None = Field(default=None, ge=12, le=40)
    gender: Literal["m", "f", "x"] | None = None
    budget_limit: int | None = Field(default=None, ge=0, le=500000)
    max_travel_km: int | None = Field(default=None, ge=0, le=500)
    needs_stipend: bool | None = None
    min_earning: int | None = Field(default=None, ge=0, le=100000)
    max_months: int | None = Field(default=None, ge=1, le=60)
    work_setting: Literal["indoor", "outdoor", "any"] | None = None
    chosen_trade: str | None = None


@router.patch("/me")
def patch_me(body: MePatch, user: dict = Depends(auth.require())):
    changes = body.model_dump(exclude_none=True)
    if "district_id" in changes and not db.get_district(changes["district_id"]):
        raise HTTPException(400, "Unknown district")
    if "chosen_trade" in changes and not db.get_trade(changes["chosen_trade"]):
        raise HTTPException(400, "Unknown trade")
    user_changes = {k: v for k, v in changes.items() if k in ("name", "preferred_lang", "district_id", "relation")}
    if "district_id" in changes:
        user_changes["state"] = db.get_district(changes["district_id"])["state"]
    if user_changes:
        db.update("users", "id", user["id"], user_changes)
    if user["role"] == "student":
        p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user["id"],))
        prof = {k: v for k, v in changes.items() if k in PROFILE_FIELDS}
        if "needs_stipend" in prof:
            prof["needs_stipend"] = int(prof["needs_stipend"])
        if prof:
            db.update("student_profiles", "id", p["id"], prof)
        if "chosen_trade" in prof and prof["chosen_trade"] != p.get("chosen_trade"):
            sync_chat_trade(p, prof["chosen_trade"])
    if "preferred_lang" in changes:
        with db.connect() as c:
            c.execute("UPDATE sessions SET language = ? WHERE user_id = ?", (changes["preferred_lang"], user["id"]))
    return _me(db.one("SELECT * FROM users WHERE id = ?", (user["id"],)))


class ConsentIn(BaseModel):
    ai_guidance: bool
    counsellor_share: bool
    parent_link: bool
    research: bool


@router.put("/me/consents")
def put_consents(body: ConsentIn, user: dict = Depends(auth.require())):
    current = consents_for(user["id"])
    row = {**{k: int(v) for k, v in body.model_dump().items()}, "guardian_approved": current.get("guardian_approved") or 0,
           "updated_at": db.now()}
    with db.connect() as c:
        c.execute("INSERT OR REPLACE INTO consents (user_id, ai_guidance, counsellor_share, parent_link, research, "
                  "guardian_approved, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (user["id"], row["ai_guidance"], row["counsellor_share"], row["parent_link"], row["research"],
                   row["guardian_approved"], row["updated_at"]))
    return _me(user)


@router.post("/me/chat")
def my_chat(user: dict = Depends(auth.require("student", "parent"))):
    if not consents_for(user["id"]).get("ai_guidance") and user["role"] == "student":
        raise HTTPException(403, "Turn on AI guidance in your privacy settings to chat with UDAAN")
    return {"session_id": ensure_chat(user)}


def _owned(user: dict) -> dict:
    """Everything stored about this user, for export and deletion."""
    p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user["id"],))
    pid = p and p["id"]
    sessions = db.query("SELECT * FROM sessions WHERE user_id = ?", (user["id"],))
    sids = [s["id"] for s in sessions]
    marks = ",".join("?" for _ in sids) or "''"
    return {
        "user": {k: v for k, v in user.items() if k != "mobile_hash"},
        "consents": consents_for(user["id"]),
        "profile": p,
        "career_dna": pid and db.one("SELECT * FROM career_dna WHERE profile_id = ?", (pid,)),
        "simulation_attempts": pid and db.query("SELECT * FROM simulation_attempts WHERE profile_id = ?", (pid,)) or [],
        "guardian_links": db.query("SELECT * FROM guardian_links WHERE student_id = ? OR parent_id = ?", (pid or "", user["id"])),
        "conversations": [{**s, "messages": db.get_messages(s["id"])} for s in sessions],
        "referrals": db.query(f"SELECT * FROM escalations WHERE session_id IN ({marks})", sids),
        "events": db.query("SELECT * FROM events WHERE user_id = ? OR profile_id = ?", (user["id"], pid or "")),
    }


@router.get("/me/export")
def export_me(user: dict = Depends(auth.require("student", "parent"))):
    body = json.dumps({"exported_at": db.now(), **_owned(user)}, ensure_ascii=False, indent=2, default=str)
    return Response(body, media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="udaan-my-data.json"'})


@router.delete("/me")
def delete_me(user: dict = Depends(auth.require("student", "parent"))):
    data = _owned(user)
    pid = data["profile"] and data["profile"]["id"]
    sids = [s["id"] for s in data["conversations"]]
    link_ids = [lk["id"] for lk in data["guardian_links"]]
    with db.connect() as c:
        for sid in sids:
            c.execute("DELETE FROM messages WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM escalations WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM updates WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM sessions WHERE id = ?", (sid,))
        for lid in link_ids:
            c.execute("DELETE FROM consensus WHERE link_id = ?", (lid,))
            c.execute("DELETE FROM guardian_links WHERE id = ?", (lid,))
        if pid:
            for table, col in (("career_dna", "profile_id"), ("simulation_attempts", "profile_id"),
                               ("report_shares", "profile_id"), ("student_profiles", "id")):
                c.execute(f"DELETE FROM {table} WHERE {col} = ?", (pid,))
        c.execute("DELETE FROM events WHERE user_id = ? OR profile_id = ?", (user["id"], pid or ""))
        for table in ("consents", "auth_tokens"):
            c.execute(f"DELETE FROM {table} WHERE user_id = ?", (user["id"],))
        c.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return {"deleted": True}

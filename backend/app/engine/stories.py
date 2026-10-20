"""Career stories ranked by how closely each journey matches the learner (trade, state, gender, schooling, worry)."""
from collections import Counter

from .. import db
from ..catalog import TRADE_PROFILES
from ..stories_data import CAREER_STORIES
from . import dna, match, templates
from .concerns import LABELS, OBJECTIONS

EDUCATION = {"8": ("Class 8", "8वीं"), "10": ("Class 10", "10वीं"), "12": ("Class 12", "12वीं"),
             "iti": ("ITI", "आईटीआई"), "grad": ("Graduate", "ग्रेजुएट")}
GENDER = {"f": ("Girl", "लड़की"), "m": ("Boy", "लड़का")}
WEIGHTS = {"trade": 3, "state": 2, "gender": 2, "education": 1, "worry": 1}


def family_worry(profile_id: str | None) -> str | None:
    """The objection raised most often in this family's chats (student's or linked parent's)."""
    if not profile_id:
        return None
    rows = db.query("SELECT m.concerns FROM messages m JOIN sessions s ON s.id = m.session_id "
                    "WHERE s.profile_id = ? AND m.role = 'user'", (profile_id,))
    counts = Counter(c for r in rows for c in (r["concerns"] or []) if c in OBJECTIONS)
    return counts.most_common(1)[0][0] if counts else None


def _focus_trades(profile: dict) -> set[str]:
    if profile.get("chosen_trade"):
        return {profile["chosen_trade"]}
    d = dna.get(profile["id"]) if profile.get("id") else None
    if d and d.get("riasec"):
        return {r["trade_id"] for r in match.rank(profile, d)[:2]}
    return set()


def _localise(story: dict, lang: str) -> dict:
    t = db.get_trade(story["trade_id"])
    d = db.get_district(story["district_id"])
    o = db.get_outcome(story["trade_id"], story["district_id"])
    schemes = {s["id"]: s for s in db.query("SELECT * FROM schemes")}
    edu = EDUCATION[story["education"]][1 if lang == "hi" else 0]
    return {
        "id": story["id"], "name": story["name"][lang], "age": story["age"], "gender": story["gender"],
        "education": edu,
        "trade": {"id": t["id"], "name": t[f"name_{lang}"], "icon": t["icon"], "nsqf_level": t["nsqf_level"],
                  "sim": TRADE_PROFILES[t["id"]]["sim"]},
        "district": {"id": d["id"], "name": d[f"name_{lang}"], "state": d["state_hi"] if lang == "hi" else d["state"]},
        "start": story["start"][lang],
        "worry": {"id": story["worry"], "label": LABELS[story["worry"]][lang], "icon": LABELS[story["worry"]]["icon"]},
        "steps": [{"icon": s["icon"], "title": s["title"][lang], "text": s["text"][lang]} for s in story["steps"]],
        "now": story["now"][lang],
        "quote": story["quote"][lang], "quote_by": story["quote_by"][lang],
        "schemes": [{"id": k, "name": schemes[k][f"name_{lang}"], "link": schemes[k]["link"]} for k in story["schemes"] if k in schemes],
        "outcome": o and {"year1": [o["earn_low"], o["earn_high"]], "year3": [o["earn3_low"], o["earn3_high"]],
                          "placement_pct": o["placement_pct"], "meta": templates.outcome_meta({
                              **o, "district_of_record": (db.get_district(o["district_id"]) or {}).get(f"name_{lang}")})},
    }


def rank(profile: dict, lang: str = "en") -> dict:
    hi = lang == "hi"
    district = db.get_district(profile.get("district_id") or "") or {}
    state = district.get("state")
    trades = _focus_trades(profile)
    worry = family_worry(profile.get("id"))
    out = []
    for s in CAREER_STORIES:
        sd = db.get_district(s["district_id"])
        hits = {
            "trade": s["trade_id"] in trades,
            "state": state is not None and sd["state"] == state,
            "gender": profile.get("gender") in ("f", "m") and s["gender"] == profile.get("gender"),
            "education": profile.get("education_level") == s["education"],
            "worry": worry is not None and s["worry"] == worry,
        }
        item = _localise(s, lang)
        chips = []
        if hits["gender"]:
            chips.append(GENDER[s["gender"]][1 if hi else 0])
        if hits["education"]:
            chips.append(item["education"])
        if hits["state"]:
            chips.append(item["district"]["state"])
        if hits["trade"]:
            chips.append(item["trade"]["name"])
        if hits["worry"]:
            chips.append(("चिंता: " if hi else "Worried about ") + (item["worry"]["label"] if hi else item["worry"]["label"].lower()))
        item["matches"] = chips
        item["score"] = sum(WEIGHTS[k] for k, v in hits.items() if v)
        out.append(item)
    out.sort(key=lambda x: -x["score"])
    return {"stories": out, "focus_trades": sorted(trades), "family_worry": worry}

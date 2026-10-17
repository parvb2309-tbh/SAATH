"""Parent Proof Mode: the 16-point evidence report (spec §3.4), built only from the database and catalogue."""
from .. import db
from ..catalog import SIM_BY_ID, TRADE_DETAILS, TRADE_PROFILES
from . import templates
from .concerns import LABELS
from .pathway import eligible

TITLES = [
    ("scope", "Occupational scope", "काम क्या है"),
    ("competencies", "Core competencies", "क्या-क्या सीखेंगे"),
    ("prerequisites", "Educational prerequisites", "पढ़ाई की योग्यता"),
    ("duration", "Training duration", "ट्रेनिंग की अवधि"),
    ("nsqf", "NSQF qualification rating", "NSQF स्तर"),
    ("fees", "Verified course fee structure", "कोर्स की फ़ीस"),
    ("assistance", "Financial assistance", "आर्थिक मदद"),
    ("accreditation", "Institutional accreditation", "मान्यता वाले सेंटर"),
    ("hiring", "Geographic hiring intensity", "इलाक़े में नौकरी के मौक़े"),
    ("salary", "Empirical salary benchmarks", "कमाई के आँकड़े"),
    ("self_employment", "Self-employment viability", "अपना काम शुरू करना"),
    ("progression", "Vertical career progression", "आगे बढ़ने का रास्ता"),
    ("safety", "Workplace safety regulations", "काम की जगह पर सुरक्षा"),
    ("lateral", "Lateral pathway options", "दूसरे जुड़े हुए काम"),
    ("faq", "Parent FAQ", "माता-पिता के सवाल"),
    ("sources", "Verifiable data sources", "आँकड़ों के स्रोत"),
]
SCHOOLING_LABEL = {"8": ("Class 8", "8वीं"), "10": ("Class 10", "10वीं"), "12": ("Class 12", "12वीं"),
                   "iti": ("ITI / Polytechnic", "आईटीआई / पॉलिटेक्निक"), "grad": ("Graduate", "ग्रेजुएट")}
OFFICIAL_SOURCES = [
    ("Skill India Digital Hub", "https://www.skillindiadigital.gov.in/"),
    ("National Career Service portal", "https://www.ncs.gov.in/"),
    ("NCVET qualification register", "https://ncvet.gov.in/"),
    ("Apprenticeship India (NAPS)", "https://www.apprenticeshipindia.gov.in/"),
    ("Periodic Labour Force Survey, MoSPI", "https://mospi.gov.in/"),
]


def _demand(trade_id: str, district_id: str) -> dict:
    """Interested students per available seat in the district (the same ratio the admin gap map uses)."""
    seats = sum(c["capacity"] for c in db.query("SELECT * FROM centres WHERE district_id = ?", (district_id,))
                if trade_id in c["trades"])
    interested = db.one("SELECT COUNT(*) AS n FROM student_profiles WHERE district_id = ? AND chosen_trade = ?",
                        (district_id, trade_id))["n"]
    return {"seats": seats, "interested": interested}


def build(trade_id: str, district_id: str, lang: str = "en", education_level: str | None = None) -> dict:
    hi = lang == "hi"
    t = db.get_trade(trade_id)
    det, prof = TRADE_DETAILS[trade_id], TRADE_PROFILES[trade_id]
    session_like = {"district_id": district_id, "trade_id": trade_id, "language": lang,
                    "schooling": education_level or "10", "members": [], "learner_gender": None}
    facts = templates.build_facts(session_like)
    o, lad = facts["outcome"], facts["ladder"]
    d = db.get_district(district_id)
    sim = SIM_BY_ID.get(prof.get("sim") or "")
    tx = lambda pair: pair[lang]  # noqa: E731
    centres = [c for c in db.query("SELECT * FROM centres WHERE district_id = ? ORDER BY distance_km", (district_id,))
               if trade_id in c["trades"]]
    govt_route = any(c["kind"] in ("ITI", "PMKVY") for c in centres)

    body = {
        "scope": {"text": tx(det["day"]), "about": t[f"about_{lang}"], "roles": t[f"roles_{lang}"]},
        "competencies": {"items": [tx(s) for s in det["skills"]]},
        "prerequisites": {
            "min": SCHOOLING_LABEL[t["min_schooling"]][1 if hi else 0],
            "learner": SCHOOLING_LABEL[education_level][1 if hi else 0] if education_level else None,
            "eligible": eligible({"education_level": education_level}, t) if education_level else None,
            "bridge": t["ladder"]["pre"][lang],
        },
        "duration": {"months": t["duration_months"], "hours": det["hours"]},
        "nsqf": {"level": t["nsqf_level"], "qualification": (sim and sim[f"qual_{lang}"]) or t[f"name_{lang}"]},
        "fees": {"govt": prof["fee_govt"], "private": prof["fee_private"], "govt_available": govt_route},
        "assistance": {"schemes": facts["schemes"], "stipend": prof["stipend"]},
        "accreditation": {"centres": [{"name": c[f"name_{lang}"], "kind": c["kind"], "distance_km": c["distance_km"],
                                       "capacity": c["capacity"], "women_hostel": bool(c["women_hostel"])} for c in centres]},
        "hiring": {**_demand(trade_id, district_id),
                   **({"placement_pct": o["placed_within_6_months_pct"], "local_pct": o["placed_in_home_state_pct"],
                       "women_pct": o["women_in_batch_pct"], "cohort": o["batch_size"]} if o else {})},
        "salary": {"bands": [
            {"label": "पहला साल" if hi else "Entry (year 1)", "low": o["first_year_monthly"][0], "high": o["first_year_monthly"][1]},
            {"label": "3 साल बाद" if hi else "Mid (year 3)", "low": o["after_3_years_monthly"][0], "high": o["after_3_years_monthly"][1]},
            {"label": "5 साल बाद" if hi else "Senior (year 5)", "low": o["after_5_years_monthly"][0], "high": o["after_5_years_monthly"][1]},
        ]} if o else {"bands": []},
        "self_employment": {"capital_low": det["capital"][0], "capital_high": det["capital"][1],
                            "mudra": next((s for s in facts["schemes"] if s["id"] == "mudra"), None)},
        "progression": {"course": lad["course"], "first_job": lad["first_job"], "growth": lad["growth"],
                        "next": lad["next_options"]},
        "safety": {"items": [tx(s) for s in det["safety"]]},
        "lateral": {"items": [tx(s) for s in det["lateral"]]},
        "faq": {"items": [{"q": LABELS[c][f"ask_{lang}"], "a": templates.reply_for(c, facts)}
                          for c in ("social_status", "safety", "income", "degree_better")]},
        "sources": {"official": [{"name": n, "url": u} for n, u in OFFICIAL_SOURCES],
                    "outcome": o and templates.outcome_meta(o)},
    }
    sections = [{"n": i, "id": sid, "title": hi_t if hi else en_t, "data": body[sid]}
                for i, (sid, en_t, hi_t) in enumerate(TITLES, start=1)]
    return {
        "trade": {"id": t["id"], "name": t[f"name_{lang}"], "icon": t["icon"], "sector": t[f"sector_{lang}"],
                  "nsqf_level": t["nsqf_level"]},
        "district": {"id": district_id, "name": d[f"name_{lang}"], "state": d["state_hi"] if hi else d["state"]},
        "outcome": o and templates.outcome_meta(o),
        "sections": sections,
        "generated_at": db.now(),
    }

"""Actionable Pathway Engine: 8 stages (spec §3.7), each derived from what the student has actually done."""
from .. import db
from ..catalog import TRADE_PROFILES
from .templates import SCHOOLING_RANK

STAGES = [
    ("discovery", {"en": "Discovery", "hi": "खोज"},
     {"en": "Build your Career DNA and pick a trade to explore.", "hi": "अपना करियर DNA बनाएँ और एक ट्रेड चुनें।"}),
    ("experience", {"en": "Experiential testing", "hi": "करके देखें"},
     {"en": "Try the trade's hands-on simulation in the Lab.", "hi": "लैब में उस ट्रेड का सिमुलेशन करके देखें।"}),
    ("prerequisites", {"en": "Prerequisites", "hi": "योग्यता"},
     {"en": "Check you meet the entry requirement and find an accredited centre.", "hi": "जाँचें कि आप योग्य हैं और मान्यता वाला सेंटर देखें।"}),
    ("finance", {"en": "Financial planning", "hi": "पैसों की योजना"},
     {"en": "See free PMKVY training, stipends and the 5-year comparison with your family.", "hi": "परिवार के साथ मुफ़्त PMKVY ट्रेनिंग, स्टाइपेंड और 5 साल की तुलना देखें।"}),
    ("enrolment", {"en": "Official enrolment", "hi": "दाख़िला"},
     {"en": "Register on the Skill India Digital Hub.", "hi": "स्किल इंडिया डिजिटल हब पर रजिस्टर करें।"}),
    ("assessment", {"en": "Assessment", "hi": "मूल्यांकन"},
     {"en": "Pass the NCVET / Sector Skill Council assessment to get certified.", "hi": "NCVET / सेक्टर स्किल काउंसिल का मूल्यांकन पास करके सर्टिफ़िकेट पाएँ।"}),
    ("apprenticeship", {"en": "Apprenticeship", "hi": "अप्रेंटिसशिप"},
     {"en": "Move into paid on-the-job training through NAPS.", "hi": "NAPS के ज़रिए वेतन वाली ऑन-द-जॉब ट्रेनिंग।"}),
    ("progression", {"en": "Career progression", "hi": "आगे बढ़ना"},
     {"en": "Advanced certificates, diploma or B.Voc bridge courses.", "hi": "एडवांस सर्टिफ़िकेट, डिप्लोमा या बी.वोक ब्रिज कोर्स।"}),
]


def eligible(profile: dict, trade: dict) -> bool:
    have = SCHOOLING_RANK.get(profile.get("education_level") or "10", 10)
    return have >= SCHOOLING_RANK.get(trade["min_schooling"], 10)


def _done_flags(profile: dict) -> dict:
    pid, trade_id = profile["id"], profile.get("chosen_trade")
    flags = profile.get("flags") or {}
    has_dna = bool(db.one("SELECT 1 AS x FROM career_dna WHERE profile_id = ? AND riasec IS NOT NULL", (pid,)))
    sim = TRADE_PROFILES.get(trade_id, {}).get("sim") if trade_id else None
    attempts = db.query("SELECT sim_id FROM simulation_attempts WHERE profile_id = ? AND completed_at IS NOT NULL", (pid,))
    tried = {a["sim_id"] for a in attempts}
    trade = db.get_trade(trade_id) if trade_id else None
    finance = bool(flags.get("finance_viewed")) or bool(db.one(
        "SELECT 1 AS x FROM events WHERE profile_id = ? AND kind IN ('whatif_viewed', 'finance_viewed') LIMIT 1", (pid,)))
    return {
        "discovery": has_dna and bool(trade_id),
        "experience": bool(trade_id) and (sim in tried if sim else bool(tried)),
        "prerequisites": bool(trade) and bool(flags.get("prereq_checked")) and eligible(profile, trade),
        "finance": finance,
        "enrolment": bool(flags.get("sidh_ref")),
        "assessment": False, "apprenticeship": False, "progression": False,
    }


def compute(profile: dict, lang: str = "en") -> dict:
    if profile.get("synthetic"):
        reached = profile.get("stage") or 1
        done = {sid: i + 1 < reached for i, (sid, *_r) in enumerate(STAGES)}
    else:
        done = _done_flags(profile)
    trade = db.get_trade(profile["chosen_trade"]) if profile.get("chosen_trade") else None
    stages, current = [], None
    for i, (sid, title, desc) in enumerate(STAGES, start=1):
        if done[sid]:
            status = "done"
        elif current is None:
            status, current = "current", i
        else:
            status = "upcoming"
        if sid == "prerequisites" and trade and not eligible(profile, trade):
            status = "blocked" if status == "current" else status
        stages.append({"n": i, "id": sid, "title": title[lang], "desc": desc[lang], "status": status})
    completed = (current or 9) - 1  # stages finished in order
    reached = min(current or 8, 8)   # stored on the profile: the stage the student is working on
    if not profile.get("synthetic") and profile.get("stage") != reached:
        db.update("student_profiles", "id", profile["id"], {"stage": reached})
    return {"stages": stages, "current": reached, "completed": completed,
            "trade": trade and {"id": trade["id"], "name": trade[f"name_{lang}"], "icon": trade["icon"]}}

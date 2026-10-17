"""Reverse Career Search: the compatibility index S(u, j) (spec §3.2) and its explanation (§5.2).

    S(u, j) = w1 · f_interest(R_u, T_j) + w2 · f_skill(C_u, K_j) − Σ_m λ_m · g_m(L_u, D_j,m)

f_interest is the cosine similarity, split exactly into one term per RIASEC letter; f_skill is the
K_j-weighted mean competency, one term per competency; each g_m is a constraint violation in [0, 1].
Because S is a plain sum of these terms, the term values are an exact additive attribution, and
"term minus the cohort's average term" equals the SHAP value of each feature group for this model.
"""
import math
from functools import lru_cache

from .. import db
from ..catalog import COMPETENCIES, COMPETENCY_LABELS, RIASEC, RIASEC_LABELS, TRADE_PROFILES
from . import dna as dna_mod

W_INTEREST, W_SKILL = 0.6, 0.4
LAMBDA = {"travel": 0.15, "budget": 0.15, "duration": 0.10, "stipend": 0.08, "earnings": 0.15, "setting": 0.07}
CONSTRAINT_LABELS = {
    "travel": {"en": "Travel distance", "hi": "सफ़र की दूरी"},
    "budget": {"en": "Training fee", "hi": "ट्रेनिंग फ़ीस"},
    "duration": {"en": "Course length", "hi": "कोर्स की अवधि"},
    "stipend": {"en": "Stipend need", "hi": "स्टाइपेंड की ज़रूरत"},
    "earnings": {"en": "Earning need", "hi": "कमाई की ज़रूरत"},
    "setting": {"en": "Indoor / outdoor", "hi": "अंदर / बाहर का काम"},
}
FAR_KM = 80  # no centre in the district: assume the nearest is in another district


def _norm(v: dict) -> float:
    return math.sqrt(sum(x * x for x in v.values())) or 1.0


def trade_constraints(trade_id: str, district_id: str) -> dict:
    return dict(_trade_constraints(trade_id, district_id))


@lru_cache(maxsize=256)
def _trade_constraints(trade_id: str, district_id: str) -> dict:
    """D_j for one district: fee, months, stipend, setting, nearest centre and first-year earning floor."""
    p = TRADE_PROFILES[trade_id]
    t = db.get_trade(trade_id)
    centres = [c for c in db.query("SELECT * FROM centres WHERE district_id = ?", (district_id,)) if trade_id in c["trades"]]
    govt = any(c["kind"] in ("ITI", "PMKVY") for c in centres)
    o = db.get_outcome(trade_id, district_id)
    return {
        "fee": p["fee_govt"] if govt else p["fee_private"],
        "months": t["duration_months"],
        "stipend": p["stipend"],
        "setting": p["setting"],
        "distance_km": min((c["distance_km"] for c in centres), default=FAR_KM),
        "centre": min(centres, key=lambda c: c["distance_km"])["name_en"] if centres else None,
        "earn_low": o["earn_low"] if o else None,
    }


def penalties(L: dict, D: dict) -> dict:
    def over(value, limit, floor):
        if limit is None or value is None or value <= limit:
            return 0.0
        return min(1.0, (value - limit) / max(limit, floor))

    g = {
        "travel": over(D["distance_km"], L.get("max_travel_km"), 5),
        "budget": over(D["fee"], L.get("budget_limit"), 2000),
        "duration": over(D["months"], L.get("max_months"), 1),
        "stipend": 1.0 if L.get("needs_stipend") and not D["stipend"] else 0.0,
        "earnings": 0.0,
        "setting": 0.0,
    }
    need, have = L.get("min_earning"), D.get("earn_low")
    if need and have is not None and have < need:
        g["earnings"] = min(1.0, (need - have) / need)
    pref = L.get("work_setting")
    if pref in ("indoor", "outdoor") and D["setting"] not in ("mixed", pref):
        g["setting"] = 1.0
    return g


def score(profile: dict, dna: dict | None, trade_id: str, D: dict | None = None) -> dict:
    p = TRADE_PROFILES[trade_id]
    R = (dna or {}).get("riasec") or {d: 1 / 6 for d in RIASEC}
    T = p["riasec"]
    denom = _norm(R) * _norm(T)
    C = dna_mod.skill_vector(dna)
    D = D or trade_constraints(trade_id, profile["district_id"])
    g = penalties(profile, D)

    terms = [{"key": d, "group": "interest", "value": W_INTEREST * R.get(d, 0) * T.get(d, 0) / denom} for d in RIASEC]
    terms += [{"key": k, "group": "skill", "value": W_SKILL * w * C[k]} for k, w in p["skills"].items()]
    terms += [{"key": m, "group": "constraint", "value": -LAMBDA[m] * g[m]} for m in LAMBDA]
    S = sum(t["value"] for t in terms)
    for t in terms:
        t["value"] = round(t["value"], 4)
    return {
        "trade_id": trade_id, "S": round(S, 4), "score": round(100 * max(0.0, min(1.0, S))),
        "interest": round(sum(t["value"] for t in terms if t["group"] == "interest"), 4),
        "skill": round(sum(t["value"] for t in terms if t["group"] == "skill"), 4),
        "penalty": round(-sum(t["value"] for t in terms if t["group"] == "constraint"), 4),
        "violations": [m for m in LAMBDA if g[m] > 0], "constraints": D, "terms": terms,
    }


def rank(profile: dict, dna: dict | None) -> list[dict]:
    return sorted((score(profile, dna, tid) for tid in TRADE_PROFILES), key=lambda r: -r["S"])


@lru_cache(maxsize=64)
def _cohort_baseline(district_id: str | None) -> dict:
    """Average term value per (trade, feature) across the synthetic student cohort."""
    where, params = "WHERE p.synthetic = 1", []
    if district_id:
        where += " AND p.district_id = ?"
        params.append(district_id)
    rows = db.query(f"SELECT p.*, d.riasec, d.competencies, d.confidence FROM student_profiles p "
                    f"JOIN career_dna d ON d.profile_id = p.id {where}", params)
    sums: dict = {}
    for r in rows:
        dna = {"riasec": r["riasec"], "competencies": r["competencies"], "confidence": r["confidence"]}
        for tid in TRADE_PROFILES:
            for t in score(r, dna, tid)["terms"]:
                sums[(tid, t["key"])] = sums.get((tid, t["key"]), 0.0) + t["value"]
    n = len(rows) or 1
    return {k: v / n for k, v in sums.items()}


def clear_baseline_cache() -> None:
    _cohort_baseline.cache_clear()


def clear_caches() -> None:
    """Call after outcome or centre data changes."""
    _trade_constraints.cache_clear()
    _cohort_baseline.cache_clear()


def attribution(result: dict, district_id: str | None = None) -> list[dict]:
    """Each feature's contribution relative to the cohort average (SHAP values for this additive score)."""
    base = _cohort_baseline(district_id)
    out = []
    for t in result["terms"]:
        b = base.get((result["trade_id"], t["key"]), 0.0)
        out.append({**t, "baseline": round(b, 4), "shap": round(t["value"] - b, 4)})
    return sorted(out, key=lambda t: -abs(t["shap"]))


def feature_label(key: str, group: str, lang: str) -> str:
    if group == "interest":
        return RIASEC_LABELS[key]["short_" + lang] if lang in ("en", "hi") else key
    if group == "skill":
        return COMPETENCY_LABELS[key][lang]
    return CONSTRAINT_LABELS[key][lang]


def explain(result: dict, profile: dict, lang: str) -> str:
    """One plain-language line for the student: the strongest reasons for and against."""
    hi = lang == "hi"
    interest = sorted((t for t in result["terms"] if t["group"] == "interest"), key=lambda t: -t["value"])[:2]
    likes = (" और " if hi else " and ").join(feature_label(t["key"], "interest", lang).lower() if not hi else
                                              feature_label(t["key"], "interest", lang) for t in interest)
    parts = [f"आपकी पसंद से मेल: {likes}" if hi else f"Fits your liking for {likes}"]
    skill = max((t for t in result["terms"] if t["group"] == "skill"), key=lambda t: t["value"], default=None)
    if skill and skill["value"] > 0.08:
        parts.append(f"आपकी ताक़त: {feature_label(skill['key'], 'skill', lang)}" if hi
                     else f"uses your strength in {feature_label(skill['key'], 'skill', lang).lower()}")
    D = result["constraints"]
    for m in result["violations"][:1]:
        if m == "travel":
            parts.append(f"नज़दीकी सेंटर {D['distance_km']} किमी दूर है" if hi else f"nearest centre is {D['distance_km']} km away")
        elif m == "budget":
            parts.append(f"फ़ीस ₹{D['fee']:,} है" if hi else f"fee is ₹{D['fee']:,}")
        elif m == "duration":
            parts.append(f"कोर्स {D['months']} महीने का है" if hi else f"course takes {D['months']} months")
        elif m == "stipend":
            parts.append("इसमें स्टाइपेंड नहीं मिलता" if hi else "no stipend during training")
        elif m == "earnings":
            parts.append(f"पहले साल की कमाई ₹{D['earn_low']:,} से शुरू होती है" if hi else f"first-year pay starts at ₹{D['earn_low']:,}")
        elif m == "setting":
            parts.append("काम की जगह आपकी पसंद से अलग है" if hi else "work setting differs from your preference")
    if result["violations"] and len(parts) > 1:
        parts[-1] = ("लेकिन " if hi else "but ") + parts[-1]
    return "; ".join(parts) + ("।" if hi else ".")

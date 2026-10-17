"""Career DNA profile P_u(t) = [R, C, L, S, E] (spec §3.1).

R  normalised Holland RIASEC vector from the activity cards (sums to 1)
C  practical competencies in [0, 1], updated from simulation attempts
L  constraints (travel, budget, duration, stipend, earnings, setting) — stored on the student profile
S  self-reported confidence (numerical, spatial, digital), 1–5
E  exploration history (simulations tried, trades viewed)
"""
from .. import db
from ..catalog import COMPETENCIES, RIASEC, RIASEC_ITEMS, SIM_BY_ID

VOTE = {"like": 2, "meh": 1, "no": 0}
ITEM_DIM = {i["id"]: i["dim"] for i in RIASEC_ITEMS}
CONFIDENCE_DIMS = ("numerical", "spatial", "digital")
NEW_WEIGHT = 0.6  # how strongly a new simulation result moves an existing competency


def riasec_from_answers(answers: dict) -> dict:
    totals = {d: 0 for d in RIASEC}
    for item, vote in (answers or {}).items():
        if item in ITEM_DIM and vote in VOTE:
            totals[ITEM_DIM[item]] += VOTE[vote]
    s = sum(totals.values())
    if s == 0:
        return {d: round(1 / 6, 4) for d in RIASEC}
    vec = {d: totals[d] / s for d in RIASEC}
    # round but keep the sum exactly 1
    out = {d: round(v, 4) for d, v in vec.items()}
    out[max(out, key=out.get)] += round(1 - sum(out.values()), 4)
    return out


def top_dims(riasec: dict, n: int = 2) -> list[str]:
    return sorted(RIASEC, key=lambda d: -(riasec or {}).get(d, 0))[:n]


def update_competencies(comp: dict | None, sim_id: str, accuracy: float, safety: float) -> dict:
    comp = dict(comp or {})
    sim = SIM_BY_ID[sim_id]
    for k, v in [*((c, accuracy) for c in sim["competencies"]), ("safety", safety)]:
        v = max(0.0, min(1.0, float(v)))
        comp[k] = round(v if k not in comp else NEW_WEIGHT * v + (1 - NEW_WEIGHT) * comp[k], 3)
    return comp


def skill_vector(dna: dict | None) -> dict:
    """C_u where measured; otherwise a prior from self-reported confidence (or a neutral 0.5)."""
    dna = dna or {}
    comp, conf = dna.get("competencies") or {}, dna.get("confidence") or {}
    out = {}
    for k in COMPETENCIES:
        if k in comp:
            out[k] = comp[k]
        elif k in conf:
            out[k] = round(0.2 + 0.6 * (int(conf[k]) - 1) / 4, 3)
        else:
            out[k] = 0.5
    return out


def get(profile_id: str) -> dict | None:
    return db.one("SELECT * FROM career_dna WHERE profile_id = ?", (profile_id,))


def save(profile_id: str, **fields) -> dict:
    existing = get(profile_id)
    fields["updated_at"] = db.now()
    if existing:
        db.update("career_dna", "profile_id", profile_id, fields)
    else:
        db.insert("career_dna", {"profile_id": profile_id, "riasec": None, "answers": {}, "competencies": {},
                                 "confidence": {}, "exploration": {"sims": [], "trades_viewed": []}, **fields})
    return get(profile_id)


def record_exploration(profile_id: str, *, sim: str | None = None, trade: str | None = None) -> None:
    dna = get(profile_id) or save(profile_id)
    ex = dna.get("exploration") or {"sims": [], "trades_viewed": []}
    if sim:
        ex.setdefault("sims", []).append(sim)
    if trade and trade not in ex.setdefault("trades_viewed", []):
        ex["trades_viewed"].append(trade)
    db.update("career_dna", "profile_id", profile_id, {"exploration": ex, "updated_at": db.now()})

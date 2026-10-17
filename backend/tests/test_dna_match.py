"""Career DNA and the compatibility index S(u, j)."""
import math

import pytest

from app.catalog import RIASEC_ITEMS
from app.engine import dna, match


def answers(liked_dims):
    return {i["id"]: ("like" if i["dim"] in liked_dims else "no") for i in RIASEC_ITEMS}


def test_riasec_sums_to_one():
    r = dna.riasec_from_answers(answers("RI"))
    assert math.isclose(sum(r.values()), 1.0, abs_tol=1e-6)
    assert dna.top_dims(r) == ["R", "I"] or set(dna.top_dims(r)) == {"R", "I"}
    assert dna.riasec_from_answers({}) == pytest.approx({d: 1 / 6 for d in "RIASEC"}, abs=1e-3)


def test_competencies_move_with_simulations():
    c = dna.update_competencies({}, "solar", 0.9, 0.3)
    assert c["spatial"] == 0.9 and c["safety"] == 0.3
    c2 = dna.update_competencies(c, "solar", 0.5, 1.0)
    assert 0.5 < c2["spatial"] < 0.9 and c2["safety"] > 0.3


def profile(**kw):
    base = {"district_id": "gaya", "max_travel_km": None, "budget_limit": None, "max_months": None, "needs_stipend": 0,
            "min_earning": None, "work_setting": "any"}
    return {**base, **kw}


def test_interests_drive_ranking(client):
    hands_on = {"riasec": dna.riasec_from_answers(answers("RI"))}
    caring = {"riasec": dna.riasec_from_answers(answers("S"))}
    assert match.rank(profile(), hands_on)[0]["trade_id"] in {"electrician", "solar", "auto_tech", "ac_tech"}
    assert match.rank(profile(), caring)[0]["trade_id"] in {"gda", "beauty", "retail"}


def test_constraints_lower_the_score(client):
    d = {"riasec": dna.riasec_from_answers(answers("RI"))}
    free = match.score(profile(), d, "electrician")
    tight = match.score(profile(max_months=6, needs_stipend=0), d, "electrician")
    assert "duration" in tight["violations"] and tight["S"] < free["S"]


def test_terms_are_an_exact_additive_attribution(client):
    d = {"riasec": dna.riasec_from_answers(answers("C"))}
    r = match.score(profile(max_travel_km=1), d, "data_entry")
    assert math.isclose(sum(t["value"] for t in r["terms"]), r["S"], abs_tol=1e-3)
    att = match.attribution(r)
    assert all(math.isclose(a["shap"], a["value"] - a["baseline"], abs_tol=1e-3) for a in att)
    assert match.explain(r, profile(), "en") and match.explain(r, profile(), "hi")


def test_student_matches_endpoint_reranks_live(client, login):
    h = login("student")
    base = client.get("/api/student/matches", headers=h).json()
    assert base["has_dna"] and len(base["results"]) == 9
    near = client.get("/api/student/matches?max_travel_km=1&budget_limit=0", headers=h).json()
    by_id = {r["trade_id"]: r for r in near["results"]}
    assert any("travel" in r["violations"] for r in near["results"])
    assert all(r["why"] for r in near["results"])
    assert by_id["solar"]["S"] <= {r["trade_id"]: r for r in base["results"]}["solar"]["S"]

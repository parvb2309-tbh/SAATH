"""Parent Proof report, What-If comparator, Family Consensus Builder and the guardian link."""
from app.engine import consensus, whatif


def test_whatif_math_adds_up(client):
    r = whatif.simulate("electrician", "patna")
    assert r["available"] and [o["id"] for o in r["options"]] == ["A", "B", "C"]
    for o in r["options"]:
        rows = o["rows"]
        assert len(rows) == 5
        running = 0
        for row in rows:
            assert row["net"] == row["earnings"] + row["stipend"] - row["direct_cost"]
            running += row["net"]
            assert abs(row["cumulative"] - running) <= 5  # each year is rounded separately
    a, b, c = r["options"]
    assert a["total_income"] == 0 and a["first_income_year"] is None
    assert b["rows"][2]["stipend"] == 12 * r["assumptions"]["naps_stipend"]
    assert c["first_income_year"] == 1


def test_whatif_overrides_change_result(client):
    low = whatif.simulate("gda", "gaya", {"band": "low"})
    high = whatif.simulate("gda", "gaya", {"band": "high", "naps_stipend": 9000})
    assert high["options"][1]["net_5y"] > low["options"][1]["net_5y"]


def test_consensus_columns():
    s = {"earn_soon": 5, "near_home": 2, "safety": 1, "respect": 5, "low_cost": 3, "degree_path": 1, "interest": 5, "stability": 4}
    p = {"earn_soon": 5, "near_home": 5, "safety": 5, "respect": 1, "low_cost": 3, "degree_path": 4, "interest": 3, "stability": 4}
    plan = consensus.build_plan(s, p, "solar")
    col = {i["id"]: i["column"] for i in plan["items"]}
    assert col["earn_soon"] == col["low_cost"] == col["stability"] == "agreed"
    assert col["near_home"] == "verify" and col["degree_path"] == "verify"
    assert col["safety"] == "counsellor" and col["respect"] == "counsellor"
    assert col["interest"] == "simulate"
    assert plan["agreement_pct"] == 38


def test_parent_flow_keeps_student_notes_private(client, login):
    student, parent = login("student"), login("parent")
    client.put("/api/student/consensus", headers=student,
               json={"answers": {"earn_soon": 4, "safety": 2, "interest": 5}, "private_notes": "SECRET-NOTE"})
    ov = client.get("/api/parent/overview", headers=parent).json()
    assert ov["chosen_trade"]["id"] == "solar" and ov["pathway"]["stages"]
    r = client.put("/api/parent/consensus", headers=parent,
                   json={"answers": {"earn_soon": 4, "safety": 5, "interest": 3}}).json()
    assert r["plan"] and len(r["plan"]["items"]) == 3
    assert "SECRET-NOTE" not in str(r) and "SECRET-NOTE" not in str(ov)
    assert client.post("/api/parent/consensus/accept", headers=parent).json()["completed"]


def test_report_has_16_sections_and_share_link(client, login):
    student, parent = login("student"), login("parent")
    rep = client.get("/api/parent/report", headers=parent).json()
    assert [s["n"] for s in rep["sections"]] == list(range(1, 17))
    sec = {s["id"]: s["data"] for s in rep["sections"]}
    assert sec["salary"]["bands"] and sec["accreditation"]["centres"] and len(sec["faq"]["items"]) == 4
    share = client.post("/api/student/report/share", headers=student, json={"trade": "solar"}).json()
    public = client.get(f"/api/reports/{share['token']}?lang=en")
    assert public.status_code == 200 and public.json()["trade"]["id"] == "solar"
    assert "Riya" not in public.text  # the shared copy carries no personal details


def test_link_code_approves_guardian_consent(client):
    code = client.post("/api/auth/otp/request", json={"mobile": "9811122233"}).json()["demo_code"]
    st = client.post("/api/auth/otp/verify", json={"mobile": "9811122233", "code": code, "role": "student", "name": "Test"}).json()
    hs = {"Authorization": f"Bearer {st['token']}"}
    client.patch("/api/me", headers=hs, json={"district_id": "bhopal", "education_level": "10", "age": 16, "gender": "f"})
    me = client.get("/api/me", headers=hs).json()
    assert me["minor"] and me["guardian_needed"]
    link_code = client.get("/api/student/family", headers=hs).json()["link"]["code"]
    pc = client.post("/api/auth/otp/request", json={"mobile": "9811122234"}).json()["demo_code"]
    pa = client.post("/api/auth/otp/verify", json={"mobile": "9811122234", "code": pc, "role": "parent"}).json()
    hp = {"Authorization": f"Bearer {pa['token']}"}
    assert client.post("/api/parent/link", headers=hp, json={"code": link_code.lower()}).status_code == 200
    assert client.get("/api/me", headers=hs).json()["guardian_needed"] is False

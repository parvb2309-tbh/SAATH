"""Sign-in and privacy, simulations and the pathway, risk levels, retrieval, and admin/teacher analytics."""
from app import db
from app.engine import retrieval


def _new_student(client, tag):
    import re
    import uuid
    from app.email_service import sent_emails_mock
    uid_str = uuid.uuid4().hex[:6]
    email = f"student_{tag}_{uid_str}@example.com"
    reg = client.post("/api/auth/register", json={"name": "Asha", "email": email, "password": "Password@123", "role": "student"})
    assert reg.status_code == 200, reg.text
    email_obj = next(m for m in reversed(sent_emails_mock) if m["to"] == email)
    code = re.search(r"\b\d{6}\b", email_obj["text"]).group(0)
    ver = client.post("/api/auth/otp/verify", json={"email": email, "code": code, "purpose": "signup_verification"})
    assert ver.status_code == 200, ver.text
    r = ver.json()
    h = {"Authorization": f"Bearer {r['token']}"}
    client.patch("/api/me", headers=h, json={"district_id": "lucknow", "education_level": "10", "age": 19, "gender": "f"})
    client.put("/api/me/consents", headers=h, json={"ai_guidance": True, "counsellor_share": True, "parent_link": True,
                                                     "research": False})
    return r, h


def test_email_registration_and_argon2(client):
    assert client.post("/api/auth/otp/verify", json={"email": "unregistered@saath.local", "code": "000000",
                                                     "purpose": "signup_verification"}).status_code == 400
    r, _ = _new_student(client, "argon2_check")
    from app import mongo
    users_col = mongo.get_sync_users_col()
    doc = users_col.find_one({"_id": r["user"]["id"]})
    assert doc and doc["password_hash"].startswith("$argon2id$")
    assert client.post("/api/auth/register", json={"name": "Test", "password": "Password@123", "role": "student", "email": "invalid"}).status_code == 400


def test_roles_are_enforced(client, login):
    assert client.get("/api/admin/metrics", headers=login("student")).status_code == 403
    assert client.get("/api/escalations", headers=login("parent")).status_code == 403
    assert client.get("/api/teacher/class", headers=login("teacher")).status_code == 200


def test_simulation_updates_dna_and_pathway(client):
    _, h = _new_student(client, "9000022222")
    client.put("/api/student/dna", headers=h, json={"answers": {"r1": "like", "c2": "like", "s1": "no"},
                                                    "confidence": {"digital": 5}})
    client.patch("/api/me", headers=h, json={"chosen_trade": "data_entry"})
    p0 = client.get("/api/student/pathway", headers=h).json()
    assert p0["stages"][0]["status"] == "done" and p0["current"] == 2
    aid = client.post("/api/student/sims/data_entry/start", headers=h).json()["attempt_id"]
    r = client.post(f"/api/student/sims/data_entry/attempts/{aid}", headers=h,
                    json={"time_s": 240, "accuracy": 0.8, "safety_score": 0.9, "telemetry": {"x": 1}}).json()
    assert r["competencies"]["digital"] == 0.8 and r["pathway"]["stages"][1]["status"] == "done"
    assert client.post(f"/api/student/sims/data_entry/attempts/{aid}", headers=h,
                       json={"time_s": 1, "accuracy": 1, "safety_score": 1}).status_code == 409
    # Class 10 is below the Class 12 requirement for data entry: stage 3 is blocked, not done
    p = client.post("/api/student/pathway", headers=h, json={"action": "prereq_checked"}).json()
    assert p["stages"][2]["status"] == "blocked"
    p = client.post("/api/student/pathway", headers=h, json={"action": "enrol"}).json()
    assert p["details"]["sidh_ref"].startswith("SIDH-DEMO-")


def test_export_and_delete(client):
    r, h = _new_student(client, "9000033333")
    exported = client.get("/api/me/export", headers=h)
    assert exported.status_code == 200 and "career_dna" in exported.json() and "mobile_hash" not in exported.text
    assert client.delete("/api/me", headers=h).json()["deleted"]
    assert client.get("/api/me", headers=h).status_code == 401
    assert db.one("SELECT * FROM users WHERE id = ?", (r["user"]["id"],)) is None


def test_risk_levels_in_chat(client):
    _, h = _new_student(client, "9000044444")
    client.patch("/api/me", headers=h, json={"chosen_trade": "gda"})
    sid = client.post("/api/me/chat", headers=h).json()["session_id"]
    calm = client.post(f"/api/sessions/{sid}/messages", json={"text": "fees kitni hai?", "speaker": "learner"}).json()
    assert calm["risk"] is None and calm["assistant"]["sources"]
    l2 = client.post(f"/api/sessions/{sid}/messages",
                     json={"text": "bahut pressure hai, padhai chhod dungi", "speaker": "learner"}).json()
    assert l2["risk"]["level"] == 2 and l2["risk"]["needs_consent"] and l2["escalation"] is None
    assert all(c["type"] == "helpline" for c in l2["assistant"]["cards"])
    ref = client.post(f"/api/sessions/{sid}/referral", json={"consent": True}).json()
    assert ref["created"] and ref["risk_level"] == 2
    l3 = client.post(f"/api/sessions/{sid}/messages", json={"text": "main khud ko nuksan pahunchana chahti hoon",
                                                            "speaker": "learner"}).json()
    assert l3["risk"]["level"] == 3 and l3["risk"]["halted"]
    assert "14416" in l3["assistant"]["text"] and "1800-599-0019" in l3["assistant"]["text"]
    after = client.post(f"/api/sessions/{sid}/messages", json={"text": "salary kitni hai", "speaker": "learner"}).json()
    assert "14416" in after["assistant"]["text"]  # career chat stays halted


def test_retrieval_finds_the_right_passage(client):
    retrieval.clear_cache()
    assert retrieval.search("apprenticeship stipend kitna milta hai")[0]["id"] == "naps"
    assert retrieval.search("क्या सर्टिफ़िकेट मान्य है")[0]["id"] == "ncvet"
    assert retrieval.search("fees", concerns=["cost"])[0]["id"] in {"pmkvy", "scholarship"}
    assert retrieval.search("loan for own shop")[0]["id"] == "mudra"


def test_admin_gap_map_and_privacy_threshold(client, login):
    h = login("admin")
    g = client.get("/api/admin/gis?trade=solar", headers=h).json()
    rows = {r["id"]: r for r in g["districts"]}
    assert rows["rewa"]["suppressed"] and rows["rewa"]["igi"] is None
    lk = rows["lucknow"]
    assert not lk["suppressed"] and abs(lk["igi"] - lk["demand"] / (lk["seats"] + 1)) < 1e-3
    b = client.get("/api/admin/barriers?split=gender", headers=h).json()
    assert any(r["suppressed"] for r in b["rows"]) and any(not r["suppressed"] for r in b["rows"])
    assert all(r.get("counts") is None for r in b["rows"] if r["suppressed"])
    m = {x["id"]: x for x in client.get("/api/admin/metrics", headers=h).json()["metrics"]}
    assert set(m) == {"sim_completion", "pathway_depth", "report_use", "consensus", "referral_sla", "coverage"}
    assert m["coverage"]["value"] == 100 and m["referral_sla"]["value"] is not None
    att = client.get("/api/admin/attribution", headers=h).json()
    assert any(r["values"] for r in att["rows"]) and any(r["suppressed"] for r in att["rows"])


def test_counsellor_sees_consented_profile_and_sla(client, login):
    h = login("counsellor")
    queue = client.get("/api/escalations", headers=h).json()
    l2 = next(e for e in queue if e["session_id"] == "demo-esc-l2")
    assert queue[0]["risk_level"] == 3  # safeguarding cases first
    case = client.get(f"/api/escalations/{l2['id']}", headers=h).json()
    assert case["profile"]["consented"] and case["profile"]["attribution"]
    after = client.patch(f"/api/escalations/{l2['id']}", headers=h, json={"first_contact": True}).json()
    assert after["first_contact_at"]


def test_teacher_class_view_hides_conversations(client, login):
    c = client.get("/api/teacher/class", headers=login("teacher")).json()
    assert c["size"] >= 30 and 0 <= c["dna_completion"] <= 100
    assert abs(sum(c["riasec_mean"].values()) - 1) < 0.02
    assert all(set(r) <= {"id", "student", "created_at", "status", "first_contact_at", "urgent"} for r in c["referrals"])

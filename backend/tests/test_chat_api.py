from app.engine import guard, templates
from app import db


def new_session(client, **kw):
    body = {"members": ["mother", "learner"], "learner_gender": "f", "district_id": "gaya",
            "trade_id": "gda", "income_bracket": "lt10", "schooling": "10", "language": "hi", "consent": True}
    body.update(kw)
    r = client.post("/api/sessions", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_meta(client):
    m = client.get("/api/meta").json()
    assert len(m["districts"]) == 9 and len(m["trades"]) == 6
    assert m["engine"]["configured"] is False


def test_consent_required(client):
    r = client.post("/api/sessions", json={"members": ["learner"], "district_id": "patna", "consent": False})
    assert r.status_code == 400


def test_offline_income_answer_uses_db_figures(client):
    s = new_session(client)
    sid = s["session"]["id"]
    assert s["messages"][0]["role"] == "assistant"
    r = client.post(f"/api/sessions/{sid}/messages", json={"text": "beti kitna kamayegi?", "speaker": "mother"}).json()
    assert r["engine"] == "offline"
    assert "income" in r["user"]["concerns"]
    facts = templates.build_facts(db.get_session(sid))
    ok, bad = guard.check(r["assistant"]["text"], facts)
    assert ok, bad
    assert any(c["type"] == "fact" for c in r["assistant"]["cards"])


def test_repeated_concern_escalates_and_reaches_console(client):
    sid = new_session(client, district_id="patna", trade_id="electrician", members=["father", "learner"],
                      learner_gender="m")["session"]["id"]
    esc = None
    for _ in range(3):
        esc = client.post(f"/api/sessions/{sid}/messages",
                          json={"text": "degree zyada achhi hai, college bhejna hai", "speaker": "father"}).json()["escalation"]
    assert esc and esc["code"] == "repeat:degree_better"
    queue = client.get("/api/escalations").json()
    assert any(e["session_id"] == sid for e in queue)
    detail = client.get(f"/api/escalations/{esc['id']}").json()
    assert detail["summary"] and detail["messages"]


def test_state_fallback_is_labelled(client):
    sid = new_session(client, district_id="rewa", trade_id="beauty", language="en")["session"]["id"]
    r = client.post(f"/api/sessions/{sid}/messages", json={"text": "How much will she earn?", "speaker": "mother"}).json()
    assert "no record for your district" in r["assistant"]["text"]


def test_pathway_and_admin(client):
    sid = new_session(client, schooling="8", trade_id="electrician", language="en")["session"]["id"]
    p = client.get(f"/api/sessions/{sid}/pathway").json()
    assert p["steps"][0]["kind"] == "pre"  # Class 8 learner needs a step before ITI Electrician
    summary = client.get("/api/admin/summary").json()
    assert summary["kpis"]["sessions"] > 300 and len(summary["districts"]) == 9
    upd = client.post("/api/admin/updates", json={"session_id": sid, "kind": "progress"}).json()
    assert upd["text_hi"] and upd["text_en"]


def test_csv_import(client):
    csv_text = ("trade_id,district_id,provider,earn_low,earn_high,earn3_low,earn3_high,earn5_low,earn5_high,"
                "placement_pct,local_pct,women_pct,cohort,source,year,status\n"
                "beauty,rewa,Test Centre,8000,12000,10000,15000,13000,20000,60,70,90,30,Test source,2025,verified\n"
                "beauty,nowhere,X,1,2,3,4,5,6,7,8,9,10,Y,2025,verified\n")
    r = client.post("/api/admin/import-outcomes", content=csv_text, headers={"content-type": "text/csv"}).json()
    assert r["loaded"] == 1 and len(r["errors"]) == 1

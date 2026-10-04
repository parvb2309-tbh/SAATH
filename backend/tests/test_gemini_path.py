"""Gemini path with a mocked model: honest replies pass through, invented numbers are replaced."""
from app.llm import gemini
from app.llm.gemini import CounselTurn


def _session(client):
    return client.post("/api/sessions", json={
        "members": ["father", "learner"], "learner_gender": "m", "district_id": "indore", "trade_id": "ac_tech",
        "schooling": "12", "language": "en", "consent": True}).json()["session"]["id"]


def test_honest_reply_is_used(client, monkeypatch):
    monkeypatch.setattr(gemini, "available", lambda: True)
    monkeypatch.setattr(gemini, "summarize", lambda **_: None)
    monkeypatch.setattr(gemini, "counsel_turn", lambda **_: CounselTurn(
        concerns=["income"], sentiment=-0.2, needs_human=False,
        reply="AC technicians from your area start in a steady job and earn more with experience."))
    sid = _session(client)
    r = client.post(f"/api/sessions/{sid}/messages", json={"text": "How much will he earn?", "speaker": "father"}).json()
    assert r["engine"] == "gemini"
    assert r["assistant"]["text"].startswith("AC technicians")
    assert any(c["type"] == "fact" for c in r["assistant"]["cards"])


def test_invented_number_falls_back_to_template(client, monkeypatch):
    monkeypatch.setattr(gemini, "available", lambda: True)
    monkeypatch.setattr(gemini, "summarize", lambda **_: None)
    monkeypatch.setattr(gemini, "counsel_turn", lambda **_: CounselTurn(
        concerns=["income"], sentiment=-0.2, needs_human=False,
        reply="He will surely earn ₹45,000 a month from day one!"))
    sid = _session(client)
    r = client.post(f"/api/sessions/{sid}/messages", json={"text": "How much will he earn?", "speaker": "father"}).json()
    assert r["engine"] == "gemini+guard"
    assert "45,000" not in r["assistant"]["text"]
    assert r["guard_blocked"]


def test_distress_keywords_override_the_model(client, monkeypatch):
    monkeypatch.setattr(gemini, "available", lambda: True)
    monkeypatch.setattr(gemini, "summarize", lambda **_: None)
    monkeypatch.setattr(gemini, "counsel_turn", lambda **_: CounselTurn(
        concerns=["other"], sentiment=-0.3, needs_human=False, reply="I understand. Tell me more."))
    sid = _session(client)
    r = client.post(f"/api/sessions/{sid}/messages",
                    json={"text": "I feel hopeless, I want to kill myself", "speaker": "learner"}).json()
    assert r["user"]["concerns"][0] == "distress"
    assert r["escalation"]["priority"] == 1
    assert "14416" in r["assistant"]["text"]

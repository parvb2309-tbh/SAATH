from app.engine import quiz


def test_care_answers_point_to_healthcare():
    r = quiz.score([1, 1, 1, 0, 3, 3, 3, 1, 1])
    assert r["matches"][0]["trade_id"] == "gda"
    assert r["worries"][0] == "safety"  # direct worry (x2) plus "depends on safety"
    assert r["keenness"] == 0.1


def test_skipped_answers_are_ignored():
    r = quiz.score([None] * 8 + [3])
    assert r["matches"] == [] and r["worries"] == [] and r["keenness"] == -0.8


def test_quiz_session_starts_with_top_worry(client):
    q = client.get("/api/quiz").json()
    assert len(q) == 9 and all(len(x["options"]) == 4 for x in q)
    body = {"members": ["father", "learner"], "learner_gender": "m", "learner_age": 17, "district_id": "patna",
            "schooling": "10", "language": "hi", "consent": True,
            "quiz_answers": [0, 0, 0, 1, 2, 2, 0, 1, 2]}
    d = client.post("/api/sessions", json=body).json()
    s = d["session"]
    assert s["trade_id"] == "electrician" and s["learner_age"] == 17
    assert s["first_sentiment"] == -0.4 and s["quiz"]["worries"][0] == "social_status"
    roles = [(m["role"], m["engine"]) for m in d["messages"]]
    assert roles[0] == ("user", "quiz")  # quiz answers recorded for counsellors
    worry_msg = d["messages"][-1]
    assert worry_msg["concerns"] == ["social_status"] and worry_msg["cards"]


def test_quiz_worries_do_not_trigger_escalation_on_their_own(client):
    body = {"members": ["mother", "learner"], "learner_gender": "f", "district_id": "gaya", "language": "en",
            "consent": True, "quiz_answers": [1, 1, 1, 0, 3, 3, 0, 1, 2]}
    sid = client.post("/api/sessions", json=body).json()["session"]["id"]
    r = client.post(f"/api/sessions/{sid}/messages", json={"text": "Is it safe for my daughter at night?",
                                                         "speaker": "mother"}).json()
    assert r["escalation"] is None

from app.engine.escalation import evaluate, level_for


def u(concerns, s=-0.2):
    return {"role": "user", "concerns": concerns, "sentiment": s}


def test_crisis_is_level_3():
    assert evaluate([], ["crisis", "distress"], -0.9) == ("crisis", 1)
    assert level_for("crisis") == 3


def test_distress_is_level_2():
    assert evaluate([], ["distress"], -0.9) == ("distress", 1)
    assert level_for("distress") == 2


def test_decision_paralysis_is_level_1():
    assert evaluate([], ["confused"], -0.1) == ("paralysis", 3)
    assert evaluate([], ["income"], 0.0, trade_changes=3) == ("trade_switching", 3)
    assert level_for("paralysis") == level_for("repeat:income") == 1


def test_asking_for_a_person():
    assert evaluate([], ["human_request"], 0.0) == ("asked_for_human", 2)


def test_repeat_concern_three_times():
    hist = [u(["degree_better"]), u(["degree_better"])]
    assert evaluate(hist, ["degree_better"], -0.2) == ("repeat:degree_better", 3)


def test_two_low_turns():
    assert evaluate([u(["income"], -0.6)], ["social_status"], -0.7) == ("low_sentiment", 3)


def test_safety_repeated_and_unhappy():
    assert evaluate([u(["safety"])], ["safety"], -0.5) == ("safety_unresolved", 2)


def test_no_local_data():
    assert evaluate([], ["income"], -0.1, had_data=False) == ("no_local_data", 4)


def test_calm_conversation_stays_with_ai():
    assert evaluate([u(["income"], -0.1)], ["job_security"], 0.2) is None

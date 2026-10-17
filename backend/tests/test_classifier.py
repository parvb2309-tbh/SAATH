import pytest

from app.engine.classifier import classify
from app.engine.sentiment import score


@pytest.mark.parametrize("text,expected", [
    ("कितना कमाएगा मेरा बेटा?", "income"),
    ("salary kitni milegi?", "income"),
    ("नौकरी पक्की मिलेगी?", "job_security"),
    ("log kya kahenge, mistri banega", "social_status"),
    ("बेटी के लिए सुरक्षित है?", "safety"),
    ("beti ko raat mein kaam karna padega kya?", "safety"),
    ("ghar se door jana padega?", "distance"),
    ("Isn't a degree better than this?", "degree_better"),
    ("fees kitni hai", "cost"),
    ("course mein kya sikhega", "course_info"),
    ("mujhe counsellor se baat karni hai", "human_request"),
    ("namaste", "greeting"),
])
def test_main_concern(text, expected):
    assert classify(text)[0] == expected


def test_self_harm_is_crisis_not_just_distress():
    assert classify("main bahut pareshan hoon, mar jaun aisa lagta hai")[0] == "crisis"
    assert classify("ghar par maarte hain")[0] == "crisis"


def test_pressure_and_dropout_is_distress():
    assert classify("bahut pressure hai, padhai chhod dunga")[0] == "distress"


def test_hesitation_is_confused():
    assert "confused" in classify("samajh nahi aa raha kaun sa chunu")


def test_unknown_is_other():
    assert classify("hmm") == ["other"]


def test_sentiment_direction():
    assert score("accha theek hai, samajh gaya") > 0.3
    assert score("nahi, bharosa nahi, bekar hai") < -0.3

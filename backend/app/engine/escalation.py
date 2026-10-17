"""4-level risk protocol (spec §5.3). Lower priority number = more urgent.

Level 0  normal exploration      grounded answers, no human involved
Level 1  decision paralysis      banner offers to book a counsellor session (family books it)
Level 2  substantial distress    recommendations pause; a Priority Referral is created only with consent
Level 3  immediate safety        helplines shown, career chat halted, safeguarding desk alerted automatically
"""
from collections import Counter

from .concerns import OBJECTIONS

UNRESOLVED_REPEATS = 3
LOW_SENTIMENT = -0.5
TRADE_SWITCHES = 3

LEVEL = {
    "crisis": 3, "distress": 2, "asked_for_human": 1, "safety_unresolved": 1, "low_sentiment": 1,
    "paralysis": 1, "trade_switching": 1, "no_local_data": 1, "manual": 1, "ai_unresolved": 1,
}


def level_for(code: str) -> int:
    return 1 if code.startswith("repeat:") else LEVEL.get(code, 1)


def evaluate(history: list[dict], turn_concerns: list[str], turn_sentiment: float,
             had_data: bool = True, trade_changes: int = 0) -> tuple[str, int] | None:
    """history: earlier user messages of this session (dicts with concerns, sentiment).
    Returns (reason_code, priority) or None. Use level_for(code) for the risk level."""
    if "crisis" in turn_concerns:
        return "crisis", 1
    if "distress" in turn_concerns:
        return "distress", 1
    if "human_request" in turn_concerns:
        return "asked_for_human", 2

    user_turns = [m for m in history if m.get("role", "user") == "user"] + [
        {"concerns": turn_concerns, "sentiment": turn_sentiment}]
    counts = Counter(c for m in user_turns for c in (m.get("concerns") or []) if c in OBJECTIONS)

    if counts.get("safety", 0) >= 2 and turn_sentiment <= -0.3 and "safety" in turn_concerns:
        return "safety_unresolved", 2
    for c in turn_concerns:
        if c in OBJECTIONS and counts[c] >= UNRESOLVED_REPEATS:
            return f"repeat:{c}", 3
    if "confused" in turn_concerns:
        return "paralysis", 3
    if trade_changes >= TRADE_SWITCHES:
        return "trade_switching", 3
    recent = [m.get("sentiment") for m in user_turns[-2:] if m.get("sentiment") is not None]
    if len(recent) == 2 and all(s <= LOW_SENTIMENT for s in recent):
        return "low_sentiment", 3
    if not had_data:
        return "no_local_data", 4
    return None


REASON_TEXT = {
    "crisis": {"en": "Immediate safety concern: self-harm or abuse mentioned", "hi": "तुरंत सुरक्षा की चिंता: ख़ुद को नुक़सान या दुर्व्यवहार का ज़िक्र"},
    "distress": {"en": "Severe distress about family pressure or dropping out", "hi": "परिवार के दबाव या पढ़ाई छूटने को लेकर गहरी परेशानी"},
    "asked_for_human": {"en": "Family asked to speak to a counsellor", "hi": "परिवार ने काउंसलर से बात माँगी"},
    "safety_unresolved": {"en": "Safety concern raised again after an answer", "hi": "जवाब के बाद भी सुरक्षा की चिंता"},
    "low_sentiment": {"en": "Family remains upset across two turns", "hi": "परिवार दो बार से नाराज़/परेशान है"},
    "paralysis": {"en": "Decision paralysis: can't choose between options", "hi": "फ़ैसला नहीं हो पा रहा: विकल्पों में उलझन"},
    "trade_switching": {"en": "Decision paralysis: switched trade 3 or more times", "hi": "फ़ैसला नहीं हो पा रहा: 3 या ज़्यादा बार ट्रेड बदला"},
    "no_local_data": {"en": "No verified local data for the question", "hi": "सवाल के लिए स्थानीय आँकड़ा नहीं"},
    "manual": {"en": "Family booked a counsellor session", "hi": "परिवार ने काउंसलर से सत्र बुक किया"},
    "ai_unresolved": {"en": "AI could not resolve the family's concern", "hi": "एआई परिवार की चिंता दूर नहीं कर सका"},
    "consensus": {"en": "Family consensus: large disagreement on a sensitive priority", "hi": "परिवार में किसी अहम बात पर बड़ा मतभेद"},
}


def reason_text(code: str, lang: str = "en") -> str:
    if code.startswith("repeat:"):
        c = code.split(":", 1)[1]
        from .concerns import LABELS
        return (f"Same concern unresolved after {UNRESOLVED_REPEATS} answers: {LABELS[c]['en']}" if lang == "en"
                else f"{UNRESOLVED_REPEATS} जवाबों के बाद भी वही चिंता: {LABELS[c]['hi']}")
    return REASON_TEXT.get(code, {"en": code, "hi": code})[lang]

"""When to bring in a human counsellor. Lower priority number = more urgent."""
from collections import Counter

from .concerns import OBJECTIONS

UNRESOLVED_REPEATS = 3
LOW_SENTIMENT = -0.5


def evaluate(history: list[dict], turn_concerns: list[str], turn_sentiment: float,
             had_data: bool = True) -> tuple[str, int] | None:
    """history: earlier user messages of this session (dicts with concerns, sentiment).
    Returns (reason_code, priority) or None."""
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
    recent = [m.get("sentiment") for m in user_turns[-2:] if m.get("sentiment") is not None]
    if len(recent) == 2 and all(s <= LOW_SENTIMENT for s in recent):
        return "low_sentiment", 3
    if not had_data:
        return "no_local_data", 4
    return None


REASON_TEXT = {
    "distress": {"en": "Signs of distress in the conversation", "hi": "बातचीत में परेशानी के संकेत"},
    "asked_for_human": {"en": "Family asked to speak to a counsellor", "hi": "परिवार ने काउंसलर से बात माँगी"},
    "safety_unresolved": {"en": "Safety concern raised again after an answer", "hi": "जवाब के बाद भी सुरक्षा की चिंता"},
    "low_sentiment": {"en": "Family remains upset across two turns", "hi": "परिवार दो बार से नाराज़/परेशान है"},
    "no_local_data": {"en": "No verified local data for the question", "hi": "सवाल के लिए स्थानीय आँकड़ा नहीं"},
    "manual": {"en": "Family pressed 'Talk to a counsellor'", "hi": "परिवार ने 'काउंसलर से बात' दबाया"},
    "ai_unresolved": {"en": "AI could not resolve the family's concern", "hi": "एआई परिवार की चिंता दूर नहीं कर सका"},
}


def reason_text(code: str, lang: str = "en") -> str:
    if code.startswith("repeat:"):
        c = code.split(":", 1)[1]
        from .concerns import LABELS
        return (f"Same concern unresolved after {UNRESOLVED_REPEATS} answers: {LABELS[c]['en']}" if lang == "en"
                else f"{UNRESOLVED_REPEATS} जवाबों के बाद भी वही चिंता: {LABELS[c]['hi']}")
    return REASON_TEXT.get(code, {"en": code, "hi": code})[lang]

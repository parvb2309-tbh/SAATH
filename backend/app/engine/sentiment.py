"""Small lexicon sentiment scorer for Hindi, Hinglish and English. Returns a score in [-1, 1]."""
import re

from .concerns import OBJECTIONS

POSITIVE = [
    "accha", "achha", "acha", "theek", "thik", "badhiya", "badiya", "sahi", "samajh gaya", "samajh gayi",
    "samajh aa gaya", "great", "good", "nice", "ok", "okay", "thanks", "thank you", "dhanyavad", "shukriya",
    "interested", "haan", "ha ji", "bilkul", "pasand", "khush", "convinced", "makes sense", "bhej denge",
    "karwa denge", "join", "admission le", "sounds good", "helpful",
    "अच्छा", "ठीक", "बढ़िया", "सही", "समझ गया", "समझ गई", "समझ गए", "धन्यवाद", "शुक्रिया", "हाँ", "बिलकुल",
    "बिल्कुल", "पसंद", "ख़ुश", "खुश", "भेज देंगे", "करवा देंगे", "दाख़िला",
]
NEGATIVE = [
    "nahi", "nahin", "no", "not", "never", "bekar", "bekaar", "kharab", "darr", "dar lagta", "chinta", "worried",
    "worry", "bad", "galat", "bharosa nahi", "problem", "pareshan", "tension", "waste", "fraud", "jhooth", "jhoot",
    "kabhi nahi", "gussa", "angry", "useless", "mat", "risk", "dhokha", "sharam", "afraid", "scared", "doubt",
    "नहीं", "बेकार", "ख़राब", "खराब", "डर", "चिंता", "गलत", "ग़लत", "भरोसा नहीं", "परेशान", "टेंशन", "झूठ", "धोखा",
    "कभी नहीं", "गुस्सा", "शर्म", "मत",
]
_DEV = re.compile(r"[ऀ-ॿ]")


def _pats(words):
    return [re.compile(re.escape(w)) if _DEV.search(w) else re.compile(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])")
            for w in words]


_POS, _NEG = _pats(POSITIVE), _pats(NEGATIVE)


def score(text: str, concerns: list[str] | None = None) -> float:
    t = (text or "").lower()
    pos = sum(1 for p in _POS if p.search(t))
    neg = sum(1 for p in _NEG if p.search(t))
    s = (pos - neg) / (pos + neg + 1)
    # Raising an objection signals some worry even when no emotion words are present.
    if concerns and any(c in OBJECTIONS for c in concerns):
        s -= 0.15
    if concerns and "distress" in concerns:
        s = min(s, -0.8)
    return round(max(-1.0, min(1.0, s)), 2)

"""Offline concern classifier for Hindi (Devanagari), Hinglish and English.

Latin keywords match on word boundaries; Devanagari keywords match as substrings because
Hindi words take many suffixes (कमाई, कमाएगा, कमाएगी ...).
"""
import re

from .concerns import ALL

KEYWORDS: dict[str, list[str]] = {
    "income": [
        "salary", "income", "earn", "earning", "earnings", "kamai", "kamayi", "kamayega", "kamayegi", "kamaega",
        "kamaegi", "kamaenge", "kitna milega", "kitna milegi", "paisa", "paise", "tankhwah", "tankha", "vetan",
        "pay", "wage", "wages", "money",
        "कमा", "पैसा", "पैसे", "तनख्वाह", "तनख़्वाह", "वेतन", "सैलरी", "आमदनी", "कितना मिलेगा", "आय",
    ],
    "job_security": [
        "job", "jobs", "naukri", "naukari", "placement", "pakki", "pakka", "guarantee", "rozgar", "rojgar",
        "berozgar", "permanent", "stable", "employment", "unemployed", "kaam milega", "work milega",
        "नौकरी", "प्लेसमेंट", "पक्की", "पक्का", "गारंटी", "रोज़गार", "रोजगार", "बेरोज़गार", "बेरोजगार", "काम मिलेगा",
    ],
    "social_status": [
        "log kya kahenge", "log kya kahege", "kya kahenge", "izzat", "ijjat", "samaj", "society", "respect",
        "status", "shaadi", "shadi", "rishta", "chhota kaam", "chota kaam", "mistri", "mazdoor", "majdoor",
        "sharam", "relatives", "rishtedar", "neighbours", "neighbors", "padosi", "log hasenge", "naak",
        "लोग क्या कहेंगे", "क्या कहेंगे", "इज़्ज़त", "इज्जत", "समाज", "शादी", "रिश्ता", "छोटा काम", "मिस्त्री",
        "मज़दूर", "मजदूर", "शर्म", "रिश्तेदार", "पड़ोसी", "नाक",
    ],
    "safety": [
        "safe", "safety", "unsafe", "surakshit", "suraksha", "beti ke liye", "ladki ke liye", "for girls",
        "for a girl", "for my daughter", "for her", "raat", "night shift", "night", "hostel", "harassment", "darr", "dar lagta", "khatra", "accident",
        "current lagega", "shock",
        "सुरक्षित", "सुरक्षा", "बेटी के लिए", "लड़की के लिए", "लड़कियों के लिए", "रात", "हॉस्टल", "छेड़", "डर", "ख़तरा", "खतरा", "दुर्घटना", "करंट",
    ],
    "distance": [
        "door", "dur", "ghar se", "bahar", "shehar", "sheher", "migrate", "migration", "another city", "far",
        "far away", "outside", "pardes", "travel", "safar", "relocate", "delhi", "mumbai", "gujarat", "surat",
        "दूर", "घर से", "बाहर", "शहर", "परदेस", "सफ़र", "सफर", "दिल्ली", "मुंबई", "गुजरात", "सूरत",
    ],
    "degree_better": [
        "degree", "college", "graduation", "graduate", "bsc", "b.sc", "b.a", "ba", "b.com", "bcom", "engineer",
        "engineering", "padhai", "padhna", "higher studies", "aage padh", "sarkari exam", "competition",
        "government exam", "upsc", "ssc",
        "डिग्री", "कॉलेज", "ग्रेजुएशन", "बीए", "बीएससी", "इंजीनियर", "पढ़ाई", "पढ़ना", "आगे पढ़", "सरकारी परीक्षा",
    ],
    "cost": [
        "fees", "fee", "kharcha", "kharch", "cost", "loan", "karz", "karza", "free", "muft", "stipend",
        "scholarship", "afford", "expensive", "mehenga", "mehnga",
        "फ़ीस", "फीस", "खर्चा", "ख़र्च", "खर्च", "लोन", "कर्ज", "क़र्ज़", "मुफ्त", "मुफ़्त", "स्टाइपेंड",
        "छात्रवृत्ति", "महंगा", "महँगा",
    ],
    "course_info": [
        "course", "kya sikhega", "kya sikhegi", "kya sikhenge", "duration", "kitne mahine", "kitne saal", "trade",
        "iti", "nsqf", "certificate", "aage kya", "career", "syllabus", "training",
        "कोर्स", "सीखेगा", "सीखेगी", "सीखेंगे", "कितने महीने", "कितने साल", "ट्रेड", "आईटीआई", "सर्टिफ़िकेट",
        "सर्टिफिकेट", "आगे क्या", "करियर", "ट्रेनिंग",
    ],
    "human_request": [
        "counsellor", "counselor", "insaan", "kisi se baat", "real person", "human", "call me", "call karo",
        "phone karo", "talk to someone", "talk to a person", "baat karni hai", "baat karna hai",
        "काउंसलर", "इंसान", "किसी से बात", "कॉल करें", "फ़ोन करें", "फोन करें", "बात करनी है", "बात करना है",
    ],
    "distress": [
        "suicide", "kill myself", "mar jaun", "mar jau", "jaan de", "khatam kar", "zinda nahi", "no reason to live",
        "hopeless", "depressed", "depression", "bahut pareshan", "mann nahi lagta",
        "आत्महत्या", "मर जाऊँ", "मर जाऊं", "जान दे", "ख़त्म कर", "खत्म कर", "ज़िंदा नहीं", "बहुत परेशान", "डिप्रेशन",
    ],
    "greeting": [
        "hello", "namaste", "namaskar", "pranam", "good morning",
        "नमस्ते", "नमस्कार", "प्रणाम",
    ],
}

_DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def _compile(word: str) -> re.Pattern:
    if _DEVANAGARI.search(word):
        return re.compile(re.escape(word))
    return re.compile(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])")


_PATTERNS = {c: [_compile(w) for w in words] for c, words in KEYWORDS.items()}


def classify(text: str) -> list[str]:
    """Return matched concerns, strongest first. Never empty: falls back to 'other'."""
    t = (text or "").lower()
    scores: dict[str, int] = {}
    for concern, pats in _PATTERNS.items():
        hits = sum(1 for p in pats if p.search(t))
        if hits:
            scores[concern] = hits
    if not scores:
        return ["other"]
    # A greeting alone is a greeting; a greeting plus a real question is the question.
    if len(scores) > 1:
        scores.pop("greeting", None)
    # Mentioning the course is context, not a concern, when a real objection is present.
    if "course_info" in scores and len(scores) > 1:
        scores.pop("course_info")
    ranked = sorted(scores, key=lambda c: (-scores[c], ALL.index(c)))
    return ranked[:3]

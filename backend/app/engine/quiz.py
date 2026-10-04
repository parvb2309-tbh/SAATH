"""The opening family quiz: learner interests pick courses, parent answers surface worries,
and the last question records how sure the family feels before counselling starts.

The frontend scores answers live with the same weights; the backend re-scores on session creation.
"""
from collections import Counter

# who: learner | parents | family.  Option fields: trades (weights), concern, keen (sentiment).
QUESTIONS = [
    {
        "id": "excites", "who": "learner", "icon": "✨",
        "en": "When you think about your future, what excites you most?",
        "hi": "जब आप अपने भविष्य के बारे में सोचते हैं, तो सबसे ज़्यादा क्या अच्छा लगता है?",
        "options": [
            {"icon": "🔧", "en": "Fixing and building things", "hi": "चीज़ें बनाना और ठीक करना", "trades": {"electrician": 2, "ac_tech": 2, "solar": 1}},
            {"icon": "🤝", "en": "Helping and caring for people", "hi": "लोगों की मदद और देखभाल करना", "trades": {"gda": 3, "beauty": 1}},
            {"icon": "🎨", "en": "Making beautiful things", "hi": "सुंदर चीज़ें बनाना", "trades": {"tailoring": 2, "beauty": 2}},
            {"icon": "🌱", "en": "New technology that helps villages", "hi": "गाँवों के काम आने वाली नई तकनीक", "trades": {"solar": 3, "electrician": 1}},
        ],
    },
    {
        "id": "free_time", "who": "learner", "icon": "⏳",
        "en": "You have a free afternoon. What would you rather do?",
        "hi": "आपके पास एक खाली दोपहर है। आप क्या करना पसंद करेंगे?",
        "options": [
            {"icon": "🪛", "en": "Open up a fan or phone to see how it works", "hi": "पंखा या फ़ोन खोलकर देखना कि कैसे चलता है", "trades": {"electrician": 2, "ac_tech": 2}},
            {"icon": "🩹", "en": "Look after a relative who is unwell", "hi": "बीमार रिश्तेदार की देखभाल करना", "trades": {"gda": 3}},
            {"icon": "💄", "en": "Stitch, design or do make-up for someone", "hi": "किसी के लिए सिलाई, डिज़ाइन या मेकअप करना", "trades": {"tailoring": 2, "beauty": 2}},
            {"icon": "☀️", "en": "Be outdoors, on the roof or in the fields", "hi": "बाहर रहना, छत पर या खेतों में", "trades": {"solar": 2, "electrician": 1}},
        ],
    },
    {
        "id": "workplace", "who": "learner", "icon": "🏢",
        "en": "Where would you like to work?",
        "hi": "आप कहाँ काम करना चाहेंगे?",
        "options": [
            {"icon": "🏭", "en": "In a workshop or factory", "hi": "वर्कशॉप या फ़ैक्ट्री में", "trades": {"electrician": 2, "ac_tech": 2, "tailoring": 1}},
            {"icon": "🏥", "en": "In a hospital or clinic", "hi": "अस्पताल या क्लिनिक में", "trades": {"gda": 3}},
            {"icon": "🏠", "en": "In a salon, boutique, or from home", "hi": "सैलून, बुटीक, या घर से", "trades": {"beauty": 2, "tailoring": 2}},
            {"icon": "🚲", "en": "Moving around, on different sites", "hi": "घूम-घूमकर, अलग-अलग जगहों पर", "trades": {"solar": 2, "electrician": 1, "ac_tech": 1}},
        ],
    },
    {
        "id": "earn_when", "who": "learner", "icon": "🗓️",
        "en": "How soon do you want to start earning?",
        "hi": "आप कितनी जल्दी कमाना शुरू करना चाहते हैं?",
        "options": [
            {"icon": "⚡", "en": "As soon as possible, in a few months", "hi": "जितनी जल्दी हो सके, कुछ महीनों में", "trades": {"solar": 1, "tailoring": 1, "beauty": 1, "gda": 1}},
            {"icon": "🎓", "en": "After a longer, bigger qualification", "hi": "लंबी, बड़ी पढ़ाई के बाद", "trades": {"electrician": 2}},
            {"icon": "📚", "en": "While I keep studying", "hi": "पढ़ाई जारी रखते हुए", "trades": {}, "concern": "degree_better"},
            {"icon": "🤷", "en": "Not sure yet", "hi": "अभी पक्का नहीं", "trades": {}},
        ],
    },
    {
        "id": "worry", "who": "parents", "icon": "💭",
        "en": "What worries you most about your child's career?",
        "hi": "बच्चे के करियर को लेकर आपको सबसे ज़्यादा किस बात की चिंता है?",
        "options": [
            {"icon": "💰", "en": "Will they earn enough?", "hi": "क्या कमाई काफ़ी होगी?", "concern": "income"},
            {"icon": "🧰", "en": "Will the job be steady?", "hi": "क्या नौकरी पक्की होगी?", "concern": "job_security"},
            {"icon": "🏘️", "en": "What will people say?", "hi": "लोग क्या कहेंगे?", "concern": "social_status"},
            {"icon": "🛡️", "en": "Will they be safe?", "hi": "क्या बच्चा सुरक्षित रहेगा?", "concern": "safety"},
        ],
    },
    {
        "id": "move", "who": "parents", "icon": "🧭",
        "en": "Would you be okay if the job is in another city?",
        "hi": "अगर नौकरी किसी दूसरे शहर में हो, तो क्या आपको ठीक लगेगा?",
        "options": [
            {"icon": "✅", "en": "Yes, if the job is good", "hi": "हाँ, अगर नौकरी अच्छी हो", "keen": 0.1},
            {"icon": "🗺️", "en": "Only within our state", "hi": "सिर्फ़ अपने राज्य में", "concern": "distance"},
            {"icon": "🏠", "en": "Only close to home", "hi": "सिर्फ़ घर के पास", "concern": "distance"},
            {"icon": "🛡️", "en": "Depends on safety", "hi": "सुरक्षा पर निर्भर है", "concern": "safety"},
        ],
    },
    {
        "id": "hoped", "who": "parents", "icon": "🌟",
        "en": "What had you hoped your child would do?",
        "hi": "आपने बच्चे के लिए क्या सोचा था?",
        "options": [
            {"icon": "🎓", "en": "A college degree", "hi": "कॉलेज की डिग्री", "concern": "degree_better"},
            {"icon": "🏛️", "en": "A government job", "hi": "सरकारी नौकरी", "concern": "job_security"},
            {"icon": "🛠️", "en": "Any skill that earns well", "hi": "कोई भी हुनर जिससे अच्छी कमाई हो", "keen": 0.2},
            {"icon": "💚", "en": "Whatever our child enjoys", "hi": "जो बच्चे को पसंद हो", "keen": 0.2},
        ],
    },
    {
        "id": "fees", "who": "parents", "icon": "🪙",
        "en": "Can the family manage course fees?",
        "hi": "क्या परिवार कोर्स की फ़ीस दे पाएगा?",
        "options": [
            {"icon": "👍", "en": "Yes, we can manage", "hi": "हाँ, दे पाएँगे"},
            {"icon": "🆓", "en": "Only if it is free or low cost", "hi": "सिर्फ़ अगर मुफ़्त या कम हो", "concern": "cost"},
            {"icon": "🏦", "en": "We would need a loan or scholarship", "hi": "लोन या छात्रवृत्ति चाहिए होगी", "concern": "cost"},
            {"icon": "❓", "en": "We don't know the cost yet", "hi": "अभी ख़र्च का पता नहीं", "concern": "cost"},
        ],
    },
    {
        "id": "sure", "who": "family", "icon": "🤝",
        "en": "Today, how does the family feel about skill training?",
        "hi": "आज परिवार हुनर वाली ट्रेनिंग के बारे में कैसा महसूस करता है?",
        "options": [
            {"icon": "😀", "en": "Very keen", "hi": "बहुत उत्साहित", "keen": 0.6},
            {"icon": "🙂", "en": "Open to it", "hi": "सोचने को तैयार", "keen": 0.1},
            {"icon": "😕", "en": "Doubtful", "hi": "शक है", "keen": -0.4},
            {"icon": "🙅", "en": "Against it for now", "hi": "अभी इसके ख़िलाफ़", "keen": -0.8},
        ],
    },
]


def score(answers: list[int | None]) -> dict:
    """answers[i] is the chosen option index for QUESTIONS[i] (or None if skipped)."""
    trades: Counter = Counter()
    worries: Counter = Counter()
    keen = None
    picked = []
    for q, a in zip(QUESTIONS, answers):
        if a is None or not (0 <= a < len(q["options"])):
            continue
        opt = q["options"][a]
        picked.append((q, opt))
        trades.update(opt.get("trades", {}))
        if opt.get("concern"):
            # the direct "what worries you most" answer counts double
            worries[opt["concern"]] += 2 if q["id"] == "worry" else 1
        if q["id"] == "sure":
            keen = opt["keen"]
    total = sum(trades.values()) or 1
    matches = [{"trade_id": t, "score": round(100 * s / total)} for t, s in trades.most_common(3)]
    return {
        "matches": matches,
        "worries": [c for c, _ in worries.most_common()],
        "keenness": keen,
        "picked": picked,
    }


def summary_text(picked, lang: str) -> str:
    """A readable record of the answers, kept in the conversation for counsellors."""
    parts = [f"{q[lang]} → {opt[lang]}" for q, opt in picked]
    head = "प्रश्नोत्तरी के जवाब" if lang == "hi" else "Quiz answers"
    return head + ":\n" + "\n".join(f"• {p}" for p in parts)


def public() -> list[dict]:
    return QUESTIONS

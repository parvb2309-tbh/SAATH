"""Fact pack assembly, offline reply templates and answer cards (Hindi + English).

Templates read figures only from the fact pack, so the offline engine can never state a
number that is not in the database.
"""
from .. import db
from .concerns import LABELS

STATUS_LABEL = {
    "verified": {"en": "verified", "hi": "सत्यापित"},
    "self-reported": {"en": "reported by the training centre", "hi": "ट्रेनिंग सेंटर द्वारा बताया गया"},
    "estimate": {"en": "estimate", "hi": "अनुमान"},
}
MEMBER_LABEL = {
    "learner": {"en": "learner", "hi": "विद्यार्थी"},
    "mother": {"en": "mother", "hi": "माँ"},
    "father": {"en": "father", "hi": "पिता"},
    "guardian": {"en": "guardian", "hi": "अभिभावक"},
}
SCHOOLING_RANK = {"8": 8, "10": 10, "12": 12, "grad": 15}


def rupees(n: int) -> str:
    return f"₹{n:,}"


def band(lo: int, hi: int) -> str:
    return f"{rupees(lo)}–{rupees(hi)}"


def build_facts(session: dict) -> dict:
    lang = session.get("language") or "hi"
    d = db.get_district(session["district_id"]) or {}
    t = db.get_trade(session["trade_id"]) if session.get("trade_id") else None
    facts: dict = {
        "language": lang,
        "district": d.get(f"name_{lang}") or d.get("name_en"),
        "state": d.get(f"state_{lang}" if lang == "hi" else "state") or d.get("state"),
        "family": {
            "members": session.get("members") or [],
            "learner_gender": session.get("learner_gender"),
            "schooling": session.get("schooling"),
            "income_bracket": session.get("income_bracket"),
        },
        "trade": None, "outcome": None, "stories": [], "schemes": [], "ladder": None,
    }
    if not t:
        return facts
    facts["trade"] = {
        "id": t["id"], "name": t[f"name_{lang}"], "sector": t[f"sector_{lang}"], "nsqf_level": t["nsqf_level"],
        "duration_months": t["duration_months"], "roles": t[f"roles_{lang}"], "about": t[f"about_{lang}"],
        "min_schooling": t["min_schooling"],
    }
    o = db.get_outcome(t["id"], session["district_id"])
    if o:
        od = db.get_district(o["district_id"]) or {}
        facts["outcome"] = {
            "provider": o["provider"], "district_of_record": od.get(f"name_{lang}") or od.get("name_en"),
            "scope": o["scope"],
            "first_year_monthly": [o["earn_low"], o["earn_high"]],
            "after_3_years_monthly": [o["earn3_low"], o["earn3_high"]],
            "after_5_years_monthly": [o["earn5_low"], o["earn5_high"]],
            "placed_within_6_months_pct": o["placement_pct"], "placed_in_home_state_pct": o["local_pct"],
            "women_in_batch_pct": o["women_pct"], "batch_size": o["cohort"],
            "source": o["source"], "year": o["year"], "status": o["status"],
            "status_label": STATUS_LABEL[o["status"]][lang],
        }
    for kind, gender in (("parent", None), ("alumni", None), ("alumni", "f"), ("parent", "f")):
        s = db.get_story(t["id"], session["district_id"], kind, gender)
        if s and all(s["id"] != x["id"] for x in facts["stories"]):
            sd = db.get_district(s["district_id"]) or {}
            facts["stories"].append({"id": s["id"], "kind": s["kind"], "name": s["name"], "gender": s["gender"],
                                     "district": sd.get(f"name_{lang}") or sd.get("name_en"),
                                     "text": s[f"text_{lang}"]})
    facts["schemes"] = [{"id": s["id"], "name": s[f"name_{lang}"], "text": s[f"text_{lang}"], "link": s["link"]}
                        for s in db.get_schemes(t["id"])]
    lad = t["ladder"]
    below = SCHOOLING_RANK.get(session.get("schooling") or "10", 10) < SCHOOLING_RANK.get(t["min_schooling"], 10)
    facts["ladder"] = {
        "before_course": lad["pre"][lang] if below else None,
        "course": lad["course"][lang], "first_job": lad["first_job"][lang], "growth": lad["growth"][lang],
        "next_options": [n[lang] for n in lad["next"]],
    }
    return facts


# ------------------------------------------------------------------ cards
def outcome_meta(o: dict) -> dict:
    return {"source": o["source"], "year": o["year"], "status": o["status"], "scope": o["scope"],
            "district": o["district_of_record"], "provider": o["provider"]}


def cards_for(concerns: list[str], facts: dict) -> list[dict]:
    lang = facts["language"]
    o, cards = facts.get("outcome"), []
    hi = lang == "hi"
    stories = facts.get("stories") or []

    def story(pref_kind=None, pref_gender=None):
        for s in stories:
            if (pref_kind is None or s["kind"] == pref_kind) and (pref_gender is None or s["gender"] == pref_gender):
                return s
        return stories[0] if stories else None

    def add_story(s):
        if s and all(c.get("id") != f"story-{s['id']}" for c in cards):
            cards.append({"type": "story", "id": f"story-{s['id']}", **s})

    for c in concerns:
        if c == "income" and o:
            cards.append({"type": "fact", "id": "earn", "title": "पहले साल की कमाई (महीना)" if hi else "First-year earnings (monthly)",
                          "value": band(*o["first_year_monthly"]),
                          "sub": ("3 साल बाद " if hi else "After 3 years ") + band(*o["after_3_years_monthly"]),
                          **outcome_meta(o)})
            cards.append({"type": "ladder", "id": "ladder"})
        elif c == "job_security" and o:
            cards.append({"type": "fact", "id": "placed", "title": "6 महीने में नौकरी मिली" if hi else "Got a job within 6 months",
                          "value": f"{o['placed_within_6_months_pct']}%",
                          "sub": (f"पिछले बैच के {o['batch_size']} में से" if hi else f"of the last batch of {o['batch_size']}"),
                          **outcome_meta(o)})
        elif c == "social_status":
            add_story(story("parent"))
        elif c == "safety":
            add_story(story(None, "f"))
            if o:
                cards.append({"type": "fact", "id": "women", "title": "पिछले बैच में महिलाएँ" if hi else "Women in the last batch",
                              "value": f"{o['women_in_batch_pct']}%", "sub": o["provider"], **outcome_meta(o)})
        elif c == "distance" and o:
            cards.append({"type": "fact", "id": "local", "title": "अपने ही राज्य में काम मिला" if hi else "Found work in their home state",
                          "value": f"{o['placed_in_home_state_pct']}%", "sub": facts["state"], **outcome_meta(o)})
        elif c in ("degree_better", "course_info"):
            if all(x["type"] != "ladder" for x in cards):
                cards.append({"type": "ladder", "id": "ladder"})
        elif c == "cost":
            for s in facts.get("schemes", [])[:3]:
                cards.append({"type": "scheme", "id": f"scheme-{s['id']}", **s})
        elif c == "distress":
            cards.append({"type": "helpline", "id": "telemanas", "name": "Tele-MANAS", "number": "14416",
                          "text": "मुफ़्त, 24 घंटे, आपकी भाषा में" if hi else "Free, 24x7, in your language"})
    # de-duplicate by id, keep order
    seen, out = set(), []
    for c in cards:
        if c["id"] not in seen:
            seen.add(c["id"])
            out.append(c)
    return out


# ------------------------------------------------------------------ text templates
def _src(o, lang):
    scope = ""
    if o["scope"] == "state":
        scope = (f" यह {o['district_of_record']} का आँकड़ा है, आपके ज़िले का रिकॉर्ड अभी नहीं है।" if lang == "hi"
                 else f" This figure is from {o['district_of_record']}; we have no record for your district yet.")
    return (f" (स्रोत: {o['source']}, {o['year']}, {o['status_label']}।){scope}" if lang == "hi"
            else f" (Source: {o['source']}, {o['year']}, {o['status_label']}.){scope}")


def no_data(facts: dict) -> str:
    if facts["language"] == "hi":
        return ("इस सवाल के लिए हमारे पास आपके इलाक़े का पक्का आँकड़ा अभी नहीं है। मैं अंदाज़े से नहीं बताऊँगी। "
                "आप चाहें तो हमारे काउंसलर आपको फ़ोन करके सही जानकारी देंगे।")
    return ("We don't yet have a verified figure for your area on this, and I won't guess. "
            "If you like, a counsellor can call you with the right information.")


def reply_for(concern: str, facts: dict, speaker: str | None = None) -> str:
    lang = facts["language"]
    hi = lang == "hi"
    t, o, lad = facts.get("trade"), facts.get("outcome"), facts.get("ladder")
    d = facts.get("district")

    if concern in ("greeting", "other") or not t:
        if not t:
            return ("नमस्ते! पहले बताइए, किस काम या कोर्स के बारे में सोच रहे हैं? नीचे से कोई कोर्स चुन सकते हैं।" if hi
                    else "Namaste! First, which trade or course are you thinking about? You can pick one below.")
        topics = ", ".join(LABELS[c][lang] for c in ("income", "job_security", "social_status", "safety", "cost"))
        return (f"नमस्ते! हम {t['name']} के बारे में बात कर रहे हैं। आपकी क्या चिंता है? जैसे: {topics}।" if hi
                else f"Namaste! We are talking about {t['name']}. What worries you most? For example: {topics}.")

    if concern == "income":
        if not o:
            return no_data(facts)
        y1, y3, y5 = o["first_year_monthly"], o["after_3_years_monthly"], o["after_5_years_monthly"]
        if hi:
            return (f"{o['district_of_record']} में {o['provider']} से {t['name']} की ट्रेनिंग लेने वालों ने पहले साल में "
                    f"लगभग {band(*y1)} महीना कमाया। 3 साल के अनुभव के बाद यह {band(*y3)} और 5 साल में {band(*y5)} "
                    f"तक पहुँचता है।" + _src(o, lang))
        return (f"In {o['district_of_record']}, people trained as {t['name']} at {o['provider']} earned about "
                f"{band(*y1)} a month in their first year. With 3 years' experience this grows to {band(*y3)}, "
                f"and to {band(*y5)} by 5 years." + _src(o, lang))

    if concern == "job_security":
        if not o:
            return no_data(facts)
        if hi:
            return (f"पिछले बैच के {o['batch_size']} विद्यार्थियों में से {o['placed_within_6_months_pct']}% को 6 महीने के अंदर "
                    f"नौकरी मिली। काम के मौक़े: {t['roles']}। नौकरी की गारंटी कोई नहीं दे सकता, पर अपना काम शुरू करने का "
                    f"रास्ता भी खुला रहता है।" + _src(o, lang))
        return (f"Of the last batch of {o['batch_size']} trainees, {o['placed_within_6_months_pct']}% found a job within "
                f"6 months. Typical roles: {t['roles']}. Nobody can promise a job, but starting your own work is "
                f"also an option." + _src(o, lang))

    if concern == "social_status":
        s = next((x for x in facts["stories"] if x["kind"] == "parent"), facts["stories"][0] if facts["stories"] else None)
        story = f" {s['text']}" if s else ""
        if hi:
            return (f"यह चिंता बहुत परिवारों को होती है। आज {t['name']} हुनर वाला, सम्मान का काम है: {t['roles']}।{story} "
                    f"सर्टिफ़िकेट सरकारी मान्यता वाला होता है, और आगे बढ़ने के रास्ते खुले रहते हैं।")
        return (f"Many families share this worry. Today {t['name']} is skilled, respected work: {t['roles']}.{story} "
                f"The certificate is government-recognised, and the path to grow stays open.")

    if concern == "safety":
        s = next((x for x in facts["stories"] if x["gender"] == "f"), None)
        story = f" {s['text']}" if s else ""
        women = (f" पिछले बैच में {o['women_in_batch_pct']}% महिलाएँ थीं।" if hi else
                 f" Women made up {o['women_in_batch_pct']}% of the last batch.") if o else ""
        if hi:
            return ("आपकी चिंता बिलकुल सही है। ट्रेनिंग सेंटर में प्रशिक्षित ट्रेनर और सुरक्षा उपकरण होते हैं। आप सेंटर से "
                    "महिलाओं का अलग बैच, दिन की शिफ़्ट वाली नौकरी और घर के पास प्लेसमेंट माँग सकते हैं; कई सेंटर में वार्डन "
                    f"वाला महिला हॉस्टल भी होता है।{women}{story}")
        return ("Your concern is completely fair. Training centres have trained instructors and safety equipment. "
                "You can ask the centre for a women-only batch, day-shift jobs and a placement close to home; many "
                f"centres also have a women's hostel with a warden.{women}{story}")

    if concern == "distance":
        if not o:
            return no_data(facts)
        if hi:
            return (f"पिछले बैच में {o['placed_in_home_state_pct']}% लोगों को {facts['state']} में ही काम मिला। "
                    f"आप प्लेसमेंट के समय घर के पास की नौकरी को प्राथमिकता देने को कह सकते हैं।" + _src(o, lang))
        return (f"In the last batch, {o['placed_in_home_state_pct']}% found work without leaving {facts['state']}. "
                f"You can ask the centre to prioritise jobs close to home at placement time." + _src(o, lang))

    if concern == "degree_better":
        nxt = "; ".join(lad["next_options"])
        if hi:
            return (f"यह 'या तो डिग्री या हुनर' वाली बात नहीं है। {lad['course']} के बाद आगे के रास्ते: {nxt}। "
                    "बहुत से विद्यार्थी कमाते हुए ओपन यूनिवर्सिटी से डिग्री भी पूरी करते हैं।")
        return (f"It doesn't have to be degree or skill. After {lad['course']}, the paths ahead include: {nxt}. "
                "Many learners also complete a degree through an open university while they earn.")

    if concern == "cost":
        schemes = facts.get("schemes") or []
        names = ", ".join(s["name"] for s in schemes[:3])
        if hi:
            return (f"ख़र्च की चिंता मत कीजिए, कई सरकारी योजनाएँ मदद करती हैं: {names}। "
                    "नीचे हर योजना की जानकारी है; सही फ़ीस अपने सेंटर से ज़रूर पक्की करें।")
        return (f"Several government schemes help with costs: {names}. Details are below; "
                "please confirm the exact fee with your centre.")

    if concern == "course_info":
        pre = f" {lad['before_course']}" if lad.get("before_course") else ""
        if hi:
            return (f"{t['name']}: {t['about']} यह NSQF स्तर {t['nsqf_level']} का कोर्स है, अवधि {t['duration_months']} महीने। "
                    f"पहली नौकरी: {lad['first_job']}। आगे: {lad['growth']}।{pre}")
        return (f"{t['name']}: {t['about']} It is an NSQF level {t['nsqf_level']} course lasting {t['duration_months']} "
                f"months. First job: {lad['first_job']}. Later: {lad['growth']}.{pre}")

    if concern == "human_request":
        return ("ज़रूर। मैंने हमारे काउंसलर को आपकी बातचीत का सार भेज दिया है। वे आपको फ़ोन करेंगे; "
                "ऊपर अपना नंबर और सही समय लिख दीजिए।" if hi else
                "Of course. I have sent a summary of our conversation to a counsellor, who will call you. "
                "Please add your number and a good time to call above.")

    if concern == "distress":
        return ("आप अकेले नहीं हैं। अभी किसी से बात करना चाहें तो Tele-MANAS पर 14416 पर मुफ़्त कॉल करें, 24 घंटे, आपकी भाषा में। "
                "मैंने हमारे काउंसलर को भी बता दिया है, वे जल्दी संपर्क करेंगे।" if hi else
                "You are not alone. If you want to talk to someone now, call Tele-MANAS on 14416: free, 24x7, in your "
                "language. I have also alerted our counsellor, who will reach out soon.")
    return no_data(facts)


def acknowledge(facts: dict) -> str:
    if facts["language"] == "hi":
        return ("यह सुनकर अच्छा लगा! कोई और सवाल हो तो पूछिए। अगर परिवार तैयार है, तो 'हम आगे बढ़ना चाहते हैं' दबाइए, "
                "सेंटर आपसे संपर्क करेगा।")
    return ("Glad that helped! Ask anything else you like. If the family is ready, press 'We want to go ahead' "
            "and the centre will contact you.")


def compose(concerns: list[str], facts: dict, speaker: str | None = None, mood: float = 0.0) -> str:
    """Answer the main concern fully and acknowledge a second one briefly."""
    if concerns == ["other"] and mood >= 0.3 and facts.get("trade"):
        return acknowledge(facts)
    main = concerns[0]
    text = reply_for(main, facts, speaker)
    if len(concerns) > 1 and concerns[1] not in ("greeting", "other", "course_info") and main not in ("distress", "human_request"):
        text += " " + reply_for(concerns[1], facts, speaker)
    return text


GREET_NAMES = {
    "hi": {"mother": "माताजी", "father": "पिताजी", "guardian": "अभिभावक जी",
           "learner": {"f": "बेटी", "m": "बेटा", "x": "विद्यार्थी"}},
    "en": {"mother": "mother", "father": "father", "guardian": "guardian",
           "learner": {"f": "daughter", "m": "son", "x": "learner"}},
}


def greeting(facts: dict) -> str:
    lang = facts["language"]
    names = GREET_NAMES[lang]
    gender = facts["family"].get("learner_gender") or "x"
    who = [names["learner"][gender] if m == "learner" else names[m] for m in facts["family"]["members"]]
    joined = (" और ".join(who) if lang == "hi" else " and ".join(who))
    t = facts.get("trade")
    if lang == "hi":
        base = (f"नमस्ते {joined}, आप सबका स्वागत है! मैं साथ हूँ। मैं आपके परिवार के सवालों का जवाब "
                "आपके इलाक़े के आँकड़ों से दूँगी, अंदाज़े से नहीं।")
        if t:
            base += f" हम {t['name']} के बारे में बात करेंगे। कमाई, नौकरी, सुरक्षा या समाज, जो भी चिंता हो, पूछिए।"
        return base
    base = (f"Namaste, and welcome {joined}! I'm SAATH. I'll answer your family's questions with figures "
            "from your area, never guesses.")
    if t:
        base += f" We'll talk about {t['name']}. Ask about earnings, jobs, safety or what people will say."
    return base

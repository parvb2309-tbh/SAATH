"""One counselling turn: classify, gather facts, answer (Gemini or templates), guard, escalate, persist."""
from collections import Counter

from .. import db
from ..llm import gemini
from . import escalation, guard, sentiment, templates
from .classifier import classify
from .concerns import LABELS

NEEDS_OUTCOME = {"income", "job_security", "distance"}
SAFETY_CRITICAL = ("distress", "human_request")


def _context_line(session: dict, facts: dict) -> str:
    members = " and ".join(templates.MEMBER_LABEL.get(m, {}).get("en", m) for m in session.get("members") or [])
    trade = (db.get_trade(session["trade_id"]) or {}).get("name_en", "no trade chosen") if session.get("trade_id") else "no trade chosen"
    district = (db.get_district(session["district_id"]) or {}).get("name_en", "")
    gender = {"f": "daughter", "m": "son"}.get(session.get("learner_gender") or "", "learner")
    income = {"lt10": "below ₹10,000", "10_25": "₹10,000–25,000", "25_50": "₹25,000–50,000",
              "gt50": "above ₹50,000"}.get(session.get("income_bracket"), "not given")
    schooling = {"grad": "graduate"}.get(session.get("schooling"), f"class {session.get('schooling')}")
    return (f"{members.capitalize()} from {district}. Learner: {gender}, {schooling}. "
            f"Family income {income} a month. Trade: {trade}")


def template_summary(session: dict, messages: list[dict], reason: str) -> str:
    facts = templates.build_facts({**session, "language": "en"})
    counts = Counter(c for m in messages if m["role"] == "user" for c in (m.get("concerns") or [])
                     if c not in ("greeting", "other"))
    top = ", ".join(f"{LABELS[c]['en'].lower()} ({n}x)" for c, n in counts.most_common(3)) or "none recorded"
    last_user = next((m for m in reversed(messages) if m["role"] == "user" and m.get("text")), None)
    first, last = session.get("first_sentiment"), session.get("last_sentiment")
    mood = f" Mood moved from {first:+.1f} to {last:+.1f}." if first is not None and last is not None else ""
    latest = f' Latest from the {last_user.get("speaker")}: "{last_user["text"]}".' if last_user else ""
    return (f"{_context_line(session, facts)}. Concerns raised: {top}.{mood}{latest} "
            f"Escalated because: {reason}. Please call the family and address this directly.")


def escalate(session_id: str, code: str, priority: int, phone: str = "", callback_time: str = "",
             note: str = "") -> dict:
    session = db.get_session(session_id)
    messages = db.get_messages(session_id)
    reason = escalation.reason_text(code, "en")
    existing = db.open_escalation(session_id)
    if existing:
        changes = {}
        if priority < existing["priority"]:
            changes.update(priority=priority, reason=reason)
        if phone:
            changes["phone"] = phone
        if callback_time:
            changes["callback_time"] = callback_time
        if note:
            changes["notes"] = ((existing.get("notes") or "") + "\nFamily: " + note).strip()
        if changes:
            db.update("escalations", "id", existing["id"], changes)
        return {**existing, **changes, "new": False}

    transcript = "\n".join(f"{m['role']} ({m.get('speaker') or 'saath'}): {m['text']}" for m in messages[-14:] if m.get("text"))
    summary, engine = None, "template"
    if gemini.available() and transcript:
        summary = gemini.summarize(context=_context_line(session, {}), transcript=transcript)
        engine = "gemini" if summary else "template"
    summary = summary or template_summary(session, messages, reason)
    row = {"session_id": session_id, "created_at": db.now(), "reason": reason, "priority": priority,
           "summary": summary, "status": "open", "phone": phone or session.get("phone") or "",
           "callback_time": callback_time, "notes": ("Family: " + note) if note else "", "engine": engine}
    row["id"] = db.insert("escalations", row)
    return {**row, "new": True}


def handle_turn(session_id: str, text: str, speaker: str, lang: str | None = None) -> dict:
    session = db.get_session(session_id)
    if session is None:
        raise KeyError(session_id)
    if lang and lang != session["language"]:
        db.update("sessions", "id", session_id, {"language": lang})
        session["language"] = lang
    lang = session["language"]
    history = db.get_messages(session_id)
    facts = templates.build_facts(session)

    offline_concerns = classify(text)
    concerns, mood = offline_concerns, sentiment.score(text, offline_concerns)
    reply, engine, blocked, needs_human = None, "offline", [], False

    llm = gemini.counsel_turn(facts=facts, history=history, message=text, speaker=speaker, lang=lang) \
        if gemini.available() else None
    if llm:
        concerns = list(dict.fromkeys(llm.concerns))
        # keyword hits for distress / asking for a human always count, whatever the model says
        for c in SAFETY_CRITICAL:
            if c in offline_concerns and c not in concerns:
                concerns.insert(0, c)
        mood, needs_human = llm.sentiment, llm.needs_human
        ok, blocked = guard.check(llm.reply, facts)
        if ok:
            reply, engine = llm.reply.strip(), "gemini"
        else:
            engine = "gemini+guard"

    if "distress" in concerns:
        # safety-critical: always the reviewed reply with the Tele-MANAS helpline, never free text
        reply = None
    if reply is None:
        reply = templates.compose(concerns, facts, speaker, mood)
        if engine == "offline" and gemini.status()["configured"]:
            engine = "offline (gemini unavailable)"

    had_data = facts.get("outcome") is not None or not (set(concerns) & NEEDS_OUTCOME)
    chat_history = [m for m in history if m.get("engine") != "quiz"]  # rules judge the conversation, not the quiz
    esc = escalation.evaluate(chat_history, concerns, mood, had_data)
    if esc is None and needs_human and any(m["role"] == "user" for m in chat_history):
        esc = ("ai_unresolved", 3)
    cards = templates.cards_for(concerns, facts)

    user_msg = {"session_id": session_id, "created_at": db.now(), "role": "user", "speaker": speaker,
                "text": text, "lang": lang, "concerns": concerns, "sentiment": mood, "engine": engine, "cards": []}
    user_msg["id"] = db.insert("messages", user_msg)
    bot_msg = {"session_id": session_id, "created_at": db.now(), "role": "assistant", "speaker": "saath",
               "text": reply, "lang": lang, "concerns": concerns, "sentiment": None, "engine": engine,
               "cards": cards}
    bot_msg["id"] = db.insert("messages", bot_msg)

    changes = {"last_sentiment": mood}
    if session.get("first_sentiment") is None:
        changes["first_sentiment"] = mood
    db.update("sessions", "id", session_id, changes)

    esc_row = None
    if esc:
        code, priority = esc
        esc_row = escalate(session_id, code, priority)
        esc_row["reason_local"] = escalation.reason_text(code, lang)
        esc_row["code"] = code
    return {"user": user_msg, "assistant": bot_msg, "escalation": esc_row, "engine": engine,
            "guard_blocked": blocked}


def start_message(session_id: str) -> list[dict]:
    """Greeting; after the opening quiz, also a first answer to the family's biggest worry."""
    session = db.get_session(session_id)
    facts = templates.build_facts(session)
    lang = session["language"]
    msgs = [{"session_id": session_id, "created_at": db.now(), "role": "assistant", "speaker": "saath",
             "text": templates.greeting(facts), "lang": lang, "concerns": ["greeting"], "sentiment": None,
             "engine": "template", "cards": [{"type": "ladder", "id": "ladder"}] if facts.get("trade") else []}]
    worries = (session.get("quiz") or {}).get("worries") or []
    if worries and facts.get("trade"):
        top = worries[0]
        label = LABELS[top][lang]
        lead = (f"आपने बताया कि आपकी एक बड़ी चिंता है: {label}। पहले इसी की बात करते हैं। " if lang == "hi"
                else f"You told us one big worry is: {label.lower()}. Let's start there. ")
        msgs.append({"session_id": session_id, "created_at": db.now(), "role": "assistant", "speaker": "saath",
                     "text": lead + templates.reply_for(top, facts), "lang": lang, "concerns": [top],
                     "sentiment": None, "engine": "template", "cards": templates.cards_for([top], facts)})
    for m in msgs:
        m["id"] = db.insert("messages", m)
    return msgs

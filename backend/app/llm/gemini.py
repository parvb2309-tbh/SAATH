"""Gemini client: counselling turns (structured JSON), escalation summaries and audio transcription .

Every call returns None on any failure (no key, rate limit, timeout, bad output) so the caller
can fall back to the offline engine. After a 429 the client backs off for a minute.
"""
import json
import logging
import os
import time
from typing import Literal

from pydantic import BaseModel, Field

from ..engine.concerns import ALL

log = logging.getLogger("saath.gemini")

Concern = Literal[tuple(ALL)]  # type: ignore[valid-type]


class CounselTurn(BaseModel):
    concerns: list[Concern] = Field(description="Concerns raised in the latest message, most important first")
    sentiment: float = Field(description="Speaker's feeling in the latest message, -1 very negative to 1 very positive")
    reply: str = Field(description="Reply to the family, in the requested language")
    needs_human: bool = Field(description="True if a human counsellor should step in")


SYSTEM = """You are SAATH, a warm counsellor who helps Indian families in the Hindi belt decide about vocational training.
You talk to the learner and their parents together. Parents usually decide, so answer their worries respectfully.

Rules:
- Reply in {language_name} only, in simple everyday words a person with little schooling understands. No jargon.
- Keep the reply under 90 words. Address the person who spoke ({speaker}).
- Use ONLY numbers that appear in FACTS. Never invent, round or estimate a figure. If the needed figure is not in FACTS, say you do not have verified local data and offer a counsellor call.
- When you quote a figure, name its source and year from FACTS. If outcome.scope is "state", say it is not from their own district.
- Never promise a guaranteed job or income.
- You may retell a story from FACTS.stories to answer social or safety worries.
- If the person shows distress or self-harm thoughts, gently share the Tele-MANAS helpline 14416 and set needs_human true.
- Set needs_human true if they ask for a person, or if their worry is not resolved by what FACTS contain.
- concerns: classify the LATEST message using these codes: {codes}."""


class _State:
    client = None
    cooldown_until = 0.0
    last_error = ""


def _key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()


def _client():
    if _State.client is None and _key():
        from google import genai
        from google.genai import types
        _State.client = genai.Client(api_key=_key(), http_options=types.HttpOptions(timeout=25_000))
    return _State.client


def available() -> bool:
    return bool(_key()) and time.time() >= _State.cooldown_until


def status() -> dict:
    return {"configured": bool(_key()), "model": model_name(), "available": available(),
            "cooldown_seconds": max(0, int(_State.cooldown_until - time.time())), "last_error": _State.last_error}


def _config(schema=None, system: str | None = None):
    from google.genai import types
    kwargs = {"temperature": 0.4}
    if system:
        kwargs["system_instruction"] = system
    if schema is not None:
        kwargs["response_mime_type"] = "application/json"
        kwargs["response_schema"] = schema
    if model_name().startswith("gemini-2.5-flash"):
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    return types.GenerateContentConfig(**kwargs)


def _call(contents, config):
    if not available():
        return None
    try:
        return _client().models.generate_content(model=model_name(), contents=contents, config=config)
    except Exception as e:  # noqa: BLE001 - any provider error means "use the fallback"
        msg = str(e)
        _State.last_error = msg[:200]
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            _State.cooldown_until = time.time() + 60
        log.warning("Gemini call failed: %s", msg[:200])
        return None


def counsel_turn(*, facts: dict, history: list[dict], message: str, speaker: str, lang: str) -> CounselTurn | None:
    language_name = "Hindi (Devanagari script)" if lang == "hi" else "English"
    system = SYSTEM.format(language_name=language_name, speaker=speaker, codes=", ".join(ALL))
    convo = "\n".join(f"{'FAMILY' if m['role'] == 'user' else 'SAATH'} ({m.get('speaker') or 'saath'}): {m['text']}"
                      for m in history[-8:] if m.get("text"))
    prompt = (f"FACTS (the only source of numbers):\n{json.dumps(facts, ensure_ascii=False)}\n\n"
              f"CONVERSATION SO FAR:\n{convo or '(start)'}\n\n"
              f"LATEST MESSAGE from {speaker}:\n{message}")
    resp = _call(prompt, _config(CounselTurn, system))
    if resp is None:
        return None
    try:
        parsed = resp.parsed if isinstance(resp.parsed, CounselTurn) else CounselTurn.model_validate_json(resp.text)
        if not parsed.reply.strip():
            return None
        parsed.concerns = parsed.concerns or ["other"]
        parsed.sentiment = max(-1.0, min(1.0, float(parsed.sentiment)))
        return parsed
    except Exception as e:  # noqa: BLE001
        _State.last_error = f"bad output: {e}"[:200]
        return None


def summarize(*, context: str, transcript: str) -> str | None:
    prompt = ("Write a 2-3 sentence handover note in English for a human career counsellor who will call this family. "
              "Say who is worried, about what, what SAATH already explained, and what the counsellor should do next. "
              f"Do not add numbers that are not in the transcript.\n\nFAMILY: {context}\n\nTRANSCRIPT:\n{transcript}")
    return _text(_call(prompt, _config()))


def transcribe(audio: bytes, mime: str, lang: str) -> str | None:
    from google.genai import types
    instr = ("Transcribe this audio exactly. It is a family speaking Hindi, English or a mix. "
             f"Write Hindi in Devanagari script. Prefer {'Hindi' if lang == 'hi' else 'English'}. "
             "Return only the transcript text.")
    return _text(_call([types.Part.from_bytes(data=audio, mime_type=mime), instr], _config()))


def _text(resp) -> str | None:
    if resp is None:
        return None
    try:
        return (resp.text or "").strip() or None
    except Exception:  # noqa: BLE001 - blocked or empty candidates
        return None

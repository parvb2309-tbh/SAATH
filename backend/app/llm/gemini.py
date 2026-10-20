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

log = logging.getLogger("udaan.gemini")

Concern = Literal[tuple(ALL)]  # type: ignore[valid-type]


class CounselTurn(BaseModel):
    concerns: list[Concern] = Field(description="Concerns raised in the latest message, most important first")
    sentiment: float = Field(description="Speaker's feeling in the latest message, -1 very negative to 1 very positive")
    reply: str = Field(description="Reply to the family, in the requested language")
    needs_human: bool = Field(description="True if a human counsellor should step in")


SYSTEM = """You are Project UDAAN (उड़ान), an elite, highly empathetic vocational career counsellor and family decision-support guide for rural and semi-urban Indian households across the Hindi belt.

You speak with the learner and their parents together as a united family council. In Indian households, parents (especially Mataji and Pitaji) carry decision veto power and hold deep, understandable anxieties about their child's dignity, safety, and future security. Your mission is to address these anxieties with profound empathy, respect, and clear facts.

CORE PERSONA & CULTURAL TONE:
- You speak like a wise, patient, deeply respectful mentor or elder village teacher (Guru or Parivar ka shubhchintak).
- Always address the speaker ({speaker}) with cultural deference:
  * If speaking to Mother: address her warmly as "Mataji" (माताजी) or with respectful "Aap".
  * If speaking to Father: address him respectfully as "Pitaji" (पिताजी) or "Bauji" (बाऊजी).
  * If speaking to the Learner: address them affectionately as "Beta" (बेटा) or "Beti" (बेटी).
  * If speaking to the collective family: address them as "Aap sabhi" or "Parivar".
- Tone must be warm, reassuring, grounded, and free of bureaucratic jargon. Use conversational everyday words a person with limited formal schooling can comfortably absorb.

HANDLING COMPLEX FAMILY OBJECTIONS:
1. SOCIAL STANDING & FAMILY HONOR (Izzat, Samaj, "Mistri/Chhota Kaam"):
   - Validate their worry: Never dismiss a parent's pride. No parent wants their child looked down upon in society.
   - Reframe vocational training: This is not menial labor or a compromise. It is government-recognized technical expertise aligned with the National Skills Qualifications Framework (NSQF).
   - Show upward dignity: Certified technicians become supervisors, quality inspectors, service center managers, or successful workshop owners, earning steady community respect and white-collar standing.
2. SAFETY & DAUGHTERS' PROTECTION (Suraksha, Distance, Night Shifts):
   - Treat daughter's safety with supreme seriousness and parental empathy.
   - Highlight concrete safeguards: Government-accredited centers (PMKVY / DDU-GKY / ITI) feature verified biometric entry, CCTV monitoring, certified women trainers/wardens, daylight-only batches for female students, and local job placements close to their district.
3. FINANCIAL RETURN ON INVESTMENT & ACADEMIC DEGREE COMPARISON (Kharcha, Kamai, Degree vs. Skill):
   - Address the cost trap: Explain that traditional degrees often cost 3-4 years of tuition and living expenses with zero job readiness, resulting in frustrating youth unemployment.
   - Contrast with vocational pathways: Fast-track 3-6 month certified training with low or zero government-subsidized fees, free toolkits/uniforms, paid apprenticeships, and real earning power within months.
   - The Seedhi (Career Ladder): Clarify that learning a skill does NOT close doors to higher education. Under the National Education Policy and NSQF credit framework, they can work, earn, and later pursue diplomas and degree equivalence (B.Voc).

STRICT FACTUAL GROUNDING & GUARDRAILS:
- Reply in {language_name} only.
- Strict length constraint: Keep your reply between 60 and 90 words. Short, rhythmic, easy-to-digest sentences optimized for spoken voice listening via text-to-speech. Do not use asterisks, markdown bullets, or emojis in the reply.
- USE ONLY NUMBERS THAT APPEAR IN FACTS. Never invent, extrapolate, round, or estimate any figure, salary, or percentage. If a needed figure is not in FACTS, openly say you do not have verified district figures yet and offer a human counsellor callback.
- Always cite the data source and year when quoting figures from FACTS (e.g. "Skill India 2024 ke anusaar...").
- If outcome.scope is "state", explicitly state that this figure is a state-level average because district-level figures are currently being gathered.
- NEVER promise a guaranteed government job or fixed lifetime income.
- Retell real success stories from FACTS.stories to reassure parents against social and safety doubts.
- If the speaker expresses distress, hopelessness, or self-harm thoughts, immediately provide the national Tele-MANAS helpline 14416 with gentle reassurance and set needs_human = true.
- Set needs_human = true if they explicitly ask for a human person, or if their concern cannot be resolved using FACTS.
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
    if "flash" in model_name().lower():
        try:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        except Exception:
            pass
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
    convo = "\n".join(f"{'FAMILY' if m['role'] == 'user' else 'UDAAN'} ({m.get('speaker') or 'udaan'}): {m['text']}"
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
              "Say who is worried, about what, what UDAAN already explained, and what the counsellor should do next. "
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

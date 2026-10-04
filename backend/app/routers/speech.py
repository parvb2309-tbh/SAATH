"""Speech endpoints: neural TTS (edge-tts) and an STT fallback (Gemini) for browsers without Web Speech."""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..llm import gemini
from ..speech.stt_gemini import GeminiSTT
from ..speech.tts_edge import EdgeTTS

router = APIRouter(prefix="/api/speech", tags=["speech"])
tts = EdgeTTS()
stt = GeminiSTT()


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    lang: str = "hi"


@router.post("/tts")
async def speak(body: TTSIn):
    try:
        audio, mime = await tts.synthesize(body.text, body.lang)
    except Exception as e:  # noqa: BLE001 - network or service error: the browser falls back to its own voice
        raise HTTPException(503, f"TTS unavailable: {e}")
    return Response(content=audio, media_type=mime, headers={"Cache-Control": "max-age=86400"})


@router.post("/stt")
async def transcribe(request: Request, lang: str = "hi"):
    if not gemini.available():
        raise HTTPException(503, "Server speech recognition needs a Gemini key; use Chrome or Edge for in-browser recognition.")
    audio = await request.body()
    if not audio or len(audio) > 8 * 1024 * 1024:
        raise HTTPException(400, "Send between 1 byte and 8 MB of audio")
    mime = (request.headers.get("content-type") or "audio/webm").split(";")[0]
    text = stt.transcribe(audio, mime, lang)
    if not text:
        raise HTTPException(502, "Could not transcribe the audio")
    return {"text": text, "provider": stt.name}

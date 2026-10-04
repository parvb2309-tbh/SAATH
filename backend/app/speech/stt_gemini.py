"""Server-side speech-to-text fallback using Gemini's audio understanding (free tier).

The browser's Web Speech API is the primary recogniser; this is used when the browser has none.
"""
from ..llm import gemini


class GeminiSTT:
    name = "gemini"

    def transcribe(self, audio: bytes, mime: str, lang: str) -> str | None:
        return gemini.transcribe(audio, mime, lang)

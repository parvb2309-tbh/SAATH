"""Speech adapter interface. Swap in Bhashini or AI4Bharat models by adding a provider here."""
from typing import Protocol


class TTSProvider(Protocol):
    name: str

    async def synthesize(self, text: str, lang: str) -> tuple[bytes, str]:
        """Return (audio bytes, mime type)."""


class STTProvider(Protocol):
    name: str

    def transcribe(self, audio: bytes, mime: str, lang: str) -> str | None:
        ...

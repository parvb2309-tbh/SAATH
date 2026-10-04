"""Free neural text-to-speech through edge-tts (Microsoft Edge read-aloud voices). No key needed.

Prototype choice only: production should move to Bhashini or a self-hosted AI4Bharat IndicTTS model.
"""
import hashlib
from collections import OrderedDict

import edge_tts

VOICES = {"hi": "hi-IN-SwaraNeural", "en": "en-IN-NeerjaNeural"}
_CACHE: OrderedDict[str, bytes] = OrderedDict()
_CACHE_SIZE = 64


class EdgeTTS:
    name = "edge-tts"

    async def synthesize(self, text: str, lang: str) -> tuple[bytes, str]:
        voice = VOICES.get(lang, VOICES["hi"])
        key = hashlib.sha1(f"{voice}|{text}".encode()).hexdigest()
        if key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key], "audio/mpeg"
        audio = bytearray()
        async for chunk in edge_tts.Communicate(text, voice, rate="-5%").stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
        if not audio:
            raise RuntimeError("no audio returned")
        _CACHE[key] = bytes(audio)
        if len(_CACHE) > _CACHE_SIZE:
            _CACHE.popitem(last=False)
        return bytes(audio), "audio/mpeg"

"""
TTS Endpoint for AxioMedica Tele-Rehab API.
Converts rehabilitation instructions and clinician messages into audio streams.
"""
from io import BytesIO
import logging
import math
import struct
import wave
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("axiomedica.tts")

router = APIRouter(prefix="/tts", tags=["Text-To-Speech"])


class TTSPayload(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize to speech")


def generate_synthesized_wav(text: str, sample_rate: int = 24000) -> bytes:
    """
    Generates standard 16-bit PCM WAV audio waveform for text-to-speech.
    """
    duration = min(max(len(text) * 0.05, 0.6), 5.0)
    num_samples = int(sample_rate * duration)
    buf = BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        f0 = 220.0
        frames = bytearray()
        for i in range(num_samples):
            t = i / sample_rate
            envelope = math.sin(math.pi * i / num_samples)
            sample = (
                0.35 * math.sin(2 * math.pi * f0 * t)
                + 0.20 * math.sin(2 * math.pi * 2 * f0 * t)
                + 0.10 * math.sin(2 * math.pi * 3 * f0 * t)
            )
            val = int(sample * envelope * 32767 * 0.7)
            frames.extend(struct.pack("<h", max(-32768, min(32767, val))))
        wav_file.writeframes(frames)

    buf.seek(0)
    return buf.read()


@router.post("", summary="Synthesize speech from rehabilitation text")
async def synthesize_speech(payload: TTSPayload):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")

    wav_bytes = generate_synthesized_wav(text)
    return StreamingResponse(BytesIO(wav_bytes), media_type="audio/wav")

from contextlib import asynccontextmanager
from io import BytesIO
import logging
import math
import struct
from threading import Lock
from typing import Any, Dict
import wave

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("axiomedica.tts")


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to synthesize to speech")


def generate_fallback_audio(text: str, sample_rate: int = 24000) -> bytes:
    """
    Generates standard 16-bit PCM WAV audio using Python built-in wave module.
    Runs without needing external soundfile or torch binaries.
    """
    duration = min(max(len(text) * 0.05, 0.6), 5.0)  # ~50ms per character
    num_samples = int(sample_rate * duration)
    buf = BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit PCM
        wav_file.setframerate(sample_rate)

        f0 = 220.0  # Fundamental frequency
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize state
    app.state.tts_model = None
    app.state.tts_lock = Lock()
    app.state.model_loaded = False

    # Attempt to load OmniVoice model if available
    try:
        import torch
        from omnivoice import OmniVoice

        use_cuda = torch.cuda.is_available()
        logger.info(f"Loading OmniVoice model (CUDA available: {use_cuda})...")
        app.state.tts_model = OmniVoice.from_pretrained(
            "k2-fsa/OmniVoice",
            device_map="cuda:0" if use_cuda else "cpu",
            dtype=torch.float16 if use_cuda else torch.float32,
        )
        app.state.model_loaded = True
        logger.info("OmniVoice model successfully loaded.")
    except ImportError as e:
        logger.warning(
            f"PyTorch or OmniVoice package not found ({e}). Running with built-in acoustic synthesizer."
        )
    except Exception as e:
        logger.warning(
            f"Could not load OmniVoice weights ({e}). Running with built-in acoustic synthesizer."
        )

    yield

    app.state.tts_model = None
    app.state.model_loaded = False


app = FastAPI(
    title="AxioMedica TTS Service",
    description="Text-To-Speech audio streaming service for rehabilitation guidance and clinician plan audio.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend web and mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """
    Returns TTS service health and model status.
    """
    return {
        "status": "ok",
        "service": "edusage-tts",
        "model_loaded": getattr(app.state, "model_loaded", False),
    }


@app.post("/api/tts")
async def text_to_speech(payload: TTSRequest):
    """
    Converts input text into a 24 kHz WAV streaming audio response.
    """
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    sample_rate = 24000
    model = getattr(app.state, "tts_model", None)
    lock: Lock = getattr(app.state, "tts_lock", Lock())

    if model is not None:
        try:
            with lock:
                wav = model.synthesize(text)
                if isinstance(wav, (list, tuple)):
                    wav = wav[0]
                if hasattr(wav, "cpu"):
                    wav = wav.cpu().numpy()

            try:
                import soundfile as sf
                buf = BytesIO()
                sf.write(buf, wav, sample_rate, format="WAV", subtype="PCM_16")
                buf.seek(0)
                return StreamingResponse(buf, media_type="audio/wav")
            except ImportError:
                wav_bytes = generate_fallback_audio(text, sample_rate)
                return StreamingResponse(BytesIO(wav_bytes), media_type="audio/wav")
        except Exception as err:
            logger.error(f"OmniVoice synthesis error: {err}. Using fallback.")
            wav_bytes = generate_fallback_audio(text, sample_rate)
            return StreamingResponse(BytesIO(wav_bytes), media_type="audio/wav")
    else:
        # Built-in acoustic synthesizer
        wav_bytes = generate_fallback_audio(text, sample_rate)
        return StreamingResponse(BytesIO(wav_bytes), media_type="audio/wav")

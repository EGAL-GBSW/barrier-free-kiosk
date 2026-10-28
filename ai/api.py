"""HTTP audio upload endpoint for the separate AI server."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from stt_service import STTConfig, STTEngine


MAX_AUDIO_BYTES = 25 * 1024 * 1024
SUPPORTED_SUFFIXES = {".wav", ".mp3", ".m4a", ".webm"}

app = FastAPI(title="Barrier-Free Kiosk AI STT")
allowed_origins = [origin.strip() for origin in os.getenv("AI_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
engine = STTEngine(STTConfig.from_env())
logger = logging.getLogger(__name__)


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "model": engine.config.model_name, "model_loaded": engine.loaded}


@app.post("/transcribe")
def transcribe(audio: UploadFile = File(...)) -> dict[str, object]:
    if Path(audio.filename or "").suffix.lower() not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Supported formats: wav, mp3, m4a, webm")

    audio.file.seek(0, 2)
    size = audio.file.tell()
    audio.file.seek(0)
    if size == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty")
    if size > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25 MiB")

    try:
        result = engine.transcribe(audio.file)
    except Exception as exc:
        logger.exception("STT transcription failed")
        raise HTTPException(status_code=500, detail="STT transcription failed") from exc

    return {
        "transcript": result.text,
        "language": "ko",
        "model": engine.config.model_name,
        "device": engine.config.device,
        "compute_type": engine.config.compute_type,
        "audio_duration_seconds": result.audio_duration_seconds,
        "processing_seconds": round(result.processing_seconds, 3),
    }

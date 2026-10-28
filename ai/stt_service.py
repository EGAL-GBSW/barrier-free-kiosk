"""Shared faster-whisper settings for the API and local benchmarks."""

from __future__ import annotations

import os
from dataclasses import dataclass
from threading import Lock
from time import perf_counter
from typing import BinaryIO, Callable

from faster_whisper import WhisperModel


INITIAL_PROMPT = """
키오스크 주문 음성입니다.
한국어 표준어와 사투리가 포함될 수 있습니다.
아메리카노, 바닐라 크림 라떼, 카페 라떼, 제주 말차 라떼,
리얼 딸기 밀크, 딥 초코 프라페, 생 딸기 케이크, 버터 크루아상,
바스크 치즈케이크 등의 메뉴를 주문합니다.
"""


@dataclass(frozen=True)
class STTConfig:
    model_name: str = "medium"
    device: str = "cuda"
    compute_type: str = "float16"

    @classmethod
    def from_env(cls) -> STTConfig:
        return cls(
            model_name=os.getenv("STT_MODEL", "medium"),
            device=os.getenv("STT_DEVICE", "cuda"),
            compute_type=os.getenv("STT_COMPUTE_TYPE", "float16"),
        )


@dataclass(frozen=True)
class Transcription:
    text: str
    audio_duration_seconds: float | None
    processing_seconds: float


class STTEngine:
    """Load one model per process and serialize requests on a shared GPU."""

    def __init__(
        self,
        config: STTConfig,
        model_factory: Callable[..., WhisperModel] = WhisperModel,
    ) -> None:
        self.config = config
        self._model_factory = model_factory
        self._model: WhisperModel | None = None
        self._lock = Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _load_unlocked(self) -> float:
        if self._model is not None:
            return 0.0
        started = perf_counter()
        self._model = self._model_factory(
            self.config.model_name,
            device=self.config.device,
            compute_type=self.config.compute_type,
        )
        return perf_counter() - started

    def load(self) -> float:
        """Preload the model and return cold-start time in seconds."""
        with self._lock:
            return self._load_unlocked()

    def transcribe(self, audio: BinaryIO) -> Transcription:
        with self._lock:
            started = perf_counter()
            self._load_unlocked()

            audio.seek(0)
            segments, info = self._model.transcribe(
                audio,
                language="ko",
                beam_size=5,
                temperature=0,
                condition_on_previous_text=False,
                initial_prompt=INITIAL_PROMPT,
            )
            # faster-whisper returns a generator; consume it before measuring time.
            text = "".join(segment.text for segment in segments).strip()
            duration = getattr(info, "duration", None)
            return Transcription(
                text=text,
                audio_duration_seconds=float(duration) if duration is not None else None,
                processing_seconds=perf_counter() - started,
            )

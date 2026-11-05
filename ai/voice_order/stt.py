"""Whisper STT. 발화 길이를 제한하지 않고 침묵으로 발화 끝을 감지한다."""

from queue import Queue

import numpy as np
import sounddevice as sd

MODEL_NAME = "openai/whisper-large-v3-turbo"
SAMPLE_RATE = 16000
BLOCK_SECONDS = 0.1
SILENCE_SECONDS = 1.5
SPEECH_THRESHOLD = 0.01
_stt_pipeline = None


def load_model():
    """터치 주문에서는 무거운 STT 모델을 불러오지 않는다."""
    global _stt_pipeline
    if _stt_pipeline is None:
        import torch
        from transformers import pipeline

        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        print("STT 모델 불러오는 중...")
        _stt_pipeline = pipeline(
            "automatic-speech-recognition", model=MODEL_NAME, device=device,
            chunk_length_s=30,
        )
        print("STT 모델 준비 완료!")
    return _stt_pipeline


def record_until_silence(
    silence_seconds=SILENCE_SECONDS, speech_threshold=SPEECH_THRESHOLD,
):
    """대기/발화에 시간 상한 없음. 발화 후 연속 침묵이면 마이크를 닫는다."""
    if silence_seconds <= 0 or speech_threshold <= 0:
        raise ValueError("침묵 시간과 음성 감지 기준은 양수여야 합니다.")
    blocks = Queue()

    def callback(indata, frames, time_info, status):
        blocks.put((indata.copy(), status))

    audio = []
    # 첫 음절이 잘리지 않도록 음성 감지 직전 0.3초도 보관한다.
    from collections import deque
    preroll = deque(maxlen=3)
    speaking = False
    silent_seconds = 0.0
    with sd.InputStream(
        samplerate=SAMPLE_RATE, channels=1, dtype="float32",
        blocksize=int(SAMPLE_RATE * BLOCK_SECONDS), callback=callback,
    ):
        while True:
            block, status = blocks.get()
            if status:
                raise RuntimeError(f"마이크 입력 오류: {status}")
            volume = float(np.sqrt(np.mean(np.square(block))))
            if not speaking:
                preroll.append(block)
                if volume < speech_threshold:
                    continue
                speaking = True
                audio.extend(preroll)
                continue
            audio.append(block)
            silent_seconds = (
                silent_seconds + len(block) / SAMPLE_RATE
                if volume < speech_threshold else 0.0
            )
            if silent_seconds >= silence_seconds:
                break
    return np.concatenate(audio).flatten()


def transcribe_from_microphone():
    recognizer = load_model()
    print("\n말씀해 주세요. (시간 제한 없음, 말씀 후 잠시 쉬면 분석합니다.)")
    audio = record_until_silence()
    print("음성 인식 중...")
    result = recognizer(
        {"raw": audio, "sampling_rate": SAMPLE_RATE},
        generate_kwargs={"language": "korean"},
    )
    return result["text"].strip()

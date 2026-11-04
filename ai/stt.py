import torch
import sounddevice as sd
from transformers import pipeline

MODEL_NAME = "openai/whisper-large-v3-turbo"
SAMPLE_RATE = 16000
RECORD_SECONDS = 5

device = torch.device(
    "mps" if torch.backends.mps.is_available() else "cpu"
)

print("STT 모델 불러오는 중...")

stt_pipeline = pipeline(
    "automatic-speech-recognition",
    model=MODEL_NAME,
    device=device
)

print("STT 모델 준비 완료!")


def transcribe_from_microphone():
    print("\n음성을 입력하세요. (5초 녹음)")

    audio = sd.rec(
        int(RECORD_SECONDS * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32"
    )

    sd.wait()

    print("음성 인식 중...")

    result = stt_pipeline(
        {
            "raw": audio.flatten(),
            "sampling_rate": SAMPLE_RATE
        },
        generate_kwargs={
            "language": "korean"
        }
    )

    text = result["text"].strip()

    print("인식 결과:", text)

    return text
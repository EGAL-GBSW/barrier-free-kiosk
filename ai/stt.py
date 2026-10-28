from faster_whisper import WhisperModel

model = WhisperModel(
    "medium",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(
    "audio/stt_recoding2.m4a",
    language="ko",
    beam_size=5,
    condition_on_previous_text=False,
    initial_prompt="""
    키오스크 주문 음성입니다.
    한국어 표준어와 사투리가 포함될 수 있습니다.
    햄버거, 세트, 콜라, 감자튀김, 아메리카노 등의 메뉴를 주문합니다.
    """
)

text = ""

for segment in segments:
    text += segment.text

print("인식 결과:")
print(text.strip())
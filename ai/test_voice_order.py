"""마이크 → Whisper STT → OrderAI → 주문 결과(JSON) 실행 진입점."""

import json
from pathlib import Path
import sys

# 프로젝트 루트 경로 추가
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from order_ai import OrderAI

def main():
    # 한 인스턴스를 계속 사용해야 주문 내역과 추천 대화 맥락이 유지된다.
    try:
        order_ai = OrderAI()
    except ValueError as exc:
        print(exc)
        return

    # API 키 확인 후 STT 모델을 불러온다.
    from stt import transcribe_from_microphone

    print("음성 주문 시작: Enter를 누르면 5초 동안 녹음합니다.")
    print("종료하려면 '종료'를 입력하거나 녹음 중 '종료'라고 말하세요.")
    while True:
        try:
            command = input("\nEnter: 녹음 / 종료: 끝내기 > ").strip()
            if command.lower() in ("종료", "exit", "quit"):
                break
            if command:
                print("녹음하려면 Enter를 눌러 주세요.")
                continue

            try:
                text = transcribe_from_microphone()
            except Exception as exc:
                # 녹음/STT 실패 시 이전 주문을 유지하고 다음 녹음을 받는다.
                print(f"음성 인식 실패 ({type(exc).__name__}): {exc}")
                print("마이크 연결과 접근 권한을 확인한 뒤 다시 녹음해 주세요.")
                continue

            if not text or not text.strip():
                print("음성이 인식되지 않았습니다. 다시 말씀해 주세요.")
                continue

            text = text.strip()
            print("\n인식된 주문 문장:", text)
            if text.rstrip(".!?。 ") in ("종료", "프로그램 종료", "주문 프로그램 종료"):
                break

            # 추천, 추가, 수정, 취소, 결제 상태 처리는 order_ai.py에 맡긴다.
            result = order_ai.handle_input(text)
            print("\nAI 주문 처리 결과:")
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except (EOFError, KeyboardInterrupt):
            break

    print("음성 주문을 종료합니다.")


if __name__ == "__main__":
    main()

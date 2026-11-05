"""주문 방식 선택 → STT → 같은 폴더의 OrderAI → 주문/결제 결과.

실행: python voice_order/main.py 또는 python -m voice_order.main
기본 주문은 콘솔 입력으로 제공하며 실제 터치 UI는 별도 연결이 필요하다.
"""

if __package__:
    from .order_ai import MENU, OrderAI
else:
    from order_ai import MENU, OrderAI

PAUSE_WORDS = ("결제", "주문", "계산")
PAYMENT_SCREENS = {"payment", "card_payment", "cash_payment"}
EXIT_WORDS = {"종료", "프로그램 종료", "주문 프로그램 종료", "exit", "quit"}


def print_result(result):
    print("\n========== 주문 분석 결과 ==========")
    print(f"안내 메시지: {result['message']}")
    if result.get("error"):
        print(f"오류: {result['error']}")
    if result["recommendations"]:
        print("\n[추천 메뉴]")
        for item in result["recommendations"]:
            print(f"- {item['menu']} / {item['price']:,}원")
    print("\n[현재 주문]")
    if result["cart"]:
        for item in result["cart"]:
            print(f"- {item['menu']} {item['quantity']}개 ({item['amount']:,}원)")
    else:
        print("주문한 메뉴가 없습니다.")
    print(f"\n총 금액: {result['total_amount']:,}원")
    print(f"현재 화면: {result['screen']}")
    print("====================================")


def select_order_mode():
    while True:
        print("\n주문 방식을 선택해 주세요.")
        print("1. 음성 주문\n2. 기본(터치) 주문 — 현재 콘솔 입력\n0. 종료")
        choice = input("선택 [기본: 2]: ").strip()
        if choice in ("1", "음성", "음성 주문"):
            return "voice"
        if choice in ("", "2", "터치", "기본", "터치 주문"):
            return "touch"
        if choice == "0" or choice.lower() in EXIT_WORDS:
            return None
        print("1 또는 2를 선택해 주세요.")


def run_order(order, mode, transcribe=None):
    """하나의 OrderAI를 유지하며 화면 판단과 주문 규칙을 전부 위임한다."""
    print("종료하려면 '종료'라고 말하거나 입력해 주세요. Ctrl+C로도 종료할 수 있습니다.")
    if mode == "voice" and transcribe is None:
        if __package__:
            from .stt import transcribe_from_microphone
        else:
            from stt import transcribe_from_microphone
        transcribe = transcribe_from_microphone

    while True:
        if mode == "voice":
            try:
                # Enter나 추가 선택 없이 바로 다음 발화를 받는다.
                text = transcribe()
            except (EOFError, KeyboardInterrupt):
                raise
            except Exception as exc:
                print(f"음성 인식 실패 ({type(exc).__name__}): {exc}")
                print("마이크와 모델 설정을 확인해 주세요. 주문 내역은 유지됩니다.")
                # 장치 오류가 반복되는 무한 재시도를 피하고 방식 선택으로 복귀한다.
                return
        else:
            text = input("\n주문 입력 (메뉴: 메뉴표 / 종료: 끝내기): ")
        text = (text or "").strip()
        if not text:
            print("인식된 내용이 없습니다. 다시 말씀해 주세요.")
            continue
        if text.rstrip(".!?。 ").lower() in EXIT_WORDS:
            return "exit"
        if mode == "touch" and text == "메뉴":
            for name, item in MENU.items():
                print(f"- {name}: {item['price']:,}원")
            continue
        print(f"\n[입력된 문장] {text}")
        if mode == "voice" and any(word in text for word in PAUSE_WORDS):
            # STT는 반환 전에 입력 스트림을 닫으므로 분석/화면 전환 중 녹음하지 않는다.
            print("음성 인식을 잠시 멈추고 주문을 확인합니다.")
        result = order.handle_input(text)
        print_result(result)
        if mode == "voice":
            if result["screen"] in PAYMENT_SCREENS:
                print("결제 화면입니다. 결제 수단이나 수정할 내용을 말씀해 주세요.")
            print("음성 인식을 다시 시작합니다.")


def main():
    print("========== 키오스크 주문 ==========")
    order = None
    try:
        while True:
            mode = select_order_mode()
            if mode is None:
                break
            if order is None:
                try:
                    order = OrderAI()
                except Exception as exc:
                    print(f"주문 AI 초기화 실패: {exc}")
                    return
            if run_order(order, mode) == "exit":
                break
    except (EOFError, KeyboardInterrupt):
        pass
    print("주문 프로그램을 종료합니다.")


if __name__ == "__main__":
    main()

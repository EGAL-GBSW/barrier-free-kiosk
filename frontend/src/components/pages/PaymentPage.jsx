import { useState } from "react"
import "./PaymentPage.css"
import StepBar from "../layout/StepBar"
import PaymentRecap from "../payment/PaymentRecap"
import TossCheckout from "../payment/TossCheckout"
import { money, total } from "../menu/menuData"

/**
 * PaymentPage (전체 화면 결제 — 주문 내역 확인 + 결제 수단 선택)
 * 레퍼런스 ./frontend/app.js (openTossCheckout → .kiosk-checkout) 기준
 *
 *  ┌ checkout-top: 모그커피 / 결제하기 / 테스트 결제
 *  ├ StepBar (4단계 활성)
 *  ├ checkout-body: [주문 내역] [토스 결제 수단]
 *  └ checkout-bottom: 이전으로 / 총 결제 금액 / N원 결제하기
 *
 * Props:
 *   cart       {Array}     장바구니 항목 목록
 *   orderType  {string}    'DINE_IN' | 'TAKEOUT'
 *   onBack     {Function}  이전으로 () => void
 *   onPay      {Function}  결제 요청 (widgets) => void
 *   busy       {boolean}   주문 요청 진행 중 여부 (버튼 비활성화)
 */
function PaymentPage({
    cart = [],
    orderType = "DINE_IN",
    onBack,
    onPay,
    busy = false,
}) {
    const [widgets, setWidgets] = useState(null)
    const amount = total(cart)

    return (
        <main id="main" className="toss-checkout kiosk-checkout">
            <header className="checkout-top">
                <span className="checkout-brand">모그커피</span>
                <h2>결제하기</h2>
                <span className="checkout-test-tag">테스트 결제</span>
            </header>

            <StepBar currentStep={4} isCheckoutOpen />

            <div className="checkout-body">
                <PaymentRecap cart={cart} orderType={orderType} />
                <TossCheckout amount={amount} onReadyChange={setWidgets} />
            </div>

            <footer className="checkout-bottom">
                <button
                    type="button"
                    className="checkout-back"
                    onClick={onBack}
                    disabled={busy}
                    aria-label="메뉴 화면으로 돌아가기"
                >
                    <svg
                        className="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m14 6-6 6 6 6" />
                    </svg>
                    <span>이전으로</span>
                </button>
                <div className="checkout-grand-total">
                    <span>총 결제 금액</span>
                    <strong>{money(amount)}</strong>
                </div>
                <button
                    type="button"
                    className="toss-pay-button"
                    disabled={!widgets || busy}
                    aria-busy={busy}
                    onClick={() => onPay?.(widgets)}
                >
                    {busy ? "주문 확인 중..." : `${money(amount)} 결제하기`}
                </button>
            </footer>
        </main>
    )
}

export default PaymentPage

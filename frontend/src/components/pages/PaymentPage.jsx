import { useState } from "react"
import "./PaymentPage.css"
import StepBar from "../layout/StepBar"
import PaymentRecap from "../payment/PaymentRecap"
import TossCheckout from "../payment/TossCheckout"
import { total } from "../menu/menuData"
import { useI18n } from "../../i18n/context"

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
    demo = false,
}) {
    const [widgets, setWidgets] = useState(null)
    const { t, money } = useI18n()
    const amount = total(cart)

    return (
        <main id="main" className="toss-checkout kiosk-checkout">
            <header className="checkout-top">
                <span className="checkout-brand">{t("start.brand")}</span>
                <h2>{t(demo ? "dock.review" : "dock.pay")}</h2>
                <span className="checkout-test-tag">{t(demo ? "payment.tagDemo" : "payment.tagTest")}</span>
            </header>

            <StepBar currentStep={4} isCheckoutOpen demo={demo} />

            <div className="checkout-body">
                <PaymentRecap cart={cart} orderType={orderType} demo={demo} />
                {demo ? (
                    <section className="checkout-methods" aria-label={t("payment.demoAria")}>
                        <h3>{t("payment.demoTitle")}</h3>
                        <p>{t("payment.demoDesc")}</p>
                    </section>
                ) : <TossCheckout amount={amount} onReadyChange={setWidgets} />}
            </div>

            <footer className="checkout-bottom">
                <button
                    type="button"
                    className="checkout-back"
                    onClick={onBack}
                    disabled={busy}
                    aria-label={t("payment.backAria")}
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
                    <span>{t("payment.back")}</span>
                </button>
                <div className="checkout-grand-total">
                    <span>{t(demo ? "dock.totalOrder" : "dock.totalPay")}</span>
                    <strong>{money(amount)}</strong>
                </div>
                <button
                    type="button"
                    className="toss-pay-button"
                    disabled={(!demo && !widgets) || busy || !cart.length}
                    aria-busy={busy}
                    onClick={() => onPay?.(widgets)}
                >
                    {busy
                        ? t("payment.busy")
                        : t(demo ? "payment.orderButton" : "payment.payButton", { amount: money(amount) })}
                </button>
            </footer>
        </main>
    )
}

export default PaymentPage

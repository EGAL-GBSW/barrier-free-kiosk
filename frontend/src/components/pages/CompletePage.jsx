import "./CompletePage.css"
import Receipt from "../payment/Receipt"

/**
 * CompletePage (결제 완료 — 5단계)
 * 레퍼런스 ./frontend/app.js (completePage) 기준
 *
 * Props:
 *   receipt     {object}    { number, cart, total, type, method, approved }
 *                           approved: 토스 결제 승인 여부 (승인 연동 전에는 false)
 *   onNewOrder  {Function}  새로운 주문 시작하기 () => void
 */
function CompletePage({ receipt, onNewOrder }) {
    if (!receipt) return null
    const isDineIn = receipt.type === "DINE_IN"

    return (
        <main id="main" className="complete-page">
            <div className="complete-copy">
                <span className="complete-check" aria-hidden="true">
                    <svg
                        className="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m5 12 4 4L19 6" />
                    </svg>
                </span>
                <h1>{receipt.approved ? "결제가 완료되었어요." : "주문이 접수되었어요."}</h1>
                <p>
                    {receipt.approved
                        ? "토스 테스트 결제 승인이 완료되었습니다."
                        : "서버에 주문이 저장되었습니다."}
                </p>
                <div className="complete-order-number">
                    <span>주문 번호</span>
                    <strong style={{ overflowWrap: "anywhere", fontSize: "clamp(1rem, 3vw, 2rem)" }}>{receipt.number}</strong>
                </div>
                <div className="complete-meta">
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
                        <path
                            d={
                                isDineIn
                                    ? "M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2"
                                    : "M5 7h14l1 14H4L5 7Zm4 1V6a3 3 0 0 1 6 0v2"
                            }
                        />
                    </svg>
                    {isDineIn ? "매장 이용" : "포장 주문"}
                    <span>
                        테스트 주문 · 실제 금액 청구 및 매장 접수는 진행되지 않습니다.
                    </span>
                </div>
                <button
                    type="button"
                    className="button primary"
                    onClick={onNewOrder}
                >
                    새로운 주문 시작하기
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
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                </button>
            </div>
            <Receipt receipt={receipt} />
        </main>
    )
}

export default CompletePage

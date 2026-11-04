import "./CompletePage.css"
import Receipt from "../payment/Receipt"
import { money } from "../menu/menuData"

/**
 * CompletePage (결제 완료 — 5단계)
 * 가운데 정렬 단일 열: 체크 아이콘 → 완료 문구 → 주문번호 박스 → 결제 금액 → 영수증 인쇄 / 처음으로
 *
 * 영수증 인쇄: 브라우저 인쇄(window.print)를 호출하며, 인쇄 시에는 영수증(Receipt)만 출력됩니다.
 *
 * Props:
 *   receipt     {object}    { number, cart, total, type, method, approved }
 *                           approved: 토스 결제 승인 여부 (승인 연동 전에는 false)
 *   onNewOrder  {Function}  처음으로 (주문 초기화 후 시작 화면) () => void
 */
function CompletePage({ receipt, onNewOrder }) {
    if (!receipt) return null

    return (
        <main id="main" className="complete-page">
            <div className="complete-panel">
                <span className="complete-check" aria-hidden="true">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m7.5 12.5 3 3 6-6.5" />
                    </svg>
                </span>

                <h1>결제가 완료되었습니다.</h1>

                <div className="complete-order-number">
                    <span>주문번호</span>
                    <strong># {receipt.number}</strong>
                </div>

                <dl className="complete-info">
                    <dt>결제 금액</dt>
                    <dd>{money(receipt.total)}</dd>
                </dl>

                {!receipt.approved && (
                    <p className="complete-note">
                        테스트 주문 · 실제 금액 청구 및 매장 접수는 진행되지 않습니다.
                    </p>
                )}

                <div className="complete-actions">
                    <button
                        type="button"
                        className="complete-button outline"
                        onClick={() => window.print()}
                    >
                        영수증 인쇄
                    </button>
                    <button
                        type="button"
                        className="complete-button primary"
                        onClick={onNewOrder}
                    >
                        처음으로
                    </button>
                </div>
            </div>

            {/* 인쇄 전용 영수증 (화면에는 보이지 않음) */}
            <div className="complete-print-receipt">
                <Receipt receipt={receipt} />
            </div>
        </main>
    )
}

export default CompletePage

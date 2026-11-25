import "./CompletePage.css"
import Receipt from "../payment/Receipt"
import { useI18n } from "../../i18n/context"

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
    const { t } = useI18n()
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
                <h1>{t(receipt.approved ? "complete.approvedTitle" : "complete.placedTitle")}</h1>
                <p>
                    {t(receipt.approved ? "complete.approvedDesc" : "complete.placedDesc")}
                </p>
                <div className="complete-order-number">
                    <span>{t("complete.number")}</span>
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
                    {t(isDineIn ? "complete.dineIn" : "complete.takeout")}
                    <span>
                        {t("complete.testNote")}
                    </span>
                </div>
                <button
                    type="button"
                    className="button primary"
                    onClick={onNewOrder}
                >
                    {t("complete.newOrder")}
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

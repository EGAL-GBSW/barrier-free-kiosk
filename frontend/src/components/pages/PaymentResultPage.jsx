import { useEffect, useRef, useState } from "react"
import "./PaymentResultPage.css"
import CompletePage from "./CompletePage"
import { confirmPayment, getOrder } from "../../api/client"
import toReceipt from "../payment/toReceipt"
import { useI18n } from "../../i18n/context"
import { getLanguage, translate } from "../../i18n/translate"

function readReturnParams() {
    const params = new URLSearchParams(window.location.search)
    return {
        isSuccess: window.location.pathname.startsWith("/payment/success"),
        paymentKey: params.get("paymentKey"),
        orderId: params.get("orderId"),
        amount: Number(params.get("amount")),
        code: params.get("code"),
        message: params.get("message"),
    }
}

// 승인 요청 없이 바로 실패로 표시해야 하는 복귀인지 판단합니다.
function getReturnFailure({ isSuccess, paymentKey, orderId, amount, code, message }) {
    if (!isSuccess) {
        return {
            titleKey:
                code === "PAY_PROCESS_CANCELED"
                    ? "result.canceled"
                    : "result.failed",
            // 토스가 보낸 실패 사유가 있으면 그대로, 없으면 번역 문구
            description: message || undefined,
            descriptionKey: "result.failedDesc",
        }
    }
    if (!paymentKey || !orderId || !Number.isSafeInteger(amount) || amount < 1) {
        return {
            titleKey: "result.invalidTitle",
            descriptionKey: "result.invalidDesc",
        }
    }
    return null
}

/**
 * PaymentResultPage (토스 결제 인증 후 복귀 화면)
 * successUrl(/payment/success)로 돌아오면 서버에 승인을 요청하고 영수증을 표시합니다.
 * failUrl(/payment/fail)로 돌아오면 실패 사유를 안내합니다.
 *
 * 새로고침하면 승인이 다시 요청되므로 /payments/confirm은 중복 호출을 처리해야 합니다.
 *
 * Props:
 *   onDone  {Function}  시작 화면으로 돌아가기 () => void
 */
function PaymentResultPage({ onDone }) {
    const { t } = useI18n()
    const [result] = useState(readReturnParams)
    const [returnFailure] = useState(() => getReturnFailure(result))
    const [view, setView] = useState(
        returnFailure
            ? { status: "failed", ...returnFailure }
            : { status: "confirming" }
    )
    const [attempt, setAttempt] = useState(0)
    const startedAttempt = useRef(-1)

    useEffect(() => {
        if (returnFailure || startedAttempt.current === attempt) return
        startedAttempt.current = attempt

        const { paymentKey, orderId, amount } = result
        const confirm = async () => {
            try {
                await confirmPayment({ paymentKey, orderId, amount })
                const order = await getOrder(orderId)
                if (order?.status !== "PAID") throw new Error(translate(getLanguage(), "result.notRecorded"))
                setView({ status: "done", receipt: toReceipt(order) })
            } catch (error) {
                // 4xx는 다시 요청해도 같은 결과입니다. 그 외에는 승인 여부를 알 수 없습니다.
                const uncertain = !(error.status >= 400 && error.status < 500)
                setView({
                    status: "failed",
                    uncertain,
                    titleKey: uncertain
                        ? "result.uncertainTitle"
                        : "result.notCompleteTitle",
                    description: error.message,
                })
            }
        }
        confirm()
    }, [attempt, result, returnFailure])

    const handleRetry = () => {
        setView({ status: "confirming" })
        setAttempt((n) => n + 1)
    }

    if (view.status === "done") {
        return <CompletePage receipt={view.receipt} onNewOrder={onDone} />
    }

    if (view.status === "confirming") {
        // 승인 중 화면을 벗어나지 않도록 헤더까지 덮습니다.
        return (
            <main id="main" className="payment-confirming" role="status">
                <span className="payment-spinner" aria-hidden="true" />
                <h1>{t("result.confirming")}</h1>
                <p>{t("result.wait")}</p>
            </main>
        )
    }

    return (
        <main id="main" className="complete-page payment-result">
            <div className="complete-copy">
                <span className="complete-check payment-result-mark" aria-hidden="true">
                    <svg
                        className="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 7v6m0 4h.01" />
                        <circle cx="12" cy="12" r="9" />
                    </svg>
                </span>
                <h1>{t(view.titleKey)}</h1>
                <p role="alert">{view.description ?? t(view.descriptionKey)}</p>
                <p className="payment-result-help">
                    {t(view.uncertain ? "result.uncertainHelp" : "result.restartHelp")}
                </p>
                <div className="payment-result-actions">
                    {view.uncertain && (
                        <button
                            type="button"
                            className="button primary"
                            onClick={handleRetry}
                        >
                            {t("result.retry")}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`button ${view.uncertain ? "secondary" : "primary"}`}
                        onClick={onDone}
                    >
                        {t("header.homeAria")}
                    </button>
                </div>
            </div>
        </main>
    )
}

export default PaymentResultPage

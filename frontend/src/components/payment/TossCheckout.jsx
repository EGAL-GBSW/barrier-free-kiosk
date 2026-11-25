import { useEffect, useState } from "react"
import { useI18n } from "../../i18n/context"

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY
const SDK_URL = "https://js.tosspayments.com/v2/standard"

// 번역 키를 담은 오류: 화면에서 현재 언어로 보여줍니다.
const keyedError = (i18nKey) => Object.assign(new Error(i18nKey), { i18nKey })

let sdkPromise
function loadSDK() {
    if (window.TossPayments) return Promise.resolve(window.TossPayments)
    if (sdkPromise) return sdkPromise
    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = SDK_URL
        script.async = true
        const timer = setTimeout(() => {
            script.remove()
            sdkPromise = null
            reject(keyedError("toss.sdkTimeout"))
        }, 20000)
        script.onload = () => {
            clearTimeout(timer)
            if (window.TossPayments) resolve(window.TossPayments)
            else {
                sdkPromise = null
                reject(keyedError("toss.sdkMissing"))
            }
        }
        script.onerror = () => {
            clearTimeout(timer)
            script.remove()
            sdkPromise = null
            reject(keyedError("toss.sdkNetwork"))
        }
        document.head.append(script)
    })
    return sdkPromise
}

/**
 * TossCheckout (결제 수단 선택)
 * 레퍼런스 ./frontend/app.js (section.checkout-methods) 및 toss-checkout.js 기준
 * 토스페이먼츠 결제위젯(결제 수단 + 약관)을 렌더링합니다.
 *
 * Props:
 *   amount         {number}    결제 금액
 *   onReadyChange  {Function}  위젯 준비 상태 변경 (widgets | null) => void
 */
function TossCheckout({ amount, onReadyChange }) {
    const { t } = useI18n()
    // loading: 불러오는 중, ready: 준비 완료, Error 객체: 실패
    const [status, setStatus] = useState("loading")
    const failed = status instanceof Error
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let disposed = false
        let methodWidget
        let agreementWidget

        const initialize = async () => {
            try {
                if (!CLIENT_KEY?.startsWith("test_")) {
                    throw keyedError("toss.noKey")
                }
                const TossPayments = await loadSDK()
                if (disposed) return
                const widgets = TossPayments(CLIENT_KEY).widgets({
                    customerKey: TossPayments.ANONYMOUS,
                })
                await widgets.setAmount({ currency: "KRW", value: amount })
                if (disposed) return
                methodWidget = await widgets.renderPaymentMethods({
                    selector: "#toss-payment-method",
                    variantKey: "DEFAULT",
                })
                if (disposed) return
                agreementWidget = await widgets.renderAgreement({
                    selector: "#toss-agreement",
                    variantKey: "AGREEMENT",
                })
                if (disposed) return
                setStatus("ready")
                onReadyChange?.(widgets)
            } catch (error) {
                if (disposed) return
                setStatus(error instanceof Error ? error : new Error(String(error)))
            }
        }
        initialize()

        return () => {
            disposed = true
            onReadyChange?.(null)
            try { methodWidget?.destroy() } catch { /* 이미 해제됨 */ }
            try { agreementWidget?.destroy() } catch { /* 이미 해제됨 */ }
        }
    }, [amount, attempt, onReadyChange])

    const handleRetry = () => {
        setStatus("loading")
        setAttempt((n) => n + 1)
    }

    const statusText = failed
        ? status.i18nKey
            ? t(status.i18nKey)
            : status.message || t("toss.loadFail")
        : status === "loading"
          ? t("toss.loading")
          : ""

    return (
        <section className="checkout-methods" aria-label={t("toss.aria")}>
            <div className="checkout-provider">
                <span>{t("toss.secure")}</span>
                <strong>toss payments</strong>
            </div>
            <div id="toss-payment-method" />
            <div id="toss-agreement" />
            {statusText && (
                <p className="toss-status" role="status">
                    {statusText}
                </p>
            )}
            {failed && (
                <button type="button" className="toss-retry" onClick={handleRetry}>
                    {t("toss.retry")}
                </button>
            )}
            <p className="toss-test-note">
                {t("toss.note")}
            </p>
        </section>
    )
}

export default TossCheckout

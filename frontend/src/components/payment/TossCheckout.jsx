import { useEffect, useState } from "react"

// 토스페이먼츠 공개 문서용 TEST 클라이언트 키 (레퍼런스 ./frontend/toss-checkout.js와 동일)
// 가맹점 시크릿이 아니며 실제 결제는 지원하지 않습니다.
const CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
const SDK_URL = "https://js.tosspayments.com/v2/standard"

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
            reject(new Error("결제 화면 연결이 지연되고 있어요. 다시 시도해 주세요."))
        }, 20000)
        script.onload = () => {
            clearTimeout(timer)
            if (window.TossPayments) resolve(window.TossPayments)
            else {
                sdkPromise = null
                reject(new Error("결제 화면을 불러오지 못했어요."))
            }
        }
        script.onerror = () => {
            clearTimeout(timer)
            script.remove()
            sdkPromise = null
            reject(new Error("토스페이먼츠에 연결할 수 없어요. 인터넷 연결을 확인해 주세요."))
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
    const [status, setStatus] = useState("결제 화면을 불러오는 중입니다.")
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let disposed = false
        let methodWidget
        let agreementWidget

        const initialize = async () => {
            try {
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
                setStatus("")
                onReadyChange?.(widgets)
            } catch (error) {
                if (disposed) return
                setStatus(
                    error.message ||
                        "결제 화면을 불러오지 못했어요. 다시 시도해 주세요."
                )
                setFailed(true)
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
        setFailed(false)
        setStatus("결제 화면을 불러오는 중입니다.")
        setAttempt((n) => n + 1)
    }

    return (
        <section className="checkout-methods" aria-label="결제 수단 선택">
            <div className="checkout-provider">
                <span>안전한 결제</span>
                <strong>toss payments</strong>
            </div>
            <div id="toss-payment-method" />
            <div id="toss-agreement" />
            {status && (
                <p className="toss-status" role="status">
                    {status}
                </p>
            )}
            {failed && (
                <button type="button" className="toss-retry" onClick={handleRetry}>
                    다시 불러오기
                </button>
            )}
            <p className="toss-test-note">
                테스트 결제 · 실제 금액은 청구되지 않습니다.
            </p>
        </section>
    )
}

export default TossCheckout

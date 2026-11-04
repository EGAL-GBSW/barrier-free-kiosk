import { useEffect, useState } from "react"

// 결제위젯 클라이언트 키
// - .env.local 의 VITE_TOSS_CLIENT_KEY (토스페이먼츠 개발자센터에서 발급한 본인 상점의 test_gck_ 키)
// - 없으면 토스 공개 문서용 TEST 키 사용 (레퍼런스 ./frontend/toss-checkout.js와 동일)
//   ※ 공개 문서용 키는 토스 측 공용 테스트 상점이라, 토스 서버 상태에 따라
//     위젯 조회가 500(처리 중 오류)으로 실패할 수 있습니다.
// 실제 결제를 막기 위해 테스트 키(test_gck_)만 허용합니다.
const DOCS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm"
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || DOCS_CLIENT_KEY
const SDK_URL = "https://js.tosspayments.com/v2/standard"
const LOAD_ERROR_MESSAGE =
    "결제 수단을 불러오지 못했어요. 잠시 후 다시 불러오기를 눌러 주세요."

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

        // 화면을 벗어난 뒤 늦게 끝난 렌더링 결과도 해제 (위젯 중복 렌더링 방지)
        const destroyWidgets = () => {
            try { methodWidget?.destroy() } catch { /* 이미 해제됨 */ }
            try { agreementWidget?.destroy() } catch { /* 이미 해제됨 */ }
            methodWidget = null
            agreementWidget = null
        }

        const initialize = async () => {
            try {
                if (!CLIENT_KEY.startsWith("test_gck_")) {
                    throw new Error("테스트 결제 키(test_gck_)만 사용할 수 있어요.")
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
                if (disposed) return destroyWidgets()
                agreementWidget = await widgets.renderAgreement({
                    selector: "#toss-agreement",
                    variantKey: "AGREEMENT",
                })
                if (disposed) return destroyWidgets()
                setStatus("")
                onReadyChange?.(widgets)
            } catch (error) {
                if (disposed) return
                destroyWidgets()
                // 토스 SDK는 서버 오류를 "알 수 없는 에러" 같은 일반 문구로 던지므로
                // 화면에는 안내 문구를, 개발자 콘솔에는 원인 파악용 정보를 남깁니다.
                console.error(
                    "[TossCheckout] 결제위젯 로드 실패:",
                    error,
                    CLIENT_KEY === DOCS_CLIENT_KEY
                        ? "\n공개 문서용 테스트 키를 사용 중입니다. 토스 공용 테스트 상점 오류일 수 있으니 " +
                              ".env.local 에 VITE_TOSS_CLIENT_KEY(본인 상점의 test_gck_ 키)를 설정해 보세요."
                        : ""
                )
                setStatus(
                    error.message?.startsWith("테스트 결제 키")
                        ? error.message
                        : LOAD_ERROR_MESSAGE
                )
                setFailed(true)
            }
        }
        initialize()

        return () => {
            disposed = true
            onReadyChange?.(null)
            destroyWidgets()
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

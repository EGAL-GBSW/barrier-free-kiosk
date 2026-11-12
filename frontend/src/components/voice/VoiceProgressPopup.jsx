import "./VoiceProgressPopup.css"
import { money } from "../menu/menuData"

const PHASE_LABEL = {
    listening: "주문을 듣고 있어요",
    analyzing: "주문을 확인하고 있어요",
    question: "옵션을 확인해 주세요",
    reply: "음성 주문 진행 중",
    quote: "주문 금액을 확인해 주세요",
    retry: "다시 말씀해 주세요",
}

export default function VoiceProgressPopup({
    phase, transcript, message, listening, draft, quote, confirming, onRetry, onClose, onConfirm,
}) {
    if (phase === "idle" && !confirming) return null
    const title = confirming ? "주문 처리 중" : PHASE_LABEL[phase]

    return (
        <aside className="voice-progress-popup" aria-label="음성 주문 진행 상황">
            <header className="voice-progress-header">
                <span className="voice-progress-eyebrow">음성 주문</span>
                <button type="button" className="voice-progress-close" onClick={onClose} disabled={confirming}>
                    닫기
                </button>
            </header>
            <div role="status" aria-live="polite" aria-atomic="true">
                <h2>{title}</h2>
                {message && !confirming && <p>{message}</p>}
                {quote && quote.message !== message && <p>{quote.message}</p>}
                {listening && <p className="voice-progress-mic"><span aria-hidden="true" /> 마이크 듣는 중</p>}
            </div>
            {transcript && (
                <div className="voice-progress-card">
                    <strong>인식한 문장</strong>
                    <p>“{transcript}”</p>
                </div>
            )}
            {draft && <p className="voice-progress-draft"><strong>음성 주문 내역</strong> {draft}</p>}
            {quote && (
                <div className="voice-progress-actions">
                    <strong>총 {money(quote.amount)}</strong>
                    <button type="button" className="button primary" onClick={onConfirm}>주문 확정</button>
                </div>
            )}
            {phase === "retry" && !confirming && (
                <button type="button" className="button primary" onClick={onRetry}>다시 말하기</button>
            )}
        </aside>
    )
}

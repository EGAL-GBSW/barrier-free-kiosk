import "./VoiceProgressPopup.css"
import { useI18n } from "../../i18n/context"

export default function VoiceProgressPopup({
    phase, transcript, message, listening, draft, quote, confirming, onRetry, onClose, onConfirm,
}) {
    const { lang, t, money } = useI18n()
    if (phase === "idle" && !confirming) return null
    const title = t(confirming ? "voice.confirming" : `voice.phase.${phase}`)

    return (
        <aside className="voice-progress-popup" aria-label={t("voice.popupAria")}>
            <header className="voice-progress-header">
                <span className="voice-progress-eyebrow">{t("orderMode.voice")}</span>
                <button type="button" className="voice-progress-close" onClick={onClose} disabled={confirming}>
                    {t("common.close")}
                </button>
            </header>
            <div role="status" aria-live="polite" aria-atomic="true">
                <h2>{title}</h2>
                {lang !== "ko" && <p className="voice-progress-note">{t("voice.koreanOnly")}</p>}
                {message && !confirming && <p>{message}</p>}
                {quote && quote.message !== message && <p>{quote.message}</p>}
                {listening && <p className="voice-progress-mic"><span aria-hidden="true" /> {t("voice.mic")}</p>}
            </div>
            {transcript && (
                <div className="voice-progress-card">
                    <strong>{t("voice.transcript")}</strong>
                    <p>“{transcript}”</p>
                </div>
            )}
            {draft && <p className="voice-progress-draft"><strong>{t("voice.draft")}</strong> {draft}</p>}
            {quote && (
                <div className="voice-progress-actions">
                    <strong>{t("voice.total", { amount: money(quote.amount) })}</strong>
                    <button type="button" className="button primary" onClick={onConfirm}>{t("voice.confirm")}</button>
                </div>
            )}
            {phase === "retry" && !confirming && (
                <button type="button" className="button primary" onClick={onRetry}>{t("voice.retry")}</button>
            )}
        </aside>
    )
}

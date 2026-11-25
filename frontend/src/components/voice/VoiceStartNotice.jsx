import "./VoiceStartNotice.css"
import { useI18n } from "../../i18n/context"

/**
 * VoiceStartNotice
 * 음성 주문 시작 시 화면 중앙에 크게 안내 문구를 띄웠다가 천천히 사라지게 합니다.
 * 같은 안내를 다시 띄우려면 부모에서 key를 바꿔 다시 마운트합니다.
 *
 * Props:
 *   onDone  {Function}  애니메이션 종료 후 호출 () => void
 */
function VoiceStartNotice({ onDone }) {
    const { lang, t } = useI18n()

    return (
        <div className="voice-start-notice" aria-hidden="true">
            <p onAnimationEnd={onDone}>
                {t("voice.started")}
                {lang !== "ko" && (
                    <>
                        <br />
                        {t("voice.koreanOnly")}
                    </>
                )}
            </p>
        </div>
    )
}

export default VoiceStartNotice

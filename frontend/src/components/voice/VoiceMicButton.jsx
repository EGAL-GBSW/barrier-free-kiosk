import "./VoiceMicButton.css"

/**
 * VoiceMicButton
 * 레퍼런스 ./frontend/app.js의 .mic-button 컴포넌트
 *
 * Props:
 *   listening  {boolean}   음성 인식 중 여부
 *   onToggle   {Function}  클릭 토글 핸들러 () => void
 *   disabled   {boolean}   비활성화 여부
 */
function VoiceMicButton({ listening = false, onToggle, disabled = false }) {
    return (
        <button
            type="button"
            className={`mic-button${listening ? " listening" : ""}`}
            onClick={onToggle}
            disabled={disabled}
            aria-label={listening ? "음성 인식 중지" : "음성 인식 시작"}
            data-action="listen"
        >
            {listening ? (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m6 6 12 12M6 18 18 6" />
                </svg>
            ) : (
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect x="9" y="2" width="6" height="13" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
                </svg>
            )}
        </button>
    )
}

export default VoiceMicButton

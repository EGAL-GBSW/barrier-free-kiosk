import { useState } from "react"
import "./VoiceInputForm.css"

/**
 * VoiceInputForm
 * 레퍼런스 ./frontend/app.js의 .voice-chips 및 #voice-form 영역
 *
 * Props:
 *   onSend  {Function}  텍스트 입력 또는 예시 칩 전송 콜백 (text: string) => void
 */
function VoiceInputForm({ onSend }) {
    const [text, setText] = useState("")

    const examples = [
        "아이스 아메리카노 한 잔",
        "바닐라 라떼 두 잔",
        "딸기 케이크 한 개",
    ]

    const handleSubmit = (e) => {
        e.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) return
        onSend?.(trimmed)
        setText("")
    }

    const handleChipClick = (val) => {
        onSend?.(val)
    }

    return (
        <div className="voice-form-wrapper">
            <div className="voice-chips">
                {examples.map((example) => (
                    <button
                        key={example}
                        type="button"
                        className="voice-chip"
                        onClick={() => handleChipClick(example)}
                    >
                        “{example}”
                    </button>
                ))}
            </div>

            <form className="voice-input" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="voice-text-input">
                    주문할 내용을 입력하세요
                </label>
                <input
                    id="voice-text-input"
                    type="text"
                    name="order"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoComplete="off"
                    placeholder="직접 입력해도 괜찮아요"
                    maxLength={180}
                />
                <button type="submit" aria-label="주문 내용 보내기">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                </button>
            </form>

            <p className="voice-privacy">
                마이크는 누를 때만 켜져요. 음성 인식 시 브라우저 제공 서비스로
                음성이 전송될 수 있어요.
            </p>
        </div>
    )
}

export default VoiceInputForm

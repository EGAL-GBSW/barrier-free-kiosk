import "./OrderModeModal.css"

/**
 * OrderModeModal
 * 레퍼런스 ./frontend/app.js (chooseOrderMode) 기준
 * 매장/포장 선택 후 음성 주문 또는 터치 주문 방식을 선택하는 대화상자
 *
 * Props:
 *   isOpen    {boolean}   모달 오픈 여부
 *   onClose   {Function}  닫기 핸들러 () => void
 *   onSelect  {Function}  모드 선택 핸들러 (mode: 'voice' | 'touch') => void
 */
function OrderModeModal({ isOpen = false, onClose, onSelect }) {
    if (!isOpen) return null

    return (
        <div
            className="order-mode-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
            role="presentation"
        >
            <div
                className="order-mode-modal"
                role="dialog"
                aria-labelledby="order-mode-title"
                aria-modal="true"
            >
                <div className="order-mode-prompt">
                    <button
                        type="button"
                        className="mode-prompt-close"
                        onClick={onClose}
                        aria-label="주문 방식 선택 닫기"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            width="20"
                            height="20"
                        >
                            <path d="m6 6 12 12M6 18 18 6" />
                        </svg>
                    </button>

                    <div className="mode-prompt-icon">
                        <svg
                            className="icon"
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
                    </div>

                    <h2 id="order-mode-title">음성으로 주문하시겠습니까?</h2>
                    <p>메뉴와 수량을 말로 편하게 주문할 수 있어요.</p>

                    <div className="mode-prompt-actions">
                        <button
                            type="button"
                            className="mode-btn voice-choice"
                            onClick={() => onSelect?.("voice")}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <rect
                                    x="9"
                                    y="2"
                                    width="6"
                                    height="13"
                                    rx="3"
                                />
                                <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
                            </svg>
                            <span>네, 음성 주문</span>
                        </button>

                        <button
                            type="button"
                            className="mode-btn touch-choice"
                            onClick={() => onSelect?.("touch")}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M8 12V5a2 2 0 0 1 4 0v6l5 1a3 3 0 0 1 2 3l-1 5H9l-5-7a2 2 0 0 1 3-2l1 1Z" />
                            </svg>
                            <span>아니요, 터치 주문</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OrderModeModal

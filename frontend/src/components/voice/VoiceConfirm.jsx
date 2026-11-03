import "./VoiceConfirm.css"
import { money, unitPrice, optionsText } from "../menu/menuData"

/**
 * VoiceConfirm
 * 레퍼런스 ./frontend/app.js의 .voice-confirm 영역
 * 음성으로 주문이 인식되었을 때 상품 확인 및 장바구니 담기 카드
 *
 * Props:
 *   pending   {object}    { menu: object, options: object }
 *   onConfirm {Function}  확인하고 담기 핸들러 (menu, options) => void
 *   onRetry   {Function}  다시 말하기 핸들러 () => void
 */
function VoiceConfirm({ pending, onConfirm, onRetry }) {
    if (!pending?.menu) return null

    const { menu, options } = pending
    const calculatedPrice = unitPrice(menu, options) * (options.quantity || 1)
    const detailText = optionsText({ ...options, id: menu.id })

    return (
        <div className="voice-confirm" aria-label={`${menu.name} 주문 확인`}>
            <div
                className={`product-photo photo-${menu.id}`}
                role="img"
                aria-label={menu.name}
            />
            <div className="voice-confirm-info">
                <h3>{menu.name}</h3>
                <p>
                    {detailText} · {options.quantity || 1}개
                </p>
                <strong>{money(calculatedPrice)}</strong>
            </div>
            <div className="voice-confirm-actions">
                <button
                    type="button"
                    className="voice-retry-btn"
                    onClick={onRetry}
                    data-action="voice-retry"
                >
                    다시 말하기
                </button>
                <button
                    type="button"
                    className="voice-confirm-btn"
                    onClick={() => onConfirm?.(menu, options)}
                    data-action="voice-confirm"
                >
                    <span>확인하고 담기</span>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
            </div>
        </div>
    )
}

export default VoiceConfirm

/**
 * QuantityControl
 * 레퍼런스 ./frontend/app.js (quantity) 기준
 * 수량 감소/증가 버튼과 현재 수량 표시 (1~99)
 *
 * Props:
 *   quantity  {number}    현재 수량
 *   name      {string}    스크린리더용 메뉴 이름
 *   onChange  {Function}  수량 변경 핸들러 (delta: -1 | 1) => void
 *   className {string}    추가 클래스
 */
function QuantityControl({ quantity, name = "", onChange, className = "" }) {
    return (
        <div className={`quantity ${className}`.trim()}>
            <button
                type="button"
                onClick={() => onChange?.(-1)}
                disabled={quantity <= 1}
                aria-label={`${name} 수량 줄이기`.trim()}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="20"
                    height="20"
                    aria-hidden="true"
                >
                    <path d="M5 12h14" />
                </svg>
            </button>
            <strong aria-label={`수량 ${quantity}`} aria-live="polite">
                {quantity}
            </strong>
            <button
                type="button"
                onClick={() => onChange?.(1)}
                disabled={quantity >= 99}
                aria-label={`${name} 수량 늘리기`.trim()}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="20"
                    height="20"
                    aria-hidden="true"
                >
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>
        </div>
    )
}

export default QuantityControl

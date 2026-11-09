import "./ConfirmDialog.css"

/**
 * ConfirmDialog
 * 레퍼런스 ./frontend/app.js (confirmDialog → .simple-modal) 기준
 * "전체 취소", "처음으로" 등 되돌릴 수 없는 동작 전 확인 대화상자
 *
 * Props:
 *   isOpen        {boolean}   오픈 여부
 *   title         {string}    제목
 *   description   {string}    설명
 *   confirmLabel  {string}    확인 버튼 문구 (기본: "확인")
 *   onConfirm     {Function}  확인 핸들러 () => void
 *   onCancel      {Function}  돌아가기 핸들러 () => void
 *   hideCancel    {boolean}   돌아가기 버튼 숨김 (오류 안내처럼 확인만 필요한 경우)
 */
function ConfirmDialog({
    isOpen = false,
    title,
    description,
    confirmLabel = "확인",
    onConfirm,
    onCancel,
    hideCancel = false,
}) {
    if (!isOpen) return null

    return (
        <div
            className="confirm-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel?.()
            }}
            role="presentation"
        >
            <div
                className="confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-desc"
            >
                <span className="dialog-symbol" aria-hidden="true">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3h.01" />
                    </svg>
                </span>
                <h2 id="confirm-dialog-title">{title}</h2>
                {description && <p id="confirm-dialog-desc">{description}</p>}
                <div className="dialog-actions">
                    {!hideCancel && (
                        <button
                            type="button"
                            className="dialog-button secondary"
                            onClick={onCancel}
                            autoFocus
                        >
                            돌아가기
                        </button>
                    )}
                    <button
                        type="button"
                        className="dialog-button primary"
                        onClick={onConfirm}
                        autoFocus={hideCancel}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmDialog

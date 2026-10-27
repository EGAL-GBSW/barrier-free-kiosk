import "./Toast.css"

/**
 * Toast
 * 화면 하단 중앙에 짧게 표시되는 알림 메시지.
 *
 * Props:
 *   message {string}   표시할 텍스트 (빈 문자열이면 숨김)
 *   visible {boolean}  show/hide 제어
 */
function Toast({ message = "", visible = false }) {
  return (
    <div
      id="toast"
      className={`toast${visible ? " toast--show" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  )
}

export default Toast

import "./Overlay.css"

/**
 * Overlay
 * 모달/다이얼로그가 열릴 때 배경을 덮는 반투명 레이어.
 * children 으로 dialog 요소를 전달합니다.
 *
 * Props:
 *   visible  {boolean}    오버레이 표시 여부
 *   onClose  {Function}   배경 클릭 시 닫기 콜백
 *   children {ReactNode}  내부에 렌더링할 모달 콘텐츠
 */
function Overlay({ visible = false, onClose, children }) {
  if (!visible) return null

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {children}
    </div>
  )
}

export default Overlay

import "./FontControl.css"

/**
 * FontControl
 * 글자 크기 단계 조절 버튼 그룹 (일반 / 큰글씨 / 최대).
 * <html data-font="normal|large|max"> 값을 변경합니다.
 *
 * Props:
 *   font    {number} 현재 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont  {Function} 단계 변경 콜백 (nextIndex: number) => void
 */
const LABELS = ["일반", "큰글씨", "최대"]

function FontControl({ font = 0, onFont }) {
  return (
    <div className="font-control" role="group" aria-label="글자 크기">
      {LABELS.map((label, i) => (
        <button
          key={i}
          className={`font-btn${font === i ? " font-btn--active" : ""}`}
          aria-pressed={font === i}
          onClick={() => onFont?.(i)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default FontControl

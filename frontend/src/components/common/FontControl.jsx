import "./FontControl.css"
import { useI18n } from "../../i18n/context"

/**
 * FontControl
 * 글자 크기 단계 조절 버튼 그룹 (일반 / 큰글씨 / 최대).
 * 상단 헤더(KioskHeader) 오른쪽에 위치합니다.
 * 실제 <html data-font="normal|large|max"> 반영은 AppLayout이 담당합니다.
 *
 * Props:
 *   font    {number} 현재 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont  {Function} 단계 변경 콜백 (nextIndex: number) => void
 */
const LEVELS = [0, 1, 2]

function FontControl({ font = 0, onFont }) {
  const { t } = useI18n()

  return (
    <div className="font-control" role="group" aria-label={t("font.group")}>
      {LEVELS.map((i) => (
        <button
          key={i}
          type="button"
          className={`font-btn${font === i ? " font-btn--active" : ""}`}
          aria-pressed={font === i}
          onClick={() => onFont?.(i)}
        >
          {t(`font.${i}`)}
        </button>
      ))}
    </div>
  )
}

export default FontControl

import "./KioskHeader.css"
import FontControl from "../common/FontControl"

/**
 * KioskHeader
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css 기준
 *
 * 구조 (grid 3열):
 *  1. [좌] 처음으로 (홈) 버튼 (showHome=false 시 mog. 워드마크)
 *  2. [중] 경과 시간 (order-elapsed)
 *  3. [우] 글자 크기 조절 (언어 변경 기능이 없어 기존 언어 버튼 자리에 배치)
 *
 * Props:
 *   onHome      {Function}  홈 버튼 클릭 핸들러
 *   elapsed     {string}    경과 시간 ("MM:SS")
 *   showHome    {boolean}   홈 버튼 표시 여부 (기본값 true)
 *   font        {number}    글자 크기 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont      {Function}  글자 크기 변경 핸들러
 */
function KioskHeader({
  onHome,
  elapsed = "00:00",
  showHome = true,
  font = 0,
  onFont,
}) {
  return (
    <header className="header kiosk-header">
      {/* ── 좌: 홈 버튼 or 워드마크 ── */}
      {showHome ? (
        <button
          type="button"
          className="header-home"
          onClick={onHome}
          data-action="home"
          aria-label="처음으로 돌아가기"
        >
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
            <path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3V10Z" />
          </svg>
          <span>처음으로</span>
        </button>
      ) : (
        <span className="wordmark" aria-label="모그커피">
          mog<span className="brand-dot">.</span>
        </span>
      )}

      {/* ── 중: 경과 시간 ── */}
      <time
        className="order-elapsed"
        aria-label={`주문 경과 시간 ${elapsed || "00:00"}`}
      >
        {elapsed || "00:00"}
      </time>

      {/* ── 우: 글자 크기 조절 ── */}
      <div className="header-tools">
        <FontControl font={font} onFont={onFont} />
      </div>
    </header>
  )
}

export default KioskHeader

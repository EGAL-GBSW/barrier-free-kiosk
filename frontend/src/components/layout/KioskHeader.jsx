import "./KioskHeader.css"
import FontControl from "../common/FontControl"

/**
 * KioskHeader
 * desktop/frontend의 header.kiosk-header 구조를 재현합니다.
 *
 * grid 3열:
 *  [좌] 홈 버튼                → justify-self: start
 *  [중] 경과 시간 (order-elapsed)
 *  [우] FontControl + 언어 선택 버튼
 *
 * Props:
 *   onHome   {Function} 홈 버튼 클릭 핸들러
 *   elapsed  {string}   "MM:SS" 형식 — 빈 문자열이면 숨김
 *   showHome {boolean}  홈 버튼 표시 여부 (start 화면에서는 false)
 *   font     {number}   현재 글자 크기 단계 (0·1·2)
 *   onFont   {Function} 글자 크기 변경 콜백
 */
function KioskHeader({
  onHome,
  elapsed = "",
  showHome = true,
  font = 0,
  onFont,
}) {
  return (
    <header className="kiosk-header">

      {/* ── 좌: 홈 버튼 ── */}
      <div className="kiosk-header__left">
        {showHome && (
          <button
            className="header-home"
            onClick={onHome}
            aria-label="처음으로 돌아가기"
          >
            {/* TODO: 홈 아이콘 추가 */}
            <span>처음으로</span>
          </button>
        )}
      </div>

      {/* ── 중: 경과 시간 ── */}
      {elapsed ? (
        <time
          className="order-elapsed"
          aria-label={`주문 경과 시간 ${elapsed}`}
        >
          {elapsed}
        </time>
      ) : (
        <div aria-hidden="true" />
      )}

      {/* ── 우: FontControl + 언어 버튼 ── */}
      <div className="kiosk-header__right">
        <FontControl font={font} onFont={onFont} />
        <button
          type="button"
          className="language-btn"
          aria-pressed={true}
          lang="ko"
        >
          한국어
        </button>
      </div>

    </header>
  )
}

export default KioskHeader

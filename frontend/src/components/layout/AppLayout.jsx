import "./AppLayout.css"
import KioskHeader from "./KioskHeader"
import StepBar from "./StepBar"
import Toast from "../common/Toast"
import Overlay from "../common/Overlay"

/**
 * AppLayout
 * desktop/frontend의 레이아웃 구조를 React로 재현합니다.
 *
 * ┌─────────────────────────────────────┐ ← KioskHeader  (--header: 88px)
 * │  처음으로    mog.   00:00   [가]     │
 * ├─────────────────────────────────────┤ ← StepBar      (--stepbar: 74px)
 * │  ① 포장/매장 ② 메뉴 ③ 확인 ④ 결제 ⑤ 완료 │
 * ├─────────────────────────────────────┤ ← .app-workspace (3-row grid)
 * │  CategoryTabs   (auto)              │   row 1
 * ├─────────────────────────────────────┤
 * │  main-panel     (1fr)               │   row 2  ← .app-main
 * │  (MenuPage / VoicePage / ...)       │
 * ├─────────────────────────────────────┤
 * │  OrderDock      (--dock: 132px)     │   row 3
 * └─────────────────────────────────────┘
 *
 * start    화면: KioskHeader + startSlot (100dvh) — stepbar·workspace 없음
 * complete 화면: KioskHeader + StepBar + completeSlot (스크롤 허용)
 *
 * Props:
 *   page             {string}    현재 페이지 키 ('start'|'menu'|'voice'|'cart'|'payment'|'complete')
 *   currentStep      {number}    StepBar 활성 단계 (1~5)
 *   onHome           {Function}  홈 버튼 클릭 핸들러
 *   elapsed          {string}    경과 시간 "MM:SS"
 *   font             {number}    글자 크기 단계 (0·1·2)
 *   onFont           {Function}  글자 크기 변경 콜백
 *   toast            {object}    { message, visible }
 *   overlay          {object}    { visible, onClose, children }
 *   startSlot        {ReactNode} start 화면 전체 콘텐츠
 *   categoryTabsSlot {ReactNode} row1 — 카테고리 탭
 *   mainSlot         {ReactNode} row2 — 페이지 콘텐츠
 *   orderDockSlot    {ReactNode} row3 — 하단 주문 독
 *   completeSlot     {ReactNode} complete 화면 콘텐츠
 */
function AppLayout({
  page = "start",
  currentStep = 1,
  onHome,
  elapsed = "",
  font = 0,
  onFont,
  toast: toastProps = { message: "", visible: false },
  overlay: overlayProps = { visible: false },
  startSlot,
  categoryTabsSlot,
  mainSlot,
  orderDockSlot,
  completeSlot,
}) {
  const isStart    = page === "start"
  const isComplete = page === "complete"

  return (
    <div className="app-layout" data-page={page}>
      <a href="#main" className="skip-link">주문 화면으로 바로 가기</a>

      {/* ── 헤더: 모든 화면 ── */}
      <KioskHeader
        onHome={onHome}
        elapsed={elapsed}
        showHome={!isStart}
        font={font}
        onFont={onFont}
      />

      {/* ── start 화면 전용 콘텐츠 ── */}
      {isStart && startSlot}

      {/* ── start 제외 나머지 ── */}
      {!isStart && (
        <>
          {/* 스텝바 */}
          <StepBar currentStep={currentStep} />

          {/* workspace */}
          <div className="app-workspace">

            {/* row 1: 카테고리 탭 (complete 화면에서는 숨김) */}
            {!isComplete && categoryTabsSlot}

            {/* row 2: 메인 콘텐츠 */}
            <main id="main" className="app-main">
              {isComplete ? completeSlot : mainSlot}
            </main>

            {/* row 3: 하단 주문 독 (complete 화면에서는 숨김) */}
            {!isComplete && orderDockSlot}

          </div>
        </>
      )}

      {/* ── 전역 레이어 ── */}
      <Toast message={toastProps.message} visible={toastProps.visible} />
      <Overlay
        visible={overlayProps.visible}
        onClose={overlayProps.onClose}
      >
        {overlayProps.children}
      </Overlay>
    </div>
  )
}

export default AppLayout

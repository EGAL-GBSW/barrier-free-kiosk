import { useEffect, useState } from "react"
import "./AppLayout.css"
import KioskHeader from "./KioskHeader"
import StepBar from "./StepBar"
import Toast from "../common/Toast"
import Overlay from "../common/Overlay"

/**
 * AppLayout
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css의 전체 레이아웃 구조를 React로 재현합니다.
 *
 * 화면별 구성:
 *  1. start 화면:
 *     - 헤더/스텝바 없이 전체 화면 프로모션 및 매장/포장 선택
 *     - startSlot 전달 시 해당 슬롯 렌더링, 미전달 시 레퍼런스 기반 기본 시작 화면(renderDefaultStart) 표시
 *  2. complete 화면:
 *     - KioskHeader (66px) + StepBar (66px, 5단계 활성)
 *     - completeSlot 렌더링 (단일 페이지 flex 레이아웃)
 *  3. menu / voice / cart / payment 화면:
 *     - KioskHeader (66px) + StepBar (66px)
 *     - .workspace (2열 2행 그리드):
 *       [col 1, row 1] 카테고리 레일 (categoryTabsSlot 또는 기본 레일)
 *       [col 2, row 1] 메인 패널 (mainSlot 또는 기본 메뉴 그리드)
 *       [col 1/-1, row 2] 하단 독 (orderDockSlot 또는 기본 주문 독)
 *
 * Props:
 *   page             {string}    현재 페이지 키 ('start'|'menu'|'voice'|'cart'|'payment'|'complete')
 *   currentStep      {number}    StepBar 활성 단계 (1~5)
 *   onHome           {Function}  홈 ("처음으로") 버튼 클릭 핸들러
 *   elapsed          {string}    경과 시간 "MM:SS" (생략 시 주문 시작 후 자동 카운트)
 *   font             {number}    글자 크기 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont           {Function}  글자 크기 변경 핸들러
 *   isCheckoutOpen   {boolean}   토스 결제 모달 오픈 여부 (StepBar 스타일 제어)
 *   toast            {object}    { message: string, visible: boolean }
 *   overlay          {object}    { visible: boolean, onClose: Function, children: ReactNode }
 *   startSlot        {ReactNode} start 화면 커스텀 슬롯
 *   categoryTabsSlot {ReactNode} 좌측 카테고리 탭 커스텀 슬롯
 *   mainSlot         {ReactNode} 메인 콘텐츠 커스텀 슬롯
 *   orderDockSlot    {ReactNode} 하단 주문 독 커스텀 슬롯
 *   completeSlot     {ReactNode} complete 화면 커스텀 슬롯
 *   children         {ReactNode} 대체 슬롯
 */
function AppLayout({
    page = "start",
    currentStep = 1,
    onHome,
    elapsed = "",
    font = 0,
    onFont,
    isCheckoutOpen = false,
    toast: toastProps = { message: "", visible: false },
    overlay: overlayProps = { visible: false },
    startSlot,
    categoryTabsSlot,
    mainSlot,
    orderDockSlot,
    completeSlot,
    children,
}) {
    const isStart = page === "start"
    const isComplete = page === "complete"

    // 폰트 및 화면 데이터 속성 동기화
    useEffect(() => {
        const fontNames = ["normal", "large", "max"]
        document.documentElement.dataset.font = fontNames[font] || "normal"
        document.documentElement.dataset.screen = page
    }, [font, page])

    // 경과 시간 자동 카운트
    const [internalElapsed, setInternalElapsed] = useState("00:00")
    useEffect(() => {
        if (elapsed || isStart) return

        const startTime = Date.now()
        const timer = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000)
            const m = String(Math.floor(seconds / 60)).padStart(2, "0")
            const s = String(seconds % 60).padStart(2, "0")
            setInternalElapsed(`${m}:${s}`)
        }, 1000)

        return () => clearInterval(timer)
    }, [isStart, elapsed])

    const activeElapsed = elapsed || (isStart ? "00:00" : internalElapsed)
    const stepNumber = isComplete ? 5 : currentStep

    // 기본 슬롯 미제공 시 레퍼런스(./frontend/app.js)와 완전히 일치하는 기본 시작 화면 렌더러
    const renderDefaultStart = () => (
        <main id="main" className="kiosk-start">
            <section
                className="kiosk-promo photo-only-promo"
                aria-label="모그커피 음료"
            >
                <img
                    className="start-editorial-photo"
                    src="/StartPage.png"
                    alt="하늘색 배경 위 커다란 아이스 아메리카노"
                />
                <div className="start-campaign-copy">
                    <p>모그커피와 함께</p>
                    <h1>
                        시원하게
                        <br />한 모금!
                    </h1>
                </div>
            </section>
            <section className="kiosk-entry" aria-label="주문 시작">
                <div className="entry-logo">
                    <span className="wordmark">
                        mog<span className="brand-dot">.</span>
                    </span>
                    <span>모그커피</span>
                </div>
                <div className="kiosk-type-options">
                    <button
                        type="button"
                        className="kiosk-type-button dine-in"
                        data-action="begin"
                        data-value="DINE_IN"
                        onClick={() => onHome?.("DINE_IN")}
                    >
                        <svg
                            className="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2" />
                        </svg>
                        <strong>매장</strong>
                        <span>매장에서 드시기</span>
                    </button>
                    <button
                        type="button"
                        className="kiosk-type-button take-out"
                        data-action="begin"
                        data-value="TAKEOUT"
                        onClick={() => onHome?.("TAKEOUT")}
                    >
                        <svg
                            className="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M5 7h14l1 14H4L5 7Zm4 1V6a3 3 0 0 1 6 0v2" />
                        </svg>
                        <strong>포장</strong>
                        <span>가지고 가기</span>
                    </button>
                </div>
                <p className="kiosk-start-instruction">
                    주문 방법을 선택해 주세요
                </p>
            </section>
        </main>
    )

    const renderDefaultCategoryTabs = () => (
        <nav className="category-tabs" aria-label="메뉴 카테고리">
            <div className="category-tab-list">
                {["전체 메뉴", "커피", "논커피", "프라페", "베이커리"].map(
                    (c, i) => (
                        <button
                            key={c}
                            type="button"
                            className={`category-tab${
                                i === 0 ? " active" : ""
                            }`}
                            aria-pressed={i === 0}
                        >
                            <span>{c}</span>
                        </button>
                    )
                )}
            </div>
            <div className="kiosk-tools">
                <div
                    className="font-control"
                    role="group"
                    aria-label="글자 크기"
                >
                    {["일반", "큰글씨", "최대"].map((label, idx) => (
                        <button
                            key={label}
                            type="button"
                            className={`font-button${
                                font === idx ? " active" : ""
                            }`}
                            aria-pressed={font === idx}
                            onClick={() => onFont?.(idx)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    )

    const renderDefaultMainPanel = () => (
        <section className="kiosk-catalogue">
            <div className="product-grid" data-page-size="6">
                {[
                    { name: "아메리카노", price: "3,000원", temp: "HOT / ICE" },
                    {
                        name: "바닐라 크림 라떼",
                        price: "4,900원",
                        temp: "HOT / ICE",
                    },
                    { name: "카페 라떼", price: "4,200원", temp: "HOT / ICE" },
                    {
                        name: "제주 말차 라떼",
                        price: "5,200원",
                        temp: "HOT / ICE",
                    },
                    { name: "생딸기 케이크", price: "6,500원", temp: "BAKERY" },
                    { name: "버터 크루아상", price: "3,800원", temp: "BAKERY" },
                ].map((item) => (
                    <div key={item.name} className="product-card">
                        <div className="product-visual">
                            <span
                                className="product-sample-icon"
                                aria-hidden="true"
                            >
                                ☕
                            </span>
                            <span className="temperature">{item.temp}</span>
                        </div>
                        <div className="product-info">
                            <h3>{item.name}</h3>
                            <div className="product-bottom">
                                <strong>{item.price}</strong>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <nav className="menu-pagination" aria-label="메뉴 페이지">
                <button type="button" className="page-button" disabled>
                    이전
                </button>
                <span>
                    <strong>1</strong> / 2
                </span>
                <button type="button" className="page-button">
                    다음
                </button>
            </nav>
        </section>
    )

    const renderDefaultOrderDock = () => (
        <section
            className="order-dock compact-order-dock"
            aria-label="선택한 메뉴와 결제"
        >
            <div className="selected-menu-tray">
                <div className="tray-items">
                    <div className="tray-placeholder">
                        <span>선택한 메뉴가 여기에 담깁니다</span>
                    </div>
                </div>
            </div>
            <div className="dock-payment-summary">
                <div className="dock-amount">
                    <span>총 결제 금액</span>
                    <strong>0원</strong>
                </div>
                <button type="button" className="dock-cancel" disabled>
                    전체 취소
                </button>
            </div>
            <button type="button" className="dock-pay" disabled>
                <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4 7V5l13-3v5M3 7h17v14H3V7Z" />
                    <path d="M16 12h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
                </svg>
                <span>결제하기</span>
            </button>
        </section>
    )

    return (
        <div
            id="app"
            className="app-layout"
            data-page={page}
            data-screen={page}
        >
            <a href="#main" className="skip-link">
                주문 화면으로 바로 가기
            </a>

            {/* ── 1. start 화면 ── */}
            {isStart && (startSlot || children || renderDefaultStart())}

            {/* ── 2. start 제외 화면: 헤더 + 스텝바 공통 ── */}
            {!isStart && (
                <>
                    <KioskHeader
                        onHome={onHome}
                        elapsed={activeElapsed}
                        showHome={true}
                        language="한국어"
                    />
                    <StepBar
                        currentStep={stepNumber}
                        isCheckoutOpen={isCheckoutOpen}
                    />

                    {/* 완료 화면 */}
                    {isComplete ? (
                        completeSlot || children
                    ) : (
                        /* 일반 주문 화면: 카테고리 레일 + 메인 패널 + 하단 독 그리드 */
                        <div className="workspace">
                            {categoryTabsSlot || renderDefaultCategoryTabs()}

                            <main id="main" className="main-panel">
                                {mainSlot ||
                                    children ||
                                    renderDefaultMainPanel()}
                            </main>

                            {orderDockSlot || renderDefaultOrderDock()}
                        </div>
                    )}
                </>
            )}

            {/* ── 전역 레이어 ── */}
            <Toast
                message={toastProps?.message || ""}
                visible={toastProps?.visible || false}
            />

            <Overlay
                visible={overlayProps?.visible || false}
                onClose={overlayProps?.onClose}
            >
                {overlayProps?.children}
            </Overlay>
        </div>
    )
}

export default AppLayout

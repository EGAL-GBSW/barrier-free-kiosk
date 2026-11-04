import { useEffect, useRef, useState } from "react"
import "./AppLayout.css"
import KioskHeader from "./KioskHeader"
import StepBar from "./StepBar"
import Toast from "../common/Toast"
import Overlay from "../common/Overlay"
import ConfirmDialog from "../common/ConfirmDialog"
import CategoryTabs from "../menu/CategoryTabs"
import ProductGrid from "../menu/ProductGrid"
import MenuPagination from "../menu/MenuPagination"
import ProductModal from "../menu/ProductModal"
import OrderModeModal from "../order/OrderModeModal"
import VoicePage from "../pages/VoicePage"
import PaymentPage from "../pages/PaymentPage"
import CompletePage from "../pages/CompletePage"
import { useVoiceOrder } from "../voice/useVoiceOrder"
import {
    MENUS,
    CATEGORIES,
    money,
    total,
    optionsText,
    lineKey,
} from "../menu/menuData"

/**
 * AppLayout
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css의 전체 레이아웃 구조를 React로 재현합니다.
 *
 * 화면별 구성:
 *  1. start 화면:
 *     - 헤더/스텝바 없이 전체 화면 프로모션 및 매장/포장 선택
 *     - startSlot 전달 시 해당 슬롯 렌더링, 미전달 시 레퍼런스 기반 기본 시작 화면(renderDefaultStart) 표시
 *     - 매장/포장 선택 시 OrderModeModal을 통해 음성 주문/터치 주문 분기 지원
 *  2. complete 화면:
 *     - KioskHeader (66px) + StepBar (66px, 5단계 활성)
 *     - completeSlot 렌더링 (단일 페이지 flex 레이아웃)
 *  3. menu / voice / cart / payment 화면:
 *     - KioskHeader (66px) + StepBar (66px)
 *     - .workspace (2열 2행 그리드):
 *       [col 1, row 1] 카테고리 레일 (CategoryTabs: 터치/음성 모드 전환 및 글자 크기 제어)
 *       [col 2, row 1] 메인 패널 (터치 카탈로그 ProductGrid 또는 VoicePage 음성 주문 화면)
 *       [col 1/-1, row 2] 하단 독 (orderDockSlot 또는 기본 주문 독)
 *  4. payment 화면 (레퍼런스 openTossCheckout):
 *     - 하단 "결제하기" → 전체 화면 PaymentPage (왼쪽 주문 내역 + 오른쪽 토스 결제 수단)
 *     - "이전으로" → 결제하기를 눌렀던 화면으로 복귀, "N원 결제하기" → onCheckout 호출
 *
 * Props:
 *   page             {string}    현재 페이지 키 ('start'|'menu'|'voice'|'cart'|'payment'|'complete')
 *   currentStep      {number}    StepBar 활성 단계 (1~5)
 *   onHome           {Function}  홈 ("처음으로") 버튼 클릭 핸들러
 *   elapsed          {string}    경과 시간 "MM:SS" (생략 시 주문 시작 후 자동 카운트)
 *   font             {number}    글자 크기 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont           {Function}  글자 크기 변경 핸들러
 *   isCheckoutOpen   {boolean}   토스 결제 모달 오픈 여부 (StepBar 스타일 제어)
 *   onCheckout       {Function}  주문 확인 후 결제 진행 ({ cart, orderType }) => void
 *   toast           {object}    { message: string, visible: boolean }
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
    onCheckout,
    toast: toastProps = { message: "", visible: false },
    overlay: overlayProps = { visible: false },
    startSlot,
    categoryTabsSlot,
    mainSlot,
    orderDockSlot,
    completeSlot,
    children,
}) {
    // 모드 및 페이지 상태 관리
    const [internalMode, setInternalMode] = useState("touch")
    const [pageOverride, setPageOverride] = useState(null)
    const [prevPropPage, setPrevPropPage] = useState(page)
    const [showOrderModeModal, setShowOrderModeModal] = useState(false)
    const [orderType, setOrderType] = useState("DINE_IN")

    // 메뉴 탐색 및 장바구니 상태 관리
    const [activeCategory, setActiveCategory] = useState("all")
    const [menuPage, setMenuPage] = useState(0)
    const [cart, setCart] = useState([])
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [editingIndex, setEditingIndex] = useState(null)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [checkoutReturnPage, setCheckoutReturnPage] = useState("menu")
    const [receipt, setReceipt] = useState(null)
    const receiptSequence = useRef(0)
    const [internalToast, setInternalToast] = useState({
        message: "",
        visible: false,
    })

    if (prevPropPage !== page) {
        setPrevPropPage(page)
        setPageOverride(null)
    }

    const activePage = pageOverride || page
    const isStart = activePage === "start"
    const isComplete = activePage === "complete"

    const setInternalPage = (next) => {
        setPageOverride(next)
    }

    // 폰트 및 화면 데이터 속성 동기화
    useEffect(() => {
        const fontNames = ["normal", "large", "max"]
        document.documentElement.dataset.font = fontNames[font] || "normal"
        document.documentElement.dataset.screen = activePage
    }, [font, activePage])

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
    const STEP_BY_PAGE = { payment: 4, complete: 5 }
    const stepNumber = STEP_BY_PAGE[activePage] ?? currentStep

    const showToast = (message) => {
        setInternalToast({ message, visible: true })
        setTimeout(() => {
            setInternalToast({ message: "", visible: false })
        }, 2500)
    }

    const handleAddToCart = (product, options) => {
        const key = lineKey(product.id, options)
        setCart((prevCart) => {
            const existingIdx = prevCart.findIndex((line) => line.key === key)
            if (existingIdx >= 0) {
                const next = [...prevCart]
                next[existingIdx] = {
                    ...next[existingIdx],
                    quantity: Math.min(
                        99,
                        next[existingIdx].quantity + options.quantity
                    ),
                }
                return next
            }
            return [...prevCart, { ...options, id: product.id, key }]
        })
        showToast(`${product.name} ${options.quantity}개를 담았어요.`)
    }

    // 옵션 변경: 같은 옵션 항목이 있으면 합치고, 없으면 제자리에서 교체
    const handleEditLine = (index, product, options) => {
        const key = lineKey(product.id, options)
        setCart((prev) => {
            const rest = prev.filter((_, i) => i !== index)
            const existingIdx = rest.findIndex((line) => line.key === key)
            if (existingIdx >= 0) {
                rest[existingIdx] = {
                    ...rest[existingIdx],
                    quantity: Math.min(
                        99,
                        rest[existingIdx].quantity + options.quantity
                    ),
                }
                return rest
            }
            const next = [...prev]
            next[index] = { ...options, id: product.id, key }
            return next
        })
        showToast(`${product.name} ${options.quantity}개로 변경했어요.`)
    }

    const openEditLine = (index) => {
        const m = MENUS.find((menu) => menu.id === cart[index]?.id)
        if (!m) return
        setEditingIndex(index)
        setSelectedProduct(m)
    }

    const closeProductModal = () => {
        setSelectedProduct(null)
        setEditingIndex(null)
    }

    // ── 음성 주문 Web Speech API 훅 연동 ──
    const voiceOrder = useVoiceOrder({
        currentPage: activePage,
        onAddToCart: handleAddToCart,
        onToast: showToast,
    })

    // 폰트 단계 및 카테고리에 따른 메뉴 필터링 및 페이징 계산
    const pageSize = font === 2 ? 2 : 6
    const filteredProducts =
        activeCategory === "all"
            ? MENUS
            : MENUS.filter((m) => m.category === activeCategory)
    const totalPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / pageSize)
    )
    const safePage = Math.min(menuPage, totalPages - 1)
    const visibleProducts = filteredProducts.slice(
        safePage * pageSize,
        (safePage + 1) * pageSize
    )

    const handleSelectCategory = (catId) => {
        setActiveCategory(catId)
        setMenuPage(0)
    }

    const handlePageChange = (newPage) => {
        setMenuPage(Math.max(0, Math.min(totalPages - 1, newPage)))
    }

    const handleRemoveFromCart = (index) => {
        setCart((prev) => {
            const item = prev[index]
            const m = MENUS.find((menu) => menu.id === item?.id)
            if (m) showToast(`${m.name}를 삭제했어요.`)
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleCartQty = (index, delta) => {
        setCart((prev) => {
            const next = [...prev]
            const current = next[index]
            if (!current) return prev
            const newQty = current.quantity + delta
            if (newQty < 1 || newQty > 99) return prev
            next[index] = { ...current, quantity: newQty }
            return next
        })
    }

    const handleClearCart = () => {
        setShowClearConfirm(false)
        setCart([])
        showToast("선택한 메뉴를 모두 취소했어요.")
    }

    // 하단 "결제하기": 레퍼런스 openTossCheckout처럼 전체 화면 결제(주문 내역 + 결제 수단)로 이동
    const handleDockPay = () => {
        if (!cart.length) return
        voiceOrder.stopListening()
        setCheckoutReturnPage(activePage)
        setInternalPage("payment")
    }

    const handleCheckoutBack = () => {
        setInternalPage(checkoutReturnPage)
    }

    const handleCheckout = (widgets) => {
        if (onCheckout) {
            onCheckout({ cart, orderType, widgets })
            return
        }
        // TODO: 백엔드 결제 승인(/payments/confirm) 연동 전까지 임시로 바로 결제 완료 처리
        receiptSequence.current += 1
        setReceipt({
            number: String(receiptSequence.current).padStart(3, "0"),
            cart: cart.map((line) => ({ ...line })),
            total: total(cart),
            type: orderType,
            method: "테스트 결제",
            approved: false,
        })
        setInternalPage("complete")
    }

    // 결제 완료 후 "새로운 주문 시작하기": 주문 상태 초기화 후 시작 화면으로
    const handleNewOrder = () => {
        setCart([])
        setReceipt(null)
        setOrderType("DINE_IN")
        setActiveCategory("all")
        setMenuPage(0)
        handleHomeNavigation()
    }

    // 시작 화면 매장/포장 클릭 시 모드 선택 모달 표시
    const handleBeginOrder = (type) => {
        setOrderType(type)
        setShowOrderModeModal(true)
    }

    const handleOrderModeSelect = (selectedMode) => {
        setShowOrderModeModal(false)
        setInternalMode(selectedMode)
        if (selectedMode === "voice") {
            setInternalPage("voice")
            voiceOrder.toggleListen()
        } else {
            setInternalPage("menu")
        }
        onHome?.(orderType, selectedMode)
    }

    const handleHomeNavigation = () => {
        voiceOrder.stopListening()
        setInternalPage("start")
        setInternalMode("touch")
        onHome?.("start")
    }

    // 기본 시작 화면
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
                        onClick={() => handleBeginOrder("DINE_IN")}
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
                        onClick={() => handleBeginOrder("TAKEOUT")}
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

    // 기본 카테고리 탭 (CategoryTabs 컴포넌트 연동)
    const renderDefaultCategoryTabs = () => (
        <CategoryTabs
            categories={CATEGORIES}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            font={font}
            onFont={onFont}
        />
    )

    // 기본 메인 패널 (터치 카탈로그 또는 VoicePage 음성 주문 화면 렌더링)
    const renderDefaultMainPanel = () => {
        if (activePage === "voice") {
            return (
                <VoicePage
                    products={visibleProducts}
                    pageSize={pageSize}
                    currentPage={safePage + 1}
                    totalPages={totalPages}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                    onPageChange={(p) => handlePageChange(p - 1)}
                    listening={voiceOrder.listening}
                    speechStatus={voiceOrder.speechStatus}
                    onToggleListen={voiceOrder.toggleListen}
                />
            )
        }

        return (
            <section className="kiosk-catalogue">
                <ProductGrid
                    products={visibleProducts}
                    pageSize={pageSize}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                />
                <MenuPagination
                    currentPage={safePage + 1}
                    totalPages={totalPages}
                    onPrev={() => handlePageChange(safePage - 1)}
                    onNext={() => handlePageChange(safePage + 1)}
                    onPageChange={(p) => handlePageChange(p - 1)}
                />
            </section>
        )
    }

    // 기본 주문 독 (선택 메뉴 트레이 + 결제 요약)
    const renderDefaultOrderDock = () => {
        const dockPageSize = 3
        const dockLines = cart.slice(0, dockPageSize)
        const cartTotal = total(cart)

        return (
            <section
                className="order-dock compact-order-dock"
                aria-label="선택한 메뉴와 결제"
            >
                <div className="selected-menu-tray">
                    <div className="tray-items">
                        {cart.length === 0 ? (
                            <div className="tray-placeholder">
                                <span>선택한 메뉴가 여기에 담깁니다</span>
                            </div>
                        ) : (
                            dockLines.map((line, idx) => {
                                const m = MENUS.find(
                                    (menu) => menu.id === line.id
                                )
                                if (!m) return null
                                return (
                                    <article
                                        key={line.key || idx}
                                        className="tray-item"
                                        aria-label={`${m.name} ${optionsText(
                                            line
                                        )}`}
                                    >
                                        <button
                                            type="button"
                                            className="tray-product"
                                            onClick={() => openEditLine(idx)}
                                            aria-label={`${
                                                m.name
                                            } ${optionsText(line)} 옵션 변경`}
                                        >
                                            <div
                                                className={`product-photo photo-${m.id}`}
                                                role="img"
                                                aria-label={m.name}
                                            />
                                            <span>{m.name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="tray-remove"
                                            onClick={() =>
                                                handleRemoveFromCart(idx)
                                            }
                                            aria-label={`${m.name} 삭제`}
                                        >
                                            <svg
                                                className="icon"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="m6 6 12 12M6 18 18 6" />
                                            </svg>
                                        </button>
                                        <div className="quantity">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleCartQty(idx, -1)
                                                }
                                                disabled={line.quantity <= 1}
                                                aria-label={`${m.name} 수량 줄이기`}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    width="16"
                                                    height="16"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M5 12h14" />
                                                </svg>
                                            </button>
                                            <strong
                                                aria-label={`수량 ${line.quantity}`}
                                            >
                                                {line.quantity}
                                            </strong>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleCartQty(idx, 1)
                                                }
                                                disabled={line.quantity >= 99}
                                                aria-label={`${m.name} 수량 늘리기`}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    width="16"
                                                    height="16"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M12 5v14M5 12h14" />
                                                </svg>
                                            </button>
                                        </div>
                                    </article>
                                )
                            })
                        )}
                    </div>
                </div>
                <div className="dock-payment-summary">
                    <div className="dock-amount">
                        <span>총 결제 금액</span>
                        <strong aria-live="polite">{money(cartTotal)}</strong>
                    </div>
                    <button
                        type="button"
                        className="dock-cancel"
                        disabled={cart.length === 0}
                        onClick={() => setShowClearConfirm(true)}
                    >
                        전체 취소
                    </button>
                </div>
                <button
                    type="button"
                    className="dock-pay"
                    disabled={cart.length === 0}
                    onClick={handleDockPay}
                >
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
    }

    const activeToast = toastProps.visible ? toastProps : internalToast

    return (
        <div
            id="app"
            className="app-layout"
            data-page={activePage}
            data-screen={activePage}
        >
            <a href="#main" className="skip-link">
                주문 화면으로 바로 가기
            </a>

            {/* ── 1. start 화면 ── */}
            {isStart && (startSlot || children || renderDefaultStart())}

            {/* ── 결제 화면: 주문 내역 확인 + 결제 수단 (전체 화면, 자체 상단바·스텝바) ── */}
            {activePage === "payment" && (
                <PaymentPage
                    cart={cart}
                    orderType={orderType}
                    onBack={handleCheckoutBack}
                    onPay={handleCheckout}
                />
            )}

            {/* ── 2. start·payment 제외 화면: 헤더 + 스텝바 공통 ── */}
            {!isStart && activePage !== "payment" && (
                <>
                    <KioskHeader
                        onHome={
                            isComplete ? handleNewOrder : handleHomeNavigation
                        }
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
                        completeSlot ||
                        children || (
                            <CompletePage
                                receipt={receipt}
                                onNewOrder={handleNewOrder}
                            />
                        )
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

            {/* ── 주문 방식(음성/터치) 선택 모달 ── */}
            <OrderModeModal
                isOpen={showOrderModeModal}
                onClose={() => setShowOrderModeModal(false)}
                onSelect={handleOrderModeSelect}
            />

            {/* ── 상품 옵션 선택 모달 ── */}
            <ProductModal
                key={`${selectedProduct?.id}:${editingIndex}`}
                product={selectedProduct}
                isOpen={Boolean(selectedProduct)}
                onClose={closeProductModal}
                editOptions={
                    editingIndex !== null ? cart[editingIndex] : null
                }
                onAddToCart={(product, options) =>
                    editingIndex !== null
                        ? handleEditLine(editingIndex, product, options)
                        : handleAddToCart(product, options)
                }
            />

            {/* ── 전체 취소 확인 ── */}
            <ConfirmDialog
                isOpen={showClearConfirm}
                title="선택한 메뉴를 모두 취소할까요?"
                description="선택한 메뉴가 모두 삭제됩니다."
                confirmLabel="전체 취소"
                onConfirm={handleClearCart}
                onCancel={() => setShowClearConfirm(false)}
            />

            {/* ── 전역 레이어 ── */}
            <Toast
                message={activeToast?.message || ""}
                visible={activeToast?.visible || false}
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

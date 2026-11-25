import { useEffect, useRef, useState } from "react"
import "./AppLayout.css"
import { createOrder } from "../../api/client"
import toReceipt from "../payment/toReceipt"
import KioskHeader from "./KioskHeader"
import StepBar from "./StepBar"
import Toast from "../common/Toast"
import Overlay from "../common/Overlay"
import ConfirmDialog from "../common/ConfirmDialog"
import CategoryTabs from "../menu/CategoryTabs"
import ProductGrid from "../menu/ProductGrid"
import MenuPagination from "../menu/MenuPagination"
import ProductModal from "../menu/ProductModal"
import VoicePage from "../pages/VoicePage"
import PaymentPage from "../pages/PaymentPage"
import CompletePage from "../pages/CompletePage"
import { useVoiceOrder } from "../voice/useVoiceOrder"
import { useAiVoiceOrder } from "../voice/useAiVoiceOrder"
import VoiceStartNotice from "../voice/VoiceStartNotice"
import { useI18n } from "../../i18n/context"
import {
    MENUS,
    CATEGORIES,
    findMenu,
    total,
    lineKey,
} from "../menu/menuData"

const useTeamAi = import.meta.env.VITE_VOICE_MODE === "ai"

/**
 * AppLayout
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css의 전체 레이아웃 구조를 React로 재현합니다.
 *
 * 화면별 구성:
 *  1. start 화면:
 *     - 헤더/스텝바 없이 전체 화면 프로모션 및 매장/포장 선택
 *     - startSlot 전달 시 해당 슬롯 렌더링, 미전달 시 레퍼런스 기반 기본 시작 화면(renderDefaultStart) 표시
 *     - 매장/포장 선택 시 바로 메뉴 화면으로 이동 (터치·음성 주문 모두 메뉴 화면에서 사용)
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
 *   language         {string}    화면 언어 코드 ('ko'|'en'|'ja')
 *   onLanguage       {Function}  언어 변경 핸들러
 *   isCheckoutOpen   {boolean}   토스 결제 모달 오픈 여부 (StepBar 스타일 제어)
 *   onCheckout       {Function}  주문 확인 후 결제 진행 ({ cart, orderType, widgets }) => Promise | void
 *                                실패 시 error.message를 오류 안내 팝업으로 표시
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
    language = "ko",
    onLanguage,
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
    const { t, money, menu, options: optionsText } = useI18n()

    // 모드 및 페이지 상태 관리
    const [pageOverride, setPageOverride] = useState(null)
    const [prevPropPage, setPrevPropPage] = useState(page)
    const [orderType, setOrderType] = useState("DINE_IN")
    const [orderMode, setOrderMode] = useState("touch")
    const [voiceNoticeKey, setVoiceNoticeKey] = useState(0)

    // 메뉴 탐색 및 장바구니 상태 관리
    const [activeCategory, setActiveCategory] = useState("all")
    const [menuPage, setMenuPage] = useState(0)
    const [cart, setCart] = useState([])
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [editingIndex, setEditingIndex] = useState(null)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [showHomeConfirm, setShowHomeConfirm] = useState(false)
    const [checkoutReturnPage, setCheckoutReturnPage] = useState("menu")
    const [receipt, setReceipt] = useState(null)
    const [checkoutBusy, setCheckoutBusy] = useState(false)
    const [checkoutError, setCheckoutError] = useState("")
    const checkoutLock = useRef(false)
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

    // 화면 언어를 <html lang>에 반영 (스크린리더 발음·브라우저 음성 처리 기준)
    useEffect(() => {
        document.documentElement.lang = language
    }, [language])

    // 경과 시간: 시작 시각만 보관하고, 매초 갱신은 헤더의 ElapsedClock이 담당
    // (결제 화면에서 헤더가 사라졌다 돌아와도 같은 시작 시각 기준으로 이어서 표시)
    const [orderStartedAt, setOrderStartedAt] = useState(null)

    const STEP_BY_PAGE = { payment: 4, complete: 5 }
    const stepNumber = STEP_BY_PAGE[activePage] ?? currentStep

    // 새 토스트를 띄우기 전에 이전 숨김 타이머를 취소해, 마지막 알림이 항상 2.5초간 보이도록 함
    const toastTimer = useRef(null)
    useEffect(() => () => clearTimeout(toastTimer.current), [])

    const showToast = (message) => {
        clearTimeout(toastTimer.current)
        setInternalToast({ message, visible: true })
        toastTimer.current = setTimeout(() => {
            toastTimer.current = null
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
        showToast(t("toast.added", { name: menu(product).name, n: options.quantity }))
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
        showToast(t("toast.changed", { name: menu(product).name, n: options.quantity }))
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

    // ── AI 추천 카테고리 ──
    // 음성 발화에서 찾은 조건(따뜻한, 달달한 등)에 맞는 메뉴 목록. 형식은 menu/recommendation.js 참고
    const [recommendation, setRecommendation] = useState(null)
    const handleRecommend = (next) => {
        setRecommendation(next)
        setActiveCategory("ai")
        setMenuPage(0)
        showToast(t(next.menuIds.length ? "ai.found" : "ai.noMatch"))
    }

    // ── 음성 주문 Web Speech API 훅 연동 ──
    const browserVoiceOrder = useVoiceOrder({
        currentPage: activePage,
        onAddToCart: handleAddToCart,
        onToast: showToast,
        onRecommend: handleRecommend,
    })
    const aiVoiceOrder = useAiVoiceOrder({
        cart,
        orderType,
        onRecommend: handleRecommend,
        onConfirmOrder: async (quote) => {
            if (checkoutLock.current) throw new Error(t("dialog.alreadyProcessing"))
            if (onCheckout) {
                setCart(quote.cart)
                setCheckoutReturnPage(activePage)
                setInternalPage("payment")
                return
            }
            checkoutLock.current = true
            try {
                const order = await createOrder(quote.orderType, quote.cart, quote.amount)
                setReceipt(toReceipt(order))
                setInternalPage("complete")
            } finally {
                checkoutLock.current = false
            }
        },
    })
    const voiceOrder = useTeamAi ? aiVoiceOrder : browserVoiceOrder

    // 폰트 단계 및 카테고리에 따른 메뉴 필터링 및 페이징 계산
    const pageSize = font === 2 ? 2 : 6
    const filteredProducts =
        activeCategory === "ai"
            ? recommendation
                ? recommendation.menuIds.map(findMenu).filter(Boolean)
                : MENUS // 추천 전에는 전체 메뉴를 보여줌
            : activeCategory === "all"
              ? MENUS
              : MENUS.filter((m) => m.category === activeCategory)

    // AI 추천 탭 안내 문구 (추천 전 / 결과 없음 / 추천 조건)
    const aiNotice =
        activeCategory !== "ai"
            ? ""
            : !recommendation
              ? t("ai.empty")
              : !recommendation.menuIds.length
                ? t("ai.noMatch")
                : recommendation.keywords.length
                  ? t("ai.banner", { keywords: recommendation.keywords.join(", ") })
                  : t("ai.bannerPlain")
    const totalPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / pageSize)
    )
    const safePage = Math.min(menuPage, totalPages - 1)
    const visibleProducts = filteredProducts.slice(
        safePage * pageSize,
        (safePage + 1) * pageSize
    )

    // 왼쪽 탭의 터치/음성 주문 전환
    // 음성 주문: 음성 인식 시작 + 화면 중앙에 "음성 주문이 시작되었습니다." 안내
    const handleOrderMode = (mode) => {
        if (aiVoiceOrder.confirming) return
        setOrderMode(mode)
        if (mode === "touch") {
            voiceOrder.stopListening()
            return
        }
        if (useTeamAi) {
            voiceOrder.toggleListen()
            return
        }
        const supported =
            window.SpeechRecognition || window.webkitSpeechRecognition
        if (!voiceOrder.listening) voiceOrder.toggleListen()
        if (supported) setVoiceNoticeKey((k) => k + 1)
    }

    const handleSelectCategory = (catId) => {
        setActiveCategory(catId)
        setMenuPage(0)
        // AI 추천은 음성 발화로 시작되므로, 탭을 누르면 바로 음성 주문을 시작 (이미 듣는 중이면 그대로)
        if (catId === "ai" && (orderMode !== "voice" || !voiceOrder.listening)) {
            handleOrderMode("voice")
        }
    }

    const handlePageChange = (newPage) => {
        setMenuPage(Math.max(0, Math.min(totalPages - 1, newPage)))
    }

    const handleRemoveFromCart = (index) => {
        setCart((prev) => {
            const item = prev[index]
            const m = MENUS.find((menu) => menu.id === item?.id)
            if (m) showToast(t("toast.removed", { name: menu(m).name }))
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
        showToast(t("toast.cleared"))
    }

    // 하단 "결제하기": 레퍼런스 openTossCheckout처럼 전체 화면 결제(주문 내역 + 결제 수단)로 이동
    const handleDockPay = () => {
        if (!cart.length || checkoutLock.current) return
        voiceOrder.stopListening()
        setCheckoutReturnPage(activePage)
        setInternalPage("payment")
    }

    const handleCheckoutBack = () => {
        setInternalPage(checkoutReturnPage)
    }

    const handleCheckout = async (widgets) => {
        if (checkoutLock.current || !cart.length) return
        checkoutLock.current = true
        setCheckoutBusy(true)
        setCheckoutError("")
        try {
            if (onCheckout) {
                await onCheckout({ cart, orderType, widgets })
            } else {
                const order = await createOrder(orderType, cart)
                setReceipt(toReceipt(order))
                setInternalPage("complete")
            }
        } catch (error) {
            setCheckoutError(error.message || t("dialog.errorFallback"))
        } finally {
            checkoutLock.current = false
            setCheckoutBusy(false)
        }
    }

    // 헤더 "처음으로": 결제 완료 화면은 바로, 그 외 화면은 확인 팝업 후 초기화
    const handleHomeRequest = () => {
        if (checkoutLock.current) return
        if (isComplete) {
            handleNewOrder()
            return
        }
        voiceOrder.stopListening()
        setShowHomeConfirm(true)
    }

    // "새로운 주문 시작하기" / "처음으로" 확인: 담은 메뉴 등 주문 상태 초기화 후 시작 화면으로
    const handleNewOrder = () => {
        setShowHomeConfirm(false)
        setCart([])
        setReceipt(null)
        setOrderType("DINE_IN")
        setOrderMode("touch")
        setVoiceNoticeKey(0)
        setActiveCategory("all")
        setRecommendation(null)
        setMenuPage(0)
        handleHomeNavigation()
    }

    // 시작 화면 매장/포장 클릭 시 바로 메뉴 화면으로 이동 (음성 주문은 메뉴 화면에서 바로 사용)
    const handleBeginOrder = (type) => {
        setOrderType(type)
        setOrderStartedAt(Date.now())
        setInternalPage("menu")
        onHome?.(type, "touch")
    }

    const handleHomeNavigation = () => {
        voiceOrder.stopListening()
        setOrderStartedAt(null)
        setInternalPage("start")
        onHome?.("start")
    }

    // 기본 시작 화면
    const renderDefaultStart = () => (
        <main id="main" className="kiosk-start">
            <section
                className="kiosk-promo photo-only-promo"
                aria-label={t("start.promoAria")}
            >
                <img
                    className="start-editorial-photo"
                    src="/StartPage.png"
                    alt={t("start.photoAlt")}
                />
                <div className="start-campaign-copy">
                    <p>{t("start.lead")}</p>
                    <h1>
                        {t("start.title1")}
                        <br />
                        {t("start.title2")}
                    </h1>
                </div>
            </section>
            <section className="kiosk-entry" aria-label={t("start.entryAria")}>
                <div className="entry-logo">
                    <span className="wordmark">
                        mog<span className="brand-dot">.</span>
                    </span>
                    <span>{t("start.brand")}</span>
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
                        <strong>{t("start.dineIn")}</strong>
                        <span>{t("start.dineInDesc")}</span>
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
                        <strong>{t("start.takeout")}</strong>
                        <span>{t("start.takeoutDesc")}</span>
                    </button>
                </div>
                <p className="kiosk-start-instruction">
                    {t("start.instruction")}
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
            orderMode={orderMode}
            onOrderMode={handleOrderMode}
        />
    )

    // 기본 메인 패널 (터치 카탈로그 또는 VoicePage 음성 주문 화면 렌더링)
    const renderDefaultMainPanel = () => {
        if (activePage === "menu" || activePage === "voice") {
            return (
                <VoicePage
                    products={visibleProducts}
                    pageSize={pageSize}
                    currentPage={safePage + 1}
                    totalPages={totalPages}
                    onSelectProduct={(p) => { voiceOrder.stopListening(); setSelectedProduct(p) }}
                    onPageChange={(p) => handlePageChange(p - 1)}
                    /* 터치 주문으로 바꾸면 음성 안내 문구를 숨김 (음성 주문으로 돌아오면 새 안내가 표시됨) */
                    speechStatus={orderMode === "voice" ? voiceOrder.speechStatus : ""}
                    notice={aiNotice}
                    draft={useTeamAi ? aiVoiceOrder.draft : ""}
                    pendingQuote={useTeamAi ? aiVoiceOrder.pending : null}
                    onConfirmQuote={aiVoiceOrder.confirmPending}
                    confirmingQuote={aiVoiceOrder.confirming}
                    voiceProgress={useTeamAi ? {
                        phase: aiVoiceOrder.phase,
                        transcript: aiVoiceOrder.transcript,
                        listening: aiVoiceOrder.listening,
                        onRetry: aiVoiceOrder.toggleListen,
                        onClose: () => handleOrderMode("touch"),
                    } : null}
                />
            )
        }

        return (
            <section className="kiosk-catalogue">
                <MenuPagination
                    currentPage={safePage + 1}
                    totalPages={totalPages}
                    onPageChange={(p) => handlePageChange(p - 1)}
                >
                    <ProductGrid
                        products={visibleProducts}
                        pageSize={pageSize}
                        onSelectProduct={(p) => setSelectedProduct(p)}
                    />
                </MenuPagination>
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
                aria-label={t("dock.aria")}
            >
                <div className="selected-menu-tray">
                    <div className="tray-items">
                        {cart.length === 0 ? (
                            <div className="tray-placeholder">
                                <span>{t("dock.placeholder")}</span>
                            </div>
                        ) : (
                            dockLines.map((line, idx) => {
                                const m = MENUS.find(
                                    (menu) => menu.id === line.id
                                )
                                if (!m) return null
                                const name = menu(m).name
                                const itemLabel = `${name} ${optionsText(line)}`
                                return (
                                    <article
                                        key={line.key || idx}
                                        className="tray-item"
                                        aria-label={itemLabel}
                                    >
                                        <button
                                            type="button"
                                            className="tray-product"
                                            onClick={() => openEditLine(idx)}
                                            aria-label={t("dock.editAria", { item: itemLabel })}
                                        >
                                            <div
                                                className={`product-photo photo-${m.id}`}
                                                role="img"
                                                aria-label={name}
                                            />
                                            <span>{name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="tray-remove"
                                            onClick={() =>
                                                handleRemoveFromCart(idx)
                                            }
                                            aria-label={t("dock.removeAria", { name })}
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
                                                aria-label={t("dock.decreaseAria", { name })}
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
                                                aria-label={t("dock.quantityAria", { n: line.quantity })}
                                            >
                                                {line.quantity}
                                            </strong>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleCartQty(idx, 1)
                                                }
                                                disabled={line.quantity >= 99}
                                                aria-label={t("dock.increaseAria", { name })}
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
                        <span>{t(onCheckout ? "dock.totalPay" : "dock.totalOrder")}</span>
                        <strong aria-live="polite">{money(cartTotal)}</strong>
                    </div>
                    <button
                        type="button"
                        className="dock-cancel"
                        disabled={cart.length === 0}
                        onClick={() => setShowClearConfirm(true)}
                    >
                        {t("dock.clearAll")}
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
                    <span>{t(onCheckout ? "dock.pay" : "dock.review")}</span>
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
                {t("common.skipLink")}
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
                    busy={checkoutBusy}
                    demo={!onCheckout}
                />
            )}

            {/* ── 2. start·payment 제외 화면: 헤더 + 스텝바 공통 ── */}
            {!isStart && activePage !== "payment" && (
                <>
                    <KioskHeader
                        onHome={handleHomeRequest}
                        elapsed={elapsed}
                        startedAt={orderStartedAt}
                        showHome={true}
                        font={font}
                        onFont={onFont}
                        language={language}
                        onLanguage={onLanguage}
                    />
                    <StepBar
                        demo={!onCheckout && !completeSlot}
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
                        /* 일반 주문 화면: 메인 패널(왼쪽) + 카테고리 레일(오른쪽) + 하단 독 그리드
                           화면 순서와 같도록 메인 패널을 먼저 둬서 키보드·스크린리더 탐색 순서를 맞춤 */
                        <div className="workspace">
                            <main id="main" className="main-panel">
                                {mainSlot ||
                                    children ||
                                    renderDefaultMainPanel()}
                            </main>

                            {categoryTabsSlot || renderDefaultCategoryTabs()}

                            {orderDockSlot || renderDefaultOrderDock()}
                        </div>
                    )}
                </>
            )}

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
                title={t("dialog.clearTitle")}
                description={t("dialog.clearDesc")}
                confirmLabel={t("dock.clearAll")}
                onConfirm={handleClearCart}
                onCancel={() => setShowClearConfirm(false)}
            />

            {/* ── 음성 주문 시작 안내 (크게 띄웠다가 천천히 사라짐) ── */}
            {voiceNoticeKey > 0 && (
                <VoiceStartNotice
                    key={voiceNoticeKey}
                    onDone={() => setVoiceNoticeKey(0)}
                />
            )}

            {/* ── 처음으로 확인 ── */}
            <ConfirmDialog
                isOpen={showHomeConfirm}
                title={t("dialog.homeTitle")}
                description={
                    t(cart.length ? "dialog.homeDescCart" : "dialog.homeDescEmpty")
                }
                confirmLabel={t("header.home")}
                onConfirm={handleNewOrder}
                onCancel={() => setShowHomeConfirm(false)}
            />

            {/* ── 주문·결제 요청 오류 안내 ── */}
            <ConfirmDialog
                isOpen={Boolean(checkoutError)}
                title={t("dialog.errorTitle")}
                description={checkoutError}
                hideCancel
                onConfirm={() => setCheckoutError("")}
                onCancel={() => setCheckoutError("")}
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

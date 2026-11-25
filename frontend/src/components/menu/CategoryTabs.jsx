import "./CategoryTabs.css"
import { CATEGORIES } from "./menuData"
import { useI18n } from "../../i18n/context"

/**
 * CategoryTabs
 * 레퍼런스 ./frontend/app.js (rail 함수) 및 ./frontend/kiosk.css 기준
 * 오른쪽 레일: 메뉴 카테고리 탭 리스트 + AI 추천 탭 + 터치/음성 주문 전환 버튼(하나로 통합).
 * (글자 크기 조절은 상단 헤더 KioskHeader로 이동)
 *
 * Props:
 *   categories       {Array}     카테고리 목록 [{ id, label }]
 *   activeCategory   {string}    현재 선택된 카테고리 id ('all' | 'coffee' | 'noncoffee' | 'frappe' | 'bakery' | 'ai')
 *   onSelectCategory {Function}  카테고리 변경 콜백 (categoryId) => void
 *   orderMode        {string}    현재 주문 방식 ('touch' | 'voice')
 *   onOrderMode      {Function}  주문 방식 변경 콜백 (mode) => void
 */
const ORDER_MODES = [
    {
        id: "touch",
        icon: (
            <path d="M8 12V5a2 2 0 0 1 4 0v6l5 1a3 3 0 0 1 2 3l-1 5H9l-5-7a2 2 0 0 1 3-2l1 1Z" />
        ),
    },
    {
        id: "voice",
        icon: (
            <>
                <rect x="9" y="2" width="6" height="13" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
            </>
        ),
    },
]

function CategoryTabs({
    categories = CATEGORIES,
    activeCategory = "all",
    onSelectCategory,
    orderMode = "touch",
    onOrderMode,
}) {
    const { t } = useI18n()
    const isVoice = orderMode === "voice"
    const nextMode = ORDER_MODES.find((m) => m.id === (isVoice ? "touch" : "voice"))
    const isAiActive = activeCategory === "ai"

    return (
        <nav className="category-tabs" aria-label={t("category.aria")}>
            {/* ── 카테고리 탭 리스트 ── */}
            <div className="category-tab-list">
                {categories.map((c) => {
                    const isActive = activeCategory === c.id
                    return (
                        <button
                            key={c.id}
                            type="button"
                            className={`category-tab${
                                isActive ? " active" : ""
                            }`}
                            data-action="category"
                            data-value={c.id}
                            aria-pressed={isActive}
                            onClick={() => onSelectCategory?.(c.id)}
                        >
                            <span>{t(`category.${c.id}`)}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── 주문 방식 (터치 / 음성): 카테고리와 글자 크기 조절 사이 빈 공간 ── */}
            <div className="order-mode-toggle">
                {/* AI 추천: 음성으로 말한 특징(따뜻한, 달달한 등)에 맞는 메뉴만 모아 보여주는 카테고리 */}
                <button
                    type="button"
                    className={`ai-recommend-tab${isAiActive ? " active" : ""}`}
                    aria-pressed={isAiActive}
                    onClick={() => onSelectCategory?.("ai")}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
                        <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
                    </svg>
                    <span>{t("category.ai")}</span>
                </button>

                {/* 주문 방식 전환: 하나의 버튼이 "바꿀 방식"을 보여줌 (터치 중 → 음성 주문, 음성 중 → 터치 주문) */}
                <button
                    type="button"
                    /* 터치 주문 중에는 "음성 주문" 버튼을 파란색으로 강조해 음성 주문을 눈에 띄게 함 */
                    className={`order-mode-button${isVoice ? "" : " active"}`}
                    aria-label={t("orderMode.switchTo", { mode: t(`orderMode.${nextMode.id}`) })}
                    onClick={() => onOrderMode?.(nextMode.id)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        {nextMode.icon}
                    </svg>
                    <span>{t(`orderMode.${nextMode.id}`)}</span>
                </button>
            </div>
        </nav>
    )
}

export default CategoryTabs

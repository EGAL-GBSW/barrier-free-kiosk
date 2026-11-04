import "./CategoryTabs.css"
import { CATEGORIES } from "./menuData"

/**
 * CategoryTabs
 * 레퍼런스 ./frontend/app.js (rail 함수) 및 ./frontend/kiosk.css 기준
 * 좌측 메뉴 카테고리 탭 리스트와 하단 글자 크기 조절 컨트롤을 제공합니다.
 *
 * Props:
 *   categories       {Array}     카테고리 목록 [{ id, label }]
 *   activeCategory   {string}    현재 선택된 카테고리 id ('all' | 'coffee' | 'noncoffee' | 'frappe' | 'bakery')
 *   onSelectCategory {Function}  카테고리 변경 콜백 (categoryId) => void
 *   font             {number}    글자 크기 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont           {Function}  글자 크기 변경 콜백 (fontIdx) => void
 *   orderMode        {string}    현재 주문 방식 ('touch' | 'voice')
 *   onOrderMode      {Function}  주문 방식 변경 콜백 (mode) => void
 */
const ORDER_MODES = [
    {
        id: "touch",
        label: "터치 주문",
        icon: (
            <path d="M8 12V5a2 2 0 0 1 4 0v6l5 1a3 3 0 0 1 2 3l-1 5H9l-5-7a2 2 0 0 1 3-2l1 1Z" />
        ),
    },
    {
        id: "voice",
        label: "음성 주문",
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
    font = 0,
    onFont,
    orderMode = "touch",
    onOrderMode,
}) {
    const fontLabels = ["일반", "큰글씨", "최대"]

    return (
        <nav className="category-tabs" aria-label="메뉴 카테고리">
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
                            <span>{c.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── 주문 방식 (터치 / 음성): 카테고리와 글자 크기 조절 사이 빈 공간 ── */}
            <div className="order-mode-toggle" role="group" aria-label="주문 방식">
                {ORDER_MODES.map((m) => {
                    const isActive = orderMode === m.id
                    return (
                        <button
                            key={m.id}
                            type="button"
                            className={`order-mode-button${
                                isActive ? " active" : ""
                            }`}
                            aria-pressed={isActive}
                            onClick={() => onOrderMode?.(m.id)}
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
                                {m.icon}
                            </svg>
                            <span>{m.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── 글자 크기 조절 컨트롤 ── */}
            <div className="kiosk-tools">
                <div
                    className="font-control"
                    role="group"
                    aria-label="글자 크기"
                >
                    {fontLabels.map((label, idx) => (
                        <button
                            key={label}
                            type="button"
                            className={`font-button${
                                font === idx ? " active" : ""
                            }`}
                            data-action="font"
                            data-value={idx}
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
}

export default CategoryTabs

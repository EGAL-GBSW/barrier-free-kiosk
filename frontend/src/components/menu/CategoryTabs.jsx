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
 */
function CategoryTabs({
    categories = CATEGORIES,
    activeCategory = "all",
    onSelectCategory,
    font = 0,
    onFont,
}) {
    const fontLabels = ["일반", "큰글씨", "최대"]

    return (
        <nav className="category-tabs" aria-label="메뉴 카테고리">
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

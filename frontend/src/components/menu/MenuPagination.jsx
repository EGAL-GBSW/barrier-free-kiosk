import "./MenuPagination.css"

/**
 * MenuPagination
 * 레퍼런스 ./frontend/app.js의 .menu-pagination 컴포넌트
 *
 * Props:
 *   currentPage   {number}    현재 페이지 (1부터 시작)
 *   totalPages    {number}    전체 페이지 수
 *   onPrev        {Function}  이전 버튼 클릭 핸들러
 *   onNext        {Function}  다음 버튼 클릭 핸들러
 *   onPageChange  {Function}  페이지 변경 핸들러 (nextPage: number) => void
 */
function MenuPagination({
    currentPage = 1,
    totalPages = 1,
    onPrev,
    onNext,
    onPageChange,
}) {
    const handlePrev = () => {
        if (currentPage > 1) {
            onPrev?.()
            onPageChange?.(currentPage - 1)
        }
    }

    const handleNext = () => {
        if (currentPage < totalPages) {
            onNext?.()
            onPageChange?.(currentPage + 1)
        }
    }

    return (
        <nav className="menu-pagination" aria-label="메뉴 페이지">
            <button
                type="button"
                className="page-button"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                aria-label="이전 페이지"
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
                    <path d="m14 6-6 6 6 6" />
                </svg>
                <span>이전</span>
            </button>

            <span aria-live="polite">
                <strong>{currentPage}</strong> / {totalPages}
            </span>

            <button
                type="button"
                className="page-button"
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                aria-label="다음 페이지"
            >
                <span>다음</span>
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
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
            </button>
        </nav>
    )
}

export default MenuPagination

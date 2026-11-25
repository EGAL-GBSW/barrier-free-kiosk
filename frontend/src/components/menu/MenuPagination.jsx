import "./MenuPagination.css"
import { useI18n } from "../../i18n/context"

/**
 * MenuPagination
 * 메뉴 그리드(children)를 가운데 두고, 이전/다음 버튼을 그리드 양옆 빈 공간에 배치합니다.
 * (버튼이 그리드 아래에 있으면 하단 독에 가려 스크롤해야 하는 문제를 피하기 위함)
 *
 *   [ ‹ 이전 ]  [   메뉴 그리드   ]  [ 다음 › ]
 *                                     1 / 2
 *
 * Props:
 *   currentPage   {number}    현재 페이지 (1부터 시작)
 *   totalPages    {number}    전체 페이지 수
 *   onPrev        {Function}  이전 버튼 클릭 핸들러
 *   onNext        {Function}  다음 버튼 클릭 핸들러
 *   onPageChange  {Function}  페이지 변경 핸들러 (nextPage: number) => void
 *   children      {ReactNode} 가운데에 표시할 메뉴 그리드
 */
function MenuPagination({
    currentPage = 1,
    totalPages = 1,
    onPrev,
    onNext,
    onPageChange,
    children,
}) {
    const { t } = useI18n()

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
        <div className="menu-stage">
            <div className="menu-stage-side">
                <button
                    type="button"
                    className="page-button"
                    onClick={handlePrev}
                    disabled={currentPage <= 1}
                    aria-label={t("page.prevAria")}
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
                    <span>{t("page.prev")}</span>
                </button>
            </div>

            <div className="menu-stage-content">{children}</div>

            <div className="menu-stage-side">
                <button
                    type="button"
                    className="page-button"
                    onClick={handleNext}
                    disabled={currentPage >= totalPages}
                    aria-label={t("page.nextAria")}
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
                        <path d="m10 6 6 6-6 6" />
                    </svg>
                    <span>{t("page.next")}</span>
                </button>
                <span
                    className="menu-page-indicator"
                    role="status"
                    aria-label={t("page.aria")}
                >
                    <strong>{currentPage}</strong> / {totalPages}
                </span>
            </div>
        </div>
    )
}

export default MenuPagination

import "./VoicePage.css"
import ProductGrid from "../menu/ProductGrid"
import MenuPagination from "../menu/MenuPagination"

/**
 * VoicePage
 * 음성 주문 탭: 메뉴 카탈로그를 그대로 보여주면서
 * 오른쪽 하단에 반원형 음성 주문 FAB 버튼을 오버레이합니다.
 *
 * 버튼 클릭 시 간략한 안내 말풍선이 나타나고 음성 인식이 시작됩니다.
 *
 * Props:
 *   products         {Array}     현재 페이지 상품 목록
 *   pageSize         {number}    페이지당 상품 수
 *   currentPage      {number}    현재 페이지 (1-based)
 *   totalPages       {number}    전체 페이지 수
 *   onSelectProduct  {Function}  상품 선택 핸들러
 *   onPageChange     {Function}  페이지 변경 핸들러
 *   listening        {boolean}   음성 인식 활성화 여부
 *   speechStatus     {string}    음성 상태 안내 문구
 *   onToggleListen   {Function}  마이크 토글 핸들러
 */
function VoicePage({
    products = [],
    pageSize = 6,
    currentPage = 1,
    totalPages = 1,
    onSelectProduct,
    onPageChange,
    listening = false,
    speechStatus = "",
    onToggleListen,
}) {
    return (
        <section className="voice-page-v2" aria-label="음성 주문 화면">
            {/* 메뉴 카탈로그 (터치 메뉴와 동일) */}
            <div className="voice-catalogue">
                <ProductGrid
                    products={products}
                    pageSize={pageSize}
                    onSelectProduct={onSelectProduct}
                />
                <MenuPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPrev={() => onPageChange?.(currentPage - 1)}
                    onNext={() => onPageChange?.(currentPage + 1)}
                    onPageChange={onPageChange}
                />
            </div>

            <p className="voice-inline-status" role="status" aria-live="polite">
                {speechStatus}
            </p>

            {/* 음성 주문 FAB (오른쪽 하단 반원) */}
            <button
                type="button"
                className={`voice-fab${listening ? " listening expanded" : ""}`}
                onClick={onToggleListen}
                aria-pressed={listening}
                aria-label={listening ? "음성 인식 중지" : "음성 주문 시작"}
            >
                <svg
                    className="voice-fab-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect x="9" y="2" width="6" height="13" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
                </svg>
                <span className="voice-fab-label">
                    {listening ? "듣고 있어요..." : "음성 주문"}
                </span>
            </button>
        </section>
    )
}

export default VoicePage

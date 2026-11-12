import "./VoicePage.css"
import ProductGrid from "../menu/ProductGrid"
import MenuPagination from "../menu/MenuPagination"
import VoiceProgressPopup from "../voice/VoiceProgressPopup"

/**
 * VoicePage
 * 메뉴 화면: 메뉴 카탈로그와 음성 인식 상태 안내 문구를 보여줍니다.
 * 터치/음성 주문 전환 버튼은 왼쪽 카테고리 탭(CategoryTabs)에 있습니다.
 *
 * Props:
 *   products         {Array}     현재 페이지 상품 목록
 *   pageSize         {number}    페이지당 상품 수
 *   currentPage      {number}    현재 페이지 (1-based)
 *   totalPages       {number}    전체 페이지 수
 *   onSelectProduct  {Function}  상품 선택 핸들러
 *   onPageChange     {Function}  페이지 변경 핸들러
 *   speechStatus     {string}    음성 상태 안내 문구
 */
function VoicePage({
    products = [],
    pageSize = 6,
    currentPage = 1,
    totalPages = 1,
    onSelectProduct,
    onPageChange,
    speechStatus = "",
    draft = "",
    pendingQuote,
    onConfirmQuote,
    confirmingQuote,
    voiceProgress,
}) {
    return (
        <section className="voice-page-v2" aria-label="메뉴 화면">
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

            {voiceProgress ? (
                <VoiceProgressPopup
                    {...voiceProgress}
                    message={speechStatus}
                    draft={draft}
                    quote={pendingQuote}
                    onConfirm={onConfirmQuote}
                    confirming={confirmingQuote}
                />
            ) : (
                <p className="voice-inline-status" role="status">{speechStatus}</p>
            )}
        </section>
    )
}

export default VoicePage

import ProductGrid from "../menu/ProductGrid"
import MenuPagination from "../menu/MenuPagination"

/**
 * MenuPage
 * 레퍼런스 ./frontend/app.js (menuPage 함수) 및 ./frontend/kiosk.css 기준
 * 키오스크 카탈로그 패널: 상품 그리드와 페이지네이션을 렌더링합니다.
 *
 * Props:
 *   products         {Array}     현재 페이지에 표시할 상품 목록
 *   pageSize         {number}    페이지당 상품 수
 *   currentPage      {number}    현재 페이지 (1부터 시작)
 *   totalPages       {number}    전체 페이지 수
 *   onSelectProduct  {Function}  상품 선택 핸들러
 *   onPageChange     {Function}  페이지 변경 핸들러
 */
function MenuPage({
    products = [],
    pageSize = 6,
    currentPage = 1,
    totalPages = 1,
    onSelectProduct,
    onPageChange,
}) {
    return (
        <section className="kiosk-catalogue">
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
        </section>
    )
}

export default MenuPage

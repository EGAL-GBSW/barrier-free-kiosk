import "./ProductGrid.css"
import ProductCard from "./ProductCard"

/**
 * ProductGrid
 * 레퍼런스 ./frontend/app.js의 .product-grid 영역 컴포넌트
 *
 * Props:
 *   products         {Array}     표시할 상품 목록
 *   onSelectProduct  {Function}  상품 선택 시 핸들러
 *   pageSize         {number}    페이지당 개수 (기본 6)
 */
function ProductGrid({ products = [], onSelectProduct, pageSize = 6 }) {
    return (
        <div className="product-grid" data-page-size={pageSize}>
            {products.map((item) => (
                <ProductCard
                    key={item.id ?? item.name}
                    product={item}
                    onSelect={onSelectProduct}
                />
            ))}
        </div>
    )
}

export default ProductGrid

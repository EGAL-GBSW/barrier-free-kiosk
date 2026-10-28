import "./ProductCard.css"

/**
 * ProductCard
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css 기준 단일 상품 카드 컴포넌트
 *
 * Props:
 *   product    {object}    상품 정보 { id, name, price, temp (or temps), badge, description }
 *   onSelect   {Function}  상품 클릭 핸들러 (product) => void
 */
function ProductCard({ product, onSelect }) {
    if (!product) return null

    const { id = 1, name, price, badge } = product
    const tempText =
        product.temp ||
        (Array.isArray(product.temps)
            ? product.temps.length === 2
                ? "HOT / ICE"
                : product.temps[0] || "BAKERY"
            : "")
    const priceText =
        typeof price === "number" ? `${price.toLocaleString()}원` : price

    return (
        <button
            type="button"
            className="product-card"
            onClick={() => onSelect?.(product)}
            aria-label={`${name} ${priceText}, 옵션 선택`}
        >
            <div className="product-visual">
                <div
                    className={`product-photo photo-${id}`}
                    role="img"
                    aria-label={name}
                />
                {badge && (
                    <span className={`badge ${badge.toLowerCase()}`}>
                        {badge}
                    </span>
                )}
                {tempText && <span className="temperature">{tempText}</span>}
            </div>
            <div className="product-info">
                <h3>{name}</h3>
                <div className="product-bottom">
                    <strong>{priceText}</strong>
                </div>
            </div>
        </button>
    )
}

export default ProductCard

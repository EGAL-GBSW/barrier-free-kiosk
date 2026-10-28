import { useState } from "react"
import "./ProductModal.css"
import { money, unitPrice, defaults } from "./menuData"

/**
 * ProductModal
 * 레퍼런스 ./frontend/app.js (productDialog) 기준
 * 상품 상세 정보(이름, 영문명, 설명, 알레르기) 및 옵션(온도, 사이즈, 샷, 수량) 선택 모달
 *
 * Props:
 *   product      {object}    선택된 상품 객체 (id, name, en, price, temps, category, description, allergens)
 *   isOpen       {boolean}   모달 오픈 여부
 *   onClose      {Function}  모달 닫기 핸들러 () => void
 *   onAddToCart  {Function}  장바구니 추가 핸들러 (product, options) => void
 *   editOptions  {object}    기존 옵션 수정 시 전달
 */
function ProductModal({
    product,
    isOpen = false,
    onClose,
    onAddToCart,
    editOptions = null,
}) {
    if (!isOpen || !product) return null

    const initialOptions = editOptions || defaults(product)

    return (
        <ProductModalInternal
            product={product}
            initialOptions={initialOptions}
            isEditing={Boolean(editOptions)}
            onClose={onClose}
            onAddToCart={onAddToCart}
        />
    )
}

function ProductModalInternal({
    product,
    initialOptions,
    isEditing,
    onClose,
    onAddToCart,
}) {
    const [options, setOptions] = useState(initialOptions)

    const {
        id,
        name,
        en,
        description,
        allergens,
        temps = [],
        category,
    } = product
    const calculatedUnitPrice = unitPrice(product, options)
    const totalPrice = calculatedUnitPrice * options.quantity

    const handleTemperature = (temp) => {
        setOptions((prev) => ({ ...prev, temperature: temp }))
    }

    const handleSize = (sz) => {
        setOptions((prev) => ({ ...prev, size: sz }))
    }

    const handleShots = (shotsCount) => {
        setOptions((prev) => ({ ...prev, shots: shotsCount }))
    }

    const handleQuantity = (delta) => {
        setOptions((prev) => ({
            ...prev,
            quantity: Math.max(1, Math.min(99, prev.quantity + delta)),
        }))
    }

    const handleSubmit = () => {
        onAddToCart?.(product, options)
        onClose?.()
    }

    return (
        <div
            className="product-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
            role="presentation"
        >
            <div
                className="product-modal"
                role="dialog"
                aria-labelledby="dialog-product-title"
                aria-modal="true"
            >
                <button
                    type="button"
                    className="modal-close-btn"
                    onClick={onClose}
                    aria-label="닫기"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="m6 6 12 12M6 18 18 6" />
                    </svg>
                </button>

                <div className="product-modal-image">
                    <div
                        className={`product-photo photo-${id}`}
                        role="img"
                        aria-label={name}
                    />
                    {en && <span className="product-en">{en}</span>}
                </div>

                <div className="product-modal-content">
                    <h2 id="dialog-product-title">{name}</h2>
                    {description && (
                        <p className="product-description">{description}</p>
                    )}
                    {allergens && (
                        <span className="allergen">
                            알레르기 유발 성분: {allergens}
                        </span>
                    )}

                    {temps.length > 0 && (
                        <fieldset>
                            <legend>
                                온도 <span>필수 선택</span>
                            </legend>
                            <div className="option-row">
                                {temps.map((t) => {
                                    const isSelected = options.temperature === t
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            className={`option-btn${
                                                isSelected ? " selected" : ""
                                            }`}
                                            onClick={() => handleTemperature(t)}
                                            aria-pressed={isSelected}
                                        >
                                            <strong>
                                                {t === "ICE"
                                                    ? "시원하게 ICE"
                                                    : "따뜻하게 HOT"}
                                            </strong>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    {category !== "bakery" && (
                        <fieldset>
                            <legend>사이즈</legend>
                            <div className="option-row">
                                {["Regular", "Large"].map((sz) => {
                                    const isSelected = options.size === sz
                                    return (
                                        <button
                                            key={sz}
                                            type="button"
                                            className={`option-btn${
                                                isSelected ? " selected" : ""
                                            }`}
                                            onClick={() => handleSize(sz)}
                                            aria-pressed={isSelected}
                                        >
                                            <strong>{sz}</strong>
                                            <small>
                                                {sz === "Large"
                                                    ? "+700원"
                                                    : "기본 사이즈"}
                                            </small>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    {category === "coffee" && (
                        <fieldset>
                            <legend>샷 추가</legend>
                            <div className="option-row">
                                {[0, 1, 2].map((cnt) => {
                                    const isSelected = options.shots === cnt
                                    return (
                                        <button
                                            key={cnt}
                                            type="button"
                                            className={`option-btn${
                                                isSelected ? " selected" : ""
                                            }`}
                                            onClick={() => handleShots(cnt)}
                                            aria-pressed={isSelected}
                                        >
                                            <strong>
                                                {cnt === 0
                                                    ? "기본"
                                                    : `${cnt}샷 추가`}
                                            </strong>
                                            <small>
                                                {cnt === 0
                                                    ? "추가 없음"
                                                    : `+${money(cnt * 500)}`}
                                            </small>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    <div className="modal-quantity">
                        <span>수량</span>
                        <div className="quantity">
                            <button
                                type="button"
                                onClick={() => handleQuantity(-1)}
                                disabled={options.quantity <= 1}
                                aria-label="수량 줄이기"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    width="18"
                                    height="18"
                                >
                                    <path d="M5 12h14" />
                                </svg>
                            </button>
                            <strong>{options.quantity}</strong>
                            <button
                                type="button"
                                onClick={() => handleQuantity(1)}
                                disabled={options.quantity >= 99}
                                aria-label="수량 늘리기"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    width="18"
                                    height="18"
                                >
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="add-to-cart-btn"
                        onClick={handleSubmit}
                    >
                        <strong>{money(totalPrice)}</strong>
                        <span>
                            {isEditing ? "변경하기" : "담기"}
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ProductModal

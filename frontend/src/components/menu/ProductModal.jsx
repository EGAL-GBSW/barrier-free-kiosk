import { useState } from "react"
import "./ProductModal.css"
import { unitPrice, defaults } from "./menuData"
import { useI18n } from "../../i18n/context"

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
    const { lang, t, money, menu } = useI18n()

    const { id, en, temps = [], category } = product
    const { name, description, allergens } = menu(product)
    // 영문 부제: 영어 화면에서는 제목과 겹치므로 한국어 원래 이름을 보여줌
    const subtitle = lang === "en" ? product.name : en
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
                    aria-label={t("common.close")}
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
                    {subtitle && <span className="product-en">{subtitle}</span>}
                </div>

                <div className="product-modal-content">
                    <h2 id="dialog-product-title">{name}</h2>
                    {description && (
                        <p className="product-description">{description}</p>
                    )}
                    {allergens && (
                        <span className="allergen">
                            {t("product.allergens", { list: allergens })}
                        </span>
                    )}

                    {temps.length > 0 && (
                        <fieldset>
                            <legend>
                                {t("product.temperature")} <span>{t("product.required")}</span>
                            </legend>
                            <div className="option-row">
                                {temps.map((temp) => {
                                    const isSelected = options.temperature === temp
                                    return (
                                        <button
                                            key={temp}
                                            type="button"
                                            className={`option-btn${
                                                isSelected ? " selected" : ""
                                            }`}
                                            onClick={() => handleTemperature(temp)}
                                            aria-pressed={isSelected}
                                        >
                                            <strong>
                                                {t(temp === "ICE" ? "product.ice" : "product.hot")}
                                            </strong>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    {category !== "bakery" && (
                        <fieldset>
                            <legend>{t("product.size")}</legend>
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
                                                    ? `+${money(700)}`
                                                    : t("product.sizeDefault")}
                                            </small>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    {category === "coffee" && (
                        <fieldset>
                            <legend>{t("product.shots")}</legend>
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
                                                    ? t("product.shotNone")
                                                    : t("product.shotAdd", { n: cnt })}
                                            </strong>
                                            <small>
                                                {cnt === 0
                                                    ? t("product.shotNoneDesc")
                                                    : `+${money(cnt * 500)}`}
                                            </small>
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    )}

                    <div className="modal-quantity">
                        <span>{t("product.quantity")}</span>
                        <div className="quantity">
                            <button
                                type="button"
                                onClick={() => handleQuantity(-1)}
                                disabled={options.quantity <= 1}
                                aria-label={t("product.decrease")}
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
                                aria-label={t("product.increase")}
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
                            {t(isEditing ? "product.change" : "product.add")}
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

import QuantityControl from "./QuantityControl"
import { MENUS, money, unitPrice, optionsText } from "../menu/menuData"

/**
 * CartLine
 * 레퍼런스 ./frontend/app.js (cartPage → .review-line) 기준
 * 주문 확인 화면의 메뉴 한 줄: 사진, 이름, 옵션, 옵션 변경, 수량, 금액, 삭제
 *
 * Props:
 *   line      {object}    장바구니 항목 { id, key, temperature, size, shots, quantity }
 *   onEdit    {Function}  옵션 변경 핸들러 () => void
 *   onQty     {Function}  수량 변경 핸들러 (delta) => void
 *   onRemove  {Function}  삭제 핸들러 () => void
 */
function CartLine({ line, onEdit, onQty, onRemove }) {
    const m = MENUS.find((menu) => menu.id === line.id)
    if (!m) return null

    return (
        <article className="review-line">
            <div
                className={`product-photo photo-${m.id}`}
                role="img"
                aria-label={m.name}
            />
            <div>
                <h2>{m.name}</h2>
                <p>{optionsText(line)}</p>
                <button type="button" className="text-button" onClick={onEdit}>
                    옵션 변경
                </button>
            </div>
            <QuantityControl
                quantity={line.quantity}
                name={m.name}
                onChange={onQty}
            />
            <strong>{money(unitPrice(m, line) * line.quantity)}</strong>
            <button
                type="button"
                className="icon-button"
                onClick={onRemove}
                aria-label={`${m.name} 삭제`}
            >
                <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
                </svg>
            </button>
        </article>
    )
}

export default CartLine

import { MENUS, money, unitPrice, optionsText } from "../menu/menuData"

/**
 * PaymentRecap (주문 내역)
 * 레퍼런스 ./frontend/app.js (openTossCheckout → section.checkout-order) 기준
 * 결제 화면 왼쪽에서 담은 메뉴·옵션·수량·금액을 최종 확인합니다.
 *
 * Props:
 *   cart       {Array}   장바구니 항목 목록
 *   orderType  {string}  'DINE_IN' | 'TAKEOUT'
 */
function PaymentRecap({ cart = [], orderType = "DINE_IN", demo }) {
    const itemCount = cart.reduce((n, line) => n + line.quantity, 0)

    return (
        <section className="checkout-order" aria-label="주문 내역">
            <div className="checkout-section-title">
                <h3>주문 내역</h3>
                <span>
                    {orderType === "DINE_IN" ? "매장" : "포장"} · {itemCount}개
                </span>
            </div>
            <ul className="checkout-items">
                {cart.map((line, idx) => {
                    const m = MENUS.find((menu) => menu.id === line.id)
                    if (!m) return null
                    return (
                        <li key={line.key || idx} className="checkout-item">
                            <div
                                className={`product-photo photo-${m.id}`}
                                role="img"
                                aria-label={m.name}
                            />
                            <div>
                                <h3>{m.name}</h3>
                                <p>{optionsText(line)}</p>
                                <span>수량 {line.quantity}개</span>
                            </div>
                            <strong>
                                {money(unitPrice(m, line) * line.quantity)}
                            </strong>
                        </li>
                    )
                })}
            </ul>
            <p className="checkout-order-note">
                {demo ? "메뉴와 옵션을 확인한 뒤 주문을 접수해 주세요." : "주문 내용을 확인한 뒤 결제 수단을 선택해 주세요."}
            </p>
        </section>
    )
}

export default PaymentRecap

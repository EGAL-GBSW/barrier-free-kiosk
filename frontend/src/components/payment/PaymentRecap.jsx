import { MENUS, unitPrice } from "../menu/menuData"
import { useI18n } from "../../i18n/context"

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
    const { t, money, menu, options } = useI18n()

    return (
        <section className="checkout-order" aria-label={t("recap.title")}>
            <div className="checkout-section-title">
                <h3>{t("recap.title")}</h3>
                <span>
                    {t(orderType === "DINE_IN" ? "start.dineIn" : "start.takeout")} ·{" "}
                    {t("recap.count", { n: itemCount })}
                </span>
            </div>
            <ul className="checkout-items">
                {cart.map((line, idx) => {
                    const m = MENUS.find((menu) => menu.id === line.id)
                    if (!m) return null
                    const { name } = menu(m)
                    return (
                        <li key={line.key || idx} className="checkout-item">
                            <div
                                className={`product-photo photo-${m.id}`}
                                role="img"
                                aria-label={name}
                            />
                            <div>
                                <h3>{name}</h3>
                                <p>{options(line)}</p>
                                <span>{t("recap.quantity", { n: line.quantity })}</span>
                            </div>
                            <strong>
                                {money(unitPrice(m, line) * line.quantity)}
                            </strong>
                        </li>
                    )
                })}
            </ul>
            <p className="checkout-order-note">
                {t(demo ? "recap.noteDemo" : "recap.notePay")}
            </p>
        </section>
    )
}

export default PaymentRecap

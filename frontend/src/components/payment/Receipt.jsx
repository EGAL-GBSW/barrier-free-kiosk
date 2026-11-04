import { MENUS, money, unitPrice, optionsText } from "../menu/menuData"

/**
 * Receipt (결제 내역 영수증)
 * 레퍼런스 ./frontend/app.js (completePage → section.receipt) 기준
 *
 * Props:
 *   receipt  {object}  { number, cart, total, type, method, approved }
 */
function Receipt({ receipt }) {
    return (
        <section className="receipt" aria-label="결제 내역">
            <div className="receipt-brand">mog.</div>
            <p>모그커피 테스트 결제 내역</p>
            <div className="receipt-items">
                {receipt.cart.map((line, idx) => {
                    const m = MENUS.find((menu) => menu.id === line.id)
                    if (!m) return null
                    return (
                        <div key={line.key || idx}>
                            <span>
                                {m.name}
                                <small>
                                    {optionsText(line)} · {line.quantity}개
                                </small>
                            </span>
                            <strong>
                                {money(unitPrice(m, line) * line.quantity)}
                            </strong>
                        </div>
                    )
                })}
            </div>
            <div className="receipt-total">
                <span>총 결제 금액</span>
                <strong>{money(receipt.total)}</strong>
            </div>
            <p>
                결제 수단 · {receipt.method || "테스트 결제"}
                <br />
                {receipt.approved ? "테스트 승인 완료" : "임시 완료 (승인 연동 전)"}
            </p>
        </section>
    )
}

export default Receipt

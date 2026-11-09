import { money } from "../menu/menuData"

/**
 * Receipt (결제 내역 영수증)
 * 레퍼런스 ./frontend/app.js (completePage → section.receipt) 기준
 *
 * Props:
 *   receipt  {object}  { number, cart, total, type, method, approved }
 */
function Receipt({ receipt }) {
    return (
        <section className="receipt" aria-label="주문 내역">
            <div className="receipt-brand">mog.</div>
            <p>{receipt.approved ? "모그커피 테스트 결제 내역" : "모그커피 시연 주문 내역"}</p>
            <div className="receipt-items">
                {receipt.items.map((item, index) => (
                    <div key={index}>
                        <span>
                            {item.menuName}
                            <small>
                                {[item.temperature, item.temperature && item.size, item.shots > 0 && `샷 ${item.shots} 추가`, `${item.quantity}개`].filter(Boolean).join(" · ")}
                            </small>
                        </span>
                        <strong>{money(item.totalPrice)}</strong>
                    </div>
                ))}
            </div>
            <div className="receipt-total">
                <span>{receipt.approved ? "총 결제 금액" : "총 주문 금액"}</span>
                <strong>{money(receipt.total)}</strong>
            </div>
            {receipt.approved && <p>토스 테스트 결제 승인 완료</p>}
        </section>
    )
}

export default Receipt

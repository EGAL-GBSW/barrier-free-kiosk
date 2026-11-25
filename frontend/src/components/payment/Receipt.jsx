import { findMenu } from "../menu/menuData"
import { useI18n } from "../../i18n/context"

/**
 * Receipt (결제 내역 영수증)
 * 레퍼런스 ./frontend/app.js (completePage → section.receipt) 기준
 *
 * Props:
 *   receipt  {object}  { number, cart, total, type, method, approved }
 */
function Receipt({ receipt }) {
    const { t, money, menu, options } = useI18n()
    // 서버가 저장한 메뉴 이름(한국어) 대신, menuId로 선택한 언어의 이름을 찾습니다.
    const itemName = (item) => {
        const m = findMenu(item.menuId)
        return m ? menu(m).name : item.menuName
    }

    return (
        <section className="receipt" aria-label={t("recap.title")}>
            <div className="receipt-brand">mog.</div>
            <p>{t(receipt.approved ? "receipt.approved" : "receipt.demo")}</p>
            <div className="receipt-items">
                {receipt.items.map((item, index) => (
                    <div key={index}>
                        <span>
                            {itemName(item)}
                            <small>
                                {[
                                    findMenu(item.menuId)?.category !== "bakery" && options({ ...item, id: item.menuId }),
                                    t("receipt.quantity", { n: item.quantity }),
                                ].filter(Boolean).join(" · ")}
                            </small>
                        </span>
                        <strong>{money(item.totalPrice)}</strong>
                    </div>
                ))}
            </div>
            <div className="receipt-total">
                <span>{t(receipt.approved ? "dock.totalPay" : "dock.totalOrder")}</span>
                <strong>{money(receipt.total)}</strong>
            </div>
            {receipt.approved && <p>{t("receipt.approvedNote")}</p>}
        </section>
    )
}

export default Receipt

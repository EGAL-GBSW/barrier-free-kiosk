import "./CartPage.css"
import CartLine from "../order/CartLine"
import { money, total } from "../menu/menuData"

/**
 * CartPage (주문 확인 — 3단계)
 * 레퍼런스 ./frontend/app.js (cartPage) 기준
 * 담은 메뉴와 옵션을 한 번 더 확인하고 수량 변경·삭제·옵션 변경을 할 수 있습니다.
 *
 * Props:
 *   cart        {Array}     장바구니 항목 목록
 *   onEdit      {Function}  옵션 변경 (index) => void
 *   onQty       {Function}  수량 변경 (index, delta) => void
 *   onRemove    {Function}  삭제 (index) => void
 *   onMoreMenu  {Function}  메뉴 더 담기 () => void
 */
function CartPage({ cart = [], onEdit, onQty, onRemove, onMoreMenu }) {
    const itemCount = cart.reduce((n, line) => n + line.quantity, 0)

    return (
        <div className="page-scroll cart-page">
            <div className="page-title">
                <h1>주문을 확인해 주세요.</h1>
                <p>담으신 메뉴와 옵션을 한 번 더 확인하세요.</p>
            </div>

            {cart.length ? (
                <>
                    <div className="review-list">
                        {cart.map((line, idx) => (
                            <CartLine
                                key={line.key || idx}
                                line={line}
                                onEdit={() => onEdit?.(idx)}
                                onQty={(delta) => onQty?.(idx, delta)}
                                onRemove={() => onRemove?.(idx)}
                            />
                        ))}
                    </div>
                    <div className="review-total">
                        <span>총 {itemCount}개 메뉴</span>
                        <strong>{money(total(cart))}</strong>
                    </div>
                </>
            ) : (
                <div className="big-empty">
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
                        <path d="M5 7h14l1 14H4L5 7Zm4 1V6a3 3 0 0 1 6 0v2" />
                    </svg>
                    <h2>아직 선택한 메뉴가 없어요.</h2>
                    <p>좋아하는 메뉴를 먼저 골라볼까요?</p>
                </div>
            )}

            <button type="button" className="button secondary" onClick={onMoreMenu}>
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
                    <path d="M12 5v14M5 12h14" />
                </svg>
                메뉴 더 담기
            </button>
        </div>
    )
}

export default CartPage

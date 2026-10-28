import "./StepBar.css"

/**
 * StepBar
 * 레퍼런스 ./frontend/app.js 및 ./frontend/kiosk.css의 nav.order-stepbar 구조를 React로 재현합니다.
 *
 * 5단계:
 *   1. 포장/매장 선택
 *   2. 메뉴 선택
 *   3. 주문 확인
 *   4. 결제하기
 *   5. 결제 완료
 *
 * 상태:
 *   - done   (이전 단계): 파란 원 + 체크 아이콘 (svg)
 *   - active (현재 단계): 파란 원 + 숫자
 *   - 기본   (이후 단계): 회색 테두리 원 + 숫자
 *
 * Props:
 *   currentStep    {number}   현재 활성 단계 (1~5)
 *   isCheckoutOpen {boolean}  토스 결제 모달 오픈 시 data-checkout-open 속성 활성화
 */
const STEPS = [
  "포장/매장 선택",
  "메뉴 선택",
  "주문 확인",
  "결제하기",
  "결제 완료",
]

function StepBar({ currentStep = 1, isCheckoutOpen = false }) {
  return (
    <nav
      className="order-stepbar"
      aria-label="주문 진행 단계"
      data-checkout-open={isCheckoutOpen ? "true" : undefined}
    >
      {STEPS.map((label, idx) => {
        const step = idx + 1
        const isDone = step < currentStep
        const isActive = step === currentStep

        return (
          <div
            key={step}
            className={`order-step${isDone ? " done" : ""}${isActive ? " active" : ""}`}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="step-circle">
              {isDone ? (
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              ) : (
                step
              )}
            </span>
            <span>{label}</span>
          </div>
        )
      })}
    </nav>
  )
}

export default StepBar

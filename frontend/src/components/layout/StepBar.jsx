import "./StepBar.css"

/**
 * StepBar
 * desktop/frontend의 nav.order-stepbar 구조를 재현합니다.
 *
 * 5단계: 포장/매장 선택 → 메뉴 선택 → 주문 확인 → 결제하기 → 결제 완료
 *   done   (이전 단계): 초록 원 + ✓
 *   active (현재 단계): 초록 원 + 숫자
 *   기본   (이후 단계): 회색 원 + 숫자
 * 단계 사이 "·····" 구분은 CSS ::after 처리
 *
 * Props:
 *   currentStep {number}  현재 활성 단계 (1~5)
 */
const STEPS = [
  "포장/매장 선택",
  "메뉴 선택",
  "주문 확인",
  "결제하기",
  "결제 완료",
]

function StepBar({ currentStep = 1 }) {
  return (
    <nav className="step-bar" aria-label="주문 진행 단계">
      {STEPS.map((label, idx) => {
        const step     = idx + 1
        const isDone   = step < currentStep
        const isActive = step === currentStep

        return (
          <div
            key={step}
            className={[
              "step",
              isDone   ? "step--done"   : "",
              isActive ? "step--active" : "",
            ].filter(Boolean).join(" ")}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="step__circle">
              {isDone ? "✓" : step}
            </span>
            <span className="step__label">{label}</span>
          </div>
        )
      })}
    </nav>
  )
}

export default StepBar

import KioskHeader from "./KioskHeader"
import StepBar from "./StepBar"

/**
 * AppHeader
 * 레퍼런스 ./frontend/app.js의 header() 함수를 React 컴포넌트로 구현합니다.
 * KioskHeader와 StepBar를 순서대로 렌더링합니다.
 *
 * Props:
 *   onHome         {Function}  홈 ("처음으로") 버튼 클릭 핸들러
 *   elapsed        {string}    경과 시간 ("MM:SS")
 *   showHome       {boolean}   홈 버튼 노출 여부
 *   font           {number}    글자 크기 단계 (0=일반, 1=큰글씨, 2=최대)
 *   onFont         {Function}  글자 크기 변경 핸들러
 *   currentStep    {number}    StepBar 단계 (1~5)
 *   isCheckoutOpen {boolean}   토스 결제 모달 오픈 시 data-checkout-open 활성화
 */
function AppHeader({
    onHome,
    elapsed = "00:00",
    showHome = true,
    font = 0,
    onFont,
    currentStep = 1,
    isCheckoutOpen = false,
}) {
    return (
        <>
            <KioskHeader
                onHome={onHome}
                elapsed={elapsed}
                showHome={showHome}
                font={font}
                onFont={onFont}
            />
            <StepBar
                currentStep={currentStep}
                isCheckoutOpen={isCheckoutOpen}
            />
        </>
    )
}

export { KioskHeader, StepBar }
export default AppHeader

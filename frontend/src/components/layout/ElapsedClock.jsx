import { useEffect, useState } from "react"

const format = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0")
    const s = String(seconds % 60).padStart(2, "0")
    return `${m}:${s}`
}

/**
 * ElapsedClock
 * 주문 경과 시간을 1초마다 갱신합니다.
 * 타이머 상태를 이 컴포넌트 안에 두어, 매초 리렌더가 헤더의 시계에만 일어나도록 합니다.
 *
 * Props:
 *   startedAt  {number|null}  주문 시작 시각 (Date.now()), 없으면 마운트 시각부터 카운트
 */
function ElapsedClock({ startedAt }) {
    const [now, setNow] = useState(() => Date.now())
    const [mountedAt] = useState(now)

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    const seconds = Math.max(0, Math.floor((now - (startedAt ?? mountedAt)) / 1000))
    const text = format(seconds)

    return (
        <time className="order-elapsed" aria-label={`주문 경과 시간 ${text}`}>
            {text}
        </time>
    )
}

export default ElapsedClock

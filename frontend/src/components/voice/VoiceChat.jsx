import { useEffect, useRef } from "react"
import "./VoiceChat.css"

/**
 * VoiceChat
 * 레퍼런스 ./frontend/app.js의 .conversation 및 .chat 메시지 로그 영역
 *
 * Props:
 *   messages  {Array}      대화 목록 [{ role: 'user'|'assistant', text: string }]
 *   children  {ReactNode}  하단 확인 카드 (VoiceConfirm 등) 슬롯
 */
function VoiceChat({ messages = [], children }) {
    const scrollRef = useRef(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, children])

    return (
        <div
            ref={scrollRef}
            className="conversation"
            role="log"
            aria-live="polite"
        >
            {/* 기본 도우미 시작 메시지 */}
            <div className="chat assistant">
                <span className="chat-avatar">m.</span>
                <div>
                    안녕하세요! 어떤 메뉴를 드릴까요?
                    <small>
                        “아이스 아메리카노 두 잔 주세요”처럼 말씀해 주세요.
                    </small>
                </div>
            </div>

            {/* 사용자 및 어시스턴트 메시지 내역 */}
            {messages.map((m, idx) => (
                <div key={idx} className={`chat ${m.role}`}>
                    {m.role === "assistant" && (
                        <span className="chat-avatar">m.</span>
                    )}
                    <div>{m.text}</div>
                </div>
            ))}

            {/* 주문 확인 슬롯 (VoiceConfirm) */}
            {children}
        </div>
    )
}

export default VoiceChat

import { useState, useRef, useEffect, useCallback } from "react"
import { parseOrder } from "../menu/menuData"

/**
 * useVoiceOrder
 * Web Speech API (ko-KR)와 레퍼런스 한국어 주문 파서(parseOrder)를 연동하는 리액트 훅
 *
 * @param {object} options
 * @param {string} options.currentPage       현재 페이지 ('voice' | 'menu' 등)
 * @param {Function} options.onAddToCart     장바구니 추가 핸들러 (menu, options) => void
 * @param {Function} options.onToast         토스트 알림 핸들러 (msg) => void
 */
export function useVoiceOrder({
    currentPage = "menu",
    onAddToCart,
    onToast,
} = {}) {
    const [listening, setListening] = useState(false)
    const [speechStatus, setSpeechStatus] = useState("")
    const [messages, setMessages] = useState([])
    const [pending, setPending] = useState(null)

    const recognitionRef = useRef(null)

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null
            recognitionRef.current.onresult = null
            recognitionRef.current.onerror = null
            try {
                recognitionRef.current.abort()
            } catch {
                // ignore
            }
            recognitionRef.current = null
        }
        setListening(false)
    }, [])

    const processVoiceText = useCallback(
        (text) => {
            stopListening()
            const userMsg = { role: "user", text }
            setMessages((prev) => [...prev, userMsg])

            const parsed = parseOrder(text)

            // 메뉴 페이지에서 바로 음성 인식한 경우
            if (currentPage === "menu") {
                setPending(null)
                if (parsed.error) {
                    setSpeechStatus(parsed.error)
                    onToast?.(parsed.error)
                } else {
                    setSpeechStatus("더 주문하려면 마이크를 눌러 주세요.")
                    onAddToCart?.(parsed.menu, parsed.options)
                    onToast?.(
                        `${parsed.menu.name} ${parsed.options.quantity}개를 담았어요.`
                    )
                }
                return
            }

            // 음성 주문 전용 페이지(VoicePage)인 경우
            if (parsed.error) {
                setPending(null)
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: parsed.error },
                ])
                setSpeechStatus(parsed.error)
            } else {
                setPending(parsed)
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        text: "이렇게 준비해 드릴까요? 옵션과 수량을 확인한 뒤 담아주세요.",
                    },
                ])
                setSpeechStatus("")
            }
        },
        [currentPage, onAddToCart, onToast, stopListening]
    )

    const toggleListen = useCallback(() => {
        if (listening) {
            stopListening()
            setSpeechStatus("음성 인식을 멈췄어요.")
            return
        }

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition

        if (!SpeechRecognition) {
            setSpeechStatus(
                "이 브라우저는 음성 인식을 지원하지 않아요. Chrome에서 열거나 아래 입력창에 입력해 주세요."
            )
            return
        }

        try {
            const rec = new SpeechRecognition()
            rec.lang = "ko-KR"
            rec.interimResults = true
            rec.continuous = false

            rec.onresult = (e) => {
                const result = e.results[e.results.length - 1]
                if (result.isFinal) {
                    processVoiceText(result[0].transcript)
                } else {
                    setSpeechStatus(result[0].transcript)
                }
            }

            rec.onerror = (e) => {
                setListening(false)
                recognitionRef.current = null
                if (e.error === "not-allowed") {
                    setSpeechStatus(
                        "마이크 권한이 필요해요. 브라우저에서 허용하거나 직접 입력해 주세요."
                    )
                } else if (e.error === "no-speech") {
                    setSpeechStatus(
                        "목소리가 들리지 않았어요. 다시 시도해 주세요."
                    )
                } else {
                    setSpeechStatus(
                        "음성을 인식하지 못했어요. 연결을 확인하거나 직접 입력해 주세요."
                    )
                }
            }

            rec.onend = () => {
                setListening(false)
                recognitionRef.current = null
            }

            recognitionRef.current = rec
            setListening(true)
            setSpeechStatus("듣고 있어요. 주문을 말씀해 주세요.")
            rec.start()
        } catch {
            stopListening()
            setSpeechStatus(
                "마이크를 시작할 수 없어요. 화면을 눌러 주문해 주세요."
            )
        }
    }, [listening, processVoiceText, stopListening])

    const confirmPending = useCallback(() => {
        if (!pending) return
        onAddToCart?.(pending.menu, pending.options)
        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                text: "주문에 추가했어요. 더 필요한 메뉴가 있으신가요?",
            },
        ])
        setPending(null)
    }, [pending, onAddToCart])

    const retryPending = useCallback(() => {
        setPending(null)
        setSpeechStatus("메뉴 이름과 수량을 다시 말씀해 주세요.")
    }, [])

    useEffect(() => {
        return () => {
            stopListening()
        }
    }, [stopListening])

    return {
        listening,
        speechStatus,
        messages,
        pending,
        toggleListen,
        processVoiceText,
        confirmPending,
        retryPending,
        stopListening,
    }
}

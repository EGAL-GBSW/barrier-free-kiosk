import { useCallback, useEffect, useRef, useState } from "react"
import { analyzeVoice, closeVoiceSession, quoteVoiceOrder } from "../../api/client"
import { lineKey, MENUS, money } from "../menu/menuData"

const isConfirmation = (text) =>
    /^(?:네|예|응|(?:네|예|응)?주문(?:할게요|해주세요|확정해주세요|확정할게요))$/.test(text.replace(/[\s,.!?]/g, ""))

function stopRecognition(job) {
    const recognition = job.recognition
    job.recognition = null
    if (!recognition) return
    recognition.onresult = recognition.onend = recognition.onerror = null
    try { recognition.abort() } catch { /* 이미 종료됨 */ }
}

function stopJob(job) {
    stopRecognition(job)
    if (!job.request) job.controller.abort()
    if (job.utterance) {
        job.utterance.onend = job.utterance.onerror = null
        window.speechSynthesis?.cancel()
        job.utterance = null
    }
    // 중계 요청이 진행 중이면 원격 세션 변경이 끝난 뒤 정리합니다.
    void Promise.resolve(job.request).finally(() => closeVoiceSession(job.id)).catch(() => {})
}

function mergeOrder(touchCart, aiItems) {
    const merged = new Map()
    for (const item of [...touchCart, ...aiItems.map(({ menuId, ...options }) => ({ id: menuId, ...options }))]) {
        if (!MENUS.some(({ id }) => id === item.id) || !Number.isInteger(item.quantity) || item.quantity < 1) {
            throw new Error("음성 주문의 메뉴와 수량을 확인할 수 없어요.")
        }
        const key = lineKey(item.id, item)
        const quantity = (merged.get(key)?.quantity || 0) + item.quantity
        merged.set(key, { ...item, quantity, key })
    }
    return [...merged.values()]
}

export function useAiVoiceOrder({ cart, orderType, onConfirmOrder }) {
    const [listening, setListening] = useState(false)
    const [speechStatus, setSpeechStatus] = useState("")
    const [phase, setPhase] = useState("idle")
    const [transcript, setTranscript] = useState("")
    const [draft, setDraft] = useState("")
    const [pending, setPending] = useState(null)
    const [confirming, setConfirming] = useState(false)
    const jobRef = useRef(null)
    const context = useRef({ cart, orderType, onConfirmOrder })
    useEffect(() => { context.current = { cart, orderType, onConfirmOrder } }, [cart, orderType, onConfirmOrder])

    const stopListening = useCallback(() => {
        const job = jobRef.current
        if (job?.committing) return
        jobRef.current = null
        if (job) stopJob(job)
        setListening(false)
        setPending(null)
        setDraft("")
        setPhase("idle")
        setTranscript("")
        setSpeechStatus("")
    }, [])

    useEffect(() => () => {
        const job = jobRef.current
        jobRef.current = null
        if (job) stopJob(job)
    }, [])

    async function confirmPending() {
        const job = jobRef.current
        if (!job?.quote || job.busy || job.committing) return
        const quote = job.quote
        if (quote.cartSignature !== JSON.stringify(context.current.cart) || quote.orderType !== context.current.orderType) {
            job.quote = null
            setPending(null)
            setPhase("retry")
            setSpeechStatus("장바구니가 바뀌었어요. 다시 ‘결제해 주세요’라고 말씀해 주세요.")
            return
        }
        job.committing = true
        setConfirming(true)
        stopRecognition(job)
        if (job.utterance) {
            job.utterance.onend = job.utterance.onerror = null
            window.speechSynthesis?.cancel()
            job.utterance = null
        }
        setListening(false)
        job.quote = null
        setPending(null)
        try {
            await context.current.onConfirmOrder(quote)
            job.committing = false
            if (jobRef.current === job) stopListening()
        } catch (error) {
            if (jobRef.current === job) {
                setPhase("retry")
                setSpeechStatus(error.message || "주문을 접수하지 못했어요.")
            }
        } finally {
            job.committing = false
            setConfirming(false)
        }
    }

    function speakAndListen(job, message) {
        if (jobRef.current !== job) return
        setSpeechStatus(message)
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return
        stopRecognition(job)
        const utterance = new SpeechSynthesisUtterance(message)
        utterance.lang = "ko-KR"
        job.utterance = utterance
        utterance.onend = () => {
            if (jobRef.current !== job || job.utterance !== utterance) return
            job.utterance = null
            listen(job, true)
        }
        utterance.onerror = () => {
            if (jobRef.current !== job || job.utterance !== utterance) return
            job.utterance = null
            setPhase("retry")
            setSpeechStatus(message + " 음성 주문 버튼을 눌러 답해 주세요.")
        }
        window.speechSynthesis.speak(utterance)
    }

    async function processText(job, text) {
        if (job.quote && isConfirmation(text)) {
            await confirmPending()
            return
        }
        job.quote = null
        setPending(null)
        job.busy = true
        setTranscript(text)
        setPhase("analyzing")
        setSpeechStatus("AI가 주문을 확인하고 있어요.")
        let reply
        try {
            job.request = analyzeVoice(job.id, text, job.controller.signal)
            const { result } = await job.request
            if (jobRef.current !== job) return
            setDraft(result.cart.map((line) => `${line.menu} ${line.quantity}개`).join(", "))
            reply = result.message
            if (result.next_action === "request_quote" && result.ready_for_quote && result.items.length) {
                const current = context.current
                const cartSignature = JSON.stringify(current.cart)
                const lines = mergeOrder(current.cart, result.items)
                const quote = await quoteVoiceOrder(current.orderType, lines)
                if (jobRef.current !== job) return
                const menuText = quote.items.map((item) =>
                    [item.menuName, item.temperature, item.temperature && item.size, item.shots > 0 && `샷 ${item.shots}개 추가`, `${item.quantity}개`].filter(Boolean).join(" ")
                ).join(", ")
                reply = `${menuText}. 총 ${money(quote.totalPrice)}입니다. 맞으면 ‘네, 주문할게요’라고 말씀해 주세요.`
                job.quote = { cart: lines, cartSignature, orderType: current.orderType, amount: quote.totalPrice, message: reply }
                setPending(job.quote)
                setPhase("quote")
            } else if (result.next_action === "cancel_checkout") {
                setPhase("reply")
                reply = "결제 요청을 취소했어요. " + reply
            } else if (result.ready_for_quote && result.next_action === "continue") {
                setPhase("reply")
                reply += " 더 필요한 메뉴를 말씀하시거나 ‘결제해 주세요’라고 말씀해 주세요."
            } else {
                setPhase(result.next_action === "ask_clarification" ? "question" : "reply")
            }
        } catch (error) {
            reply = null
            if (jobRef.current === job) setPhase("retry")
            if (jobRef.current === job) setSpeechStatus(error.message + " 음성 주문을 다시 누르거나 터치 주문을 이용해 주세요.")
        } finally {
            job.request = null
            job.busy = false
        }
        if (reply && jobRef.current === job) speakAndListen(job, reply)
    }

    function listen(job, keepMessage = false) {
        if (jobRef.current !== job || job.recognition || job.utterance || job.busy || job.committing) return
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
            setPhase("retry")
            setSpeechStatus("Chrome에서 열거나 터치 주문을 이용해 주세요.")
            return
        }
        try {
            const recognition = new SpeechRecognition()
            job.recognition = recognition
            recognition.lang = "ko-KR"
            recognition.interimResults = false
            recognition.continuous = false
            recognition.onresult = (event) => {
                if (jobRef.current !== job || job.recognition !== recognition) return
                const text = event.results[event.results.length - 1][0].transcript.trim()
                if (!text) return
                stopRecognition(job)
                setListening(false)
                void processText(job, text)
            }
            recognition.onerror = (event) => {
                if (jobRef.current !== job || job.recognition !== recognition) return
                stopRecognition(job)
                setListening(false)
                setPhase("retry")
                setSpeechStatus(event.error === "not-allowed"
                    ? "마이크 권한을 허용한 뒤 음성 주문을 다시 누르거나 터치 주문을 이용해 주세요."
                    : "음성을 인식하지 못했어요. 음성 주문을 다시 누르거나 터치 주문을 이용해 주세요.")
            }
            recognition.onend = () => {
                if (jobRef.current !== job || job.recognition !== recognition) return
                job.recognition = null
                setListening(false)
                setPhase("retry")
                setSpeechStatus("들리지 않았어요. 음성 주문을 다시 누르거나 터치 주문을 이용해 주세요.")
            }
            recognition.start()
            setListening(true)
            if (!keepMessage) {
                setPhase(job.quote ? "quote" : "listening")
                setSpeechStatus("듣고 있어요. 주문을 말씀해 주세요.")
            }
        } catch {
            stopRecognition(job)
            setListening(false)
            setPhase("retry")
            setSpeechStatus("마이크를 시작할 수 없어요. 권한을 확인하거나 터치 주문을 이용해 주세요.")
        }
    }

    function toggleListen() {
        if (!jobRef.current) {
            jobRef.current = { id: crypto.randomUUID(), controller: new AbortController() }
        }
        const job = jobRef.current
        if (job.recognition) {
            stopRecognition(job)
            setListening(false)
            setPhase("retry")
            setSpeechStatus("인식을 멈췄어요. 음성 주문을 누르면 이어서 말할 수 있어요.")
            return
        }
        listen(job)
    }

    return { listening, speechStatus, phase, transcript, draft, pending, confirming, toggleListen, stopListening, confirmPending }
}

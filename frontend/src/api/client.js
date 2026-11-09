const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
const TIMEOUT_MS = 10000

/**
 * API 실패를 나타내는 오류. message는 화면에 그대로 보여줄 수 있는 문구입니다.
 * status는 HTTP 상태 코드이며, 서버에 닿지 못한 경우 0입니다.
 */
export class ApiError extends Error {
    constructor(message, status = 0) {
        super(message)
        this.name = "ApiError"
        this.status = status
    }
}

export async function request(path, { method = "GET", body, timeoutMs = TIMEOUT_MS } = {}) {
    if (!BASE_URL) {
        throw new ApiError("서버 주소가 설정되지 않았어요. 직원에게 문의해 주세요.")
    }

    const hasBody = body !== undefined
    let response
    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: hasBody ? { "Content-Type": "application/json" } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        })
    } catch {
        throw new ApiError("서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.")
    }

    const data = await response.json().catch(() => null)
    if (!response.ok) {
        throw new ApiError(
            data?.message || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
            response.status
        )
    }
    return data
}

/** 장바구니를 백엔드 주문 형식으로 변환합니다. 금액은 서버가 계산하므로 보내지 않습니다. */
export function toOrderPayload(orderType, cart) {
    return {
        orderType,
        items: cart.map((line) => ({
            menuId: line.id,
            quantity: line.quantity,
            temperature: line.temperature,
            size: line.size,
            shots: line.shots,
        })),
    }
}

export function createOrder(orderType, cart) {
    return request("/orders", {
        method: "POST",
        body: toOrderPayload(orderType, cart),
    })
}

export function getOrder(orderId) {
    return request(`/orders/${encodeURIComponent(orderId)}`)
}

/** 토스 승인을 거치므로 일반 요청보다 제한 시간을 길게 둡니다. */
export function confirmPayment({ paymentKey, orderId, amount }) {
    return request("/payments/confirm", {
        method: "POST",
        body: { paymentKey, orderId, amount },
        timeoutMs: 30000,
    })
}

/**
 * menuData.js
 * 레퍼런스 ./frontend/order.js 기반 전체 메뉴 및 카테고리 데이터
 * public/menu-collection.png (3x3 스프라이트)와 1:1 대응
 */

export const MENUS = [
    {
        id: 1,
        name: "아메리카노",
        en: "AMERICANO",
        price: 3000,
        category: "coffee",
        badge: "BEST",
        description: "깊고 진한 에스프레소, 깔끔하게 남는 여운.",
        temps: ["ICE", "HOT"],
        allergens: "없음",
        aliases: ["아메리카노", "아아"],
    },
    {
        id: 2,
        name: "바닐라 크림 라떼",
        en: "VANILLA CREAM LATTE",
        price: 4900,
        category: "coffee",
        badge: "NEW",
        description: "부드러운 바닐라 크림과 에스프레소의 달콤한 만남.",
        temps: ["ICE", "HOT"],
        allergens: "우유",
        aliases: ["바닐라 크림 라떼", "바닐라 라떼", "바닐라라떼", "바닐라"],
    },
    {
        id: 3,
        name: "카페 라떼",
        en: "CAFFÈ LATTE",
        price: 4200,
        category: "coffee",
        description: "고소한 우유에 풍부한 에스프레소를 더했어요.",
        temps: ["ICE", "HOT"],
        allergens: "우유",
        aliases: ["카페 라떼", "카페라떼"],
    },
    {
        id: 4,
        name: "제주 말차 라떼",
        en: "JEJU MATCHA LATTE",
        price: 5200,
        category: "noncoffee",
        badge: "BEST",
        description: "제주 말차의 진한 풍미와 우유의 부드러움.",
        temps: ["ICE", "HOT"],
        allergens: "우유",
        aliases: ["제주 말차 라떼", "말차 라떼", "말차라떼", "말차"],
    },
    {
        id: 5,
        name: "리얼 딸기 밀크",
        en: "REAL STRAWBERRY MILK",
        price: 5500,
        category: "noncoffee",
        badge: "NEW",
        description: "한 모금마다 톡톡, 진짜 딸기 과육을 가득.",
        temps: ["ICE"],
        allergens: "우유",
        aliases: ["리얼 딸기 밀크", "딸기 밀크", "딸기 우유", "딸기우유"],
    },
    {
        id: 6,
        name: "딥 초코 프라페",
        en: "DEEP CHOCOLATE FRAPPÉ",
        price: 5800,
        category: "frappe",
        description: "진한 초콜릿과 달콤한 크림을 시원하게 즐겨요.",
        temps: ["ICE"],
        allergens: "우유, 대두",
        aliases: ["딥 초코 프라페", "초코 프라페", "초코프라페", "프라페"],
    },
    {
        id: 7,
        name: "생딸기 케이크",
        en: "STRAWBERRY CAKE",
        price: 6500,
        category: "bakery",
        badge: "BEST",
        description: "폭신한 시트 사이로 생크림과 상큼한 딸기.",
        temps: [],
        allergens: "밀, 우유, 달걀",
        aliases: ["생딸기 케이크", "딸기 케이크", "딸기케이크"],
    },
    {
        id: 8,
        name: "버터 크루아상",
        en: "BUTTER CROISSANT",
        price: 3800,
        category: "bakery",
        description: "겹겹이 바삭하게, 풍부하게 퍼지는 버터 향.",
        temps: [],
        allergens: "밀, 우유, 달걀",
        aliases: ["버터 크루아상", "크루아상", "크로와상"],
    },
    {
        id: 9,
        name: "바스크 치즈케이크",
        en: "BASQUE CHEESECAKE",
        price: 5900,
        category: "bakery",
        badge: "NEW",
        description: "짙게 구운 표면 속 부드럽고 진한 치즈.",
        temps: [],
        allergens: "우유, 달걀, 밀",
        aliases: ["바스크 치즈케이크", "치즈케이크", "치즈 케이크", "바스크"],
    },
]

export const CATEGORIES = [
    { id: "all", label: "전체 메뉴", icon: "grid" },
    { id: "coffee", label: "커피", icon: "coffee" },
    { id: "noncoffee", label: "논커피", icon: "leaf" },
    { id: "frappe", label: "프라페", icon: "frappe" },
    { id: "bakery", label: "베이커리", icon: "cake" },
]

export const money = (n) =>
    typeof n === "number" ? `${n.toLocaleString("ko-KR")}원` : n

export function defaults(menu) {
    return {
        temperature: menu.temps?.[0] || "",
        size: "Regular",
        shots: 0,
        quantity: 1,
    }
}

export function unitPrice(menu, options = {}) {
    const sizeExtra =
        options.size === "Large" && menu.category !== "bakery" ? 700 : 0
    const shotsExtra =
        menu.category === "coffee" && options.shots ? options.shots * 500 : 0
    return menu.price + sizeExtra + shotsExtra
}

export function lineKey(id, o = {}) {
    return `${id}:${o.temperature || ""}:${o.size || "Regular"}:${o.shots || 0}`
}

export function total(cart = []) {
    return cart.reduce((sum, line) => {
        const menu = MENUS.find((m) => m.id === line.id)
        return sum + (menu ? unitPrice(menu, line) * line.quantity : 0)
    }, 0)
}

export function optionsText(line) {
    const m = MENUS.find((m) => m.id === line.id)
    if (!m) return ""
    return m.category === "bakery"
        ? "1조각 / 개"
        : [
              line.temperature,
              line.size,
              line.shots ? `샷 ${line.shots} 추가` : null,
          ]
              .filter(Boolean)
              .join(" · ")
}

import { MENUS } from "./menuData"

/**
 * AI 추천 카테고리 연동 모듈
 * ──────────────────────────────────────────────────────────────────
 * 화면은 아래 형태의 "추천 결과"만 사용합니다. AI 응답 형식이 바뀌면 이 파일만 고치면 됩니다.
 *
 *   Recommendation = {
 *     keywords: string[]   // 화면에 보여줄 조건 (예: ["따뜻한"])
 *     menuIds:  number[]   // 추천 메뉴 id (표시 순서 그대로)
 *     source:   "ai" | "local"
 *   }
 *
 * ▸ AI 쪽에 요청할 응답 필드 (voice/analyze의 result 안)
 *     result.recommendations : 메뉴 목록. 아래 형식 중 아무거나 허용
 *                              - 메뉴 id 숫자        [1, 2]
 *                              - 메뉴 이름 문자열    ["아메리카노"]
 *                              - 객체               [{ menuId: 1 }] / [{ id: 1 }] / [{ menu: "아메리카노" }]
 *     result.keywords        : (선택) 사용자 발화에서 뽑은 조건 키워드 ["따뜻한"]
 *
 *   - recommendations 필드가 아예 없으면 → AI가 아직 추천을 지원하지 않는 것으로 보고
 *     프론트엔드 키워드 규칙(fromText)으로 대신 추천합니다.
 *   - recommendations가 빈 배열이면 → AI가 "추천 없음"으로 판단한 것이므로 추천하지 않습니다.
 */

/** 메뉴 이름·별칭 → 메뉴 (AI가 이름으로 보낼 때 사용) */
function findMenuByName(name) {
    const compact = String(name).replace(/\s/g, "")
    return MENUS.find(
        (m) =>
            m.name.replace(/\s/g, "") === compact ||
            m.aliases?.some((a) => a.replace(/\s/g, "") === compact)
    )
}

function toMenuId(entry) {
    if (typeof entry === "number") return MENUS.some((m) => m.id === entry) ? entry : null
    if (typeof entry === "string") return findMenuByName(entry)?.id ?? null
    if (entry && typeof entry === "object") {
        const id = entry.menuId ?? entry.id
        if (id !== undefined) return toMenuId(Number(id))
        const name = entry.menu ?? entry.name ?? entry.menuName
        if (name !== undefined) return toMenuId(String(name))
    }
    return null
}

/**
 * AI 응답에서 추천 결과를 꺼냅니다.
 * @returns {Recommendation | null | undefined}
 *   undefined: AI가 추천 필드를 보내지 않음(미지원) / null: 추천 없음
 */
export function fromAiResult(result) {
    if (!result || !Array.isArray(result.recommendations)) return undefined
    const menuIds = [...new Set(result.recommendations.map(toMenuId).filter((id) => id !== null))]
    if (!menuIds.length) return null
    const keywords = Array.isArray(result.keywords)
        ? result.keywords.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim())
        : []
    return { keywords, menuIds, source: "ai" }
}

/* ── 프론트엔드 임시 키워드 규칙 (AI 추천이 준비되기 전까지 사용) ── */
const SWEET_MENU_IDS = new Set([2, 5, 6, 7, 9])

const KEYWORD_RULES = [
    { keyword: "따뜻한", pattern: /따뜻|따듯|뜨거|뜨끈|핫|hot/i, match: (m) => m.temps.includes("HOT") },
    { keyword: "시원한", pattern: /시원|차가|차갑|아이스|ice/i, match: (m) => m.temps.includes("ICE") },
    {
        keyword: "커피 말고",
        pattern: /논커피|커피\s*(?:말고|빼고|없는|아닌|안\s*들어간)|카페인\s*(?:없|빼)/,
        match: (m) => m.category !== "coffee",
    },
    {
        keyword: "커피",
        pattern: /(?<!논)커피(?!\s*(?:말고|빼고|없는|아닌|안\s*들어간))/,
        match: (m) => m.category === "coffee",
    },
    { keyword: "달달한", pattern: /달달|달콤|단\s*거|단것|달게|스위트/, match: (m) => SWEET_MENU_IDS.has(m.id) },
    {
        keyword: "우유 없는",
        pattern: /우유\s*(?:없|빼|말고|안\s*들어간)|유당/,
        match: (m) => !m.allergens.includes("우유"),
    },
    { keyword: "디저트", pattern: /디저트|빵|케이크|베이커리|간식/, match: (m) => m.category === "bakery" },
    { keyword: "음료", pattern: /음료|마실\s*거|마실것|마시고/, match: (m) => m.category !== "bakery" },
]

/**
 * 사용자 발화에서 조건 키워드를 찾아 메뉴를 고릅니다. (여러 조건은 모두 만족하는 메뉴만)
 * @returns {Recommendation | null} 조건 키워드가 하나도 없으면 null
 */
export function fromText(text = "") {
    const rules = KEYWORD_RULES.filter((rule) => rule.pattern.test(text))
    if (!rules.length) return null
    return {
        keywords: rules.map((rule) => rule.keyword),
        menuIds: MENUS.filter((m) => rules.every((rule) => rule.match(m))).map((m) => m.id),
        source: "local",
    }
}

/**
 * 음성 주문 결과에서 추천을 결정합니다.
 * @param {object|null} aiResult   AI 응답 result (브라우저 음성 모드는 null)
 * @param {string} text            인식한 문장
 * @param {object} [options]
 * @param {boolean} [options.allowLocal=true]  AI 미지원 시 키워드 규칙을 쓸지 (주문이 반영된 발화면 false)
 */
export function resolveRecommendation(aiResult, text, { allowLocal = true } = {}) {
    const ai = fromAiResult(aiResult)
    if (ai === null) return null
    if (ai) {
        // AI가 키워드를 안 보내면 발화에서 찾은 키워드를 제목으로 사용
        return ai.keywords.length ? ai : { ...ai, keywords: fromText(text)?.keywords ?? [] }
    }
    return allowLocal ? fromText(text) : null
}

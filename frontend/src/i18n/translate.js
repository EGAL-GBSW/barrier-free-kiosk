import { MESSAGES } from "./messages"

export const DEFAULT_LANGUAGE = "ko"

/** 문구 키를 해당 언어로 바꿉니다. 없는 키는 한국어 문구, 그것도 없으면 키 자체를 돌려줍니다. */
export function translate(lang, key, params) {
    const text = MESSAGES[lang]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (match, name) =>
        params[name] === undefined ? match : String(params[name])
    )
}

/**
 * React 밖(API 클라이언트 등)에서 쓰는 현재 언어.
 * AppLayout이 <html lang>에 선택한 언어를 반영하므로 그 값을 읽습니다.
 */
export function getLanguage() {
    const lang = typeof document === "undefined" ? "" : document.documentElement.lang
    return MESSAGES[lang] ? lang : DEFAULT_LANGUAGE
}

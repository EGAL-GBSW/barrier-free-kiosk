import { createContext, useContext } from "react"
import { translate, DEFAULT_LANGUAGE } from "./translate"
import { localizeMenu, money, optionsText } from "../components/menu/menuData"

/** 선택한 언어에 묶인 번역 도구 묶음을 만듭니다. App이 언어가 바뀔 때마다 새로 만들어 내려줍니다. */
export function createI18n(lang = DEFAULT_LANGUAGE) {
    return {
        lang,
        t: (key, params) => translate(lang, key, params),
        money: (n) => money(n, lang),
        menu: (menu) => localizeMenu(menu, lang),
        options: (line) => optionsText(line, lang),
    }
}

export const I18nContext = createContext(createI18n())

/** 컴포넌트에서 { lang, t, money, menu, options }를 꺼내 씁니다. */
export function useI18n() {
    return useContext(I18nContext)
}

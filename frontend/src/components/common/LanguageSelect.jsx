import "./LanguageSelect.css"

/**
 * LanguageSelect
 * 화면 언어 선택 드롭다운 (한국어 / English / 日本語).
 * 상단 헤더(KioskHeader) 오른쪽, 글자 크기 조절 바로 왼쪽에 위치합니다.
 * 실제 <html lang="ko|en|ja"> 반영은 AppLayout이 담당합니다.
 *
 * Props:
 *   language    {string}   현재 언어 코드 ('ko' | 'en' | 'ja')
 *   onLanguage  {Function} 언어 변경 콜백 (code: string) => void
 */
const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
]

function LanguageSelect({ language = "ko", onLanguage }) {
  return (
    <select
      className="language-select"
      value={language}
      onChange={(e) => onLanguage?.(e.target.value)}
      aria-label="언어 선택 (Language)"
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code} lang={code}>
          {label}
        </option>
      ))}
    </select>
  )
}

export default LanguageSelect

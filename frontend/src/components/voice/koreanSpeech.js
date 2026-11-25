/** 기기에 설치된 한국어 음성을 우선 사용한다. 음성 품질은 브라우저와 OS에 따라 다르다. */
export function makeKoreanUtterance(message, synthesis, Utterance) {
    if (!synthesis || !Utterance) return null
    const utterance = new Utterance(message)
    utterance.lang = "ko-KR"
    utterance.rate = 0.9
    utterance.pitch = 1
    const voices = synthesis.getVoices?.() || []
    const korean = voices.filter((voice) => /^ko(?:-|$)/i.test(voice.lang))
    utterance.voice = korean.find((voice) => /natural|neural/i.test(voice.name))
        || korean.find((voice) => /^ko-kr$/i.test(voice.lang))
        || korean[0]
        || null
    return utterance
}

import { test } from "node:test"
import assert from "node:assert/strict"
import { makeKoreanUtterance } from "./koreanSpeech.js"

class Utterance {
    constructor(text) { this.text = text }
}

test("available Korean natural voice is selected for the question", () => {
    const korean = { lang: "ko-KR", name: "Korean Natural" }
    const speech = makeKoreanUtterance("어떤 메뉴로 드릴까요?", {
        getVoices: () => [{ lang: "en-US", name: "English" }, korean],
    }, Utterance)
    assert.equal(speech.voice, korean)
    assert.equal(speech.lang, "ko-KR")
    assert.equal(speech.rate, 0.9)
    assert.equal(speech.text, "어떤 메뉴로 드릴까요?")
})

test("missing synthesis is reported and browser can use its default voice", () => {
    assert.equal(makeKoreanUtterance("안내", null, Utterance), null)
    assert.equal(makeKoreanUtterance("안내", { getVoices: () => [] }, Utterance).voice, null)
})

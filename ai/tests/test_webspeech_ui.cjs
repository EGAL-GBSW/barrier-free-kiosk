/* Run with node --test tests/test_webspeech_ui.cjs. No browser, network or API key needed. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../webspeech_eval/app.js"), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function createHarness({ compatible = true, analysis = {}, analysisFails = false } = {}) {
  const events = [];
  const elements = new Map();
  const fixtures = [{
    id: 1, file_name: "sample.m4a", reference: "정답 문장", expected_menu: "테스트",
    utterance_type: "주문", audio_url: "/api/audio/1", error: null,
  }];

  class Element {
    constructor(id = "") {
      this.id = id; this.handlers = {}; this.dataset = {}; this.disabled = false;
      this.checked = false; this.value = ""; this.textContent = ""; this.children = [];
      this.className = ""; this.classList = { toggle() {} };
    }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    append(child) {
      this.children.push(child);
      if (this.id === "calibration-case" && !this.value) this.value = child.value;
    }
    replaceChildren(...children) { this.children = children; }
    trigger(name) { return this.handlers[name]?.({ target: this }); }
    click() { return this.trigger("click"); }
  }
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element(id));
      return elements.get(id);
    },
    createElement() { return new Element(); },
  };
  document.getElementById("limit").value = "1";

  const instances = { audios: [], recognitions: [] };
  class MediaElement {}
  MediaElement.HAVE_FUTURE_DATA = 3;
  if (compatible) MediaElement.prototype.captureStream = function () {
    const track = { kind: "audio", readyState: "live", stop() { events.push("track-stop"); } };
    return { getAudioTracks: () => [track], getTracks: () => [track] };
  };
  class FakeAudio extends MediaElement {
    constructor() { super(); this.readyState = 4; this.duration = 1; instances.audios.push(this); }
    addEventListener() {}
    removeEventListener() {}
    removeAttribute() {}
    load() {}
    pause() { events.push("pause"); }
    play() { events.push("play"); return Promise.resolve(); }
  }
  class FakeRecognition {
    constructor() { instances.recognitions.push(this); }
    start(track) { this.track = track; this.onstart?.(); }
    stop() { queueMicrotask(() => this.onend?.()); }
    abort() { events.push("recognition-abort"); }
  }
  const calls = [];
  async function fetch(url, options = {}) {
    calls.push({ url, options });
    if (url === "/api/cases") return { ok: true, json: async () => ({ cases: fixtures }) };
    if (url === "/api/analyze" && analysisFails) return {
      ok: false, status: 502, json: async () => ({ detail: "분석 서버 연결 실패" }),
    };
    if (url === "/api/analyze") return {
      ok: true, json: async () => ({
        cer: 0.1,
        analysis: { decision: "ask_clarification", question: "아이스로 드릴까요?", reason: "온도 누락", items: [], ...analysis },
      }),
    };
    throw new Error(`Unexpected request: ${url}`);
  }
  const window = {
    SpeechRecognition: compatible ? FakeRecognition : undefined,
    isSecureContext: true,
    location: { href: "http://localhost:8765/", origin: "http://localhost:8765" },
  };
  const context = vm.createContext({
    window, document, navigator: { userAgent: "Chrome/140.0.0.0" },
    HTMLMediaElement: MediaElement, Audio: FakeAudio, fetch, AbortController,
    DOMException, URL, Blob, performance, setTimeout, clearTimeout, console,
  });
  vm.runInContext(script, context, { filename: "webspeech_eval/app.js" });
  return { context, elements, fixtures, calls, instances, events };
}

function finalResult(text) {
  return { 0: { transcript: text }, isFinal: true };
}
function interimResult(text) {
  return { 0: { transcript: text }, isFinal: false };
}
function finishAudio(h, text = "녹음 결과") {
  const recognition = h.instances.recognitions.at(-1);
  const audio = h.instances.audios.at(-1);
  if (text !== null) recognition.onresult({ resultIndex: 0, results: [finalResult(text)] });
  audio.onended();
}

async function calibrate(h) {
  const pending = h.elements.get("calibrate").click();
  await tick();
  finishAudio(h);
  await pending;
  h.elements.get("calibrated").checked = true;
  h.elements.get("calibrated").trigger("change");
}

test("recording calibration is required before evaluation and does not call OpenAI", async () => {
  const h = createHarness();
  await tick();
  assert.equal(h.elements.get("run").disabled, true);
  assert.equal(h.elements.get("calibrated").disabled, true);
  await calibrate(h);
  assert.equal(h.elements.get("calibration-transcript").textContent, "녹음 결과");
  assert.equal(h.elements.get("run").disabled, false);
  assert.equal(h.calls.filter((call) => call.url === "/api/analyze").length, 0);
});

test("collects only ordered final recognition results, ignoring interim results", async () => {
  const h = createHarness();
  await tick();
  h.context.caseForTest = h.fixtures[0];
  h.context.signalForTest = new AbortController().signal;
  const pending = vm.runInContext("recognizeFile(caseForTest, signalForTest)", h.context);
  await tick();
  const recognition = h.instances.recognitions.at(-1);
  recognition.onresult({ resultIndex: 0, results: [finalResult("첫 문장"), interimResult("미완성")] });
  recognition.onresult({ resultIndex: 1, results: [finalResult("첫 문장"), finalResult("두 번째")] });
  h.instances.audios.at(-1).onended();
  assert.equal((await pending).transcript, "첫 문장 두 번째");
  assert.equal(recognition.track.kind, "audio");
  assert.ok(h.events.includes("track-stop"));
});

test("successful evaluation sends recognized text and renders clarification label", async () => {
  const h = createHarness();
  await tick();
  await calibrate(h);
  const pending = h.elements.get("run").click();
  await tick();
  finishAudio(h, "아메리카노 주세요");
  await pending;
  const calls = h.calls.filter((call) => call.url === "/api/analyze");
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), { case_id: 1, transcript: "아메리카노 주세요" });
  const cells = h.elements.get("results").children[0].children.map((cell) => cell.textContent);
  assert.ok(cells.includes("재질문"));
  assert.ok(cells.some((text) => text.includes("아이스로 드릴까요?")));
});

test("no recognized text records an error and never calls the analyzer", async () => {
  const h = createHarness();
  await tick();
  await calibrate(h);
  const pending = h.elements.get("run").click();
  await tick();
  finishAudio(h, null);
  await pending;
  assert.equal(h.calls.filter((call) => call.url === "/api/analyze").length, 0);
  const cells = h.elements.get("results").children[0].children.map((cell) => cell.textContent);
  assert.ok(cells.some((text) => text.includes("인식된 문장이 없습니다")));
});

test("recognition ending before playback is rejected", async () => {
  const h = createHarness();
  await tick();
  h.context.caseForTest = h.fixtures[0];
  h.context.signalForTest = new AbortController().signal;
  const pending = vm.runInContext("recognizeFile(caseForTest, signalForTest)", h.context);
  await tick();
  h.instances.recognitions.at(-1).onend();
  await assert.rejects(pending, /재생이 끝나기 전에 인식이 종료/);
  assert.ok(h.events.includes("track-stop"));
});

test("stop aborts ongoing recognition and does not call analyzer", async () => {
  const h = createHarness();
  await tick();
  await calibrate(h);
  const pending = h.elements.get("run").click();
  await tick();
  h.elements.get("stop").click();
  await pending;
  assert.equal(h.calls.filter((call) => call.url === "/api/analyze").length, 0);
  assert.ok(h.events.includes("recognition-abort"));
  assert.match(h.elements.get("progress").textContent, /중지/);
});

test("CSV values neutralize spreadsheet formulas and escape quotes", async () => {
  const h = createHarness();
  await tick();
  for (const value of ["=SUM(1,2)", "  +cmd", "-2+3", "@example", "\t=1"]) {
    h.context.valueForTest = value;
    assert.ok(vm.runInContext("csvValue(valueForTest)", h.context).startsWith(`"'`));
  }
  h.context.valueForTest = 'say "hello"';
  assert.equal(vm.runInContext("csvValue(valueForTest)", h.context), '"say ""hello"""');
});

test("STT CER remains available when the order analysis cannot run", async () => {
  const h = createHarness({ analysisFails: true });
  await tick();
  await calibrate(h);
  const pending = h.elements.get("run").click();
  await tick();
  finishAudio(h, "정답 문장");
  await pending;
  const cells = h.elements.get("results").children[0].children.map((cell) => cell.textContent);
  assert.ok(cells.includes("정답 문장"));
  assert.ok(cells.includes("0"));
  assert.ok(cells.some((text) => text.includes("분석 서버 연결 실패")));
});

test("unsupported browser leaves calibration and evaluation disabled", async () => {
  const h = createHarness({ compatible: false });
  await tick();
  assert.equal(h.elements.get("calibrate").disabled, true);
  assert.equal(h.elements.get("run").disabled, true);
  assert.match(h.elements.get("browser-status").textContent, /Chrome/);
});

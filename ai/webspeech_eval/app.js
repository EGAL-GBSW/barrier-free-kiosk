/* Saved audio is replayed in real time as a MediaStreamTrack, not uploaded to OpenAI. */
"use strict";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  "browser-status", "calibration-case", "calibrate", "calibration-reference",
  "calibration-transcript", "calibration-status", "calibrated", "limit", "run",
  "stop", "download", "reset", "progress", "results",
].map((id) => [id, $(id)]));
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const chromeVersion = Number((navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || 0);
const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
const supported = Boolean(Recognition && chromeVersion >= 135 && !mobile &&
  HTMLMediaElement.prototype.captureStream && window.isSecureContext);
let cases = [];
const results = new Map();
let busy = false;
let controller = null;

function message(element, value, isError = false) {
  element.textContent = value;
  element.classList.toggle("failure", isError);
}

function updateControls() {
  const available = cases.some((item) => !item.error && item.audio_url);
  ui["calibration-case"].disabled = busy || !supported || !available;
  ui.calibrate.disabled = busy || !supported || !available;
  ui.calibrated.disabled = busy || ui.calibrated.dataset.ready !== "true";
  ui.limit.disabled = busy;
  ui.run.disabled = busy || !supported || !available || !ui.calibrated.checked;
  ui.stop.disabled = !busy;
  ui.download.disabled = busy || results.size === 0;
  ui.reset.disabled = busy || results.size === 0;
}

function caseKey(item) { return String(item.id); }
function selectedCase() {
  return cases.find((item) => caseKey(item) === ui["calibration-case"].value);
}

// Preserve the STT score even if the later OpenAI request fails.
function normalizedCer(reference, transcript) {
  const normalize = (text) => Array.from(String(text).normalize("NFC").toLowerCase())
    .filter((char) => !/[\s\p{P}]/u.test(char));
  const expected = normalize(reference);
  const actual = normalize(transcript);
  if (!expected.length) return null;
  let previous = Array.from({ length: actual.length + 1 }, (_, i) => i);
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let col = 1; col <= actual.length; col += 1) {
      current.push(Math.min(current[col - 1] + 1, previous[col] + 1,
        previous[col - 1] + (expected[row - 1] === actual[col - 1] ? 0 : 1)));
    }
    previous = current;
  }
  return Math.round((previous[actual.length] / expected.length) * 10000) / 10000;
}

function readJson(response) {
  return response.json().catch(() => { throw new Error("서버 응답을 읽지 못했습니다."); });
}

async function loadCases() {
  try {
    const response = await fetch("/api/cases", { cache: "no-store" });
    if (!response.ok) throw new Error(`평가 목록을 불러오지 못했습니다. (HTTP ${response.status})`);
    const payload = await readJson(response);
    if (!Array.isArray(payload.cases)) throw new Error("평가 목록 형식이 올바르지 않습니다.");
    cases = payload.cases;
    for (const item of cases) {
      if (item.error || !item.audio_url) continue;
      const option = document.createElement("option");
      option.value = caseKey(item);
      option.textContent = `${item.id} · ${item.file_name || "음성 파일"}`;
      ui["calibration-case"].append(option);
    }
    message(ui.progress, `평가표 ${cases.length}건을 불러왔습니다. 먼저 입력 확인을 진행하세요.`);
    if (!cases.length) message(ui.progress, "평가할 행이 없습니다.", true);
  } catch (error) {
    message(ui.progress, error.message || "평가 목록을 불러오지 못했습니다.", true);
  }
  updateControls();
}

function waitForPlayable(audio, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("음성 파일을 준비하는 시간이 초과됐습니다.")), 20000);
    const ready = () => finish();
    const failed = () => finish(new Error("음성 파일을 재생할 수 없습니다. 형식과 브라우저를 확인하세요."));
    const aborted = () => finish(new DOMException("사용자가 중지했습니다.", "AbortError"));
    function finish(error) {
      clearTimeout(timer);
      audio.removeEventListener("canplay", ready);
      audio.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      error ? reject(error) : resolve();
    }
    audio.addEventListener("canplay", ready, { once: true });
    audio.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) ready();
    else audio.load();
  });
}

async function recognizeFile(item, signal) {
  if (!supported) throw new Error("오디오 트랙 음성 인식을 지원하는 데스크톱 Chrome/Edge가 필요합니다.");
  if (item.error || !item.audio_url) throw new Error(String(item.error || "음성 파일을 찾을 수 없습니다."));
  const url = new URL(item.audio_url, window.location.href);
  if (url.origin !== window.location.origin) throw new Error("같은 서버의 음성 파일만 사용할 수 있습니다.");
  const audio = new Audio();
  audio.preload = "auto";
  // Muting the media element does not mute a captured stream. It also avoids
  // accidentally letting a microphone hear speaker playback during validation.
  audio.muted = true;
  audio.src = url.href;
  await waitForPlayable(audio, signal);
  if (signal.aborted) throw new DOMException("사용자가 중지했습니다.", "AbortError");
  const stream = audio.captureStream();
  const track = stream.getAudioTracks()[0];
  if (!track || track.kind !== "audio" || track.readyState !== "live") {
    stream.getTracks().forEach((current) => current.stop());
    throw new Error("음성 파일에서 재생 가능한 오디오 트랙을 가져오지 못했습니다.");
  }

  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;
    const finalParts = [];
    let ended = false;
    let settled = false;
    const start = performance.now();
    const duration = Number.isFinite(audio.duration) ? audio.duration : 120;
    const timer = setTimeout(() => finish(new Error("음성 인식 시간이 초과됐습니다.")), Math.max(30000, Math.ceil(duration * 2000 + 30000)));
    let finalTimer;

    function cleanup() {
      clearTimeout(timer);
      clearTimeout(finalTimer);
      signal.removeEventListener("abort", abort);
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
      audio.onended = audio.onerror = null;
      audio.pause();
      stream.getTracks().forEach((current) => current.stop());
      audio.removeAttribute("src");
      audio.load();
    }
    function finish(error, value) {
      if (settled) return;
      settled = true;
      if (error) { try { recognition.abort(); } catch (_) { /* already stopped */ } }
      cleanup();
      error ? reject(error) : resolve(value);
    }
    function abort() { finish(new DOMException("사용자가 중지했습니다.", "AbortError")); }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    recognition.onstart = () => {
      audio.play().catch(() => finish(new Error("브라우저가 음성 파일 재생을 차단했습니다. 다시 시작해 주세요.")));
    };
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalParts[i] = event.results[i][0].transcript.trim();
      }
    };
    recognition.onerror = (event) => finish(new Error(`브라우저 음성 인식 오류: ${event.error || "unknown"}`));
    recognition.onend = () => {
      if (!ended) return finish(new Error("음성 재생이 끝나기 전에 인식이 종료됐습니다. 전체 파일을 인식하지 못했을 수 있습니다."));
      const transcript = finalParts.filter(Boolean).join(" ").trim();
      if (!transcript) return finish(new Error("인식된 문장이 없습니다."));
      finish(null, { transcript, seconds: (performance.now() - start) / 1000 });
    };
    audio.onended = () => {
      ended = true;
      try { recognition.stop(); } catch (_) { /* onend may already be queued */ }
      finalTimer = setTimeout(() => finish(new Error("음성 인식 최종 결과가 도착하지 않았습니다.")), 15000);
    };
    audio.onerror = () => finish(new Error("음성 재생 중 오류가 발생했습니다."));
    try { recognition.start(track); }
    catch (error) { finish(new Error(`오디오 트랙 인식을 시작할 수 없습니다: ${error.name}`)); }
  });
}

function setBusy(value) {
  busy = value;
  controller = value ? new AbortController() : null;
  updateControls();
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
  row.append(cell);
  return cell;
}

function displayItems(serialized) {
  if (!serialized) return "";
  try {
    const items = JSON.parse(serialized);
    if (!Array.isArray(items)) return "";
    const actions = { add: "추가", remove: "취소", set_quantity: "수량 변경", replace: "교체", inquire: "문의", unknown: "미확인" };
    const temperatures = { ICE: "아이스", HOT: "핫" };
    return items.map((item) => [
      item.menu_name || "메뉴 미확인",
      item.quantity == null ? "수량 미확인" : `${item.quantity}개`,
      temperatures[item.temperature] || "온도 미확인/해당 없음",
      actions[item.action] || "동작 미확인",
    ].join(" · ")).join("\n");
  } catch (_) { return ""; }
}

function renderResults() {
  ui.results.replaceChildren();
  if (!results.size) {
    const row = document.createElement("tr");
    const cell = addCell(row, "아직 평가 결과가 없습니다.");
    cell.colSpan = 9;
    cell.className = "muted";
    ui.results.append(row);
    return;
  }
  for (const record of results.values()) {
    const row = document.createElement("tr");
    addCell(row, `${record.id} · ${record.file_name || "음성"}`);
    addCell(row, record.reference);
    addCell(row, record.transcript);
    addCell(row, record.cer);
    addCell(row, record.expected_menu);
    addCell(row, displayItems(record.items));
    addCell(row, record.decision);
    addCell(row, [record.question, record.reason].filter(Boolean).join(" / "));
    addCell(row, record.error || record.status).className = record.error ? "failure" : "success";
    ui.results.append(row);
  }
}

const decisionNames = {
  ready_to_confirm: "최종 확인 필요",
  ask_clarification: "재질문",
  undetermined: "판단 불가",
};

async function analyze(item, transcript, signal) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: item.id, transcript }),
    signal,
  });
  const data = await readJson(response);
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : `HTTP ${response.status}`;
    throw new Error(`주문 분석 실패: ${detail}`);
  }
  if (!data.analysis || typeof data.analysis !== "object") throw new Error("주문 분석 결과 형식이 올바르지 않습니다.");
  return data;
}

ui["calibration-case"].addEventListener("change", () => {
  const item = selectedCase();
  ui["calibration-reference"].textContent = item?.reference || "—";
  ui["calibration-transcript"].textContent = "—";
  ui.calibrated.checked = false;
  ui.calibrated.dataset.ready = "false";
  message(ui["calibration-status"], "");
  updateControls();
});

ui.calibrate.addEventListener("click", async () => {
  const item = selectedCase();
  if (!item || busy) return;
  ui.calibrated.checked = false;
  ui.calibrated.dataset.ready = "false";
  ui["calibration-reference"].textContent = item.reference || "—";
  ui["calibration-transcript"].textContent = "인식 중…";
  message(ui["calibration-status"], "음성 파일을 인식하고 있습니다. OpenAI에는 아직 전송하지 않습니다.");
  setBusy(true);
  try {
    const outcome = await recognizeFile(item, controller.signal);
    ui["calibration-transcript"].textContent = outcome.transcript;
    ui.calibrated.dataset.ready = "true";
    message(ui["calibration-status"], "파일 내용이 인식됐는지 확인한 후 아래 항목을 체크해 주세요.");
  } catch (error) {
    ui["calibration-transcript"].textContent = "—";
    message(ui["calibration-status"], error.message || "인식 확인에 실패했습니다.", true);
  } finally { setBusy(false); }
});

ui.calibrated.addEventListener("change", updateControls);
ui.stop.addEventListener("click", () => {
  if (controller) {
    controller.abort();
    message(ui.progress, "중지하고 있습니다. 이미 전송한 주문 분석 요청은 서버에서 처리됐을 수 있습니다.");
  }
});

ui.run.addEventListener("click", async () => {
  if (busy || !ui.calibrated.checked) return;
  const requested = Number(ui.limit.value);
  if (!Number.isInteger(requested) || requested < 0) {
    message(ui.progress, "평가 개수는 0 이상의 정수여야 합니다.", true);
    return;
  }
  const selected = requested === 0 ? cases : cases.slice(0, requested);
  setBusy(true);
  const signal = controller.signal;
  try {
    for (let i = 0; i < selected.length; i += 1) {
      if (signal.aborted) throw new DOMException("사용자가 중지했습니다.", "AbortError");
      const item = selected[i];
      const key = caseKey(item);
      if (results.has(key) && !results.get(key).error) continue;
      message(ui.progress, `${i + 1} / ${selected.length} · ${item.file_name || item.id} 인식 중`);
      let transcript = "";
      let seconds = null;
      try {
        const outcome = await recognizeFile(item, signal);
        transcript = outcome.transcript;
        seconds = Math.round(outcome.seconds * 100) / 100;
        if (signal.aborted) throw new DOMException("사용자가 중지했습니다.", "AbortError");
        message(ui.progress, `${i + 1} / ${selected.length} · 주문 분석 중`);
        const data = await analyze(item, transcript, signal);
        const analysis = data.analysis;
        results.set(key, {
          id: item.id, file_name: item.file_name, reference: item.reference,
          expected_menu: item.expected_menu, utterance_type: item.utterance_type,
          transcript, cer: data.cer, seconds,
          decision: decisionNames[analysis.decision] || "판단 불가",
          question: analysis.question || "", reason: analysis.reason || "",
          items: Array.isArray(analysis.items) ? JSON.stringify(analysis.items) : "",
          status: "완료 · 수동 검토 필요", error: "",
        });
      } catch (error) {
        if (error.name === "AbortError") throw error;
        results.set(key, {
          id: item.id, file_name: item.file_name, reference: item.reference,
          expected_menu: item.expected_menu, utterance_type: item.utterance_type,
          transcript, cer: transcript ? normalizedCer(item.reference, transcript) : null,
          seconds, decision: "판단 불가", question: "", reason: "", items: "",
          status: "오류", error: error.message || "처리하지 못했습니다.",
        });
      }
      renderResults();
    }
    message(ui.progress, `평가 처리 완료: ${selected.length}건 중 ${selected.filter((item) => results.has(caseKey(item))).length}건 기록.`);
  } catch (error) {
    message(ui.progress, error.name === "AbortError" ? "중지했습니다. 완료된 결과는 유지됩니다. 이미 전송한 요청은 처리됐을 수 있습니다." : (error.message || "평가를 중지했습니다."), true);
  } finally { setBusy(false); }
});

function csvValue(value) {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula execution, including whitespace-prefixed formulas.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

ui.download.addEventListener("click", () => {
  const columns = [
    ["번호", "id"], ["파일명", "file_name"], ["정답 문장", "reference"],
    ["정답 메뉴", "expected_menu"], ["발화 유형", "utterance_type"],
    ["인식 문장", "transcript"], ["정규화 CER", "cer"], ["인식 시간(초, 재생 포함)", "seconds"],
    ["주문 판단(수동 검토)", "decision"], ["재질문", "question"], ["판단 사유", "reason"],
    ["분석 품목", "items"], ["상태", "status"], ["오류", "error"],
  ];
  const lines = [columns.map(([title]) => csvValue(title)).join(",")];
  for (const row of results.values()) lines.push(columns.map(([, key]) => csvValue(row[key])).join(","));
  const url = URL.createObjectURL(new Blob(["\ufeff", lines.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "webspeech_order_results.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

ui.reset.addEventListener("click", () => {
  results.clear();
  renderResults();
  message(ui.progress, "결과를 초기화했습니다. 다시 평가하면 OpenAI 요청이 다시 발생합니다.");
  updateControls();
});

if (!supported) {
  message(ui["browser-status"], "지원되는 데스크톱 Chrome 135+ 또는 호환 Edge와 보안 컨텍스트(localhost/HTTPS)가 필요합니다. 브라우저 확인 뒤 다시 접속하세요.", true);
} else {
  message(ui["browser-status"], "브라우저 기본 조건을 확인했습니다. 아래 음성 인식 확인으로 실제 입력 트랙 사용을 직접 확인하세요.");
}
loadCases();

"""Local-only Web Speech evaluation service for the pilot XLSX and audio ZIP."""

from __future__ import annotations

import argparse
import unicodedata
from collections import Counter
from contextlib import closing
from pathlib import Path, PurePosixPath
from typing import Callable, Optional
from zipfile import BadZipFile, ZipFile, ZipInfo

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from openpyxl import load_workbook
from pydantic import BaseModel, StrictInt, StrictStr


MAX_AUDIO_BYTES = 25 * 1024 * 1024
SUPPORTED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".webm"}
AUDIO_MEDIA_TYPES = {".wav": "audio/wav", ".mp3": "audio/mpeg",
                     ".m4a": "audio/mp4", ".webm": "audio/webm"}
REQUIRED_COLUMNS = {"파일명", "원본 파일명", "정답 문장"}
WEB_ROOT = Path(__file__).parent


def filename_key(name: str) -> str:
    """Compare macOS/Windows Korean filenames using the same Unicode form."""
    basename = PurePosixPath(name.replace("\\", "/")).name
    return unicodedata.normalize("NFC", basename).casefold()


def normalize(text: str) -> str:
    """Match the existing pilot CER normalization: ignore whitespace and punctuation."""
    return "".join(
        char for char in unicodedata.normalize("NFC", text).lower()
        if not char.isspace() and not unicodedata.category(char).startswith("P")
    )


def character_error_rate(reference: str, actual: str) -> Optional[float]:
    reference = normalize(reference)
    actual = normalize(actual)
    if not reference:
        return None
    previous = list(range(len(actual) + 1))
    for row, expected_char in enumerate(reference, start=1):
        current = [row]
        for col, actual_char in enumerate(actual, start=1):
            current.append(min(current[col - 1] + 1, previous[col] + 1,
                               previous[col - 1] + (expected_char != actual_char)))
        previous = current
    return round(previous[-1] / len(reference), 4)


def load_cases(xlsx_path: Path, zip_path: Path, limit: Optional[int] = None) -> list[dict]:
    """Read input data without extracting, rewriting or loading audio into RAM."""
    if limit is not None and limit < 1:
        raise ValueError("limit must be positive")

    with ZipFile(zip_path) as archive:
        by_name: dict[str, list[ZipInfo]] = {}
        for entry in archive.infolist():
            if entry.is_dir() or PurePosixPath(entry.filename).suffix.lower() not in SUPPORTED_AUDIO_SUFFIXES:
                continue
            by_name.setdefault(filename_key(entry.filename), []).append(entry)

    workbook = load_workbook(xlsx_path, read_only=True, data_only=True)
    try:
        if "Pilot_Test" not in workbook.sheetnames:
            raise ValueError("Evaluation sheet 'Pilot_Test' not found")
        rows = workbook["Pilot_Test"].iter_rows(values_only=True)
        headers = next(rows, None)
        if not headers:
            raise ValueError("Evaluation sheet is empty")
        indices = {str(value).strip(): i for i, value in enumerate(headers) if value is not None}
        if REQUIRED_COLUMNS - indices.keys():
            raise ValueError("Evaluation sheet is missing required filename/reference columns")

        def cell(row: tuple, name: str) -> str:
            index = indices.get(name)
            if index is None or index >= len(row) or row[index] is None:
                return ""
            return str(row[index]).strip()

        records = []
        for row in rows:
            if not any(value is not None for value in row):
                continue
            original_name = cell(row, "원본 파일명")
            file_name = cell(row, "파일명")
            reference = cell(row, "정답 문장")
            records.append({
                "file_name": file_name, "original_name": original_name,
                "reference": reference, "expected_menu": cell(row, "메뉴"),
                "utterance_type": cell(row, "발화 유형"),
            })
    finally:
        workbook.close()

    if not records:
        raise ValueError("Evaluation sheet has no audio rows")
    # Check all XLSX rows, even those beyond --limit, to avoid ambiguous matches.
    counts = Counter(filename_key(r["original_name"]) for r in records if r["original_name"])
    cases = []
    for number, record in enumerate(records[:limit], start=1):
        original = record.pop("original_name")
        key = filename_key(original) if original else ""
        matches = by_name.get(key, [])
        error = None
        info = None
        if not original or not record["file_name"] or not normalize(record["reference"]):
            error = "평가표에 파일명 또는 정답 문장이 없습니다."
        elif counts[key] > 1:
            error = "평가표에 원본 파일명이 중복됩니다."
        elif len(matches) > 1:
            error = "음성 ZIP에 같은 파일명이 여러 개 있습니다."
        elif not matches:
            error = "음성 ZIP에서 원본 파일을 찾을 수 없습니다."
        elif matches[0].file_size > MAX_AUDIO_BYTES:
            error = "음성 파일이 25 MiB를 초과합니다."
        elif matches[0].flag_bits & 0x1:
            error = "암호화된 음성 파일은 지원하지 않습니다."
        else:
            info = matches[0]
        cases.append({"id": number, **record, "audio_url": f"/api/audio/{number}" if info else None,
                      "error": error, "_zip_info": info})
    return cases


class AnalyzeRequest(BaseModel):
    case_id: StrictInt
    transcript: StrictStr


def create_app(xlsx_path, zip_path, limit=None, analyzer: Optional[Callable] = None,
               analysis_url: Optional[str] = None) -> FastAPI:
    """Build a locally bound service; inject an analyzer to test without OpenAI."""
    zip_path = Path(zip_path)
    if analysis_url is not None:
        analysis_url = analysis_url.strip()
        if not analysis_url:
            raise ValueError("analysis_url must not be empty")
    cases = load_cases(Path(xlsx_path), zip_path, limit)
    by_id = {case["id"]: case for case in cases}
    app = FastAPI(title="Web Speech pilot evaluation")

    @app.middleware("http")
    async def do_not_cache(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    def find_case(case_id: int) -> dict:
        case = by_id.get(case_id)
        if case is None:
            raise HTTPException(status_code=404, detail="평가 항목을 찾을 수 없습니다.")
        return case

    @app.get("/")
    def home():
        path = WEB_ROOT / "index.html"
        if not path.is_file():
            raise HTTPException(status_code=503, detail="평가 화면을 찾을 수 없습니다.")
        return FileResponse(path, media_type="text/html")

    @app.get("/app.js")
    def javascript():
        path = WEB_ROOT / "app.js"
        if not path.is_file():
            raise HTTPException(status_code=503, detail="평가 화면 스크립트를 찾을 수 없습니다.")
        return FileResponse(path, media_type="text/javascript")

    @app.get("/styles.css")
    def stylesheet():
        path = WEB_ROOT / "styles.css"
        if not path.is_file():
            raise HTTPException(status_code=503, detail="평가 화면 스타일을 찾을 수 없습니다.")
        return FileResponse(path, media_type="text/css")

    @app.get("/api/cases")
    def list_cases():
        return {"cases": [{k: v for k, v in case.items() if k != "_zip_info"} for case in cases]}

    @app.get("/api/audio/{case_id}")
    def get_audio(case_id: int):
        case = find_case(case_id)
        info = case["_zip_info"]
        if info is None:
            raise HTTPException(status_code=404, detail="이 평가 항목의 음성 파일을 사용할 수 없습니다.")

        def stream():
            # The archive and member must remain open until the response finishes.
            with ZipFile(zip_path) as archive, closing(archive.open(info)) as source:
                while True:
                    chunk = source.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk

        media_type = AUDIO_MEDIA_TYPES[PurePosixPath(info.filename).suffix.lower()]
        return StreamingResponse(stream(), media_type=media_type,
                                 headers={"Content-Length": str(info.file_size)})

    @app.post("/api/analyze")
    def analyze(request: AnalyzeRequest):
        case = find_case(request.case_id)
        if case["error"]:
            raise HTTPException(status_code=422, detail="음성 파일 또는 정답이 유효하지 않습니다.")
        transcript = request.transcript.strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="인식된 텍스트가 비어 있습니다.")
        if len(transcript) > 2000:
            raise HTTPException(status_code=422, detail="인식된 텍스트는 2000자 이하여야 합니다.")
        if analysis_url is not None:
            try:
                response = httpx.post(analysis_url, json={"transcript": transcript}, timeout=120.0)
                response.raise_for_status()
                payload = response.json()
            except httpx.TimeoutException as exc:
                raise HTTPException(status_code=504, detail="주문 분석 서버 응답 시간이 초과됐습니다.") from exc
            except (httpx.InvalidURL, httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
                raise HTTPException(status_code=502, detail="주문 분석 서버에 연결하거나 응답을 읽지 못했습니다.") from exc
            if not isinstance(payload, dict) or not isinstance(payload.get("analysis"), dict):
                raise HTTPException(status_code=502, detail="주문 분석 서버 응답 형식이 올바르지 않습니다.")
            analysis = payload["analysis"]
        else:
            if analyzer is None:
                from .analyzer import analyze_transcript
                run_analyzer = analyze_transcript
            else:
                run_analyzer = analyzer
            try:
                analysis = run_analyzer(transcript)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail="주문 분석 입력을 확인하세요.") from exc
            except RuntimeError as exc:
                raise HTTPException(status_code=503, detail="주문 분석 서버 설정을 확인하세요. OPENAI_API_KEY가 필요합니다.") from exc
            except Exception as exc:
                # Do not return API credentials, request bodies, or personal data.
                raise HTTPException(status_code=502, detail="주문 분석에 실패했습니다. 서버 설정을 확인하세요.") from exc
        return {"case_id": case["id"], "transcript": transcript, "reference": case["reference"],
                "expected_menu": case["expected_menu"], "utterance_type": case["utterance_type"],
                "cer": character_error_rate(case["reference"], transcript), "analysis": analysis}

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", "--evaluation-xlsx", type=Path, required=True)
    parser.add_argument("--audio-zip", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--analysis-url", help="Remote order analysis endpoint (full URL)")
    args = parser.parse_args()
    if args.port < 1 or args.port > 65535:
        parser.error("port must be between 1 and 65535")
    app = create_app(args.xlsx, args.audio_zip, args.limit, analysis_url=args.analysis_url)
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()

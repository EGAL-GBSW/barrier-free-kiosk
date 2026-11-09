# 음성 주문 서버 연결

## Web Speech를 사용할 때

키오스크 브라우저의 Web Speech API가 음성을 텍스트로 바꾼다면 A4000의 Whisper STT 서버는 필요하지 않다. 인식된 텍스트와 `session_id`를 `POST /ai/order/text`로 전달하면 기존 OpenAI 주문 분석을 사용할 수 있다. OpenAI API 키가 설정된 주문 분석 프로그램은 접근 가능한 서버 또는 컴퓨터에서 실행되어야 한다. 현재 GitHub 프론트엔드는 인식된 텍스트를 이 API에 보내지 않으므로 프론트·백엔드 연결은 별도 개발이 필요하다.

아래의 음성 파일 API는 Whisper 방식을 다시 사용할 때의 선택 경로다.

학교 A4000의 STT API와 기존 OpenAI 주문 분석 API를 연결한다. 주문 API는 각 발화의 음성 파일을 STT 서버로 보내고, 받은 `transcript`를 해당 세션의 기존 `OrderAI.handle_input()`에 전달한다. OpenAI API 키는 주문 분석 서버에서만 사용하며 STT 서버로 보내지 않는다.

```text
키오스크/백엔드 ── 음성 + session_id ──> 주문 분석 API
                                               │
                                               ├── 음성 ──> A4000 STT API
                                               │             └── 인식 텍스트
                                               └── 텍스트 + 기존 대화 ──> OpenAI
```

사용자가 재질문에 답하면 새로운 음성 파일을 **같은 `session_id`**로 다시 보낸다. 응답의 `result.message`를 사용자에게 안내하고, `recognized_text`에서 인식된 문장을 확인할 수 있다. 기존 텍스트 입력 API도 같은 세션을 사용한다.

## 1. 학교 A4000 Windows 컴퓨터: STT API 실행

기존 저장소를 최신 코드로 준비한 뒤 PowerShell에서 다음을 실행한다. 이미 설치한 가상환경은 재사용할 수 있다. CUDA/cuDNN과 GPU 드라이버 설정은 [AI README](../README.md)를 참고한다.

```powershell
cd barrier-free-kiosk\ai
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:STT_DEVICE = "cuda"
$env:STT_COMPUTE_TYPE = "float16"
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8001
```

다른 서버에서 접속하려면 두 서버 사이에 접근 제한된 VPN 등 사설 네트워크를 먼저 구성한다. 그 후 STT API를 해당 인터페이스에 바인딩하고 방화벽에서 주문 서버만 접근하도록 허용한다. `127.0.0.1`은 학교 컴퓨터 자신만 접근할 수 있는 주소이며, AWS에서 그대로 사용할 수 없다. 예를 들어 사설망 방화벽이 설정된 환경에서만 `--host 0.0.0.0`으로 바인딩할 수 있다. **현재 STT API에는 인증 기능이 없으므로 인터넷에 직접 공개하지 않는다.**

## 2. OpenAI 주문 분석 서버: 실행

기존에 사용하던 `OPENAI_API_KEY`를 주문 분석 서버의 환경변수 또는 `ai/voice_order/.env`에 유지한다. 키를 저장소에 추가하거나 STT 서버로 복사할 필요는 없다. 사용 가능한 모델을 기존 `OPENAI_MODEL` 설정으로 지정할 수 있다.

주문 서버에는 GPU나 `faster-whisper`가 필요하지 않다. `ai` 폴더에서 주문 서버 전용 의존성을 설치한다.

```bash
python -m venv .venv-order
# Linux: source .venv-order/bin/activate
# Windows PowerShell: .\.venv-order\Scripts\Activate.ps1
python -m pip install -r requirements-order.txt
```

주문 서버가 학교 PC에 접근할 수 있는 사설 주소를 `STT_API_URL`로 설정한다. 아래 주소는 예시이며 실제 VPN 주소로 바꿔야 한다. 두 API가 같은 컴퓨터에서 실행 중이면 `http://127.0.0.1:8001/transcribe`를 사용할 수 있다.

```powershell
$env:STT_API_URL = "http://<학교-PC-사설-IP>:8001/transcribe"
python -m uvicorn voice_order.order_ai:app --host 127.0.0.1 --port 8000 --workers 1
```

Linux 셸에서는 `export STT_API_URL='http://<학교-PC-사설-IP>:8001/transcribe'`를 사용한다. `STT_API_URL`은 `/transcribe`를 포함한 전체 주소다. 위 주문 API의 `127.0.0.1`도 같은 컴퓨터에서만 접근 가능하다. 다른 컴퓨터의 백엔드가 호출하려면 안전한 네트워크와 방화벽을 먼저 구성하고 적절한 인터페이스에 바인딩해야 한다. 주문 API도 인증 기능이 없으므로 외부에 노출할 때는 인증·접근 제어를 별도로 구성해야 한다.

## 3. 첫 발화와 재질문 답변 보내기

키오스크/백엔드가 `POST /ai/order/audio`에 `multipart/form-data`로 `session_id`와 `audio`를 보낸다. 지원 형식은 WAV, MP3, M4A, WebM이며 25 MiB 이하다. 각 주문은 추측하기 어려운 새 세션 ID를 사용하고, 같은 대화에서만 ID를 재사용한다.

Windows PowerShell 예시:

```powershell
curl.exe -X POST http://127.0.0.1:8000/ai/order/audio -F "session_id=example-session" -F "audio=@first.webm"
# 재질문 후 새 녹음 파일을 같은 session_id로 전송
curl.exe -X POST http://127.0.0.1:8000/ai/order/audio -F "session_id=example-session" -F "audio=@answer.webm"
```

응답 예시 (`result` 내용은 기존 주문 분석 결과에 따라 달라진다):

```json
{
  "status": "success",
  "session_id": "example-session",
  "recognized_text": "커피 말고 달달한 거 있어요?",
  "result": {
    "message": "어떤 메뉴로 드릴까요?",
    "recommendations": [],
    "cart": [],
    "error": null
  }
}
```

STT 연결 오류는 502, 시간 초과는 504, 인식된 텍스트가 없으면 422로 반환한다. 이 경우 주문 분석을 호출하지 않고 기존 세션을 유지한다. 주문 분석 자체의 오류는 HTTP 200이어도 `status: "error"`와 `result.error`를 확인해야 한다. 응답을 받기 전에 클라이언트 연결이 끊기면 주문 처리가 이미 반영되었을 수도 있다. 현재 요청 중복 방지 기능이 없으므로 자동 재전송하지 말고 기존 세션의 주문 상태를 확인한 뒤 재시도한다.

기존 `POST /ai/order/text`에 `{"session_id":"...", "text":"..."}`를 보내는 방식도 유지된다. `DELETE /ai/order/{session_id}`로 대화를 종료하고 메모리에서 지울 수 있다.

## 백엔드 주문 API 연동 계약

백엔드는 `GET /menus`로 메뉴 ID와 허용 옵션을 제공한다. 프론트엔드가 사용자의 매장/포장 선택을 `orderType` (`DINE_IN` 또는 `TAKEOUT`)에 넣고, AI가 파악한 주문 항목을 다음 `items` 형식으로 맞춰 `POST /orders/quote`에 보내면 저장 없이 주문을 검증하고 금액을 계산한다.

```json
{
  "orderType": "TAKEOUT",
  "items": [
    {"menuId": 1, "quantity": 2, "temperature": "ICE", "size": "Regular", "shots": 0}
  ]
}
```

사용자가 메뉴·옵션·금액을 최종 확인한 뒤 같은 형식으로 `POST /orders`에 보내면 백엔드가 다시 검증해 주문을 저장하고 성공 시 HTTP 201과 `orderId`를 반환한다. AI 결과를 실제 DB와 대조하지 않고 주문 확정에 사용하지 않는다.

**현재 주문 분석 API는 위 형식의 `items`를 아직 반환하지 않는다.** 기존 `result.cart`는 메뉴명·수량 중심이며 온도, 사이즈, 샷, 메뉴 ID를 모두 관리하지 않는다. 프론트의 `orderType` 선택과 별개로, 백엔드 메뉴 API를 기준으로 AI의 주문 상태 및 누락 옵션 재질문을 구현하고 최종 응답을 `items` 형식으로 변환하는 작업이 필요하다. 평가용 `/ai/evaluate/text`의 `items`는 테스트 결과이며 주문 요청 형식이 아니다.

## 현재 범위와 제한

- 이 코드는 STT 결과와 기존 주문 분석을 연결한다. 프론트엔드 녹음/재질문 UI와 백엔드의 최종 주문 저장은 아직 연결하지 않았다.
- 기존 `OrderAI`는 온도·사이즈를 완전히 처리하거나 명시적인 최종 주문 확정을 제공하지 않는다. 현재 응답을 결제 완료 또는 최종 주문 확정으로 해석하면 안 된다.
- 세션은 주문 API 프로세스의 메모리에만 저장된다. 재시작하면 사라지며 여러 워커 간 공유되지 않는다. `--workers 1`을 사용하고 같은 세션의 요청은 한 번에 하나씩 전송해야 한다.
- 현재 프론트엔드의 일반 API 요청 시간 제한은 10초다. STT 모델 초기화와 OpenAI 분석에는 더 오래 걸릴 수 있으므로, 실제 UI 연결 시 음성 주문용 시간 제한을 별도로 설정해야 한다.
- STT 모델은 첫 요청에서 로드되며 처음에는 다운로드도 발생할 수 있다. 실제 대화 테스트 전에 모델을 준비하고 첫 요청의 대기 시간을 확인한다.
- 서버와 네트워크 연결, 실제 A4000 추론, 실제 OpenAI API 호출은 각각 실행 환경에서 별도로 확인해야 한다.

## 메뉴 검색과 pgvector

현재 `menus.json`에는 9개 메뉴가 있고, 주문 분석은 각 발화마다 메뉴 전체와 대화 맥락을 OpenAI에 보낸다. 메뉴가 적다는 사실만으로 정확도나 지연 차이를 단정할 수는 없지만, 아직 pgvector가 개선된다는 실측 근거가 없어 기존 방식을 유지한다. `menus.json`은 스냅샷이므로 실제 운영 전에는 백엔드의 최신 메뉴·가격·옵션과 일치시키고 주문 시 다시 검증해야 한다.

카페인, 우유, 단맛, 사이즈, 판매 상태 등 미확인 값은 유사도 검색으로 사실을 알아낼 수 없다. 임의로 확정하지 말고 매장 데이터를 보강하거나 사용자에게 확인해야 한다. 현재 코드는 OpenAI 추천에 대해 메뉴 존재 여부와 수량 등을 검사하지만, 모든 정형 조건을 독립적인 필터로 검증하지는 않는다.

추후 pgvector 도입 여부는 같은 메뉴 스냅샷과 정답 발화로 기존 전체 메뉴 전달 방식과 비교한다. 메뉴 추천 후보 재현율, 잘못된 후보·조건 위반, 옵션·수량·취소/변경 처리, 재질문, 전체 응답 시간(p50/p95), 토큰·비용을 함께 측정한다. 의미 검색 후보를 사용하더라도 가격·온도·판매 상태 같은 확정 조건은 정형 데이터로 별도 검증한다.

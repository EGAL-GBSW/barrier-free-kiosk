# A4000 Windows 텍스트 대화 테스트

로컬 **Ollama + Qwen3-4B-Instruct-2507 Q4_K_M**으로 사용자의 문장을 해석한다. 실제 음성 연결 전 메뉴 탐색·선택·온도·수량·수정·확인을 테스트한다. SLM이 변경 조건과 설명 기반 추천을 생성하고, Python 대화 엔진이 등록된 메뉴와 비교해 다음 질문을 만든다.

이 도구는 Python 표준 라이브러리만 사용하므로 STT 패키지나 새 pip 패키지를 설치할 필요가 없다. Ollama는 Python 가상환경과 별도로 실행된다. 실제 주문 API와 결제는 호출하지 않으며 장바구니는 이 프로그램 안의 임시 테스트 목록이다.

## 1. 코드 받기

클론해 둔 `barrier-free-kiosk` 폴더에서 PowerShell을 연다. 현재 검토 브랜치 기준 명령은 다음과 같다.

```powershell
git fetch origin
git switch codex/dialogue-menu-spec
git pull --ff-only
cd ai
```

기존 `.venv`가 없다면 한 번 만든다.

```powershell
py -m venv .venv
```

## 2. Ollama 설치 및 모델 다운로드

[Ollama Windows 설치 파일](https://ollama.com/download/windows)을 설치하고 Ollama 앱을 실행한다. 설치 후 새 PowerShell을 열어야 `ollama` 명령이 인식될 수 있다. [공식 Windows 안내](https://docs.ollama.com/windows)에 GPU 드라이버 요구사항과 로그 위치가 있다.

```powershell
ollama pull qwen3:4b-instruct-2507-q4_K_M
```

공식 모델 태그는 [qwen3:4b-instruct-2507-q4_K_M](https://ollama.com/library/qwen3:4b-instruct-2507-q4_K_M)이며 모델 파일은 약 2.5GB다. `qwen3:4b`와 구분해 지정한다. 모델 파일 크기는 실제 실행 VRAM 사용량과 같지 않다.

`ai` 폴더에서 연결을 확인한다.

```powershell
.\.venv\Scripts\python.exe text_dialogue.py --check
```

`installed: true`이면 준비됐다. 연결 오류가 나면 시작 메뉴에서 Ollama를 실행한다. 트레이 앱 대신 직접 서버를 띄울 때만 별도 터미널에서 `ollama serve`를 사용한다. 기본 API 주소는 `http://127.0.0.1:11434`이다.

## 3. 제공된 실제 메뉴 속성으로 대화하기

```powershell
.\.venv\Scripts\python.exe text_dialogue.py --debug --log-file benchmark_results\dialogue_session.jsonl
```

기본 메뉴는 다음 형식의 9개 항목이다. `category`, `description`, `badge`, `temperatures`를 그대로 모델에게 전달한다.

```json
{
  "id": 4,
  "name": "제주 말차 라떼",
  "price": 5200,
  "category": "noncoffee",
  "description": "제주 말차의 진한 풍미와 우유의 부드러움.",
  "badge": "BEST",
  "temperatures": ["ICE", "HOT"]
}
```

입력 예시:

```text
사용자> 시원한 커피 한 잔 마시고 싶네.
사용자> 아메리카노로 할게.
사용자> 그래, 담아 줘.
```

다른 직접 주문 예시:

```text
사용자> 제주 말차 라떼 따뜻한 걸로 한 잔 주세요.
사용자> 아니, 두 잔으로 해 줘.
사용자> 그래, 담아 줘.
```

메뉴 설명을 이용해 “깔끔한 맛”, “부드러운 우유”, “달콤한 크림” 같은 후보를 추천할 수 있다. 모델은 추천 근거를 해당 `description`에서 그대로 인용해야 하며, 추천 ID는 필수 조건을 통과한 후보 안에서만 화면에 표시한다. 설명 기반 의미 매칭의 정확도는 실제 모델 결과로 평가해야 한다.

현재 데이터에는 사이즈가 없으므로 기본 모드는 **온도·수량을 선택하고 사이즈를 지정하지 않은 기본 메뉴 구성**을 테스트한다. 사용자가 큰 사이즈를 요청하면 가능하다고 가정하지 않고 정보 미확인을 안내한다. 우유·카페인 제외 조건도 확정 속성이 없으면 판단 보류한다. `noncoffee`만으로 무카페인이라고 안내하지 않는다. 옵션 추가금·판매 가능 상태가 없으므로 테스트 장바구니의 금액은 기본 메뉴 금액이며 실주문 금액이 아니다.

자동으로 위 3개 발화를 실제 모델에 넣어 보려면:

```powershell
.\.venv\Scripts\python.exe text_dialogue.py --scenario registered --debug
```

이 명령은 예시 정답을 모델 응답으로 대체하지 않는다. 실제 SLM 출력과 실제 대화 상태를 다음 턴에 사용하며, 최종 테스트 장바구니 도달 여부를 출력한다.

## 4. 사이즈·우유 선택까지 가정한 할아버지 시나리오

```powershell
.\.venv\Scripts\python.exe text_dialogue.py --demo --scenario grandfather --debug --log-file benchmark_results\grandfather_demo.jsonl
```

`--demo`일 때만 `demo_attributes.json`의 가상 성분·단맛·사이즈를 사용한다. “시원하고 많이 안 단 것 → 커피 → 우유 없는 것 → 그걸로 → 큰 것 → 담아 줘” 6개 발화를 실제 모델에 순서대로 넣는다. 모델의 답이 잘못되면 이후 대화가 실패할 수 있으며 그 과정이 로그에 남는다.

자유롭게 입력하려면 `--scenario grandfather`를 빼고 `--demo --debug`로 실행한다.

## 메뉴 파일 또는 백엔드 API 사용

자체 JSON은 위 메뉴 형식의 **배열** 또는 `menus` 배열을 가진 객체로 저장한다. `const menus = ...; module.exports = ...` JavaScript 파일을 JSON으로 읽지는 않는다.

```powershell
.\.venv\Scripts\python.exe text_dialogue.py --menu-file data\menus.json --debug
.\.venv\Scripts\python.exe text_dialogue.py --menu-url http://127.0.0.1:3000/menus --debug
```

백엔드가 다른 컴퓨터에서 실행 중이면 실제 주소로 바꾼다. API/파일 모드는 서버에서 읽은 속성만 사용하고, 가상 데모 속성과 자동으로 합치지 않는다. 메뉴는 프로그램 시작 시 읽으므로 변경 후 다시 실행하면 갱신된다.

## 명령과 로그

| 명령 | 기능 |
|---|---|
| `/menus` | 읽은 메뉴 데이터 전체 확인 |
| `/state` | 현재 선택·직전 질문·화면 후보·확인 대기 상태 확인 |
| `/cart` | 현재 실행의 테스트 장바구니 확인 |
| `/reset` | 고르던 메뉴 초기화, 테스트 장바구니는 유지 |
| `/quit` | 종료 |

`--debug`는 조건 추출 JSON, 후보/미확인/제외 ID, 대화 상태, 추론 시간을 보여준다. `--log-file`은 JSONL로 사용자 문장과 결과를 누적 기록한다. 세션 ID로 각 실행을 구분한다. `benchmark_results/`는 Git에서 제외된다.

실행 중 다른 PowerShell에서 `ollama ps`로 GPU 사용 여부를 확인한다. 첫 요청에는 모델 로딩 시간이 포함된다. 기본 컨텍스트는 8192이며 `--num-ctx`로 바꿀 수 있다. A4000의 실제 속도와 메모리 사용량은 그 컴퓨터에서 확인해야 한다.

## 40개 조건 추출 정답으로 평가하기

먼저 5개만 확인한다.

```powershell
.\.venv\Scripts\python.exe evaluate_dialogue.py --limit 5
```

전체 40개:

```powershell
.\.venv\Scripts\python.exe evaluate_dialogue.py
```

결과는 새 `benchmark_results/dialogue_eval_날짜시간/` 폴더의 `predictions.jsonl`, `summary.json`이다. 예시의 원본/데모 모드를 각각 적용하고 의도·변경 조건·조건 해제·재질문을 정답과 비교한다. 근거 인용 길이나 추천 순서는 의미 일치 점수에서 제외한다. 각 예시에 주어진 이전 문맥을 사용하는 독립 추출 평가이며 자유 대화 성공률·STT 정확도와는 다르다.

## 오류 확인

- `ollama` 명령을 못 찾음: 설치 후 PowerShell을 다시 열고 설치 상태를 확인한다.
- 연결 거부: Ollama 앱과 `http://127.0.0.1:11434`를 확인한다.
- 모델을 찾지 못함: 위의 정확한 `ollama pull` 명령을 실행한다.
- 첫 모델 로딩 시간 초과: `--timeout 300`으로 재실행한다.
- 모델 JSON 검증 실패: 기본 1회 정정 요청 후에도 실패하면 상태를 바꾸지 않고 재입력을 요청한다. 이전 주문 확인 대기는 해제된다.
- 잘못된 메뉴·조건 추천: `--debug` 및 로그를 확인한다. 형식 검증이 의미 해석 정확도를 보장하지 않으므로 실제 결과를 정답 예시와 비교한다.

음성 연결 단계에서는 `text_dialogue.run_turn()`에 STT가 만든 문자열을 넣고, 반환된 `reply`를 TTS로 읽게 한다. 대화 상태와 메뉴 검증을 재사용하되 녹음 시작/종료·STT 오류·재질문·TTS 중 발화·전체 지연은 음성 단계에서 추가 검증한다.

참고: [Ollama JSON Schema 출력](https://docs.ollama.com/capabilities/structured-outputs), [로컬 Chat API](https://docs.ollama.com/api/chat).

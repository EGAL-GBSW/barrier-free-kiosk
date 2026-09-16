# Barrier-Free Kiosk AI STT

Barrier-Free Kiosk의 AI STT 기능은 로컬 음성 파일을 텍스트로 변환해 출력합니다. 현재는 `faster-whisper`의 `medium` 모델을 CPU INT8 환경에서 실행하며, 로컬 음성 파일 → STT → 텍스트 출력까지만 구현되어 있습니다.

## 실행 환경 설정

`ai` 디렉터리에서 Python 가상환경을 생성하고 활성화합니다.

```bash
cd ai
python -m venv .venv
source .venv/bin/activate
```

Windows에서는 다음 명령으로 가상환경을 활성화할 수 있습니다.

```powershell
.venv\Scripts\activate
```

필요한 패키지를 설치합니다.

```bash
pip install -r requirements.txt
```

## 테스트

테스트할 음성 파일을 `ai/audio/test.m4a`에 넣습니다. `stt.py`에서 사용하는 음성 파일 경로와 테스트 파일 경로가 일치하는지 확인한 뒤, `ai` 디렉터리에서 실행합니다.

```bash
python stt.py
```

테스트 음성 파일과 `.venv` 가상환경은 Git에 포함하지 않습니다.

현재 범위에는 RAG, SLM, API 서버, 실시간 스트리밍 기능이 포함되어 있지 않습니다.

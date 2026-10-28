# Barrier-Free Kiosk AI STT

현재 AI 코드는 로컬 음성 파일을 한국어 텍스트로 변환하는 기존 `stt.py`, 별도 AI 서버의 HTTP 음성 업로드 API, 그리고 A4000에서 `medium`과 `large-v3`를 비교하는 도구로 구성됩니다. STT 뒤의 메뉴 검색·SLM 주문 후보 생성과 Backend 주문 확정은 아직 연결되지 않았습니다.

## 설치

AI 서버에서 Python 가상환경을 만든 뒤 의존성을 설치합니다.

```bash
cd ai
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Windows에서는 `.venv\Scripts\activate`로 활성화합니다. GPU 추론 전에는 NVIDIA 드라이버와 CUDA/cuDNN 환경을 확인하세요. 사용 중인 `faster-whisper`/`ctranslate2` 버전의 요구사항은 [공식 안내](https://github.com/SYSTRAN/faster-whisper#gpu)를 확인해야 합니다.

```bash
python check_environment.py
```

이 명령은 Python·패키지 버전과 `nvidia-smi`가 제공하는 GPU·드라이버·VRAM 정보를 출력합니다. cuDNN 버전과 실제 CUDA 추론 가능 여부는 A4000 서버에서 별도로 확인해야 합니다.

## HTTP STT API

기본값은 A4000을 위한 `medium`, `cuda`, `float16`입니다. 모델은 첫 요청 때 로드되며, 한 프로세스에서 요청을 순서대로 처리해 GPU 메모리 급증을 피합니다.

```bash
cd ai
source .venv/bin/activate
uvicorn api:app --host 127.0.0.1 --port 8001
```

다른 장비에서 접속하게 할 때는 서버 네트워크와 접근 제어를 구성한 뒤 호스트 주소를 변경하세요. 브라우저 프론트엔드가 AI API를 직접 호출하면 `AI_ALLOWED_ORIGINS`에 허용할 origin을 쉼표로 구분해 지정합니다. 기본값은 허용 origin이 없습니다.

```bash
curl -F "audio=@audio/test.m4a" http://127.0.0.1:8001/transcribe
```

`POST /transcribe`는 `audio` 필드로 WAV, MP3, M4A, WebM 파일을 받으며 최대 25 MiB입니다. 응답에는 `transcript`, `language`, `model`, `device`, `compute_type`, `audio_duration_seconds`, `processing_seconds`가 들어갑니다. `GET /health`는 서버 상태와 모델 로드 여부를 반환합니다. 음성 파일은 서버에 영구 저장하지 않습니다.

CPU에서 API를 확인하려면 실행 전에 `STT_DEVICE=cpu STT_COMPUTE_TYPE=int8`을 지정합니다. 모델을 바꾸려면 `STT_MODEL=large-v3`를 지정합니다. 이 환경변수들은 프로세스 시작 전에 적용해야 합니다.

## A4000 모델 비교

`benchmark_manifest.example.csv`를 복사해 `file,reference,group` 열에 실제 음성 파일 경로·정답 문장·그룹을 입력합니다. 상대 경로는 매니페스트 파일 위치를 기준으로 합니다. 두 모델을 각각 별도 프로세스로 실행해 GPU 메모리가 다음 모델로 이어지지 않게 합니다.

```bash
python benchmark_stt.py --manifest benchmark_manifest.csv --model medium
python benchmark_stt.py --manifest benchmark_manifest.csv --model large-v3
```

두 실행 모두 `cuda/float16`, `language=ko`, `beam_size=5`, `temperature=0`을 사용합니다. 기본적으로 첫 음성으로 1회 예열한 뒤 측정합니다(`--warmup-runs 0`으로 변경 가능). 결과 JSON에는 음성별·그룹별 인식 결과, 공백·문장부호를 제외한 한국어 CER, 모델 로드 시간, 음성별 처리 시간과 p50/p95가 표시됩니다. 첫 실행 시 모델 다운로드가 로드 시간에 포함될 수 있습니다. VRAM 피크와 동시 요청 2건은 이 스크립트가 측정하지 않으므로 A4000 서버에서 별도로 관찰해야 합니다. 이 스크립트의 지연 시간에는 HTTP 전송과 SLM 처리 시간이 포함되지 않습니다.

## 음성 데이터셋 추출 검증

데이터셋이 아직 정답 문장 없이 준비되는 중이라면 폴더의 WAV/MP3/M4A/WebM 파일을 재귀적으로 추출해 CSV에서 결과를 확인할 수 있습니다. 파일은 삭제하거나 변경하지 않습니다. 먼저 일부만 시험하려면 `--limit`을 사용합니다.

```bash
cd ai
python validate_dataset.py --audio-dir audio --limit 10 --device cpu --compute-type int8
```

A4000 서버에서는 `--device cuda --compute-type float16`을 사용합니다. 기본 모델은 `medium`이며 `--model large-v3`로 바꿔 비교할 수 있습니다. 결과는 Git에서 제외되는 `benchmark_results/dataset_validation.csv`와 `dataset_validation_summary.json`에 저장됩니다. CSV에는 파일별 인식 문장, 처리 시간, 실패 사유가 담깁니다. 개인정보가 포함될 수 있으므로 결과 파일도 공개 저장소에 올리지 마세요.

정답이 준비되면 `dataset_references.example.csv`처럼 `file,reference,group` CSV를 만듭니다. `file`은 `--audio-dir` 기준 상대 경로이며, `group`은 선택 사항입니다. 예를 들어 `--audio-dir audio`라면 `audio/test.m4a`의 라벨은 `test.m4a`로 적습니다.

```bash
python validate_dataset.py --audio-dir audio --reference-csv dataset_references.csv --device cuda --compute-type float16
```

정답 CSV가 있으면 공백·문장부호를 제외한 전체 글자 오류율(CER)과 정확히 일치한 파일 비율을 요약합니다. 정답 없는 파일도 추출하지만 점수에는 포함하지 않습니다. 개별 파일 추출 실패는 CSV에 기록하고, 실패가 하나라도 있으면 종료 코드가 1이 됩니다. 정답 없이 실행한 경우 인식 정확도는 자동 판정할 수 없으므로 CSV의 문장을 직접 확인해야 합니다. 실제 데이터셋 라벨 CSV(`dataset_references.csv`)와 결과 폴더는 Git에서 제외합니다.

### EGAL 41개 파일 평가표와 음성 ZIP

`evaluate_pilot_xlsx.py`는 `EGAL_STT_pilot_test_41.xlsx`의 `Pilot_Test` 시트에서 `원본 파일명`과 `정답 문장`을 읽고, 음성 ZIP 안의 파일을 직접 찾아 STT 결과를 추출합니다. ZIP은 풀지 않으며 원본 평가표를 수정하지 않습니다.

A4000 서버에서 저장소를 클론하고 평가 도구를 설치합니다.

```bash
git clone --branch feature/ai-stt --single-branch https://github.com/EGAL-GBSW/barrier-free-kiosk.git
cd barrier-free-kiosk/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python check_environment.py
```

평가표 XLSX와 음성 ZIP은 Git에 포함되지 않습니다. 두 파일을 서버의 `ai/data/` 폴더에 별도로 전송한 뒤 실행합니다. ZIP을 미리 풀 필요는 없습니다. 한 모델만 확인하려면:

```bash
python evaluate_pilot_xlsx.py \
  --evaluation-xlsx data/EGAL_STT_pilot_test_41.xlsx \
  --audio-zip data/스피키음성데이터-20260930T081748Z-1-001.zip \
  --model medium --device cuda --compute-type float16
```

처음 3개만 확인하려면 `--limit 3`을 추가합니다. 기본 출력은 `benchmark_results/pilot_stt_results.csv`와 같은 위치의 요약 JSON입니다. CSV에서 정답과 추출 결과를 나란히 볼 수 있으며 터미널에도 파일별 문장이 표시됩니다. 이미 결과 파일이 있으면 실수로 덮어쓰지 않도록 중단합니다. 다시 실행할 때는 새 `--output-csv` 경로를 주거나 `--overwrite`를 명시하세요.

`정확히 일치`는 공백을 정리한 문장 전체가 같은 경우의 O/X이고, `정규화 CER`는 공백·문장부호를 제외한 글자 오류율입니다. 원본 평가표의 `Whisper base/small 결과` 열은 채우지 않습니다. 현재 선택한 모델이 `medium`이기 때문이며, 모델을 바꾸면 `--model large-v3`와 다른 결과 경로를 사용해 비교할 수 있습니다. 평가표·음성 ZIP·결과 CSV에는 음성과 발화 내용이 포함되므로 Git에 추가하지 마세요.

`medium`과 한 단계 큰 `large-v3`를 한 번에 비교하려면 아래 명령을 사용합니다. 두 모델을 별도 프로세스에서 순서대로 실행하므로 동시에 GPU에 올리지 않습니다. 결과 CSV는 각 모델의 추출 문장·일치 여부·CER·처리 시간을 같은 행에 나란히 보여줍니다.

```bash
python compare_pilot_models.py \
  --evaluation-xlsx data/EGAL_STT_pilot_test_41.xlsx \
  --audio-zip data/스피키음성데이터-20260930T081748Z-1-001.zip \
  --device cuda --compute-type float16
```

처음에는 `--limit 3`으로 확인하세요. 기본 비교 결과는 `benchmark_results/pilot_medium_vs_large-v3.csv`, 모델별 상세 CSV 및 요약 JSON입니다. `large-v3`는 처음 실행 시 모델을 다운로드하므로 서버의 인터넷 연결과 충분한 저장 공간이 필요합니다.
일부 파일을 시험한 뒤 전체 41개를 다시 실행할 때는 다른 `--output-dir`을 지정하거나 `--overwrite`를 추가하세요.
두 모델은 A4000 서버에서 실행합니다. 서버의 CUDA/cuDNN 버전이 현재 `faster-whisper`/`ctranslate2`와 호환되어야 합니다.

코드 테스트는 모델 다운로드나 실제 음성 없이 가짜 모델로 실행합니다.

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

## 기존 로컬 데모

기존 `stt.py`는 수정하지 않았습니다. `ai/audio/stt_recoding2.m4a`를 읽는 고정 경로를 사용하며 `medium`을 CPU INT8로 실행합니다.

```bash
cd ai
python stt.py
```

가상환경, 테스트 음성, 개인 정보가 포함된 매니페스트는 Git에 추가하지 마세요. `.gitignore`에는 음성 확장자와 `.venv`가 이미 제외되어 있습니다.

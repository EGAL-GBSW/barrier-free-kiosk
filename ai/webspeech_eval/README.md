# 저장된 음성으로 Web Speech와 주문 해석 평가

이 도구는 평가표의 정답과 ZIP의 녹음 파일을 매칭하고, 브라우저 Web Speech로 인식한 문장만 OpenAI 주문 평가기에 전달한다. 결과 화면과 CSV에서 정답 문장·인식 문장·글자 오류율(CER)·메뉴와 수량·재질문 여부를 확인할 수 있다. **평가용이며 실제 주문 생성이나 결제를 수행하지 않는다.**

```text
평가표 XLSX + 음성 ZIP (Windows 로컬)
    → 브라우저 Web Speech가 각 녹음 트랙을 재생하며 인식
    → 인식된 텍스트만 기존 OpenAI 설정을 사용하는 주문 평가기로 전달
    → 결과 확인 및 CSV 다운로드
```

각 파일은 독립 발화로 평가한다. 앞선 주문 맥락이 필요한 취소·변경·대명사 발화는 맥락이 없으므로 재질문이나 판단 불가가 나올 수 있다. 실제 연속 대화 기능을 검증하는 테스트는 아니다.

## 시작 전 확인

- 데스크톱 Chrome 135 이상 또는 호환 Edge가 필요하다. `SpeechRecognition.start(audioTrack)` 지원은 브라우저 환경에 따라 달라질 수 있으므로 첫 샘플 인식 결과를 정답 문장과 직접 대조한다. 마이크를 차단하거나 분리한 뒤 확인해 파일 대신 주변 음성을 인식하는 일이 없도록 한다. 브라우저가 녹음을 제대로 처리하지 못하면 결과를 유효한 평가로 사용하지 않는다. [Web Speech 오디오 트랙 안내](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start)
- 브라우저 인식 서비스로 원본 음성이 전송될 수 있고, OpenAI에는 인식 문장이 전송된다. 사용 권한을 확인하고 비용·개인정보를 고려한다. 정답 문장과 메뉴 라벨은 OpenAI 평가기에 전달하지 않는다.
- 평가표 `Pilot_Test` 시트에는 최소 `파일명`, `원본 파일명`, `정답 문장` 열이 필요하다. `메뉴`, `발화 유형` 열은 있으면 결과에 표시한다. ZIP의 파일은 풀지 않으며, 원본 파일명으로 매칭한다.
- 제공된 41건 평가표·ZIP은 파일명 기준 모두 매칭된다. 다른 평가표도 같은 열 구조면 사용할 수 있다. 실제 데이터와 결과 CSV는 공개 저장소에 올리지 않는다.
- 코드가 아직 커밋·푸시되지 않았다면 서버와 Windows 컴퓨터에 자동으로 반영되지 않는다. 검수 후 같은 수정본을 필요한 컴퓨터에 배포해야 한다.

## Windows 평가 컴퓨터

평가표와 음성 ZIP을 예를 들어 `ai/data/EGAL_STT_pilot_test_41.xlsx`, `ai/data/audio.zip`에 넣는다. 실제 파일명이 다르면 아래 경로를 바꾼다. `ai` 폴더에서 PowerShell로 실행한다.

```powershell
py -m venv .venv-webspeech
.\.venv-webspeech\Scripts\python.exe -m pip install -r requirements-webspeech-eval.txt

# 예: 다른 컴퓨터의 기존 주문 분석 서버를 VPN 사설 주소로 사용
.\.venv-webspeech\Scripts\python.exe -m webspeech_eval.server `
  --xlsx data\EGAL_STT_pilot_test_41.xlsx `
  --audio-zip data\audio.zip `
  --analysis-url http://<주문서버-사설-IP>:8000/ai/evaluate/text `
  --limit 3
```

`<주문서버-사설-IP>`는 실제 주소로 바꾼다. 브라우저에서 `http://127.0.0.1:8765`를 열고 **입력 확인 → 파일과 인식 문장 대조 → 평가 시작** 순서로 실행한다. `--limit 3`을 지우면 평가표 전체를 불러온다. 각 파일은 재생 시간만큼 처리하며, 브라우저 자동 재생 제한이나 인식 서비스의 종료 때문에 실패할 수 있다. 완료한 결과는 화면에서 CSV로 내려받는다.

`--analysis-url`을 쓰면 원격 서버에 **인식 텍스트만** 전송한다. 음성 ZIP, 정답, OpenAI 키를 원격 호출에 함께 보내지 않는다. 두 컴퓨터가 통신할 수 있는 VPN 등 사설망이 필요하다.

## 기존 OpenAI 주문 서버

기존 키가 있는 서버에 이 코드가 반영되면 기존 `voice_order.order_ai` 앱의 `POST /ai/evaluate/text`를 사용할 수 있다. `OPENAI_API_KEY`와 `OPENAI_MODEL`은 기존 주문 서버 설정을 재사용한다. 텍스트 평가는 실제 주문 세션이나 백엔드 주문을 수정하지 않는다.

이 API에는 자체 인증이 없으므로 인터넷에 직접 노출하지 않는다. VPN, 방화벽 등으로 평가 컴퓨터의 접근만 허용하고 적절한 서버 바인딩을 설정한다. `127.0.0.1`로 실행된 서버는 다른 컴퓨터에서 접속할 수 없다.

평가 도구와 OpenAI 키가 **같은 컴퓨터**에 있을 때만 `--analysis-url`을 생략하면 로컬 평가기가 기존 키 설정을 읽는다. OpenAI 주문 서버가 다른 곳에 있으면 위의 원격 주소를 지정해야 한다.

## 결과 해석

- `최종 확인 필요` (`ready_to_confirm`): 평가 모델이 메뉴·수량·필요한 온도를 파악했다고 판단한 **주문 후보**다. 실제 고객의 최종 동의, 나머지 옵션, 주문 저장 또는 결제 완료를 뜻하지 않는다.
- `재질문` (`ask_clarification`): 정보가 부족하거나 모호하다고 모델이 판단하여 질문을 생성했다.
- `판단 불가` (`undetermined`): 응답이 불명확하거나 최소 메뉴·수량·온도 검증을 통과하지 못했다.
- CER은 정답 문장과 인식 문장을 정규화한 글자 오류율이며 낮을수록 일치한다. 주문 메뉴·수량이 정확하다는 의미는 아니다.
- 평가표에 최종 확인·재질문 여부의 정답 라벨은 없으므로, 해당 판단의 정확도를 자동 계산하지 않는다. 정답 메뉴와 추출된 항목을 비교해 사람이 검토해야 한다.
- 평가기는 기존 주문 AI의 **OpenAI 키·모델·메뉴**를 재사용하지만, 독립 발화를 검토하기 위한 별도 프롬프트를 사용한다. 실제 운영용 `OrderAI.handle_input()`의 대화 결과와 동일하다고 가정하면 안 된다.

중지 후 이미 표시된 결과는 브라우저에서 유지되고, 다운로드하지 않은 결과는 페이지를 닫으면 사라진다. 브라우저가 응답을 기다리다 중지되어도 이미 보낸 OpenAI 요청은 처리·과금될 수 있다.

## 코드 테스트

실제 키·네트워크·GPU 없이 평가 서버와 브라우저 로직을 모의 테스트한다. `ai` 폴더에서 실행한다.

```powershell
.\.venv-webspeech\Scripts\python.exe -m unittest discover -s tests -p "test_webspeech*.py" -v
node --test tests/test_webspeech_ui.cjs
```

이 테스트는 실제 브라우저의 Web Speech 음성 트랙 지원이나 OpenAI 실호출을 검증하지 않으므로, 학교 컴퓨터의 Chrome/Edge에서 입력 확인과 소량 평가를 직접 해야 한다.

# 키오스크 시연: 주문 접수와 토스 테스트 결제

기본은 **주문 접수 시연**입니다. PostgreSQL에 주문을 저장하고 서버 주문번호를 보여줍니다. 결제 화면은 React에서 표시하고, 서버가 금액·승인·저장 상태를 결정합니다.

1. PostgreSQL을 켭니다. 이 Mac의 시연 DB가 중지된 경우:
   `pg_ctl -D ~/.local/share/barrier-free-kiosk/postgres -l ~/.local/share/barrier-free-kiosk/postgres/server.log -w start`
2. `backend/.env`의 `DATABASE_URL`을 확인한 뒤 backend에서 `npx prisma generate`, `npx prisma migrate deploy`, `node --env-file=.env prisma/seed.js`, `npm run dev`를 실행합니다.
3. frontend에서 `npm run dev`를 실행하고 Vite가 표시하는 주소를 엽니다. 기본 로컬 API 주소는 `http://127.0.0.1:3000`이며, 변경 시 `VITE_API_BASE_URL`을 설정합니다.
4. 메뉴를 담고 **주문 확인 → 주문 접수**를 누릅니다.

토스 **테스트 결제**를 시연할 때만:

- `frontend/.env.local`: `VITE_CHECKOUT_MODE=toss-test`, `VITE_TOSS_CLIENT_KEY`에 위젯 테스트 클라이언트 키.
- `backend/.env`: `TOSS_TEST_SECRET_KEY`에 같은 테스트 환경의 시크릿 키. 백엔드 파일에만 저장하세요.
- 양쪽 서버를 재시작합니다. 테스트 결제가 끝나면 `VITE_CHECKOUT_MODE=demo`로 되돌릴 수 있습니다.

`POST /payments/orders`는 서버 가격으로 계산한 결제 대기 주문을 만듭니다. `POST /payments/confirm`은 DB 금액과 토스 응답을 검증하고, 토스가 `DONE`으로 응답했을 때만 `PAID`를 기록합니다. 새로고침에서 동일한 승인 결과를 재사용합니다. 입금 대기·실패를 완료로 표시하지 않습니다. 실결제 키는 지원하지 않습니다.

[토스페이먼츠 공식 주문서 연동 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration)

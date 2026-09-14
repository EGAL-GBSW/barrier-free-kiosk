# STT 기반 배리어프리 음성 주문 키오스크

Node.js + Express 백엔드의 첫 단계입니다. 메뉴 조회와 주문 생성·조회까지 구현했습니다.

## 실행

Node.js 22 이상이 필요합니다. 터미널에서 프로젝트 폴더를 연 후 실행합니다.

```sh
cd backend
npm ci
cp .env.example .env
npm run dev
```

기본 주소: http://127.0.0.1:3000. 상태 확인: http://127.0.0.1:3000/health

`npm start`는 일반 실행, `npm test`는 API 통합 테스트입니다.
환경 변수 `PORT`, `HOST`, `CORS_ORIGIN`으로 포트, 바인딩 주소, 프론트엔드 출처를 설정합니다.
기본 프론트엔드 출처는 `http://localhost:5173`입니다.

## API

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| GET | /health | 서버 상태 |
| GET | /menus | 메뉴 전체 조회 (품절 포함) |
| GET | /menus/:id | 메뉴 상세 조회 |
| POST | /orders | 주문 생성 |
| GET | /orders/:id | 생성된 주문 조회 |

메뉴·주문 응답은 `{ "data": ... }`, 오류는 `{ "error": { "code": "...", "message": "..." } }` 형태입니다.
주문 생성 성공은 HTTP 201이며 `Location` 헤더에 조회 경로를 반환합니다.

```sh
curl http://127.0.0.1:3000/menus
curl -X POST http://127.0.0.1:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"orderType":"TAKEOUT","items":[{"menuId":1,"quantity":2,"temperature":"ICE"}]}'
```

위 주문은 아이스 아메리카노 2잔이며 합계는 6,000원입니다.
`orderType`은 `DINE_IN`(매장) 또는 `TAKEOUT`(포장), `temperature`는 메뉴가 지원하는 `HOT` 또는 `ICE`입니다.
주문 항목은 1~50개, 항목별 수량은 1~99의 정수입니다. 가격은 서버에서 계산하고 클라이언트 가격 필드는 사용하지 않습니다.
금액은 원(KRW) 단위 정수입니다. 주문 상태 `RECEIVED`는 주문 접수만 의미하며 결제 완료를 뜻하지 않습니다.

오류 상태: 입력 오류 400, 메뉴·주문·경로 없음 404, 품절 409, 요청 본문 32KB 초과 413.

## 현재 범위와 다음 단계

샘플 메뉴는 `backend/src/data/menus.js`에 있습니다. **주문은 개발용 메모리에 저장되므로 서버 재시작 시 삭제됩니다.**
인증, 결제, 중복 주문 방지, 영구 저장은 아직 구현하지 않았습니다. 현재는 로컬 개발용입니다.

1. PostgreSQL + Prisma로 메뉴·옵션·주문 테이블과 영구 저장 구현
2. React 장바구니와 주문 API 연결
3. STT 텍스트를 메뉴·옵션·수량으로 변환하고 사용자 확인 후 주문 제출
4. 접근성 기능과 관리자 기능 확장

구성 참고: [Express 공식 API 문서](https://expressjs.com/en/5x/api/).

---
name: kakao-skill-response_domain
description: >-
  카카오 챗봇 스킬 서버가 반환하는 응답 JSON(SkillResponse) 계약이 무엇인지,
  template/outputs의 출력 컴포넌트 종류·필드·렌더링 불변조건이 무엇인지 알아야 할 때 읽는다.
  RAG 백엔드 응답을 카카오 스킬 응답으로 변환·직렬화하는 코드에서 기준(권위) 문서가 된다.
metadata:
  type: domain-skill
---

# kakao-skill-response_domain

## 한 줄 정의

우리 스킬 서버가 카카오 챗봇 오픈빌더에 돌려주는 응답 JSON의 계약(`SkillResponse`)과
그 하위 출력 컴포넌트·버튼·컨텍스트 구조 및 렌더링 불변조건을 정의한다.
출처: 카카오 비즈니스 공식 문서 (Chatbot Skill Guide — Answer JSON Format).

---RAG

## 최상위 구조 (`SkillResponse`)

```json
{
  "version": "2.0",
  "template": {},
  "context": {},
  "data": {}
}
```

| 필드       | 필수                  | 설명                                                   |
| ---------- | --------------------- | ------------------------------------------------------ |
| `version`  | **필수**              | 항상 문자열 `"2.0"` 고정.                              |
| `template` | **스킬 응답 시 필수** | 말풍선(`outputs`)과 바로가기(`quickReplies`)를 담는다. |
| `context`  | 선택                  | 대화 컨텍스트 제어(값 저장·수명·삭제).                 |
| `data`     | 선택                  | 임의 데이터 전달용 오브젝트.                           |

---

## `template`

```json
{
  "outputs": [
    /* 말풍선 1~3개 */
  ],
  "quickReplies": [
    /* 최대 10개 */
  ]
}
```

- `outputs`: 출력 컴포넌트 배열. **최대 3개**(말풍선 1~3개).
- `quickReplies`: 바로가기 버튼 배열. **최대 10개**.

---

## 출력 컴포넌트 (`outputs` 원소)

각 원소는 아래 컴포넌트 중 **하나를 키로 갖는** 오브젝트다. (예: `{ "simpleText": { ... } }`)

### 1. `simpleText`

```json
{ "simpleText": { "text": "..." } }
```

- `text`: **1000자 이내**. 500자 초과 시 말풍선에 "전체 보기" 버튼이 자동 노출된다.

### 2. `simpleImage`

```json
{ "simpleImage": { "imageUrl": "...", "altText": "...(50자)" } }
```

- `imageUrl`: 이미지 URL.
- `altText`: 대체 텍스트, **50자**.

### 3. `textCard`

```json
{
  "textCard": {
    "title": "(50자)",
    "description": "(400자, 캐러셀 내부는 128자)",
    "buttons": [],
    "buttonLayout": "horizontal"
  }
}
```

- `title` / `description` 중 **최소 하나는 필수**.
- `description`: 단독 400자, **캐러셀 내부에서는 128자**.
- `buttonLayout`: `"horizontal"` | `"vertical"`.

### 4. `basicCard`

```json
{
  "basicCard": {
    "title": "(50자)",
    "description": "(230자)",
    "thumbnail": {
      "imageUrl": "...",
      "altText": "...",
      "link": { "web": "..." },
      "fixedRatio": false
    },
    "buttons": []
  }
}
```

- `thumbnail.fixedRatio`:
  - `true` = **1:1 원본 유지**, 버튼 **최대 2개(가로)**.
  - `false`(기본) = **2:1 중앙 크롭**, 버튼 **최대 3개(세로)**.

### 5. `commerceCard`

```json
{
  "commerceCard": {
    "title": "(30자)",
    "description": "(40자)",
    "price": 10000,
    "currency": "won",
    "discount": 1000,
    "discountRate": 10,
    "discountedPrice": 9000,
    "thumbnails": [{ "imageUrl": "..." }],
    "profile": { "imageUrl": "...", "nickname": "..." },
    "buttons": []
  }
}
```

- 가격 노출 우선순위(불변조건):
  1. `discountedPrice`가 있으면 **다른 할인 정보는 무시**하고 이 값만 노출.
  2. `discountRate`는 **`discountedPrice`가 반드시 함께 있어야** 유효.
  3. `discountRate`와 `discountedPrice`가 둘 다 있으면 **`discountRate` 우선**.

### 6. `listCard`

```json
{
  "listCard": {
    "header": { "title": "..." },
    "items": [
      {
        "title": "(필수)",
        "description": "",
        "imageUrl": "",
        "link": { "web": "" },
        "action": "block",
        "blockId": "",
        "messageText": "",
        "extra": {}
      }
    ],
    "buttons": []
  }
}
```

- `items[].title`: **필수**.
- 항목 수: **최대 5개** (캐러셀 내부에서는 **4개**).

### 7. `itemCard`

```json
{
  "itemCard": {
    "thumbnail": { "imageUrl": "", "width": 800, "height": 400 },
    "head": { "title": "" },
    "profile": { "imageUrl": "", "title": "(15자)" },
    "imageTitle": { "title": "", "description": "", "imageUrl": "" },
    "itemList": [{ "title": "(6자)", "description": "(2줄)" }],
    "itemListAlignment": "left",
    "itemListSummary": { "title": "(6자)", "description": "$4,032.54 (14자)" },
    "title": "",
    "description": "",
    "buttons": []
  }
}
```

- 항목 수: **단일형 최대 10개 / 캐러셀형 최대 5개**.
- 불변조건: `head`와 `profile`는 **동시 사용 불가**.
- `profile.title` 15자, `itemList[].title` 6자, `itemListSummary` 6자/14자 제한.

### 8. `carousel`

```json
{
  "carousel": {
    "type": "basicCard",
    "header": {
      "title": "",
      "description": "",
      "thumbnail": { "imageUrl": "" }
    },
    "items": [
      /* basicCard | commerceCard | listCard | itemCard */
    ]
  }
}
```

- `type`: 캐러셀에 담기는 카드 종류.
- `items`: **최대 10개** (단, `listCard` 캐러셀은 **5개**).
- 불변조건: 모든 카드 이미지는 **동일 비율(1:1 또는 2:1)로 통일** 필요 — 혼용 금지.
- `textCard`와 `listCard`는 캐러셀 **헤더 미지원**.

---

## `Button` (`buttons` 배열 원소)

공통 필드:

```json
{ "label": "(14자, 가로 배열 시 8자)", "action": "...", "...": "..." }
```

| `action`   | 형태                                                                                  | 비고                                      |
| ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| `webLink`  | `{ "action": "webLink", "webLinkUrl": "..." }`                                        | 웹 URL 이동.                              |
| `message`  | `{ "action": "message", "messageText": "..." }`                                       | `messageText`가 사용자 발화로 전송됨.     |
| `block`    | `{ "action": "block", "blockId": "...", "messageText": "", "extra": { "키": "값" } }` | 다른 블록 호출. `extra`로 임의 JSON 전달. |
| `phone`    | `{ "action": "phone", "phoneNumber": "010-1234-5678" }`                               | **PC 톡 미지원**.                         |
| `share`    | `{ "action": "share" }`                                                               | 캐러셀 공유 시 유용.                      |
| `operator` | `{ "action": "operator" }`                                                            | 상담원 연결.                              |

- `label`: **14자**, 버튼이 가로 배열이면 **8자**.
- `buttonLayout`: `"vertical"`(세로, 최대 3개) | `"horizontal"`(가로, 최대 2개).

---

## `quickReplies` (바로가기 — `template` 하위)

```json
[
  {
    "label": "",
    "action": "message | block",
    "messageText": "",
    "blockId": "",
    "extra": {}
  }
]
```

- **최대 10개**.
- `action`은 `message` 또는 `block`.

---

## `context` (컨텍스트 제어)

```json
{
  "values": [
    { "name": "", "lifeSpan": 10, "ttl": 60, "params": { "key": "val" } }
  ]
}
```

- `lifeSpan`: 컨텍스트 유효 턴 수. **`0`으로 설정하면 컨텍스트 삭제.**
- `ttl`: 유효 시간(초).
- `params`: JSON 문자열로도 저장 가능.

---

## `link` (기기별 링크)

```json
{ "web": "...", "pc": "...", "mobile": "..." }
```

- 우선순위: **`web` > `pc`/`mobile`**.

---

## 핵심 제약사항 (렌더링 실패 주범)

- `outputs`는 **최대 3개**(말풍선 1~3개). 초과 시 렌더링 실패.
- `basicCard`는 `fixedRatio`에 따라 **버튼 개수와 이미지 비율이 달라진다**
  (`true` → 1:1, 버튼 2개 가로 / `false` → 2:1, 버튼 3개 세로).
- `buttonLayout`: `vertical` 최대 3개 / `horizontal` 최대 2개.
- 캐러셀은 카드 이미지 **비율 통일 필수**(1:1 또는 2:1 혼용 금지).
- `itemCard`는 `head`와 `profile`을 **동시 사용 불가**.
- `commerceCard` 가격: `discountedPrice` 존재 시 타 할인정보 무시, `discountRate`는 `discountedPrice` 동반 필수, 둘 다 있으면 `discountRate` 우선.
- `textCard`는 `title`/`description` 중 최소 하나 필수.
- `listCard.items[].title`은 필수. 각 항목은 **클릭 동작(`link` 또는 `action`+`blockId`/`messageText`)이 필수** — 동작 없는 항목은 렌더/등록 시 거부될 수 있다.
- `version`은 항상 `"2.0"`.
- 글자 수 제한(요약): `simpleText.text` 1000자, `textCard.description` 400자(캐러셀 128자), `basicCard.description` 230자, `commerceCard` title 30자/desc 40자, `simpleImage.altText` 50자, 버튼 `label` 14자(가로 8자).

---

## 도메인 구조 (컴포넌트 계층)

```
SkillResponse
├─ version ("2.0")
├─ template
│  ├─ outputs[]        (1~3개)
│  │  └─ simpleText | simpleImage | textCard | basicCard
│  │     | commerceCard | listCard | itemCard | carousel
│  │        └─ (각 카드) buttons[] → Button(action)
│  │        └─ carousel.items[] → basicCard | commerceCard | listCard | itemCard
│  └─ quickReplies[]   (최대 10개)
├─ context.values[]    (name / lifeSpan / ttl / params)
└─ data                (임의 오브젝트)

공통 요소:
- Button.action ∈ { webLink, message, block, phone, share, operator }
- link = { web, pc, mobile }  (thumbnail.link, item.link 등에서 재사용)
```

---

## 핵심 의사 결정 (RAG 프로젝트 관점)

- **`block` action의 `extra` 필드를 컨텍스트 전달 채널로 사용한다.**
  `extra`에 임의 JSON(예: 검색된 문서 ID, 직전 질문, RAG 세션 키 등)을 실어
  후속 스킬(블록) 호출 시 컨텍스트를 넘긴다. 대화 상태를 카카오 측 `block` 호출 경로로
  왕복시키는 수단으로 활용한다. (`context.values`와 병행 가능.)
- **`operator` action으로 폴백(escalation) 경로를 만든다.**
  AI/RAG가 답하지 못하는 질의는 `operator` 버튼으로 **상담원 연결**에 넘긴다.
- 우리 스킬 서버는 RAG 응답을 위 `SkillResponse` 계약에 맞춰 직렬화해야 하며,
  위 "핵심 제약사항"을 위반하면 카카오 측에서 렌더링이 실패한다.

---

## 에러 응답

카카오 응답 계약 자체에는 별도의 HTTP 에러 응답 스키마가 정의되어 있지 않다.
실패는 "렌더링 실패"로 표면화되며, 그 트리거는 위 **핵심 제약사항** 위반이다.
(스킬 서버 자체의 HTTP 4xx/5xx 에러 포맷은 이 응답 계약의 범위 밖이다.)

---

## 구현 위치

> 이 스킬은 카카오 공식 계약(권위)이다. 아래는 **그 계약이 이 저장소에 어떻게
> 구현돼 있는지**를 가리키는 포인터다. 계약 스펙 자체가 아니라 구현 상태를 기술한다.
> (경로는 모두 저장소 루트 `sprint-kakao/` 기준.)

### 타입·상수 단일 출처

- **`packages/contract/src/response.ts`** — 응답 계약의 TypeScript 단일 출처.
  - 최상위 `SkillResponse`, `Template`, `Context`/`ContextValue`.
  - 출력 유니온 `Output`, 각 컴포넌트 인터페이스(`SimpleText`·`SimpleImage`·`BasicCard`·`ListCard`·`ItemCard`·`Carousel`), 판별 유니온 `Button`(`webLink`/`message`/`block`/`phone`/`share`/`operator`), `QuickReply`.
  - 렌더링 불변조건이 **상수로 export**됨: `MAX_OUTPUTS`, `MAX_QUICK_REPLIES`, `MAX_LIST_ITEMS`(+`MAX_LIST_ITEMS_IN_CAROUSEL`), `MAX_CAROUSEL_ITEMS`/`MAX_CAROUSEL_LIST_ITEMS`, `MAX_BUTTONS_VERTICAL`/`MAX_BUTTONS_HORIZONTAL`, `MAX_BUTTONS_FIXED_RATIO`/`MAX_BUTTONS_FREE_RATIO`, `MAX_ITEMCARD_ROWS`(+`MAX_ITEMCARD_ROWS_IN_CAROUSEL`), `TEXT_LIMITS`. 위 "핵심 제약사항"의 수치가 여기 상수로 대응된다.

### 구현된 출력 컴포넌트 vs 미구현

`Output` 유니온에 실제로 타입화·렌더·빌드되는 컴포넌트:

- **구현됨(8종 전부)**: `simpleText`, `simpleImage`, `textCard`, `basicCard`, `commerceCard`, `listCard`, `itemCard`, `carousel`(`type` ∈ `basicCard | listCard | itemCard | commerceCard`, 상수 `CarouselItemType`).
- **미구현**: 없음. `response.ts`의 **`DEFERRED_OUTPUTS = []`**. contract 타입·서버 빌더(`textCard`/`commerceCard`)·playground 렌더러(`TextCardView`/`CommerceCardView`)·validate 전 계층에 반영됨.

### `itemCard` 필드 정합성

위 본문 `itemCard` 블록의 필드는 `response.ts`의 `ItemCard`/`ItemListRow` 타입과 일치한다
(`thumbnail{imageUrl,width,height}` · `head{title}` · `profile{imageUrl,title}` · `imageTitle` · `itemList[]{title,description}` · `itemListAlignment` · `itemListSummary` · `title`/`description`/`buttons`).
`head`/`profile` 배타 불변조건도 코드에서 강제된다(아래 validate 참고).
강서구 복지도우미 스타일(키-값 행: `지원 금액 → 월 최대 51만원`)은 서버 빌더 `apps/server/src/builders/demo.ts`가 `itemCard` 캐러셀로 재현한다.

### 런타임 제약 강제 / 렌더링

- **`apps/playground/src/renderer/validate.ts`** — 위 "핵심 제약사항"을 **런타임 경고(`Warning[]`)로 구현**한다. `response.ts`의 상수(`MAX_*`, `TEXT_LIMITS`)를 그대로 재사용해 outputs 개수·버튼 개수/라벨 길이·listCard 항목 수·itemCard 행 수·`head`/`profile` 배타·캐러셀 이미지 비율 혼용·`version` 고정 등을 검사한다. (실제 카카오는 위반 시 렌더링 실패 → 여기서 사전 경고.)
- **`apps/playground/src/renderer/KakaoRenderer.tsx`** — `SkillResponse`를 실제로 렌더링하는 검증 하니스. 구현된 6개 컴포넌트 분기만 존재한다.
- **`apps/server/src/builders/{outputs,demo}.ts`** — contract 타입을 그대로 써서 `Output`을 조립하는 mock 빌더(잘못된 조합은 컴파일 타임에 차단).

> 서버 엔드포인트·요청 계약(인바운드)은 이 스킬 범위 밖 → [[kakao-skill-response_api]] 참고.

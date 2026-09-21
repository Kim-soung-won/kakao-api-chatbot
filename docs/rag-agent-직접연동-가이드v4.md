# 복지 안내 에이전트 직접 연동 가이드

채널(웹)이 오케스트레이터를 거치지 않고 이 에이전트를 **직접** 호출할 때의 계약이다. 오케스트레이터 경유 계약(`a2a-연동-가이드.md`)과 **요청 구조가 같다**(text part = 질의, DataPart = `schema`·`conditions`·`options`). DataPart `schema` 이름만 에이전트마다 다르다 — 이 에이전트는 `rag-agent.flow-input.v3`, 오케스트레이터는 `welfare-orchestrator.channel-input.v1`이다. 다른 것은 §1의 세 가지와 응답 DataPart다: 이 문서는 `rag-agent.flow-output.v1`을 돌려주고, 오케스트레이터 경유는 `welfare-orchestrator.channel-output.v1`을 돌려준다. 두 응답을 섞어 파싱하지 않는다.

- 호출 주소·인증은 이 문서에 적지 않는다. 별도로 전달한다.
- 근거 수준: **확인됨**은 실제 호출로 관측한 것, **미확인**은 관측하지 않은 것이다.

## 0. 요약

| | |
|:---|:---|
| 프로토콜 | A2A. `message/send`(단발) · `message/stream`(스트리밍) |
| 요청 | **검색**은 text part(질의) + DataPart `rag-agent.flow-input.v3`(`conditions`·`options`), **상세 조회**는 DataPart `rag-agent.detail-input.v1` |
| 응답 | artifact `welfare-guide` 안의 TextPart(안내문 마크다운) + DataPart `rag-agent.flow-output.v1`. 검색은 `sources`, 상세는 `services` 키를 담는다 |
| 대화 상태 | **없다.** 매 턴 조건을 다시 보낸다 |
| 실패 | 회수 0건은 오류가 아니다. 정상 응답에 안내문 + 빈 목록이 온다 |

## 1. 오케스트레이터 경유와 다른 점

조건 값 자체(거주지·나이·가구·관심분야·조회 기준일)는 원래 채널이 만들어 보내는 것이라 달라지지 않는다. 달라지는 것은 아래 셋이다.

| 항목 | 내용 |
|:---|:---|
| **멀티턴 맥락** | 「그거 말고 다른 것도 있어요?」 같은 후속 발화를 독립 질의로 다시 쓰지 않는다. 이전 턴에서 확정된 조건을 이어받지도, 조건이 달라졌을 때 되묻지도 않는다. 대화 흐름이 필요하면 **채널이 질의를 조립해** 보낸다 |
| **복지 무관 질의** | 거절 게이트가 없다. 복지와 무관한 질의도 검색하고 답변을 만든다. 차단이 필요하면 채널이 한다 |
| **발화 속 지역** | 「강서구 쪽으로 알려줘」처럼 문장에 지역이 나와도 조건으로 바꾸지 않는다. `residence`에 코드로 실어야 반영된다 |

**멀티턴이 검색 품질에 미치는 영향은 작지 않다.** 내부 비교에서 후속 발화 8건을 원문 그대로 검색하면 상위 1건이 맞은 것이 4건이었고, 앞 맥락을 반영해 질의를 다시 쓰면 8건이었다. 표본이 8건이라 일반화하지 않지만, 방향은 분명하다 — 후속 발화를 원문 그대로 보내면 다른 주제로 흐른다.

이 경로에서 대화 흐름이 필요하면 채널이 **직전 발화 몇 개를 반영한 완성된 질의**를 담아 보낸다(§2.1 text part, 전환 호환은 §2.5 `params.query`). 이 에이전트는 받은 질의를 다시 접거나 고쳐 쓰지 않는다.

## 2. 요청

### 2.1 모양

```json
{
  "jsonrpc": "2.0", "id": 1, "method": "message/send",
  "params": {
    "message": {
      "role": "user", "kind": "message", "messageId": "<고유값>",
      "parts": [
        { "kind": "text", "text": "어르신 일자리 있나요" },
        { "kind": "data", "data": {
            "schema": "rag-agent.flow-input.v3",
            "conditions": {
              "residence": "1150000000",
              "apply_date": "2026-09-17",
              "age": 34,
              "category_codes": ["010"]
            },
            "options": { "top_k": 3 }
        }}
      ]
    }
  }
}
```

**질의는 text part에 넣는다.** `conditions`·`options`에는 질의 문자열을 넣을 자리가 없다 — DataPart만 보내고 text part가 비어 있으면 §2.6의 실패 규칙을 탄다.

### 2.2 `conditions`

시민의 온보딩 조건과 조회 기준일이다. 이 에이전트는 키를 검증·가공하지 않고 그대로 검색 tool 인자에 싣는다.

| 키 | 필수 | 형식 | 비고 |
|:---|:---:|:---|:---|
| `residence` | 아니오 | `^[0-9]{10}$` | 생략하면 거주지 조건 없이 검색해 **지역 서비스가 나오지 않는다** |
| `apply_date` | 아니오 | `YYYY-MM-DD` | 이 날짜에 접수 중인 것만. 폐구간(시작일·종료일 당일 포함) |
| `age` | 아니오 | 정수 0~120 | 만 나이 |
| `income_ratio` | 아니오 | 정수 0~999 | 기준 중위소득 비율(%) |
| `category_codes` | 아니오 | 문자열 배열 | 관심주제 코드. 하나라도 겹치면 통과(OR) |
| `life_cycle_codes` | 아니오 | 문자열 배열 | |
| `household_type_code` | 아니오 | 문자열 | |
| `household_situation_codes` | 아니오 | 문자열 배열 | |

**빈 항목은 조건으로 만들지 않는다.** 일부만 채워도 동작한다. 이전 턴에 보낸 조건은 기억하지 않는다 — 매 턴 필요한 조건을 다시 담아 보낸다(§0).

### 2.3 `options`

| 키 | 필수 | 형식 | 비고 |
|:---|:---:|:---|:---|
| `top_k` | 아니오 | 정수 | 생략하면 검색 서버 기본값(3)을 따른다 |
| `answer_format` | 아니오 | `"markdown"` \| `"plain"` | 안내문 형식. 생략하거나 이 둘 밖의 값이면 **마크다운**으로 처리한다(오류 아님). `plain`은 §2.7 |

### 2.4 text part만 보낼 때

DataPart 없이 text part만 보내도 동작한다 — 그 문장을 질의로 써서 **조건 없이** 검색한다. 플랫폼 공통 테스트 화면을 받기 위한 경로이며, 지역 서비스는 나오지 않는다. **확인됨.**

### 2.5 전환 호환: `rag-agent.flow-input.v2`

채널이 DataPart 하나에 질의까지 담아 보내던 예전 구조다. `rag-agent.flow-input.v3`가 없고 이 DataPart가 있으면 지금도 받는다 — **전환 기간 호환이며 새 연동에는 쓰지 않는다.**

```json
{ "kind": "data", "data": {
    "schema": "rag-agent.flow-input.v2",
    "params": {
      "query": "어르신 일자리 있나요",
      "residence": "1150000000",
      "apply_date": "2026-09-17",
      "age": 34,
      "category_codes": ["010"],
      "top_k": 3
    }
}}
```

`params`가 검색 tool 인자 전체다 — `query`가 필수이고, 나머지 키는 §2.2 `conditions`와 같은 이름을 그대로 쓴다(`top_k`는 `options` 없이 `params`에 바로 얹는다). 이 경로는 `options`가 없어 `answer_format`을 받지 않는다 — 항상 마크다운으로 답한다. text part가 함께 오면 무시된다.

### 2.6 우선순위와 실패

| 들어온 것 | 동작 |
|:---|:---|
| DataPart `rag-agent.flow-input.v3`(+ text) | text part가 질의, `conditions`·`options` 반영(§2.1~§2.3) |
| 위가 없고 DataPart `rag-agent.flow-input.v2`만 | 전환 호환(§2.5). `params`를 그대로 검색 인자로 쓴다 |
| 둘 다 없고 text part만 | 그 문장을 질의로, 조건 없이 검색(§2.4) |
| 셋 다 없거나 질의가 빈 문자열 | 실패 — `INVALID_INPUT`(`RAG_INPUT_MISSING`), 검색·답변 모델 호출 0회 |

두 종류 이상이 동시에 오면 **병합하지 않는다** — 우선순위가 높은 쪽만 쓴다(`flow-input.v3` > `flow-input.v2` > text part만).

### 2.7 `answer_format: "plain"`

안내문에서 마크다운 인용 블록(`>`)·제목(`#`)·목록 기호(`* `·`- `)·굵게(`**`)를 없앤 평문으로 돌려준다. **이모지는 그대로 남는다.** 내용·순서·카드(`sources`)는 마크다운 응답과 같다. 스트리밍(`message/stream`)에서도 중간에 오는 텍스트 조각이 평문이다.

## 3. 응답

### 3.1 모양

`result.artifacts[]` 중 `name == "welfare-guide"`를 찾는다. part는 위치(`[0]`·`[1]`)가 아니라 `kind`와 `data.schema`로 찾는다. **모르는 키와 모르는 schema는 무시한다** — 필드는 앞으로 늘어난다.

위 요청에 대한 응답이다. 긴 문자열만 `…`로 줄였다.

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "kind": "task",
    "id": "5c1a…", "contextId": "e9f2…",
    "status": { "state": "completed" },
    "artifacts": [
      {
        "artifactId": "e274ddeb-378d-46df-96fc-35a77c8afe52",
        "name": "welfare-guide",
        "description": "회수된 복지서비스를 근거로 한 안내문과 근거 service_id 목록",
        "parts": [
          {
            "kind": "text",
            "text": "어르신 일자리 및 사회활동 지원 사업과 어르신 대상 소상공인 할인 혜택, 그리고 안전 지원…"
          },
          {
            "kind": "data",
            "data": {
              "schema": "rag-agent.flow-output.v1",
              "sources": [
                {
                  "service_id": "CG-2026-G-180",
                  "service_name": "노인 일자리 및 사회활동 지원",
                  "gov_code": "001",
                  "category_large": ["일자리"],
                  "min_age": 6,
                  "max_age": 100,
                  "apply_start": "2026-01-01",
                  "apply_end": "9999-12-31",
                  "selection_criteria": "구분\n지원대상\n사회활동\n공익활동\n65세 이상 기초연금 수급자\n…",
                  "contact": "1544-3388",
                  "department": "∙노인일자리 상담안내 / ∙한국노인인력개발원 지역본부",
                  "apply_method": "주민센터(행정복지센터), 노인일자리 수행기관(시니어클럽, 노인복지관 등)에 신청",
                  "content_snippet": "다양한 일자리 및 사회활동 지원\n구분\n지원내용\n…",
                  "score": 0.9688268899917603,
                  "doc_title": "",
                  "file_type": "",
                  "exclusion_criteria": ""
                },
                { "service_id": "CG-2026-G-207", "service_name": "장애인 일자리 지원", "…": "위와 같은 17필드" },
                { "service_id": "320561", "service_name": "2026년 시니어 동행상점 모집", "…": "위와 같은 17필드" }
              ],
              "suggestions": [
                {
                  "type": "detail",
                  "service_id": "CG-2026-G-180",
                  "service_name": "노인 일자리 및 사회활동 지원"
                },
                { "type": "other_category" }
              ]
            }
          }
        ]
      }
    ],
    "history": [ "…요청·응답 메시지 기록…" ]
  }
}
```

- `status.state`가 `completed`면 정상이다.
- TextPart는 시민에게 보여줄 안내문(마크다운)이다. 위 예에서 1,365자였다.
- DataPart가 카드 데이터다 — `sources`는 §3.2, `suggestions`는 §3.3.
- **`suggestions` 키가 없는 응답도 정상으로 다룬다.** 없으면 칩을 그리지 않는다.

### 3.2 `sources` — 카드 데이터

검색으로 회수된 서비스 목록이다. 각 항목은 검색 tool이 준 필드를 **가공 없이** 담는다.

**17필드**다. 검색 서버가 주는 것을 그대로 옮긴다.

`service_id` · `service_name` · `gov_code` · `category_large` · `min_age` · `max_age` · `apply_start` · `apply_end` · `selection_criteria` · `contact` · `department` · `apply_method` · `exclusion_criteria` · `content_snippet` · `score` · `doc_title` · `file_type`

- `apply_start`·`apply_end`는 `YYYY-MM-DD`다. **`apply_end`가 `9999-12-31`이면 상시 접수**다.
- `category_large`는 배열이다.
- **필드 목록의 단일 출처는 검색 tool 계약이다.** 이 문서는 시점 기록이며, 필드는 늘어난다. 모르는 키를 무시하도록 만든다.

**주의 5가지**

1. **`sources`는 답변 문장에 이름이 나온 서비스만 담는다.** 대조는 공백·가운뎃점류(`·`·`･`·`ㆍ`)·하이픈·괄호·따옴표·`*`를 지운 문자열로 하고, 전체 이름이 안 걸리면 끝의 괄호 꼬리(`(…)`)를 뗀 이름으로 한 번 더 본다(뗀 이름이 4자 미만이면 쓰지 않는다). **하나도 안 걸리면 전부 담는다** — 카드 0개보다 낫다. 회수 순서(MCP 순서)는 유지된다. **확인됨.**
2. **같은 `service_id`가 반복될 수 있었다 — 지금은 접힌다.** 한 서비스가 본문과 첨부 문서에서 각각 회수되면 자리를 나눠 차지했다. 검색 서버가 고유 `service_id` 하나로 접도록 바뀌었고, 같은 날 재확인에서 8건 전부 고유였다. **그래도 건수를 화면 문구에 쓸 때는 고유 `service_id` 기준으로 센다** — 세는 쪽이 싸고, 접기 규칙이 바뀌어도 문구가 틀리지 않는다.
3. **같은 필드인데 건마다 값의 출처가 다르다.** `selection_criteria`·`apply_method`·`contact`·`department`·`apply_start`·`apply_end`·`min_age`·`max_age` 여덟 개가 그렇다 — 첨부 문서로 걸린 건은 그 문서가 속한 대표 서비스의 원장 값이고, 본문으로 걸린 건은 색인 값이다. 어느 쪽인지는 `doc_title`로 가른다(비어 있으면 본문).
4. **`exclusion_criteria`가 비어 있다고 제외 조건이 없는 것은 아니다.** 값이 채워지는 적재 작업이 서버 배포보다 뒤에 온다. 그 사이에는 조건이 있어도 빈 값이 흐른다. **「제외 대상 없음」으로 표시하지 않는다** — 값이 있을 때만 그 칸을 그린다.
5. **건수는 거주지에 따라 변한다.** 최대 `top_k × 열린 계층 수`다. 구 코드를 주면 3계층, 시도 코드면 2계층, 거주지가 없으면 1계층이다. 고정 개수 그리드를 전제하지 않는다. **확인됨.**

`sources`가 빈 배열이면 오류가 아니라 **근거 없는 안내문**이라는 뜻이다.

### 3.3 `suggestions` — 후속 제안 칩

답변 아래에 그릴 후속 행동 후보다. **칩에 쓸 문구가 들어 있지 않다** — 아래 표의 조립 규칙대로 채널이 만든다. 접근성 레이블·다국어를 채널이 정하라고 일부러 뺐다.

**실제 응답**:

```json
"suggestions": [
  {
    "type": "detail",
    "service_id": "CG-2026-G-180",
    "service_name": "노인 일자리 및 사회활동 지원"
  },
  {
    "type": "other_category"
  }
]
```

| `type` | 동반 키 | **칩 라벨 조립** | 누르면 보낼 것 |
|:---|:---|:---|:---|
| `detail` | `service_id` · `service_name` | **`service_name` + 「 자세히 보기」** — 위 예는 「노인 일자리 및 사회활동 지원 자세히 보기」가 된다 | §3.5 상세 요청, `service_ids: [service_id]` |
| `other_category` | 없음 | **고정 문구.** 「다른 분야도 볼래요」 등 채널이 정한 한 문장 | **서버 호출 없음**(아래) |

- **`detail` 칩의 라벨에는 `service_name`이 들어간다.** 「이 서비스를 자세히 보기」처럼 이름 없는 문구를 쓰면 무엇을 여는지 알 수 없다 — 회수 결과가 여럿이라 이름이 있어야 구분된다.
- `detail`은 **`sources`(§3.2 필터를 거친 뒤) 첫 번째 항목**이다. 카드 목록의 첫 번째와 같은 서비스다.
- `type`은 **닫힌 집합**이다. 모르는 값이 오면 그 항목을 무시한다 — 앞으로 늘 수 있다.
- **`other_category`를 눌렀을 때의 동작은 아직 정하지 않았다.** 이 항목에는 동반 데이터가 없고 서버에 되돌려 보낼 것도 없다 — 서버는 이 칩을 받는 경로가 없다. 채널이 무엇을 할지 정한다.
  - 자연스러운 방향은 **분야 선택 UI를 다시 띄우고**, 시민이 고르면 바뀐 `conditions.category_codes`로 **평범한 검색 턴**을 보내는 것이다. 그러면 서버 변경이 필요 없다.
  - 화면 상단에 「조건 변경」이 이미 있다면 이 칩이 중복일 수 있다. 칩을 안 그리는 것도 선택이다.
- 회수 0건이면 `other_category` 하나만 온다.
- **이 키가 아예 없을 수도 있다.** 없으면 칩을 그리지 않는다.

### 3.4 클릭을 되돌려 보낼 때

칩과 「자세히 보기」 버튼은 **구조화 이벤트로 보낸다.** 말풍선에 문장을 보여주는 것은 표시일 뿐이고, 전송 페이로드는 분리한다.

문장으로 보내면 에이전트가 문장에서 서비스를 다시 찾아야 하고, 그 추정은 틀릴 수 있다. `service_id`를 그대로 실어 보내면 틀릴 자리가 없다.

### 3.5 상세 조회

카드의 「자세히 보기」를 눌렀을 때 쓴다. **검색과 다른 DataPart**를 보낸다 — 질의문이 아니라 **서비스 ID 배열**이다.

응답은 `services`(23필드)와 `missing_service_ids`다.

#### 요청

```json
{
  "jsonrpc": "2.0", "id": 1, "method": "message/send",
  "params": {
    "message": {
      "role": "user", "kind": "message", "messageId": "<고유값>",
      "parts": [
        { "kind": "data", "data": {
            "schema": "rag-agent.detail-input.v1",
            "params": { "service_ids": ["CG-2026-G-180", "320561"] }
        }}
      ]
    }
  }
}
```

- 한 건만 볼 때도 **배열**이다.
- **최대 20건.** 이 에이전트는 개수를 검사하지 않고 그대로 넘기므로, 넘기면 검색 서버가 거절한다.
- 카드에서 받은 `service_id`를 그대로 쓴다. 이름이나 문장으로 보내지 않는다.

#### 응답

artifact `welfare-guide` 안의 두 part는 검색과 같지만 **DataPart의 키가 다르다.**

```json
{ "kind": "text", "text": "노인 일자리 및 사회활동 지원에 대해 자세히 안내해 드릴게요." }
{ "kind": "data", "data": {
    "schema": "rag-agent.flow-output.v1",
    "services": [
      { "service_id": "CG-2026-G-180", "service_name": "노인 일자리 및 사회활동 지원", "...": "23필드" }
    ],
    "missing_service_ids": []
}}
```

| 키 | 뜻 |
|:---|:---|
| `services` | 조회된 서비스. **요청한 순서를 지킨다.** 각 항목은 23필드다 |
| `missing_service_ids` | 조회되지 않은 ID. 조용히 빠지지 않고 여기 담긴다 |

**응답 종류를 가르는 법**: `schema` 값은 검색과 같다(`rag-agent.flow-output.v1`). **`services` 키가 있으면 상세, `sources` 키가 있으면 검색**이다. 상세 응답에 `sources`는 없고, 검색 응답에 `services`는 없다.

- **자격 조건으로 걸러내지 않는다.** 지금 조건에 맞지 않는 서비스도 그대로 온다 — 비교 화면에서 「이 조건에는 해당하지 않음」을 표시할 수 있다.
- 요청한 ID가 **전부** 조회되지 않으면 `services`가 빈 배열이고 안내문은 고정 문구다.
- `service_ids`가 비어 있으면 오류다(`INVALID_INPUT`). 검색 서버를 부르지 않는다.
- 상세 23필드 중 **연도·소득기준·담당부서는 당분간 빈 값**이 올 수 있다. 원장을 넓히는 작업이 서버 배포보다 뒤에 온다. 빈 값을 「해당 없음」으로 그리지 않는다.

## 4. 실패와 경계 상황

| 상황 | `status.state` | 내용 |
|:---|:---|:---|
| 정상 | `completed` | 안내문 + `sources` 1건 이상 |
| 조건에 맞는 서비스 0건 | `completed` | 「입력하신 조건으로 신청 가능한 복지서비스를 찾지 못했습니다…」 + `sources` `[]` |
| 질의 없음(text part도, 호환 DataPart의 `query`도 없음) | 실패 | `INVALID_INPUT`(`RAG_INPUT_MISSING`) |
| 형식이 틀린 조건 | **미확인** | 이름 문자열 거주지나 숫자가 아닌 나이의 거동을 관측하지 않았다 |

**0건을 오류 화면으로 처리하지 않는다.** 조건을 바꿔 다시 물어보도록 안내한다.

## 5. 알려진 한계

- **복지 무관 질의를 거절하지 않는다**(§1).
- **멀티턴 맥락을 반영하지 않는다**(§1). 후속 발화의 질의 조립은 채널 몫이다.
- **안내문의 카드 서식.** 현재 안내문은 마크다운 인용 블록으로 서비스 카드를 그린다. 채널이 `sources`로 카드를 그린다면 안내문의 그 부분은 중복이다. 안내문을 짧은 요약으로 바꾸는 작업이 예정돼 있다.
- **`sources` 중복**(§3.2 주의 2).
- **`exclusion_criteria`가 비어도 제외 조건이 없다는 뜻은 아니다**(§3.2 주의 4). 값을 채우는 작업이 진행 중이다.
- 스트리밍(`message/stream`)은 증분 텍스트 뒤 마지막에 DataPart가 온다. 마지막 이벤트까지 받아야 `sources`·`suggestions`가 완성된다.

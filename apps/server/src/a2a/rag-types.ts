/**
 * RAG 복지 안내 에이전트 계약 타입 — docs/rag-agent-직접연동-가이드v4.md.
 *
 * 요청: text part(질의) + DataPart `rag-agent.flow-input.v3`(conditions·options).
 * 응답: artifact `welfare-guide` 안의 TextPart(안내문) + DataPart `rag-agent.flow-output.v1`.
 *       검색은 `sources`, 상세는 `services` 키를 담는다.
 *
 * ⚠️ 모르는 키와 모르는 schema는 무시한다(§3.1) — 필드는 앞으로 늘어난다. 그래서 모든
 *    필드를 옵셔널·방어적으로 다룬다.
 */

/** §2.2 conditions — 시민 온보딩 조건 + 조회 기준일. 빈 항목은 조건으로 만들지 않는다. */
export interface RagConditions {
  /** 거주지 법정동 코드 `^[0-9]{10}$`. 없으면 지역 서비스가 안 나온다. */
  residence?: string;
  /** 조회 기준일 `YYYY-MM-DD`. 이 날짜에 접수 중인 것만(폐구간). */
  apply_date?: string;
  /** 만 나이 0~120. */
  age?: number;
  /** 기준 중위소득 비율(%) 0~999. */
  income_ratio?: number;
  /** 관심주제 코드(OR). */
  category_codes?: string[];
  life_cycle_codes?: string[];
  household_type_code?: string;
  household_situation_codes?: string[];
}

/** §2.3 options. */
export interface RagOptions {
  top_k?: number;
  answer_format?: "markdown" | "plain";
}

/** askRagAgent 입력 — 질의 + (선택) 조건/옵션. */
export interface RagQuery {
  /** text part 질의. 후속 발화는 채널이 완성된 질의로 조립해 넣는다(§1). */
  query: string;
  conditions?: RagConditions;
  options?: RagOptions;
  /**
   * message.metadata.sessionId — 카카오 botUserKey(userRequest.user.id)를 그대로 싣는다.
   * 같은 채팅방(사용자)의 턴을 에이전트가 하나의 세션으로 묶는 용도. 없으면 "anonymous".
   */
  sessionId?: string;
}

/** §3.2 sources 한 건(17필드, 검색 tool이 준 값을 가공 없이). 모르는 키는 무시. */
export interface RagSource {
  service_id: string;
  service_name: string;
  gov_code?: string;
  category_large?: string[];
  min_age?: number;
  max_age?: number;
  /** `YYYY-MM-DD`. */
  apply_start?: string;
  /** `YYYY-MM-DD`. `9999-12-31`이면 상시 접수. */
  apply_end?: string;
  selection_criteria?: string;
  contact?: string;
  department?: string;
  apply_method?: string;
  exclusion_criteria?: string;
  content_snippet?: string;
  score?: number;
  doc_title?: string;
  file_type?: string;
}

/** §3.3 suggestions — 후속 제안 칩. type은 닫힌 집합, 모르는 값은 무시. */
export interface RagSuggestion {
  type: "detail" | "other_category" | (string & {});
  service_id?: string;
  service_name?: string;
}

/**
 * askRagAgent 결과 — 안내문 + 구조화 카드 데이터.
 * ok=false면 실패(질의 없음·인증·네트워크·태스크 실패). guideText에 사용자용 사유가 담긴다.
 */
export interface RagResult {
  ok: boolean;
  /** 시민에게 보여줄 안내문(옵션에 따라 plain/markdown). 실패 시 사유 문구. */
  guideText: string;
  /** 검색 회수 카드. 없거나 실패면 빈 배열. */
  sources: RagSource[];
  /** 후속 제안 칩. 없으면 빈 배열. */
  suggestions: RagSuggestion[];
}

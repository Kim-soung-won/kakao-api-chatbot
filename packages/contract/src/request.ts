/**
 * 카카오 챗봇 → 우리 스킬 서버로 오는 **요청(SkillPayload)** 계약.
 *
 * ⚠️ HYPOTHESIS — 이 타입은 아직 "가설"이다.
 * 카카오 공개 GitBook(llms-full.txt 포함)에는 요청 JSON 스펙이 명시돼 있지 않다.
 * 아래 구조는 i-오픈빌더 통념에 기반한 초안이며, 실제 값은
 * server의 `/echo` 엔드포인트로 진짜 요청 한 방을 캡처해 확정한다.
 *
 * 확정해야 할 3가지 (저장소 설계의 근거):
 *   1) 사용자 식별키(user.id / botUserKey)가 봇마다 고정인가?
 *   2) 응답에서 세팅한 context.params가 다음 요청 contexts로 왕복되는가?
 *   3) contexts params의 수명(lifeSpan/ttl)이 실제로 어떻게 만료되는가?
 */

/** 발화한 사용자. */
export interface SkillUser {
  /**
   * 봇+사용자 조합의 식별키(botUserKey). 봇 스코프에서 사용자 식별에 쓰는 값으로 추정.
   * ⚠️ 세션 간 고정 여부 = /echo로 검증 대상.
   */
  id: string;
  /** 예: "botUserKey". */
  type?: string;
  /** plusfriendUserKey, appUserId 등 추가 속성으로 추정. ⚠️ 검증 대상. */
  properties?: Record<string, unknown>;
}

/** 요청에 함께 실려 오는 컨텍스트(응답 context.params의 왕복 결과로 추정). */
export interface RequestContext {
  name: string;
  lifeSpan: number;
  ttl?: number;
  params?: Record<string, unknown>;
}

export interface UserRequest {
  /** 사용자 발화 원문. */
  utterance: string;
  user: SkillUser;
  /** 이전 응답에서 세팅한 컨텍스트들의 왕복. ⚠️ 존재/형식 검증 대상. */
  contexts?: RequestContext[];
  /** 발화가 들어온 블록 정보 등. */
  block?: { id?: string; name?: string };
  lang?: string;
  params?: Record<string, unknown>;
}

export interface BotRef {
  id: string;
  name?: string;
}

/** 매칭된 액션과 파라미터. */
export interface SkillAction {
  id?: string;
  name?: string;
  /** 엔티티 추출 등으로 채워진 파라미터(단순 값). */
  params?: Record<string, string>;
  /** 상세 파라미터(원문/정규화 값 포함). */
  detailParams?: Record<string, unknown>;
  /** 버튼 block action의 extra가 여기로 전달되는지 = 검증 대상. */
  clientExtra?: Record<string, unknown>;
}

/** 스킬 서버가 POST로 받는 최상위 페이로드. */
export interface SkillPayload {
  /** 스킬 페이로드 버전(요청 측). */
  intent?: { id?: string; name?: string };
  userRequest: UserRequest;
  bot: BotRef;
  action: SkillAction;
}

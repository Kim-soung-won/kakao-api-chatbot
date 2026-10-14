import type { SkillResponse } from "@sprint-kakao/contract";
import type { SessionMode } from "./session-store.js";

export type { SessionMode } from "./session-store.js";

/** 한 번의 스킬 호출 컨텍스트(요청에서 추출한 값). */
export interface SkillContext {
  /** 정규화된 사용자 발화. */
  utterance: string;
  /**
   * 발화자 식별키(botUserKey = userRequest.user.id). 없으면 "anonymous".
   * 세션 파일 저장소의 키이자 에이전트 sessionId. 대화 이력은 서버가 저장하지 않는다(에이전트가 관리).
   */
  userId: string;
  /**
   * 이 사용자의 현재 세션 모드(session-store.ts에서 이번 요청 시점에 로드).
   * undefined=미연결, "agent"=AI 복지 연결(발화가 에이전트로 흐름).
   */
  mode?: SessionMode;
  /**
   * 콜백 URL(카카오 useCallback 스킬에서 실려옴). 있으면 5초 초과 처리를 콜백으로 보낼 수 있다.
   * 없으면(로컬/콜백 미설정) 동기 경로로 폴백. → blocks의 `callback` 참고.
   */
  callbackUrl?: string;
  /** 원본 payload — 향후 user.id·contexts 활용 지점. */
  raw?: unknown;
}

/**
 * 스킬 블록 — 오픈빌더의 "블록" 개념을 앱 레벨로 옮긴 처리 단위.
 * match로 이 발화를 처리할지 판단하고, respond로 SkillResponse를 만든다.
 *
 * 현재 블록 (매칭 순서는 blocks/index.ts):
 *   - connect    : "AI 복지 연결" → 세션을 agent 모드로(setMode).
 *   - exit       : "종료" 등 → 세션 해제(setMode:null).
 *   - onboarding : 지역→연령대→가구→관심(복수) 카드 흐름(로컬). 완료 시 연결 상태면 프로필을 에이전트로 전달.
 *   - agent      : agent 모드일 때의 캐치올. 발화를 A2A 에이전트로 전달(callback).
 */
export interface SkillBlock {
  /** 블록 이름(로깅·문서용). */
  name: string;
  /**
   * 선택: 이 블록으로 처리한 뒤 사용자 세션 모드를 전환한다.
   * "agent"=연결, null=해제, undefined(미지정)=변경 없음. 라우트가 응답 생성 전에 저장한다.
   */
  setMode?: SessionMode | null;
  match(ctx: SkillContext): boolean;
  /** 동기 응답(5초 이내). 콜백 블록에서는 A2A 미가용 시의 폴백으로도 쓰인다. */
  respond(ctx: SkillContext): SkillResponse;
  /**
   * 선택: 5초를 초과하는 외부 처리(A2A·RAG·LLM). 있으면 라우트가 **콜백 플로우**로 처리한다 —
   * callbackUrl이 있으면 즉시 대기응답(useCallback) 후 백그라운드에서 `run`을 돌려 그 결과를
   * callbackUrl로 POST, 없으면 `run`을 동기로 await(로컬 데모). `run` 실패 시 `respond`가 폴백.
   */
  callback?: {
    /**
     * 선택: 이 요청을 콜백으로 처리할지 결정. 없거나 true면 콜백, false면 동기 respond로.
     * (예: onboarding은 완료 단계에서만 에이전트를 콜백 호출한다.)
     */
    when?(ctx: SkillContext): boolean;
    /** 대기 응답에 노출할 문구. */
    waitingText: string;
    /** 백그라운드 최종 응답 생성(외부 서버/SSE 호출). */
    run(ctx: SkillContext): Promise<SkillResponse>;
  };
}

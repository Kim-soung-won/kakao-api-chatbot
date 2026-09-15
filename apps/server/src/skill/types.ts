import type { SkillResponse } from "@sprint-kakao/contract";
import type { HistoryTurn } from "./history.js";

/** 한 번의 스킬 호출 컨텍스트(요청에서 추출한 값). */
export interface SkillContext {
  /** 정규화된 사용자 발화. */
  utterance: string;
  /** 발화자 식별키(botUserKey = userRequest.user.id). 이력 파일 저장소의 키. 없으면 "anonymous". */
  userId: string;
  /**
   * 이 사용자의 이전 대화 이력. 파일 저장소(history-store.ts)에서 이번 요청 시점에 로드한 값.
   * (파일 없음/깨짐이면 빈 배열.)
   */
  history: HistoryTurn[];
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
 * (웰컴·폴백·탈출·시나리오 블록이 각각 이 계약을 구현.)
 */
export interface SkillBlock {
  /** 블록 이름(로깅·문서용). */
  name: string;
  /**
   * 참이면 이 블록으로 처리된 턴은 대화 이력에 기록하지 않는다.
   * (예: "RAG 검색" 같은 메타/디버그 명령은 이력에 남기지 않아야 이력이 오염되지 않음)
   */
  transient?: boolean;
  match(ctx: SkillContext): boolean;
  /** 동기 응답(5초 이내). 콜백 블록에서는 A2A 미가용 시의 폴백으로도 쓰인다. */
  respond(ctx: SkillContext): SkillResponse;
  /**
   * 선택: 5초를 초과하는 외부 처리(A2A·RAG·LLM). 있으면 라우트가 **콜백 플로우**로 처리한다 —
   * callbackUrl이 있으면 즉시 대기응답(useCallback) 후 백그라운드에서 `run`을 돌려 그 결과를
   * callbackUrl로 POST, 없으면 `run`을 동기로 await(로컬 데모). `run` 실패 시 `respond`가 폴백.
   */
  callback?: {
    /** 대기 응답에 노출할 문구. */
    waitingText: string;
    /** 백그라운드 최종 응답 생성(외부 서버/SSE 호출). */
    run(ctx: SkillContext): Promise<SkillResponse>;
  };
}

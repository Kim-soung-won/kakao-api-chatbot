import type { SkillResponse } from "@sprint-kakao/contract";

/** 한 번의 스킬 호출 컨텍스트(요청에서 추출한 값). */
export interface SkillContext {
  /** 정규화된 사용자 발화. */
  utterance: string;
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
  match(ctx: SkillContext): boolean;
  respond(ctx: SkillContext): SkillResponse;
}

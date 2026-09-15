import type { SkillResponse } from "@sprint-kakao/contract";
import type { HistoryTurn } from "./history.js";

/** 한 번의 스킬 호출 컨텍스트(요청에서 추출한 값). */
export interface SkillContext {
  /** 정규화된 사용자 발화. */
  utterance: string;
  /**
   * 이번 요청에 카카오 `contexts`로 실려온 이전 대화 이력(왕복 결과).
   * 서버 저장소 없이 카카오 네이티브 context(채팅방 세션)만으로 이어받는다.
   * (요청 계약이 가설이라 없거나 깨지면 빈 배열.)
   */
  history: HistoryTurn[];
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
  respond(ctx: SkillContext): SkillResponse;
}

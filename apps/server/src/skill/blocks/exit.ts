import type { SkillBlock } from "../types.js";
import { onboarding } from "./onboarding.js";

/** 탈출(초기화) 명령어. "대화 종료/연결 해제"는 에이전트 대화 모드 이탈도 겸한다. */
const EXIT_WORDS = ["처음", "처음으로", "취소", "그만", "리셋", "대화 종료", "종료", "연결 해제"];

/**
 * 탈출 블록 — 되묻기(다단계) 흐름 초기화 + 에이전트 대화 모드 이탈.
 * (오픈빌더 탈출 블록에 대응) setMode:null로 세션 모드를 해제하고 온보딩 시작으로 리셋한다.
 * 매칭 순서상 agent-chat보다 앞이므로, agent 모드 중에도 이 키워드는 에이전트로 넘어가지 않는다.
 */
export const exit: SkillBlock = {
  name: "exit",
  setMode: null,
  match: (ctx) => EXIT_WORDS.includes(ctx.utterance),
  respond: (ctx) => onboarding.respond({ ...ctx, utterance: "맞춤복지" }),
};

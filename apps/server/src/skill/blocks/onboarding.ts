import type { SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { messageQuickReply, simpleText } from "../../builders/outputs.js";
import { welfareResponse } from "./welfare.js";

/** 온보딩 시나리오 단계별 선택지. */
export const REGIONS = ["화곡동", "등촌동", "가양동", "마곡동"];
export const HOUSEHOLDS = [
  "다문화가정",
  "외국인근로자",
  "중도입국청소년",
  "다자녀가정",
  "한부모가족",
  "1인가구",
  "노인가구",
];
export const INTERESTS = ["출산·육아", "교육·진학", "취업·직업", "의료·건강", "주거·생활"];

/** 라벨을 그대로 다음 발화로 보내는 quickReply 묶음. */
const stepQr = (labels: string[]) => labels.map((l) => messageQuickReply(l, l));

/** 텍스트 + 스텝 전용 quickReplies로 구성한 단계 응답. */
const step = (text: string, labels: string[]): SkillResponse => ({
  version: "2.0",
  template: { outputs: [simpleText(text)], quickReplies: stepQr(labels) },
});

/**
 * 온보딩 시나리오 블록 — 지역 → 가구유형 → 관심분야 → 결과.
 * 각 단계의 선택 값이 다음 발화로 넘어와 다음 단계를 트리거한다(선형).
 * ⚠️ 상태 미저장: 최종 결과에 앞 선택을 반영하려면 context 누적 필요(다음 단계).
 */
export const onboarding: SkillBlock = {
  name: "onboarding",
  match: (ctx) => {
    const u = ctx.utterance;
    return (
      u.includes("맞춤") ||
      u === "시작" ||
      REGIONS.includes(u) ||
      HOUSEHOLDS.includes(u) ||
      INTERESTS.includes(u) ||
      u === "완료"
    );
  },
  respond: (ctx) => {
    const u = ctx.utterance;
    if (u.includes("맞춤") || u === "시작") {
      return step(
        "안녕하세요! 👋 맞춤 복지 안내를 위해 몇 가지만 알려주세요.\n\n거주 지역을 선택해 주세요.",
        REGIONS,
      );
    }
    if (REGIONS.includes(u)) {
      return step(`${u}으로 설정했어요 ✅\n\n가구 유형을 선택해 주세요.`, HOUSEHOLDS);
    }
    if (HOUSEHOLDS.includes(u)) {
      return step(
        `${u} 확인했어요.\n\n관심 복지 분야를 선택해 주세요. (복수 선택 가능)`,
        [...INTERESTS, "완료"],
      );
    }
    // INTERESTS 선택 또는 "완료" → 맞춤 결과(복지 캐러셀 재사용)
    return welfareResponse();
  },
};

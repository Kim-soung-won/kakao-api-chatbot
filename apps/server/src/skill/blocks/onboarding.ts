import type { SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import { messageQuickReply, simpleText } from "../../builders/outputs.js";
import { askA2a } from "../../a2a/client.js";
import { renderAgentAnswer } from "../render-agent.js";
import { NAV_QUICK_REPLIES } from "../shared.js";

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

/**
 * 카카오 context가 요청 간 왕복되지 않고(실측) 서버도 상태를 저장하지 않으므로,
 * 온보딩 진행 상태(앞 단계 선택)는 **다음 발화(quickReply messageText)에 실어 나른다.**
 * 예: 지역 선택 → 가구 단계 버튼의 messageText = "화곡동 / 다문화가정".
 * 구분자 " / " — INTERESTS는 "·"만 쓰므로 충돌하지 않는다.
 */
const SEP = " / ";

interface Profile {
  region?: string;
  household?: string;
  interest?: string;
}

/** 발화를 프로필로 파싱(누적 텍스트). */
function parseProfile(u: string): Profile {
  const parts = u.split(SEP).map((p) => p.trim()).filter(Boolean);
  return { region: parts[0], household: parts[1], interest: parts[2] };
}

/** 지역만 고른 상태(1단계 완료). */
function isRegionOnly(u: string): boolean {
  return !u.includes(SEP) && REGIONS.includes(u);
}
/** 지역+가구 상태(2단계 완료). */
function isRegionHousehold(u: string): boolean {
  const p = parseProfile(u);
  return !!p.region && REGIONS.includes(p.region) && !!p.household && HOUSEHOLDS.includes(p.household) && !p.interest;
}
/** 지역+가구+관심(또는 완료) 상태(3단계 = 온보딩 완료). */
function isComplete(u: string): boolean {
  const p = parseProfile(u);
  return (
    !!p.region &&
    REGIONS.includes(p.region) &&
    !!p.household &&
    HOUSEHOLDS.includes(p.household) &&
    !!p.interest &&
    (INTERESTS.includes(p.interest) || p.interest === "완료")
  );
}

/** 라벨 배열을 "누적 prefix + 라벨" messageText로 되쏘는 quickReply 묶음. */
const stepQr = (prefix: string, labels: string[]) =>
  labels.map((l) => messageQuickReply(l, prefix ? `${prefix}${SEP}${l}` : l));

/** 텍스트 + 스텝 전용 quickReplies로 구성한 단계 응답. */
const step = (text: string, qr: ReturnType<typeof messageQuickReply>[]): SkillResponse => ({
  version: "2.0",
  template: { outputs: [simpleText(text)], quickReplies: qr },
});

/** 완료 프로필을 에이전트 질의 텍스트로. */
function profileQuery(p: Profile): string {
  const interest = p.interest && p.interest !== "완료" ? p.interest : "미지정";
  return (
    `복지 상담 챗봇입니다. 다음 사용자 프로필에 맞는 복지 제도를 친절하게 안내해 주세요.\n` +
    `거주 지역: ${p.region}, 가구 유형: ${p.household}, 관심 분야: ${interest}.`
  );
}

/**
 * 온보딩 시나리오 블록 — 지역 → 가구유형 → 관심분야 → (완료 시) 에이전트 안내.
 * 각 단계의 선택 값이 누적되어 다음 발화로 넘어오고(선형), 완료 단계에서 수집한 프로필을
 * 에이전트로 전달해 맞춤 안내를 받는다. 카드/버블 단계는 동기 응답, 완료만 콜백(에이전트).
 */
export const onboarding: SkillBlock = {
  name: "onboarding",
  match: (ctx) => {
    const u = ctx.utterance;
    return u.includes("맞춤") || u === "시작" || isRegionOnly(u) || isRegionHousehold(u) || isComplete(u);
  },

  respond: (ctx) => {
    const u = ctx.utterance;
    if (u.includes("맞춤") || u === "시작") {
      return step(
        "안녕하세요! 👋 맞춤 복지 안내를 위해 몇 가지만 알려주세요.\n\n거주 지역을 선택해 주세요.",
        stepQr("", REGIONS),
      );
    }
    if (isRegionOnly(u)) {
      return step(`${u}으로 설정했어요 ✅\n\n가구 유형을 선택해 주세요.`, stepQr(u, HOUSEHOLDS));
    }
    if (isRegionHousehold(u)) {
      const p = parseProfile(u);
      return step(
        `${p.household} 확인했어요.\n\n관심 복지 분야를 선택해 주세요.`,
        stepQr(u, [...INTERESTS, "완료"]),
      );
    }
    // 완료 단계의 폴백(에이전트 미가용 시): 수집 프로필만 요약해 안내.
    const p = parseProfile(u);
    const interest = p.interest && p.interest !== "완료" ? p.interest : "미지정";
    return {
      version: "2.0",
      template: {
        outputs: [
          simpleText(
            `프로필을 확인했어요 ✅\n· 지역: ${p.region}\n· 가구: ${p.household}\n· 관심: ${interest}\n\n` +
              `잠시 후 AI 상담원이 맞춤 복지를 안내해 드릴게요.`,
          ),
        ],
        quickReplies: NAV_QUICK_REPLIES,
      },
    };
  },

  // 완료 단계에서만 에이전트를 콜백 호출(카드 단계는 동기 respond).
  callback: {
    when: (ctx) => isComplete(ctx.utterance),
    waitingText: "입력하신 정보로 맞춤 복지를 찾고 있어요… 잠시만 기다려 주세요 🔎",
    run: async (ctx) => {
      const answer = await askA2a({ question: profileQuery(parseProfile(ctx.utterance)) });
      return {
        version: "2.0",
        template: { outputs: renderAgentAnswer(answer), quickReplies: NAV_QUICK_REPLIES },
      };
    },
  },
};

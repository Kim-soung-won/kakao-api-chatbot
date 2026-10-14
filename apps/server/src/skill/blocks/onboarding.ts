import type { ListCard, ListItem, Output, QuickReply, SkillResponse } from "@sprint-kakao/contract";
import { MAX_LIST_ITEMS_IN_CAROUSEL, MAX_QUICK_REPLIES } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import {
  carousel,
  messageButton,
  messageQuickReply,
  simpleText,
  textCard,
} from "../../builders/outputs.js";
import { askRagAgent } from "../../a2a/rag-client.js";
import type { RagConditions } from "../../a2a/rag-types.js";
import { renderRag } from "../render-rag.js";
import { AGE_BANDS, HOUSEHOLDS, INTERESTS, REGIONS } from "../onboarding-data.js";
import { CONNECT_QUICK_REPLIES, CONNECT_UTTERANCE, NAV_QUICK_REPLIES, wrapSession } from "../shared.js";

/**
 * 카카오 context가 요청 간 왕복되지 않고(실측) 온보딩은 서버에 저장하지 않으므로,
 * 진행 상태(앞 단계 선택)는 **다음 발화(버튼 messageText)에 실어 나른다.**
 *
 *   맞춤복지                                         → 지역 1쪽
 *   맞춤복지 / 지역 2쪽                               → 지역 2쪽(페이지 이동)
 *   맞춤복지 / 강서구                                  → 연령대 단계
 *   맞춤복지 / 강서구 / 30대                           → 가구 단계
 *   맞춤복지 / 강서구 / 30대 / 단독가구                 → 관심 단계(선택 없음)
 *   맞춤복지 / 강서구 / 30대 / 단독가구 / 주거, 보육     → 관심 단계(토글 중)
 *   맞춤복지 / 강서구 / 30대 / 단독가구 / 주거, 보육 / 완료 → 완료
 *
 * 단계 구분자 " / " — 관심 분야 라벨의 "/"(예: 문화/여가)는 앞뒤 공백이 없어 충돌하지 않는다.
 * 관심 분야 목록 구분자는 ", ". 건너뛴 값은 "나이 무관"·"관심 무관"으로 둔다.
 */
const PREFIX = "맞춤복지";
const SEP = " / ";
const LIST_SEP = ", ";
const AGE_SKIP = "나이 무관";
const INTEREST_NONE = "관심 무관";
const DONE = "완료";
const PAGE_RE = /^지역 (\d+)쪽$/;

const regionLabels = REGIONS.map((r) => r.label);
const ageLabels = AGE_BANDS.map((a) => a.label);

interface Profile {
  region: string;
  age: string;
  household?: string;
  interests?: string[];
}

/** 파싱 결과 — 어느 단계 응답을 낼지. */
type Stage =
  | { kind: "region"; page: number }
  | { kind: "age"; region: string }
  | { kind: "household"; region: string; age: string }
  | { kind: "interest"; profile: Profile & { household: string; interests: string[] } }
  | { kind: "complete"; profile: Profile & { household: string; interests: string[] } };

/** 관심 분야 목록 파트 파싱. 모르는 라벨이 섞이면 null. */
function parseInterests(part: string): string[] | null {
  if (part === INTEREST_NONE) return [];
  const list = part.split(LIST_SEP).map((s) => s.trim());
  return list.every((l) => INTERESTS.includes(l)) ? list : null;
}

/** 발화 → 단계. 온보딩 발화가 아니면 null. */
function parseStage(u: string): Stage | null {
  if (!u.includes(SEP)) {
    return u.includes("맞춤") || u === "시작" ? { kind: "region", page: 0 } : null;
  }
  const [head, ...f] = u.split(SEP).map((p) => p.trim());
  if (head !== PREFIX || f.length === 0) return null;

  const page = f.length === 1 ? PAGE_RE.exec(f[0]!) : null;
  if (page) return { kind: "region", page: Number(page[1]) - 1 };

  const [region, age, household, interestPart, done] = f;
  if (!region || !regionLabels.includes(region)) return null;
  if (f.length === 1) return { kind: "age", region };

  if (!age || (age !== AGE_SKIP && !ageLabels.includes(age))) return null;
  if (f.length === 2) return { kind: "household", region, age };

  if (!household || !HOUSEHOLDS.includes(household)) return null;
  if (f.length === 3) return { kind: "interest", profile: { region, age, household, interests: [] } };

  const interests = interestPart ? parseInterests(interestPart) : null;
  if (!interests) return null;
  const profile = { region, age, household, interests };
  if (f.length === 4) return { kind: "interest", profile };
  if (f.length === 5 && done === DONE) return { kind: "complete", profile };
  return null;
}

/** 관심 분야 목록 → messageText 파트(정렬 고정, 비면 "관심 무관"). */
function interestPart(list: string[]): string {
  const sorted = INTERESTS.filter((i) => list.includes(i));
  return sorted.length ? sorted.join(LIST_SEP) : INTEREST_NONE;
}

/**
 * 지역 quickReply 페이지 분할 — 첫 쪽은 [다음], 중간 쪽은 [이전][다음], 끝 쪽은 [이전]을 포함해
 * MAX_QUICK_REPLIES에 맞춘다. (26개 → 9 / 8 / 9)
 */
function regionPages(): string[][] {
  const pages: string[][] = [];
  let i = 0;
  while (i < regionLabels.length) {
    const prev = pages.length > 0 ? 1 : 0;
    const remaining = regionLabels.length - i;
    const take = remaining <= MAX_QUICK_REPLIES - prev ? remaining : MAX_QUICK_REPLIES - prev - 1;
    pages.push(regionLabels.slice(i, i + take));
    i += take;
  }
  return pages;
}
const REGION_PAGES = regionPages();

function regionQuickReplies(page: number): QuickReply[] {
  const p = Math.min(Math.max(page, 0), REGION_PAGES.length - 1);
  const qr: QuickReply[] = [];
  if (p > 0) qr.push(messageQuickReply("◀ 이전", `${PREFIX}${SEP}지역 ${p}쪽`));
  qr.push(...REGION_PAGES[p]!.map((l) => messageQuickReply(l, `${PREFIX}${SEP}${l}`)));
  if (p < REGION_PAGES.length - 1) qr.push(messageQuickReply("다음 ▶", `${PREFIX}${SEP}지역 ${p + 2}쪽`));
  return qr;
}

/** 받침에 맞는 조사 "으로/로"(ㄹ 받침은 "로"). */
function euro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}

/** 텍스트 + quickReplies로 구성한 단계 응답. */
const step = (outputs: Output[], quickReplies: QuickReply[]): SkillResponse => ({
  version: "2.0",
  template: { outputs, quickReplies },
});

/** 시작 안내 카드(웹 폼 헤더 대응) — "건너뛰고 바로 질문하기"는 세션 연결로 보낸다. */
const INTRO_CARD = textCard({
  title: "몇 가지만 알려주세요",
  description:
    "입력하신 정보를 기준으로 받을 수 있는 복지 제도를 찾아 드립니다.\n" +
    "모두 선택 사항이며, 건너뛰고 바로 질문하셔도 됩니다.",
  buttons: [messageButton("건너뛰고 바로 질문하기", CONNECT_UTTERANCE)],
});

/** 관심 분야 토글 캐러셀 — 항목을 누르면 선택/해제된 목록으로 같은 단계가 다시 그려진다. */
function interestCarousel(base: string, selected: string[]): Output {
  const items: ListItem[] = INTERESTS.map((label) => {
    const on = selected.includes(label);
    const next = on ? selected.filter((s) => s !== label) : [...selected, label];
    return {
      title: on ? `✅ ${label}` : label,
      description: on ? "선택됨 · 누르면 해제" : "누르면 선택",
      action: "message",
      messageText: `${base}${SEP}${interestPart(next)}`,
    };
  });
  const cards: ListCard[] = [];
  for (let i = 0; i < items.length; i += MAX_LIST_ITEMS_IN_CAROUSEL) {
    cards.push({ header: { title: "관심 복지 분야" }, items: items.slice(i, i + MAX_LIST_ITEMS_IN_CAROUSEL) });
  }
  return carousel({ type: "listCard", items: cards });
}

/** 프로필 요약 줄. */
function summaryText(p: Profile): string {
  const interests = p.interests?.length ? p.interests.join(LIST_SEP) : "무관";
  return (
    `프로필을 확인했어요 ✅\n· 지역: ${p.region}\n· 연령대: ${p.age === AGE_SKIP ? "무관" : p.age}\n` +
    `· 가구: ${p.household ?? "무관"}\n· 관심: ${interests}\n\n`
  );
}

/** 완료 프로필 → 에이전트 질의 텍스트. 코드표 없는 항목(가구·관심)은 여기에만 싣는다. */
function profileQuery(p: Profile): string {
  const region = REGIONS.find((r) => r.label === p.region)?.fullName ?? p.region;
  const fields = [`거주 지역: ${region}`];
  if (p.age !== AGE_SKIP) fields.push(`연령대: ${p.age}`);
  if (p.household && p.household !== "무관") fields.push(`가구 유형: ${p.household}`);
  if (p.interests?.length) fields.push(`관심 분야: ${p.interests.join(LIST_SEP)}`);
  return (
    `복지 상담 챗봇입니다. 다음 사용자 프로필에 맞는 복지 제도를 친절하게 안내해 주세요.\n` +
    `${fields.join(", ")}.`
  );
}

/** 완료 프로필 → conditions(거주지 코드·대표 나이·조회 기준일). */
function profileConditions(p: Profile): RagConditions {
  const residence = REGIONS.find((r) => r.label === p.region)?.code;
  const age = AGE_BANDS.find((a) => a.label === p.age)?.age;
  return {
    ...(residence ? { residence } : {}),
    ...(age !== undefined ? { age } : {}),
    apply_date: today(),
  };
}

/**
 * 온보딩 시나리오 블록 — 지역 → 연령대 → 가구 유형 → 관심 분야(복수) → (완료 시) 에이전트 안내.
 * 각 단계의 선택 값이 누적되어 다음 발화로 넘어오고(선형), 완료 단계에서 수집한 프로필을
 * 에이전트로 전달해 맞춤 안내를 받는다. 카드/버블 단계는 동기 응답, 완료만 콜백(에이전트).
 * 에이전트 전달은 **세션이 연결("AI 복지 연결")된 경우에만** — 미연결이면 연결 안내로 끝낸다.
 */
export const onboarding: SkillBlock = {
  name: "onboarding",
  match: (ctx) => parseStage(ctx.utterance) !== null,

  respond: (ctx) => {
    const stage = parseStage(ctx.utterance)!;
    switch (stage.kind) {
      case "region": {
        const ask = simpleText(
          `거주 지역을 선택해 주세요. (${Math.min(stage.page + 1, REGION_PAGES.length)}/${REGION_PAGES.length})`,
        );
        return step(stage.page === 0 ? [INTRO_CARD, ask] : [ask], regionQuickReplies(stage.page));
      }
      case "age": {
        const base = `${PREFIX}${SEP}${stage.region}`;
        return step(
          [simpleText(`${euro(stage.region)} 설정했어요 ✅\n\n연령대를 선택해 주세요.`)],
          [
            ...ageLabels.map((l) => messageQuickReply(l, `${base}${SEP}${l}`)),
            messageQuickReply("건너뛰기", `${base}${SEP}${AGE_SKIP}`),
          ],
        );
      }
      case "household": {
        const base = `${PREFIX}${SEP}${stage.region}${SEP}${stage.age}`;
        return step(
          [simpleText("가구 유형을 선택해 주세요.")],
          HOUSEHOLDS.map((l) => messageQuickReply(l, `${base}${SEP}${l}`)),
        );
      }
      case "interest": {
        const p = stage.profile;
        const base = `${PREFIX}${SEP}${p.region}${SEP}${p.age}${SEP}${p.household}`;
        const chosen = p.interests.length ? p.interests.map((i) => `✅ ${i}`).join(", ") : "없음";
        return step(
          [
            simpleText(`관심 복지 분야를 골라 주세요. (복수 선택)\n선택됨: ${chosen}`),
            interestCarousel(base, p.interests),
          ],
          [
            messageQuickReply("선택 완료", `${base}${SEP}${interestPart(p.interests)}${SEP}${DONE}`),
            messageQuickReply("건너뛰기", `${base}${SEP}${INTEREST_NONE}${SEP}${DONE}`),
          ],
        );
      }
      case "complete": {
        const summary = summaryText(stage.profile);
        // 미연결: 에이전트를 부르지 않고 연결 안내.
        if (ctx.mode !== "agent") {
          return step(
            [simpleText(summary + "AI 맞춤 안내는 'AI 복지 연결' 후 이용할 수 있어요.")],
            CONNECT_QUICK_REPLIES,
          );
        }
        // 연결 상태의 폴백(에이전트 미가용 시): 수집 프로필만 요약해 안내.
        return step(
          [simpleText(summary + "잠시 후 AI 상담원이 맞춤 복지를 안내해 드릴게요.")],
          NAV_QUICK_REPLIES,
        );
      }
    }
  },

  // 완료 단계 + 연결 상태에서만 에이전트를 콜백 호출(카드 단계·미연결은 동기 respond).
  callback: {
    when: (ctx) => ctx.mode === "agent" && parseStage(ctx.utterance)?.kind === "complete",
    waitingText: "입력하신 정보로 맞춤 복지를 찾고 있어요… 잠시만 기다려 주세요 🔎",
    run: async (ctx) => {
      const stage = parseStage(ctx.utterance);
      if (stage?.kind !== "complete") throw new Error("onboarding callback on non-complete stage");
      // 거주지·나이는 conditions로, 코드표가 없는 가구·관심은 질의 텍스트로 넘긴다.
      const result = await askRagAgent({
        query: profileQuery(stage.profile),
        conditions: profileConditions(stage.profile),
        sessionId: ctx.userId,
      });
      // 버블 = 에이전트 suggestions + "대화 종료"(서버 고정 NAV 병합 없음).
      const { outputs, quickReplies } = renderRag(result);
      return wrapSession(outputs, quickReplies);
    },
  },
};

/** 오늘 날짜 `YYYY-MM-DD`(로컬). RAG 조회 기준일용. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

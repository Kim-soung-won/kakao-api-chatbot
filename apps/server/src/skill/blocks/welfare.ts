import type { ItemCard, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import {
  blockButton,
  carousel,
  messageQuickReply,
  simpleText,
} from "../../builders/outputs.js";

const HERO_CARE = "https://placehold.co/640x360/e9eefb/1b4db5/png?text=%40+care";
const HERO_EDU = "https://placehold.co/640x360/eef3ff/1b4db5/png?text=%40+edu";

/** 복지 캐러셀 결과. 온보딩 시나리오 최종 단계에서도 재사용한다. */
export function welfareResponse(): SkillResponse {
  const cards: ItemCard[] = [
    {
      thumbnail: { imageUrl: HERO_CARE },
      head: { title: "가장 인기" },
      title: "보육료 지원",
      itemList: [{ title: "지원 금액", description: "월 최대 51만원" }],
      description: "다문화가정 만 0~5세\n국적 무관",
      buttons: [blockButton("자세히 보기", "BLOCK_CARE_DETAIL", { item: "care" })],
    },
    {
      thumbnail: { imageUrl: HERO_EDU },
      head: { title: "신규 2025" },
      title: "교육활동비 지원",
      itemList: [{ title: "지원 금액", description: "연 최대 30만원" }],
      description: "초·중·고 자녀\n강서구 거주",
      buttons: [blockButton("자세히 보기", "BLOCK_EDU_DETAIL", { item: "edu" })],
    },
  ];
  return {
    version: "2.0",
    template: {
      outputs: [
        simpleText("강서구 자녀 교육·보육 지원 제도입니다. 좌우로 넘겨 확인하세요 👉"),
        carousel({ type: "itemCard", items: cards }),
      ],
      quickReplies: [
        messageQuickReply("📋 신청 절차 안내", "신청 절차"),
        messageQuickReply("↩ 처음으로", "처음"),
      ],
    },
  };
}

/** 복지 안내 블록. */
export const welfare: SkillBlock = {
  name: "welfare",
  match: (ctx) => /복지|보육|지원/.test(ctx.utterance),
  respond: () => welfareResponse(),
};

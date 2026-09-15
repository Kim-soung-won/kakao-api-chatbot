import type { BasicCard, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import {
  basicCard,
  blockButton,
  carousel,
  listCard,
  messageButton,
  operatorButton,
  simpleImage,
  simpleText,
  webLinkButton,
} from "../../builders/outputs.js";
import { IMG_1_1, IMG_2_1, wrap } from "../shared.js";

/** basicCard 데모. */
const cardDemo = (): SkillResponse =>
  wrap([
    basicCard({
      title: "기본 카드 데모",
      description: "이미지 + 제목 + 설명 + 버튼(세로 최대 3개).",
      thumbnail: { imageUrl: IMG_2_1, fixedRatio: false },
      buttons: [
        webLinkButton("자세히", "https://example.com"),
        blockButton("후속 질문", "BLOCK_ID_TODO", { from: "basicCard" }),
        operatorButton(),
      ],
    }),
  ]);

/** listCard 데모. */
const listDemo = (): SkillResponse =>
  wrap([
    listCard(
      "리스트 카드 데모 (최대 5개)",
      [
        { title: "첫 번째 항목", description: "설명 1", action: "message", messageText: "1번" },
        { title: "두 번째 항목", description: "설명 2", action: "message", messageText: "2번" },
        { title: "세 번째 항목", description: "설명 3" },
      ],
      [messageButton("더 보기", "리스트 더")],
    ),
  ]);

/** simpleImage 데모. */
const imageDemo = (): SkillResponse =>
  wrap([simpleImage(IMG_2_1, "이미지 한 장 데모 (simpleImage)")]);

/** basicCard 캐러셀 데모(비율 통일). */
const carouselDemo = (): SkillResponse => {
  const cards: BasicCard[] = [1, 2, 3].map((n) => ({
    title: `캐러셀 카드 ${n}`,
    description: "가로 스크롤로 여러 카드를 넘겨봅니다.",
    thumbnail: { imageUrl: IMG_2_1, fixedRatio: false },
    buttons: [messageButton("선택", `카드${n} 선택`)],
  }));
  return wrap([carousel({ type: "basicCard", items: cards })]);
};

/** 제약 위반 데모(validate 경고 확인용). */
const violationDemo = (): SkillResponse => {
  const longText = "가".repeat(600); // > 500자 → "전체 보기" 접힘
  const mixed: BasicCard[] = [
    { title: "2:1 카드", thumbnail: { imageUrl: IMG_2_1, fixedRatio: false } },
    { title: "1:1 카드", thumbnail: { imageUrl: IMG_1_1, fixedRatio: true } }, // 비율 혼용
  ];
  return wrap([
    simpleText(longText),
    basicCard({
      title: "버튼 초과 카드",
      buttonLayout: "vertical",
      buttons: [
        messageButton("버튼1", "1"),
        messageButton("버튼2", "2"),
        messageButton("버튼3", "3"),
        messageButton("버튼4 (초과)", "4"),
      ],
    }),
    carousel({ type: "basicCard", items: mixed }),
    simpleText("이 네 번째 말풍선 때문에 outputs가 3개를 초과합니다."),
  ]);
};

const CASES: { test: RegExp; build: () => SkillResponse }[] = [
  { test: /카드/, build: cardDemo },
  { test: /리스트/, build: listDemo },
  { test: /이미지/, build: imageDemo },
  { test: /캐러셀/, build: carouselDemo },
  { test: /위반/, build: violationDemo },
];

/** 개발용 컴포넌트 데모 블록(카드·리스트·이미지·캐러셀·위반). */
export const demos: SkillBlock = {
  name: "demos",
  match: (ctx) => CASES.some((c) => c.test.test(ctx.utterance)),
  respond: (ctx) => CASES.find((c) => c.test.test(ctx.utterance))!.build(),
};

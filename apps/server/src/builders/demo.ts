/**
 * mock 데모 응답. /skill 이 실제 로직(RAG) 대신 우선 이걸 돌려준다.
 * playground 렌더러가 그릴 데이터이자, 컴포넌트/제약을 눈으로 검증하는 샘플.
 *
 * 발화 트리거: 카드 · 리스트 · 이미지 · 캐러셀 · 위반 · (그 외 기본)
 */
import type {
  BasicCard,
  Output,
  SkillResponse,
} from "@sprint-kakao/contract";
import {
  basicCard,
  blockButton,
  carousel,
  itemCard,
  listCard,
  messageButton,
  messageQuickReply,
  operatorButton,
  simpleImage,
  simpleText,
  webLinkButton,
} from "./outputs.js";
import type { ItemCard } from "@sprint-kakao/contract";

const IMG_2_1 = "https://placehold.co/800x400/png";
const IMG_1_1 = "https://placehold.co/400x400/png";

/** 하단 바로가기 — 모든 데모로 이동 가능하게. */
const DEMO_QUICK_REPLIES = [
  messageQuickReply("🏛️복지도우미", "복지도우미"),
  messageQuickReply("복지카드", "복지"),
  messageQuickReply("카드", "카드"),
  messageQuickReply("리스트", "리스트"),
  messageQuickReply("이미지", "이미지"),
  messageQuickReply("캐러셀", "캐러셀"),
  messageQuickReply("⚠️위반", "위반"),
];

function wrap(outputs: Output[]): SkillResponse {
  return { version: "2.0", template: { outputs, quickReplies: DEMO_QUICK_REPLIES } };
}

// 강서구 스타일 히어로 이미지(placeholder). 실제로는 뱃지칩·그라데이션이
// 구워진 디자인 이미지가 들어갈 자리다.
const HERO_WELCOME =
  "https://placehold.co/640x420/1b4db5/ffffff/png?text=Gangseo+AI";
const HERO_CARE = "https://placehold.co/640x360/e9eefb/1b4db5/png?text=%40+care";
const HERO_EDU = "https://placehold.co/640x360/eef3ff/1b4db5/png?text=%40+edu";

/** 발화 문자열에 따라 서로 다른 데모 응답을 고른다. */
export function buildDemoResponse(utterance: string): SkillResponse {
  const u = utterance.trim();

  // 화면 1: 환영 카드 (히어로 이미지 + 본문 + 버튼 2개)
  if (u.includes("도우미") || u.includes("환영") || u.includes("강서구")) {
    return {
      version: "2.0",
      template: {
        outputs: [
          itemCard({
            thumbnail: { imageUrl: HERO_WELCOME },
            title: "반갑습니다! 👋",
            description:
              "저는 강서구 AI 복지도우미예요.\n한국어 교육, 보육료, 취업 지원 등\n맞춤 복지 정보를 안내해 드려요.\n\n[24시간 안내] [다국어 지원] [맞춤 추천]",
            itemList: [
              { title: "운영", description: "24시간 자동 안내" },
              { title: "언어", description: "다국어 지원" },
            ],
            buttons: [
              blockButton("맞춤 복지 안내 시작하기", "BLOCK_WELFARE_START", {
                flow: "welfare",
              }),
              messageButton("바로 질문하기", "질문"),
            ],
          }),
        ],
      },
    };
  }

  // 화면 2: 안내 말풍선 + itemCard 캐러셀 + 바로가기
  if (u.includes("복지") || u.includes("보육") || u.includes("지원")) {
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

  if (u.includes("카드")) {
    return wrap([
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
  }

  if (u.includes("리스트")) {
    return wrap([
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
  }

  if (u.includes("이미지")) {
    return wrap([simpleImage(IMG_2_1, "이미지 한 장 데모 (simpleImage)")]);
  }

  if (u.includes("캐러셀")) {
    const cards: BasicCard[] = [1, 2, 3].map((n) => ({
      title: `캐러셀 카드 ${n}`,
      description: "가로 스크롤로 여러 카드를 넘겨봅니다.",
      thumbnail: { imageUrl: IMG_2_1, fixedRatio: false }, // 비율 통일(2:1)
      buttons: [messageButton("선택", `카드${n} 선택`)],
    }));
    return wrap([carousel({ type: "basicCard", items: cards })]);
  }

  if (u.includes("위반")) {
    // validate()가 여러 경고를 뱉도록 일부러 제약을 어긴다.
    const longText = "가".repeat(600); // > 500자 → "전체 보기" 접힘 경고
    const mixedCarousel: BasicCard[] = [
      { title: "2:1 카드", thumbnail: { imageUrl: IMG_2_1, fixedRatio: false } },
      { title: "1:1 카드", thumbnail: { imageUrl: IMG_1_1, fixedRatio: true } }, // 비율 혼용 경고
    ];
    return wrap([
      // 1) 500자 초과
      simpleText(longText),
      // 2) 세로 버튼 4개 (> 최대 3)
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
      // 3) 캐러셀 이미지 비율 혼용
      carousel({ type: "basicCard", items: mixedCarousel }),
      // → 여기까지 outputs 3개. 아래를 더하면 outputs 4개(> 3) 경고까지.
      simpleText("이 네 번째 말풍선 때문에 outputs가 3개를 초과합니다."),
    ]);
  }

  // 기본: 텍스트 + 바로가기
  return wrap([
    simpleText(
      `받은 발화: "${u || "(빈 발화)"}"\n\n아래 바로가기로 데모를 골라보세요.`,
    ),
  ]);
}

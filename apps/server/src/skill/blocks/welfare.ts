import type { ItemCard, SkillResponse } from "@sprint-kakao/contract";
import type { SkillBlock } from "../types.js";
import {
  basicCard,
  carousel,
  listCard,
  messageButton,
  messageQuickReply,
  operatorButton,
  simpleText,
  webLinkButton,
} from "../../builders/outputs.js";

// 예시 이미지·연락처(실데이터로 교체). 브랜딩 장식은 히어로 이미지에 굽는다.
const HERO_CARE = "https://placehold.co/640x360/1b4db5/ffffff/png?text=care";
const HERO_EDU = "https://placehold.co/640x360/2a6a3a/ffffff/png?text=edu";
const CONTACT = "강서구 다문화가족지원센터 ☎ 02-000-0000";

/** 복지 카테고리 탐색 바로가기. */
const WELFARE_QR = [
  messageQuickReply("보육료", "보육료"),
  messageQuickReply("교육활동비", "교육활동비"),
  messageQuickReply("한국어교육", "한국어교육"),
  messageQuickReply("취업지원", "취업"),
  messageQuickReply("의료·건강", "의료"),
  messageQuickReply("주거지원", "주거"),
  messageQuickReply("신청 절차", "신청 절차"),
];

const withQr = (outputs: SkillResponse["template"]["outputs"]): SkillResponse => ({
  version: "2.0",
  template: { outputs, quickReplies: WELFARE_QR },
});

/** 복지 안내 메뉴(개요 캐러셀). 온보딩 최종 단계·"복지" 발화의 진입점. */
export function welfareMenu(): SkillResponse {
  const cards: ItemCard[] = [
    {
      thumbnail: { imageUrl: HERO_CARE },
      head: { title: "가장 인기" },
      title: "보육료 지원",
      itemList: [{ title: "지원 금액", description: "월 최대 51만원" }],
      description: "다문화가정 만 0~5세 · 국적 무관",
      buttons: [messageButton("자세히 보기", "보육료")],
    },
    {
      thumbnail: { imageUrl: HERO_EDU },
      head: { title: "신규 2025" },
      title: "교육활동비 지원",
      itemList: [{ title: "지원 금액", description: "연 최대 30만원" }],
      description: "초·중·고 자녀 · 강서구 거주",
      buttons: [messageButton("자세히 보기", "교육활동비")],
    },
  ];
  return withQr([
    simpleText("강서구 다문화 복지 안내입니다. 관심 분야를 눌러 확인하세요 👇"),
    carousel({ type: "itemCard", items: cards }),
  ]);
}

// ── 프로그램별 상세 ──

const careDetail = (): SkillResponse =>
  withQr([
    {
      itemCard: {
        thumbnail: { imageUrl: HERO_CARE },
        title: "보육료 지원",
        itemList: [
          { title: "지원 금액", description: "월 최대 51만원" },
          { title: "대상", description: "만 0~5세 다문화가정" },
          { title: "국적", description: "무관" },
        ],
        description: "어린이집·유치원 이용 아동 대상. 소득기준 확인 필요.",
        buttons: [
          webLinkButton("온라인 신청", "https://example.com/apply/care"),
          messageButton("신청 절차", "신청 절차"),
        ],
      },
    },
  ]);

const eduDetail = (): SkillResponse =>
  withQr([
    {
      itemCard: {
        thumbnail: { imageUrl: HERO_EDU },
        title: "교육활동비 지원",
        itemList: [
          { title: "지원 금액", description: "연 최대 30만원" },
          { title: "대상", description: "초·중·고 자녀" },
          { title: "지역", description: "강서구 거주" },
        ],
        description: "학용품·교재·현장학습 등 교육활동에 사용.",
        buttons: [
          webLinkButton("온라인 신청", "https://example.com/apply/edu"),
          messageButton("신청 절차", "신청 절차"),
        ],
      },
    },
  ]);

const koreanDetail = (): SkillResponse =>
  withQr([
    basicCard({
      title: "한국어 교육 (무료)",
      description:
        "다문화가족지원센터 한국어 교실.\n초급~고급 · 주 2회 · 온라인 병행.\n방문학습(찾아가는 한국어)도 신청 가능.",
      thumbnail: { imageUrl: HERO_EDU },
      buttons: [
        webLinkButton("수강 신청", "https://example.com/apply/korean"),
        messageButton("문의하기", "문의"),
      ],
    }),
  ]);

const jobDetail = (): SkillResponse =>
  withQr([
    basicCard({
      title: "취업·일자리 지원",
      description:
        "결혼이민자 취업상담 · 직업훈련 · 통번역/이중언어 일자리 연계.\n이력서 작성, 면접 코칭 포함.",
      buttons: [
        webLinkButton("취업 상담 신청", "https://example.com/apply/job"),
        messageButton("문의하기", "문의"),
      ],
    }),
  ]);

const healthDetail = (): SkillResponse =>
  withQr([
    basicCard({
      title: "의료·건강 지원",
      description:
        "다문화가정 의료비 지원 · 무료 건강검진 · 심리상담.\n건강보험 미가입자 진료 안내 포함.",
      buttons: [messageButton("신청 절차", "신청 절차"), operatorButton("상담원 연결")],
    }),
  ]);

const housingDetail = (): SkillResponse =>
  withQr([
    basicCard({
      title: "주거 지원",
      description:
        "공공임대주택 우선공급 · 주거급여 안내.\n전세자금 대출·보증금 지원 상담.",
      buttons: [messageButton("신청 절차", "신청 절차"), messageButton("문의하기", "문의")],
    }),
  ]);

const applySteps = (): SkillResponse =>
  withQr([
    // ⚠️ listCard 항목은 클릭 동작(link 또는 action)이 필수 — 각 항목에 안내 링크 부여.
    listCard(
      "복지 신청 절차 (공통)",
      [
        {
          title: "1. 서류 준비",
          description: "신분증·가족관계·소득 증빙",
          link: { web: "https://example.com/apply/docs" },
        },
        {
          title: "2. 방문/온라인 접수",
          description: "주민센터 또는 다문화가족지원센터",
          link: { web: "https://example.com/apply/where" },
        },
        {
          title: "3. 자격 심사",
          description: "소득·대상 요건 확인",
          link: { web: "https://example.com/apply/review" },
        },
        {
          title: "4. 지급/이용",
          description: "승인 후 지원금 지급 또는 서비스 이용",
          link: { web: "https://example.com/apply/payment" },
        },
      ],
      [operatorButton("상담원 연결")],
    ),
  ]);

const contactInfo = (): SkillResponse =>
  withQr([
    basicCard({
      title: "문의 · 상담",
      description: `${CONTACT}\n평일 09:00~18:00 (다국어 상담 가능)`,
      buttons: [operatorButton("상담원 연결")],
    }),
  ]);

/**
 * 복지 안내 블록 — 개요 메뉴 + 프로그램별 상세.
 * 발화 키워드로 해당 프로그램 상세를 분기, 그 외 복지/지원은 메뉴로.
 */
export const welfare: SkillBlock = {
  name: "welfare",
  match: (ctx) =>
    /복지|지원|보육|어린이집|교육활동비|교육비|한국어|취업|일자리|구직|의료|건강|병원|주거|주택|전세|임대|신청|문의|센터|상담/.test(
      ctx.utterance,
    ),
  respond: (ctx) => {
    const u = ctx.utterance;
    if (/보육|어린이집/.test(u)) return careDetail();
    if (/교육활동비|교육비/.test(u)) return eduDetail();
    if (/한국어/.test(u)) return koreanDetail();
    if (/취업|일자리|구직/.test(u)) return jobDetail();
    if (/의료|건강|병원/.test(u)) return healthDetail();
    if (/주거|주택|전세|임대/.test(u)) return housingDetail();
    if (/신청/.test(u)) return applySteps();
    if (/문의|센터|상담/.test(u)) return contactInfo();
    return welfareMenu();
  },
};

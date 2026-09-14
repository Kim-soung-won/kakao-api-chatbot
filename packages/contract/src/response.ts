/**
 * 카카오 챗봇 스킬 서버 **응답(SkillResponse)** 계약.
 *
 * 권위 문서: `.claude/skills/kakao-skill-response_domain/SKILL.md`
 * (출처: 카카오 비즈니스 Chatbot Skill Guide — Answer JSON Format)
 *
 * 구현된 출력 컴포넌트 —
 *   simpleText · simpleImage · basicCard · listCard · itemCard · carousel · buttons · quickReplies · context
 * 미구현(추후 확장): textCard · commerceCard  → {@link DEFERRED_OUTPUTS}
 */

// ─────────────────────────────────────────────────────────────
// 렌더링 불변조건 상수 (렌더러/밸리데이터가 공유)
// ─────────────────────────────────────────────────────────────

/** `template.outputs` 최대 말풍선 수. 초과 시 렌더링 실패. */
export const MAX_OUTPUTS = 3;
/** `template.quickReplies` 최대 개수. */
export const MAX_QUICK_REPLIES = 10;
/** `listCard.items` 최대 개수 (캐러셀 내부에서는 4). */
export const MAX_LIST_ITEMS = 5;
export const MAX_LIST_ITEMS_IN_CAROUSEL = 4;
/** `carousel.items` 최대 개수 (listCard 캐러셀은 5). */
export const MAX_CAROUSEL_ITEMS = 10;
export const MAX_CAROUSEL_LIST_ITEMS = 5;
/** 버튼 레이아웃별 최대 버튼 수. */
export const MAX_BUTTONS_VERTICAL = 3;
export const MAX_BUTTONS_HORIZONTAL = 2;
/** `basicCard`: fixedRatio 값에 따른 최대 버튼 수. */
export const MAX_BUTTONS_FIXED_RATIO = 2; // 1:1, 가로
export const MAX_BUTTONS_FREE_RATIO = 3; // 2:1(기본), 세로

/** 글자 수 제한(문자 단위). 렌더러의 truncate/경고 기준. */
export const TEXT_LIMITS = {
  simpleText: 1000,
  /** 500자 초과 시 "전체 보기" 버튼 자동 노출. */
  simpleTextFoldThreshold: 500,
  simpleImageAltText: 50,
  basicCardTitle: 50,
  basicCardDescription: 230,
  buttonLabel: 14,
  buttonLabelHorizontal: 8,
} as const;

/** `itemCard.itemList` 최대 행 수 (단일형 10 / 캐러셀형 5). */
export const MAX_ITEMCARD_ROWS = 10;
export const MAX_ITEMCARD_ROWS_IN_CAROUSEL = 5;

/** 아직 타입화하지 않은 출력 컴포넌트(추후 확장 대상). */
export const DEFERRED_OUTPUTS = ["textCard", "commerceCard"] as const;

// ─────────────────────────────────────────────────────────────
// 공통 요소
// ─────────────────────────────────────────────────────────────

/**
 * 기기별 링크. 우선순위: `web` > `pc`/`mobile`.
 * thumbnail.link, listCard item.link 등에서 재사용.
 */
export interface Link {
  web?: string;
  pc?: string;
  mobile?: string;
}

/** 카드 썸네일. */
export interface Thumbnail {
  imageUrl: string;
  altText?: string;
  link?: Link;
  /**
   * true  = 1:1 원본 유지, 버튼 최대 2개(가로).
   * false = 2:1 중앙 크롭(기본), 버튼 최대 3개(세로).
   */
  fixedRatio?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Button (action 별 판별 유니온)
// ─────────────────────────────────────────────────────────────

/** 버튼 라벨: 14자(가로 배열 시 8자). */
interface ButtonBase {
  label: string;
}

/** 웹 URL 이동. */
export interface WebLinkButton extends ButtonBase {
  action: "webLink";
  webLinkUrl: string;
}
/** `messageText`가 사용자 발화로 전송됨. */
export interface MessageButton extends ButtonBase {
  action: "message";
  messageText: string;
}
/** 다른 블록 호출. `extra`로 임의 JSON 전달(RAG 컨텍스트 왕복 채널). */
export interface BlockButton extends ButtonBase {
  action: "block";
  blockId: string;
  messageText?: string;
  extra?: Record<string, unknown>;
}
/** 전화 연결. PC 톡 미지원. */
export interface PhoneButton extends ButtonBase {
  action: "phone";
  phoneNumber: string;
}
/** 공유(캐러셀 공유 시 유용). */
export interface ShareButton extends ButtonBase {
  action: "share";
}
/** 상담원 연결(폴백/escalation 경로). */
export interface OperatorButton extends ButtonBase {
  action: "operator";
}

export type Button =
  | WebLinkButton
  | MessageButton
  | BlockButton
  | PhoneButton
  | ShareButton
  | OperatorButton;

export type ButtonAction = Button["action"];

export type ButtonLayout = "horizontal" | "vertical";

// ─────────────────────────────────────────────────────────────
// 출력 컴포넌트
// ─────────────────────────────────────────────────────────────

/** 1. 순수 텍스트. text ≤ 1000자, 500자 초과 시 "전체 보기". */
export interface SimpleText {
  text: string;
}

/** 2. 이미지 한 장. */
export interface SimpleImage {
  imageUrl: string;
  /** 대체 텍스트 ≤ 50자. */
  altText?: string;
}

/** 4. 기본 카드: 이미지 + 제목 + 설명 + 버튼. (가장 범용) */
export interface BasicCard {
  /** title ≤ 50자. title/description/thumbnail 중 최소 하나는 있어야 유의미. */
  title?: string;
  /** description ≤ 230자. */
  description?: string;
  thumbnail?: Thumbnail;
  buttons?: Button[];
  buttonLayout?: ButtonLayout;
}

/** listCard 항목. title 필수. */
export interface ListItem {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: Link;
  /** 항목 자체 클릭 동작(버튼과 유사). */
  action?: "block" | "message";
  blockId?: string;
  messageText?: string;
  extra?: Record<string, unknown>;
}

/** 6. 리스트 카드: 항목 최대 5개(캐러셀 내부 4개). */
export interface ListCard {
  header: { title: string };
  items: ListItem[];
  buttons?: Button[];
}

/** itemCard 키-값 행 (예: title="지원 금액", description="월 최대 51만원"). */
export interface ItemListRow {
  /** 좌측 라벨. 6자 권장. */
  title: string;
  /** 우측 값. 최대 2줄. */
  description: string;
}

/**
 * 7. 아이템 카드: 금액/혜택 등 상세 정보를 행 단위로 강조하는 카드.
 * 강서구 "지원 금액 → 월 최대 51만원" 같은 UX에 최적.
 * 불변조건: `head`와 `profile`은 동시 사용 불가.
 */
export interface ItemCard {
  thumbnail?: { imageUrl: string; width?: number; height?: number };
  /** 상단 헤더. profile과 배타. */
  head?: { title: string };
  /** 프로필. head와 배타. title ≤ 15자. */
  profile?: { imageUrl?: string; title: string };
  /** 아이콘 + 제목/설명 블록. */
  imageTitle?: { title: string; description?: string; imageUrl?: string };
  /** 키-값 행 목록. 단일형 ≤ 10, 캐러셀형 ≤ 5. */
  itemList: ItemListRow[];
  itemListAlignment?: "left" | "right";
  /** 합계/요약 행. title 6자 / description 14자 권장. */
  itemListSummary?: { title: string; description: string };
  title?: string;
  description?: string;
  buttons?: Button[];
  buttonLayout?: ButtonLayout;
}

/** 캐러셀에 담을 수 있는(핵심 범위) 카드 종류. */
export type CarouselItemType = "basicCard" | "listCard" | "itemCard";

/**
 * 8. 캐러셀: 카드 가로 스크롤.
 * 불변조건: 모든 카드 이미지 비율 통일(1:1 또는 2:1). listCard/textCard는 헤더 미지원.
 */
export interface Carousel {
  type: CarouselItemType;
  header?: {
    title?: string;
    description?: string;
    thumbnail?: { imageUrl: string };
  };
  /** type에 따라 BasicCard[] | ListCard[] | ItemCard[]. */
  items: BasicCard[] | ListCard[] | ItemCard[];
}

/**
 * `outputs` 원소: 아래 중 **정확히 하나의 키**를 갖는 오브젝트.
 * (예: `{ simpleText: { text: "..." } }`)
 */
export type Output =
  | { simpleText: SimpleText }
  | { simpleImage: SimpleImage }
  | { basicCard: BasicCard }
  | { listCard: ListCard }
  | { itemCard: ItemCard }
  | { carousel: Carousel };

// ─────────────────────────────────────────────────────────────
// QuickReply / Context / 최상위
// ─────────────────────────────────────────────────────────────

/** 바로가기. action은 message | block. 최대 10개. */
export type QuickReply =
  | { label: string; action: "message"; messageText: string }
  | {
      label: string;
      action: "block";
      blockId: string;
      messageText?: string;
      extra?: Record<string, unknown>;
    };

export interface Template {
  /** 말풍선 1~3개. @see MAX_OUTPUTS */
  outputs: Output[];
  /** 최대 10개. @see MAX_QUICK_REPLIES */
  quickReplies?: QuickReply[];
}

/** 출력 컨텍스트 값. lifeSpan=0으로 삭제. */
export interface ContextValue {
  name: string;
  /** 유효 턴 수. 0이면 삭제. */
  lifeSpan: number;
  /** 유효 시간(초). */
  ttl?: number;
  /** 다음 요청의 contexts로 왕복되는 키-값(문자열 권장). */
  params?: Record<string, string>;
}

export interface Context {
  values: ContextValue[];
}

/** 스킬 서버 최상위 응답. */
export interface SkillResponse {
  /** 항상 "2.0". */
  version: "2.0";
  template: Template;
  context?: Context;
  data?: Record<string, unknown>;
}

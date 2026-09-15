/**
 * 카카오톡 **메시지 API** template object (기본 템플릿).
 *
 * ⚠️ 챗봇 스킬 응답(SkillResponse, response.ts)과는 **다른 인터페이스**다.
 * 이쪽은 채널 친구에게 능동(push) 발송하는 친구톡/알림톡·카카오톡 공유용 카드 포맷.
 * 출처: Kakao Developers — 메시지 템플릿(기본 템플릿).
 *
 * 범위: feed · text · list · commerce · location · calendar 기본 템플릿.
 * (carousel은 추후.)
 */

export const MESSAGE_LIMITS = {
  /** text 템플릿 본문 최대 길이. */
  textMax: 200,
  /** 버튼 최대 개수. */
  buttonsMax: 2,
  /** list 템플릿 contents 최소/최대 개수. */
  listContentsMin: 2,
  listContentsMax: 3,
  /** carousel 템플릿 items 최소/최대 개수. */
  carouselItemsMin: 2,
  carouselItemsMax: 6,
} as const;

/** 아직 타입화하지 않은 템플릿(추후 확장). carousel commerce 타입 등. */
export const DEFERRED_MESSAGE_TEMPLATES = ["carousel-commerce"] as const;

/** 기기별 링크. 최소 하나(web_url 등)는 있어야 유효. */
export interface MessageLink {
  web_url?: string;
  mobile_web_url?: string;
  android_execution_params?: string;
  ios_execution_params?: string;
}

/** 메시지 카드 버튼. (스킬 응답 Button과 다름) */
export interface MsgButton {
  title: string;
  link: MessageLink;
}

/** feed 템플릿의 메인 콘텐츠. */
export interface FeedContent {
  title: string;
  description?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  link: MessageLink;
}

/** 소셜 지표(선택). */
export interface Social {
  like_count?: number;
  comment_count?: number;
  shared_count?: number;
  view_count?: number;
  subscriber_count?: number;
}

/** Feed 템플릿: 콘텐츠(이미지·제목·설명·링크) + 소셜 + 버튼. */
export interface FeedTemplate {
  object_type: "feed";
  content: FeedContent;
  social?: Social;
  /** 최대 2개. @see MESSAGE_LIMITS.buttonsMax */
  buttons?: MsgButton[];
}

/** Text 템플릿: 본문 ≤ 200자 + 링크 + 단일 버튼 타이틀. */
export interface TextTemplate {
  object_type: "text";
  /** ≤ 200자. @see MESSAGE_LIMITS.textMax */
  text: string;
  link: MessageLink;
  button_title?: string;
}

/** List 템플릿의 개별 항목. */
export interface ListItemContent {
  title: string;
  description?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  link: MessageLink;
}

/** List 템플릿: 헤더 + 항목 목록(2~3개) + 버튼. */
export interface ListTemplate {
  object_type: "list";
  header_title: string;
  header_link: MessageLink;
  /** 2~3개. @see MESSAGE_LIMITS.listContentsMin/Max */
  contents: ListItemContent[];
  buttons?: MsgButton[];
}

/** Commerce 가격 정보. */
export interface Commerce {
  regular_price: number;
  discount_price?: number;
  discount_rate?: number;
  /** 정액 할인. */
  fixed_discount_price?: number;
  currency_unit?: string;
  /** 0=금액 뒤(예: 1000원), 1=앞(예: $1000). */
  currency_unit_position?: 0 | 1;
}

/** Commerce 템플릿: 상품 콘텐츠 + 가격 + 버튼. */
export interface CommerceTemplate {
  object_type: "commerce";
  content: FeedContent;
  commerce: Commerce;
  buttons?: MsgButton[];
}

/** Location 템플릿: 주소 + 콘텐츠 + 버튼. */
export interface LocationTemplate {
  object_type: "location";
  address: string;
  address_title?: string;
  content: FeedContent;
  buttons?: MsgButton[];
}

/** Calendar 템플릿: 일정/구독 캘린더 공유. */
export interface CalendarTemplate {
  object_type: "calendar";
  /** event=공개 일정, calendar=구독 캘린더. */
  id_type: "event" | "calendar";
  id: string;
  content: FeedContent;
  buttons?: MsgButton[];
}

/** Feed 캐러셀의 개별 카드. */
export interface CarouselFeedItem {
  title: string;
  description?: string;
  image_url?: string;
  link?: MessageLink;
  /** 카드별 버튼, 최대 2개. */
  buttons?: MsgButton[];
}

/** 캐러셀 하단 공통 이동 버튼(선택). */
export interface CarouselTail {
  link: MessageLink;
}

/** Carousel(feed) 템플릿: 카드 2~6개 가로 스크롤 + 선택적 tail. */
export interface CarouselTemplate {
  object_type: "carousel";
  /** 현재 feed만 지원(commerce는 추후). */
  type: "feed";
  /** 2~6개. @see MESSAGE_LIMITS.carouselItemsMin/Max */
  items: CarouselFeedItem[];
  tail?: CarouselTail;
}

export type MessageTemplate =
  | FeedTemplate
  | TextTemplate
  | ListTemplate
  | CommerceTemplate
  | LocationTemplate
  | CalendarTemplate
  | CarouselTemplate;
export type MessageObjectType = MessageTemplate["object_type"];

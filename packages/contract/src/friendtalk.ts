/**
 * 카카오 **친구톡(FT)** 메시지 포맷 — 채널 친구에게 보내는 능동(push) 발송.
 *
 * ⚠️ developers.kakao.com 메시지(message.ts)와도, 챗봇 스킬 응답(response.ts)과도 다르다.
 * 이쪽은 **카카오 비즈메시지** 제품이며 발신프로필(sender_key) + 비즈메시지 계정이 필요하다.
 * 출처: Kakao i Connect Message — 친구톡(FT) 발송 API.
 *
 * 범위(1차): 문서로 확인된 콘텐츠 필드(text·image·buttons·광고표기)만 타입화한다.
 * 발송 봉투(sender_key·phone_number·엔드포인트)는 발송 대행사/직접 경로가 정해지면 확정한다.
 * 캐러셀·와이드리스트·아이템 등 고급형은 {@link DEFERRED_FRIENDTALK}.
 */

export const FRIENDTALK_LIMITS = {
  /** message(text) 최대 길이. */
  textMax: 1000,
  /** 버튼 최대 개수. */
  buttonsMax: 5,
} as const;

/** 아직 타입화하지 않은 친구톡 고급 유형(추후 확장). */
export const DEFERRED_FRIENDTALK = ["wide_image", "wide_list", "carousel", "item_list"] as const;

/**
 * 친구톡 버튼 타입.
 * WL=웹 링크, AL=앱 링크, BK=봇 키워드, MD=메시지 전달.
 */
export type FriendTalkButtonType = "WL" | "AL" | "BK" | "MD";

export interface FriendTalkButton {
  /** 버튼 라벨. */
  name: string;
  type: FriendTalkButtonType;
  /** WL: 모바일/PC 웹 URL. */
  url_mobile?: string;
  url_pc?: string;
  /** AL: 앱 스킴. */
  scheme_android?: string;
  scheme_ios?: string;
}

export interface FriendTalkImage {
  /** 이미지 URL(필수). */
  img_url: string;
  /** 이미지 클릭 시 이동 링크(선택). */
  img_link?: string;
}

/**
 * 친구톡 기본형 메시지 콘텐츠.
 * 친구톡은 정보·광고성 메시지라 광고 표기(ad_flag)와 수신거부 안내가 따른다.
 */
export interface FriendTalkMessage {
  message_type: "FT";
  /** 본문 text, ≤ 1000자. @see FRIENDTALK_LIMITS.textMax */
  message: string;
  /** 광고성 여부(광고면 "(광고)" 표기 + 수신거부 안내가 노출된다). */
  ad_flag?: boolean;
  image?: FriendTalkImage;
  /** 최대 5개. @see FRIENDTALK_LIMITS.buttonsMax */
  buttons?: FriendTalkButton[];
}

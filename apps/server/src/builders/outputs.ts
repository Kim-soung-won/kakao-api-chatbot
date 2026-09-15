/**
 * 핵심 출력 컴포넌트 빌더.
 * contract 타입을 그대로 써서, 잘못된 조합은 컴파일 타임에 막힌다.
 * (RAG 연동 단계에서 이 빌더들이 검색결과 → SkillResponse 변환의 조립 단위가 된다.)
 */
import type {
  BasicCard,
  Button,
  Carousel,
  CommerceCard,
  ItemCard,
  ListCard,
  ListItem,
  Output,
  QuickReply,
  SimpleImage,
  SimpleText,
  TextCard,
} from "@sprint-kakao/contract";

export const simpleText = (text: string): Output => ({
  simpleText: { text } satisfies SimpleText,
});

export const simpleImage = (imageUrl: string, altText?: string): Output => ({
  simpleImage: { imageUrl, altText } satisfies SimpleImage,
});

export const textCard = (card: TextCard): Output => ({ textCard: card });

export const basicCard = (card: BasicCard): Output => ({ basicCard: card });

export const commerceCard = (card: CommerceCard): Output => ({ commerceCard: card });

export const listCard = (
  headerTitle: string,
  items: ListItem[],
  buttons?: Button[],
): Output => ({
  listCard: { header: { title: headerTitle }, items, buttons } satisfies ListCard,
});

export const carousel = (c: Carousel): Output => ({ carousel: c });

export const itemCard = (card: ItemCard): Output => ({ itemCard: card });

// 버튼 헬퍼 (action 별)
export const webLinkButton = (label: string, webLinkUrl: string): Button => ({
  label,
  action: "webLink",
  webLinkUrl,
});
export const messageButton = (label: string, messageText: string): Button => ({
  label,
  action: "message",
  messageText,
});
export const blockButton = (
  label: string,
  blockId: string,
  extra?: Record<string, unknown>,
): Button => ({ label, action: "block", blockId, extra });
export const operatorButton = (label = "상담원 연결"): Button => ({
  label,
  action: "operator",
});

export const messageQuickReply = (
  label: string,
  messageText: string,
): QuickReply => ({ label, action: "message", messageText });

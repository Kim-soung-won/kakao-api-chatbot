/**
 * SkillResponse 렌더링 제약 검증.
 * kakao-skill-response_domain 스킬의 "핵심 제약사항"을 런타임 경고로 구현한다.
 * (실제 카카오는 위반 시 렌더링 실패 → 여기서 미리 잡는다.)
 */
import {
  MAX_BUTTONS_HORIZONTAL,
  MAX_BUTTONS_VERTICAL,
  MAX_CAROUSEL_ITEMS,
  MAX_CAROUSEL_LIST_ITEMS,
  MAX_ITEMCARD_ROWS,
  MAX_ITEMCARD_ROWS_IN_CAROUSEL,
  MAX_LIST_ITEMS,
  MAX_OUTPUTS,
  MAX_QUICK_REPLIES,
  TEXT_LIMITS,
  type Button,
  type CommerceCard,
  type ItemCard,
  type Output,
  type SkillResponse,
} from "@sprint-kakao/contract";

export interface Warning {
  path: string;
  message: string;
}

function checkButtons(buttons: Button[] | undefined, path: string, layout?: "horizontal" | "vertical"): Warning[] {
  if (!buttons) return [];
  const w: Warning[] = [];
  const max = layout === "horizontal" ? MAX_BUTTONS_HORIZONTAL : MAX_BUTTONS_VERTICAL;
  if (buttons.length > max) {
    w.push({ path, message: `버튼 ${buttons.length}개 > 최대 ${max}개(${layout ?? "vertical"})` });
  }
  const labelMax = layout === "horizontal" ? TEXT_LIMITS.buttonLabelHorizontal : TEXT_LIMITS.buttonLabel;
  buttons.forEach((b, i) => {
    if (b.label.length > labelMax) {
      w.push({ path: `${path}[${i}]`, message: `label ${b.label.length}자 > ${labelMax}자` });
    }
  });
  return w;
}

function checkOutput(output: Output, path: string): Warning[] {
  const w: Warning[] = [];

  if ("simpleText" in output) {
    const len = output.simpleText.text.length;
    if (len > TEXT_LIMITS.simpleText) w.push({ path, message: `text ${len}자 > ${TEXT_LIMITS.simpleText}자` });
    else if (len > TEXT_LIMITS.simpleTextFoldThreshold) w.push({ path, message: `text ${len}자 > ${TEXT_LIMITS.simpleTextFoldThreshold}자 → "전체 보기" 접힘` });
  }

  if ("simpleImage" in output) {
    const alt = output.simpleImage.altText;
    if (alt && alt.length > TEXT_LIMITS.simpleImageAltText) w.push({ path, message: `altText ${alt.length}자 > ${TEXT_LIMITS.simpleImageAltText}자` });
  }

  if ("textCard" in output) {
    const c = output.textCard;
    if (!c.title && !c.description) w.push({ path, message: "textCard는 title/description 중 최소 하나 필수" });
    if (c.description && c.description.length > TEXT_LIMITS.textCardDescription) w.push({ path, message: `description ${c.description.length}자 > ${TEXT_LIMITS.textCardDescription}자` });
    w.push(...checkButtons(c.buttons, `${path}.buttons`, c.buttonLayout));
  }

  if ("commerceCard" in output) {
    w.push(...checkCommerce(output.commerceCard, path));
  }

  if ("basicCard" in output) {
    const c = output.basicCard;
    if (c.title && c.title.length > TEXT_LIMITS.basicCardTitle) w.push({ path, message: `title ${c.title.length}자 > ${TEXT_LIMITS.basicCardTitle}자` });
    if (c.description && c.description.length > TEXT_LIMITS.basicCardDescription) w.push({ path, message: `description ${c.description.length}자 > ${TEXT_LIMITS.basicCardDescription}자` });
    if (!c.title && !c.description && !c.thumbnail) w.push({ path, message: "title/description/thumbnail 전부 비어 있음" });
    // fixedRatio true → 버튼 가로 2개 제한
    const layout = c.thumbnail?.fixedRatio ? "horizontal" : c.buttonLayout;
    w.push(...checkButtons(c.buttons, `${path}.buttons`, layout));
  }

  if ("listCard" in output) {
    const c = output.listCard;
    if (c.items.length > MAX_LIST_ITEMS) w.push({ path, message: `items ${c.items.length}개 > 최대 ${MAX_LIST_ITEMS}개` });
    c.items.forEach((it, i) => {
      if (!it.title) w.push({ path: `${path}.items[${i}]`, message: "title 필수인데 비어 있음" });
      if (!it.action && !it.link) {
        w.push({ path: `${path}.items[${i}]`, message: "항목 클릭 동작 필요 — action 또는 link 중 하나 필수" });
      }
    });
    w.push(...checkButtons(c.buttons, `${path}.buttons`));
  }

  if ("itemCard" in output) {
    w.push(...checkItemCard(output.itemCard, path, false));
  }

  if ("carousel" in output) {
    const c = output.carousel;
    const max = c.type === "listCard" ? MAX_CAROUSEL_LIST_ITEMS : MAX_CAROUSEL_ITEMS;
    if (c.items.length > max) w.push({ path, message: `carousel items ${c.items.length}개 > 최대 ${max}개(${c.type})` });
    if (c.type === "listCard" && c.header) w.push({ path, message: "listCard 캐러셀은 헤더 미지원" });
    // 이미지 비율 통일 검사 (basicCard 캐러셀 한정)
    if (c.type === "basicCard") {
      const ratios = new Set(
        (c.items as { thumbnail?: { fixedRatio?: boolean } }[]).map((it) => it.thumbnail?.fixedRatio ?? false),
      );
      if (ratios.size > 1) w.push({ path, message: "캐러셀 카드 이미지 비율 혼용(1:1/2:1) → 렌더 깨짐" });
    }
    if (c.type === "itemCard") {
      (c.items as ItemCard[]).forEach((it, i) => w.push(...checkItemCard(it, `${path}.items[${i}]`, true)));
    }
    if (c.type === "commerceCard") {
      (c.items as CommerceCard[]).forEach((it, i) => w.push(...checkCommerce(it, `${path}.items[${i}]`)));
    }
  }

  return w;
}

function checkCommerce(card: CommerceCard, path: string): Warning[] {
  const w: Warning[] = [];
  if (!(card.price > 0)) w.push({ path, message: "commerceCard.price는 0보다 커야 함" });
  if (card.discountRate != null && card.discountedPrice == null) {
    w.push({ path, message: "discountRate는 discountedPrice가 함께 있어야 유효" });
  }
  if (!card.thumbnails || card.thumbnails.length === 0) {
    w.push({ path, message: "commerceCard.thumbnails 최소 1개 필요" });
  }
  if (card.title && card.title.length > TEXT_LIMITS.commerceCardTitle) w.push({ path, message: `title ${card.title.length}자 > ${TEXT_LIMITS.commerceCardTitle}자` });
  w.push(...checkButtons(card.buttons, `${path}.buttons`, card.buttonLayout));
  return w;
}

function checkItemCard(card: ItemCard, path: string, inCarousel: boolean): Warning[] {
  const w: Warning[] = [];
  if (card.head && card.profile) w.push({ path, message: "head와 profile 동시 사용 불가" });
  const max = inCarousel ? MAX_ITEMCARD_ROWS_IN_CAROUSEL : MAX_ITEMCARD_ROWS;
  if (card.itemList.length > max) w.push({ path, message: `itemList ${card.itemList.length}행 > 최대 ${max}행` });
  w.push(...checkButtons(card.buttons, `${path}.buttons`, card.buttonLayout));
  return w;
}

export function validate(res: SkillResponse): Warning[] {
  const w: Warning[] = [];
  if (res.version !== "2.0") w.push({ path: "version", message: `"2.0"이어야 함 (현재 ${JSON.stringify(res.version)})` });

  const outputs = res.template?.outputs ?? [];
  if (outputs.length > MAX_OUTPUTS) w.push({ path: "template.outputs", message: `${outputs.length}개 > 최대 ${MAX_OUTPUTS}개` });
  if (outputs.length === 0) w.push({ path: "template.outputs", message: "말풍선이 하나도 없음" });
  outputs.forEach((o, i) => w.push(...checkOutput(o, `outputs[${i}]`)));

  const qr = res.template?.quickReplies;
  if (qr && qr.length > MAX_QUICK_REPLIES) w.push({ path: "template.quickReplies", message: `${qr.length}개 > 최대 ${MAX_QUICK_REPLIES}개` });

  return w;
}

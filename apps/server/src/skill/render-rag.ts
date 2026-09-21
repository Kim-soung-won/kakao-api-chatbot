import type { ItemCard, ItemListRow, Output, QuickReply } from "@sprint-kakao/contract";
import {
  MAX_CAROUSEL_ITEMS,
  MAX_ITEMCARD_ROWS_IN_CAROUSEL,
  MAX_OUTPUTS,
  MAX_QUICK_REPLIES,
  TEXT_LIMITS,
} from "@sprint-kakao/contract";
import { carousel, itemCard, messageQuickReply, simpleText } from "../builders/outputs.js";
import type { RagResult, RagSource, RagSuggestion } from "../a2a/rag-types.js";

/**
 * RAG 결과(`rag-agent.flow-output.v1`) → 카카오 SkillResponse 출력.
 *
 * 설계 원칙(docs/rag-agent-직접연동-가이드v4.md + CLAUDE.md):
 *  - **안내문은 요약 리드 텍스트로만.** 카카오 simpleText는 마크다운을 렌더하지 않고, 안내문 본문의
 *    카드 서식은 sources 네이티브 카드와 중복이다(§5). 첫 문단만 리드로 쓰고 카드는 sources로 그린다.
 *  - **sources = 데이터성 요소 → 네이티브 카드(itemCard).** 서비스별 신청기간·문의처·신청방법을 행으로.
 *  - **suggestions = 후속 제안 칩 → quickReplies.** 라벨은 채널이 조립(§3.3).
 *    detail 칩의 구조화 상세조회(detail-input) 왕복은 아직 미배선 — 지금은 이름 재질의로 폴백.
 */

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

/** 안내문에서 첫 문단만(빈 줄 또는 첫 제목/인용 이전) 리드 텍스트로. */
function leadText(guideText: string): string {
  const trimmed = guideText.trim();
  if (!trimmed) return "";
  // plain/markdown 공통: 첫 빈 줄 전까지, 없으면 첫 마크다운 헤딩/인용 줄 전까지.
  let head = trimmed.split(/\n\s*\n/)[0]!.trim();
  const lines = head.split("\n");
  const cut = lines.findIndex((l, i) => i > 0 && /^\s*(#{1,6}\s|>\s|[-*]\s)/.test(l));
  if (cut > 0) head = lines.slice(0, cut).join("\n").trim();
  return clamp(head, TEXT_LIMITS.simpleText);
}

/** 상시 접수 여부. */
function isAlwaysOpen(apply_end?: string): boolean {
  return apply_end === "9999-12-31";
}

/**
 * 카드 설명용 한 줄 요약. content_snippet → selection_criteria 순으로 첫 "의미 있는" 줄을 고른다.
 * 표 머리글 조각(예: "구분")을 피하려고 짧은(<6자) 줄은 건너뛴다. 없으면 빈 문자열.
 */
function summaryLine(s: RagSource): string {
  for (const src of [s.content_snippet, s.selection_criteria]) {
    if (!src) continue;
    for (const line of src.split("\n")) {
      const t = line.trim();
      if (t.length >= 6) return t;
    }
  }
  return "";
}

/** 한 source → itemCard. 신청기간·문의처·신청방법을 행으로. */
function sourceCard(s: RagSource): Output {
  const rows: ItemListRow[] = [];
  if (isAlwaysOpen(s.apply_end)) {
    rows.push({ title: "신청", description: "상시 접수" });
  } else if (s.apply_start || s.apply_end) {
    rows.push({
      title: "신청기간",
      description: clamp(`${s.apply_start ?? "?"} ~ ${s.apply_end ?? "?"}`, 40),
    });
  }
  if (s.contact) rows.push({ title: "문의", description: clamp(s.contact, 40) });
  if (s.apply_method) rows.push({ title: "신청방법", description: clamp(s.apply_method, 40) });
  // itemCard.itemList는 최소 1행 필요 — 채운 게 없으면 분야/선정기준으로 채운다.
  if (rows.length === 0) {
    const fallback =
      s.selection_criteria?.split("\n")[0] || s.category_large?.join(", ") || "자세한 내용은 문의";
    rows.push({ title: "안내", description: clamp(fallback, 40) });
  }

  const card: ItemCard = {
    head: { title: clamp(s.service_name || "복지서비스", TEXT_LIMITS.basicCardTitle) },
    itemList: rows.slice(0, MAX_ITEMCARD_ROWS_IN_CAROUSEL),
  };
  const desc = summaryLine(s);
  if (desc) card.description = clamp(desc, TEXT_LIMITS.basicCardDescription);
  return itemCard(card);
}

/** sources → itemCard 캐러셀(2건 이상) 또는 단일 itemCard(1건). 0건이면 null. */
function sourceOutputs(sources: RagSource[]): Output[] {
  const list = sources.slice(0, MAX_CAROUSEL_ITEMS);
  if (list.length === 0) return [];
  if (list.length === 1) return [sourceCard(list[0]!)];
  return [
    carousel({
      type: "itemCard",
      items: list.map((s) => {
        const out = sourceCard(s) as { itemCard: ItemCard };
        return out.itemCard;
      }),
    }),
  ];
}

/** suggestions → quickReplies. detail=이름 재질의(폴백), other_category=온보딩 재진입. */
function suggestionQuickReplies(suggestions: RagSuggestion[]): QuickReply[] {
  const out: QuickReply[] = [];
  for (const s of suggestions) {
    if (s.type === "detail" && s.service_name) {
      out.push(messageQuickReply(clamp(`${s.service_name} 자세히 보기`, 14), s.service_name));
    } else if (s.type === "other_category") {
      out.push(messageQuickReply("다른 분야 보기", "맞춤복지"));
    }
    // 모르는 type은 무시(§3.3).
  }
  return out;
}

/**
 * RagResult → { outputs, quickReplies }. 블록이 공통 NAV quickReply와 병합한다.
 * 실패(ok=false)면 안내문(사유)만 simpleText로.
 */
export function renderRag(result: RagResult): { outputs: Output[]; quickReplies: QuickReply[] } {
  const lead = leadText(result.guideText);
  const outputs: Output[] = [];
  if (lead) outputs.push(simpleText(lead));

  if (result.ok) {
    outputs.push(...sourceOutputs(result.sources));
  }
  // 아무 출력도 없으면(안내문·카드 모두 빈 경우) 최소 한 개는 표출.
  if (outputs.length === 0) {
    outputs.push(simpleText(result.guideText.trim() || "안내를 준비하지 못했어요."));
  }

  const quickReplies = suggestionQuickReplies(result.suggestions).slice(0, MAX_QUICK_REPLIES);
  return { outputs: outputs.slice(0, MAX_OUTPUTS), quickReplies };
}

import type { Button, Output } from "@sprint-kakao/contract";
import { MAX_LIST_ITEMS, MAX_OUTPUTS, TEXT_LIMITS } from "@sprint-kakao/contract";
import {
  basicCard,
  listCard,
  simpleText,
  webLinkButton,
} from "../builders/outputs.js";

/**
 * A2A 에이전트의 **평문 답변(또는 구조화 JSON)** 을 케이스별로 알맞은 SkillResponse 출력
 * 컴포넌트로 변환한다. 에이전트가 카드 스펙을 모르므로, 서버가 답변 모양을 보고 렌더를 고른다.
 *
 * ⚠️ 임시 어댑터. 에이전트의 정식 SkillResponse 응답 형식은 추후 확정 예정이며, 확정되면
 *    이 모듈을 그 형식 그대로 통과(passthrough)시키는 방향으로 교체한다. 그전까지:
 *
 * 판정 순서(먼저 맞는 케이스 채택):
 *   1) 구조화 JSON — 에이전트가 SkillResponse/Output/카드 오브젝트를 그대로 반환한 경우 → 통과.
 *   2) 링크 포함  — 마크다운 링크 [라벨](url) 또는 URL이 있으면 basicCard + webLink 버튼.
 *   3) 목록형     — 불릿/번호 줄이 2개 이상이면 listCard.
 *   4) 그 외      — simpleText(1000자 한도로 절단).
 *
 * ⚠️ 에이전트 출력은 신뢰 경계 밖이라 방어적으로 파싱한다. 어떤 케이스에서 실패하든
 *    최종적으로 simpleText로 안전 폴백한다(카카오에 항상 무언가는 표출).
 */

/** 카드 title 한도 절단(말줄임). */
function clampTitle(s: string): string {
  const t = s.trim();
  return t.length <= TEXT_LIMITS.basicCardTitle
    ? t
    : t.slice(0, TEXT_LIMITS.basicCardTitle - 1) + "…";
}

/** 카드 description 한도 절단(말줄임). */
function clampDesc(s: string): string {
  const t = s.trim();
  return t.length <= TEXT_LIMITS.basicCardDescription
    ? t
    : t.slice(0, TEXT_LIMITS.basicCardDescription - 1) + "…";
}

/** 버튼 라벨 한도 절단. */
function clampButtonLabel(s: string): string {
  const t = s.trim();
  return t.length <= TEXT_LIMITS.buttonLabel
    ? t
    : t.slice(0, TEXT_LIMITS.buttonLabel - 1) + "…";
}

/** simpleText 한도 절단. */
function clampText(s: string): string {
  const t = s.trim();
  return t.length <= TEXT_LIMITS.simpleText
    ? t
    : t.slice(0, TEXT_LIMITS.simpleText - 1) + "…";
}

const KNOWN_OUTPUT_KEYS = [
  "simpleText",
  "simpleImage",
  "textCard",
  "basicCard",
  "commerceCard",
  "listCard",
  "itemCard",
  "carousel",
];

/** 값이 "정확히 한 개의 알려진 출력 키"를 가진 Output인지 얕게 판별. */
function isOutput(v: unknown): v is Output {
  if (!v || typeof v !== "object") return false;
  const keys = Object.keys(v as Record<string, unknown>);
  return keys.length === 1 && KNOWN_OUTPUT_KEYS.includes(keys[0]!);
}

/** 케이스 1: 에이전트가 구조화 JSON을 반환했으면 출력 배열로. 아니면 null. */
function tryStructured(raw: string): Output[] | null {
  const trimmed = raw.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  // 1a) 완전한 SkillResponse ({ template: { outputs: [...] } }).
  const asResp = parsed as { template?: { outputs?: unknown } };
  if (Array.isArray(asResp?.template?.outputs)) {
    const outs = asResp.template!.outputs!.filter(isOutput);
    return outs.length ? outs.slice(0, MAX_OUTPUTS) : null;
  }

  // 1b) Output 배열.
  if (Array.isArray(parsed)) {
    const outs = parsed.filter(isOutput);
    return outs.length ? outs.slice(0, MAX_OUTPUTS) : null;
  }

  // 1c) 단일 Output.
  if (isOutput(parsed)) return [parsed];

  // 1d) 카드처럼 생긴 오브젝트 → basicCard로 매핑.
  const o = parsed as { title?: unknown; description?: unknown };
  if (typeof o?.title === "string" || typeof o?.description === "string") {
    return [
      basicCard({
        ...(typeof o.title === "string" ? { title: clampTitle(o.title) } : {}),
        ...(typeof o.description === "string" ? { description: clampDesc(o.description) } : {}),
      }),
    ];
  }
  return null;
}

/** 마크다운 링크 [라벨](url) 및 bare URL을 추출. */
function extractLinks(text: string): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const md = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const seen = new Set<string>();
  for (const m of text.matchAll(md)) {
    const url = m[2]!;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ label: m[1]!, url });
  }
  // 마크다운으로 안 잡힌 bare URL도 버튼 후보로.
  const bare = /(?<!\()https?:\/\/[^\s)]+/g;
  for (const m of text.matchAll(bare)) {
    const url = m[0]!;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ label: "링크 열기", url });
  }
  return links;
}

/** 마크다운 링크 표기를 라벨만 남기고 정리(카드 본문용). */
function stripMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1").trim();
}

/** 케이스 2: 링크가 있으면 basicCard + webLink 버튼(최대 3). */
function tryLinkCard(raw: string): Output[] | null {
  const links = extractLinks(raw);
  if (links.length === 0) return null;
  const buttons: Button[] = links
    .slice(0, 3)
    .map((l) => webLinkButton(clampButtonLabel(l.label), l.url));

  const cleaned = stripMarkdown(raw);
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0] ? clampTitle(lines[0]) : "안내";
  const body = lines.slice(1).join("\n");
  return [
    basicCard({
      title,
      ...(body ? { description: clampDesc(body) } : {}),
      buttons,
    }),
  ];
}

/** 불릿/번호 목록 줄 판별. */
const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

/** 케이스 3: 목록형(불릿/번호 2줄 이상)이면 listCard. */
function tryListCard(raw: string): Output[] | null {
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  const items: { title: string; description?: string }[] = [];
  const headerCandidates: string[] = [];
  for (const line of lines) {
    const m = line.match(LIST_LINE);
    if (m) {
      const content = m[1]!.trim();
      if (!content) continue;
      // "제목 - 설명" / "제목: 설명" 이면 분리.
      const split = content.match(/^(.+?)\s*[-:—]\s+(.+)$/);
      if (split) {
        items.push({ title: clampTitle(split[1]!), description: clampDesc(split[2]!) });
      } else {
        items.push({ title: clampTitle(content) });
      }
    } else if (line.trim()) {
      headerCandidates.push(line.trim());
    }
  }
  if (items.length < 2) return null;

  const header = headerCandidates[0] ? clampTitle(headerCandidates[0]) : "안내";
  return [listCard(header, items.slice(0, MAX_LIST_ITEMS))];
}

/**
 * 에이전트 답변 → 출력 컴포넌트 배열. 위 케이스를 순서대로 시도하고, 모두 아니면 simpleText.
 * 반환 개수는 카카오 제약(MAX_OUTPUTS)으로 절단한다.
 */
export function renderAgentAnswer(raw: string): Output[] {
  const answer = (raw ?? "").trim();
  if (!answer) return [simpleText("(AI 상담원이 응답을 반환하지 않았어요.)")];

  const rendered =
    tryStructured(answer) ?? tryLinkCard(answer) ?? tryListCard(answer) ?? [simpleText(clampText(answer))];

  return rendered.slice(0, MAX_OUTPUTS);
}

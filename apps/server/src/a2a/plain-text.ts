/**
 * RAG 원장 필드의 HTML 조각 → 카카오용 평문.
 *
 * sources의 content_snippet·apply_method 등은 원장 HTML을 잘라 그대로 담아 와서
 * `<br>`·엔티티가 섞이고, 스니펫 경계가 태그 중간을 자르면 `br>` 같은 조각이 남는다.
 * 카카오 출력 컴포넌트는 HTML을 렌더하지 않으므로 받는 시점에 평문으로 바꾼다.
 *
 * 공문서에 흔한 `<신청 안내>` 같은 꺾쇠 표기를 지우지 않도록 **알려진 HTML 태그 이름만** 다룬다.
 */

const TAGS =
  "br|p|div|span|b|strong|i|em|u|s|font|a|img|hr|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|caption|h[1-6]|sup|sub|small|pre|blockquote|center|label|section|article";

/**
 * 태그 속성 부분. 실제 HTML은 `<` 바로 뒤에 공백이 없고 속성에 한글이 없다 —
 * "a < b 그리고 c > d" 같은 비교 기호·문장을 태그로 오인하지 않게 좁힌다.
 */
const ATTRS = "(?:\\s[^<>\\u3131-\\ud79d]*)?";

/** 줄바꿈으로 바꿀 태그(블록 경계). */
const BREAK_RE = new RegExp(
  `<(?:br|hr)${ATTRS}\\/?>|<\\/(?:p|div|li|tr|h[1-6]|table|ul|ol|blockquote|section|article)\\s*>`,
  "gi",
);
/** 그 외 알려진 태그(여는/닫는/자기닫힘) 제거. */
const TAG_RE = new RegExp(`<\\/?(?:${TAGS})${ATTRS}\\/?>`, "gi");
/** 앞에서 잘린 태그 꼬리(예: "br>", "/p>", "span style=\"…\">"). */
const LEADING_FRAGMENT_RE = new RegExp(`^\\s*\\/?(?:${TAGS})${ATTRS}\\/?>`, "i");
/** 뒤에서 잘린 태그 머리(예: "<br", "</p", "<span style=\"…"). */
const TRAILING_FRAGMENT_RE = new RegExp(`<\\/?(?:(?:${TAGS})${ATTRS})?$`, "i");

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  middot: "·",
  bull: "•",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** HTML 조각을 평문으로. 태그가 없는 문자열은 공백 정리만 된다. */
export function toPlainText(input: string): string {
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(LEADING_FRAGMENT_RE, "").replace(TRAILING_FRAGMENT_RE, "");
  s = s.replace(BREAK_RE, "\n").replace(TAG_RE, "");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 객체의 문자열·문자열 배열 필드를 평문으로(얕게). 그 외 값은 그대로. */
export function plainTextFields<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[k] = toPlainText(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" ? toPlainText(x) : x));
    else out[k] = v;
  }
  return out as T;
}

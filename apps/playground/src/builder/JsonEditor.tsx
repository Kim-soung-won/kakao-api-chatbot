/**
 * 편집 가능한 JSON 코드블록.
 * 투명한 <textarea>를 색칠된 <pre> 위에 겹쳐, 편집 + 구문 하이라이트를 동시에 제공.
 */

interface Props {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}

/** JSON 문자열을 토큰별 <span>으로 감싼 HTML로 변환(입력은 HTML 이스케이프됨). */
function highlightJson(code: string): string {
  const esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) cls = /:$/.test(match) ? "key" : "string";
      else if (/true|false/.test(match)) cls = "boolean";
      else if (/null/.test(match)) cls = "null";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export function JsonEditor({ value, onChange, error }: Props) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">JSON · template_object</span>
        <span className={`code-status ${error ? "bad" : "ok"}`}>{error ? "invalid" : "valid"}</span>
      </div>
      <div className="code-scroll">
        <pre className="code-hl" aria-hidden="true">
          <code dangerouslySetInnerHTML={{ __html: highlightJson(value) + "\n" }} />
        </pre>
        <textarea
          className="code-input"
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

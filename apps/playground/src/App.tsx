import { useState } from "react";
import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import { KakaoRenderer } from "./renderer/KakaoRenderer.js";
import { validate, type Warning } from "./renderer/validate.js";

interface Turn {
  utterance: string;
  meta?: Record<string, unknown>;
  response?: SkillResponse;
  warnings?: Warning[];
  error?: string;
}

// 고정 사용자 — 실측 전까지 botUserKey 가설값
const USER_ID = "playground-user-1";

async function callSkill(utterance: string, meta?: Record<string, unknown>): Promise<SkillResponse> {
  const payload: SkillPayload = {
    userRequest: { utterance, user: { id: USER_ID } },
    bot: { id: "playground-bot" },
    action: { name: "skill", clientExtra: meta?.["extra"] as Record<string, unknown> | undefined },
  };
  const res = await fetch("/skill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SkillResponse;
}

export function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [showJson, setShowJson] = useState(false);

  async function send(utterance: string, meta?: Record<string, unknown>) {
    const u = utterance.trim();
    if (!u) return;
    setInput("");
    const idx = turns.length;
    setTurns((t) => [...t, { utterance: u, meta }]);
    try {
      const response = await callSkill(u, meta);
      const warnings = validate(response);
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, response, warnings } : turn)));
    } catch (e) {
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, error: String(e) } : turn)));
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>카카오 스킬 렌더러 플레이그라운드</strong>
        <label className="json-toggle">
          <input type="checkbox" checked={showJson} onChange={(e) => setShowJson(e.target.checked)} /> 원문 JSON
        </label>
      </header>

      <div className="chat">
        {turns.length === 0 && (
          <div className="hint">'카드' 또는 '리스트'를 입력해 데모 응답을 렌더링해보세요. (서버: apps/server 실행 필요)</div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="turn">
            <div className="user-bubble">
              {turn.utterance}
              {turn.meta?.["extra"] ? <span className="extra-tag">extra</span> : null}
            </div>
            {turn.error && <div className="bot-turn"><div className="bubble text err">요청 실패: {turn.error}</div></div>}
            {turn.response && <KakaoRenderer response={turn.response} onAction={send} />}
            {turn.warnings && turn.warnings.length > 0 && (
              <div className="warnings">
                {turn.warnings.map((w, j) => (
                  <div key={j} className="warning">⚠️ <code>{w.path}</code> — {w.message}</div>
                ))}
              </div>
            )}
            {turn.warnings && turn.warnings.length === 0 && turn.response && (
              <div className="ok">✅ 제약 위반 없음</div>
            )}
            {showJson && turn.response && (
              <pre className="json">{JSON.stringify(turn.response, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="발화 입력 (예: 카드, 리스트)"
        />
        <button className="composer-send" type="submit">전송</button>
      </form>
    </div>
  );
}

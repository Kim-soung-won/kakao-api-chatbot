import { useState } from "react";
import type { SkillPayload, SkillResponse } from "@sprint-kakao/contract";
import { KakaoRenderer } from "./renderer/KakaoRenderer.js";
import { validate, type Warning } from "./renderer/validate.js";
import { MessageBuilder } from "./builder/MessageBuilder.js";
import { FriendTalkBuilder } from "./builder/FriendTalkBuilder.js";

interface Turn {
  /** 사용자 발화. 웰컴(자동 진입) 턴은 발화가 없다. */
  utterance?: string;
  meta?: Record<string, unknown>;
  response?: SkillResponse;
  warnings?: Warning[];
  error?: string;
}

// 고정 사용자 — 실측 전까지 botUserKey 가설값
const USER_ID = "playground-user-1";

async function callSkill(utterance: string, meta?: Record<string, unknown>): Promise<SkillResponse> {
  const payload: SkillPayload = {
    // 고정 user.id로 매 요청 전송 → 서버가 botUserKey별 파일 저장소에 이력을 누적한다.
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

/** 좌측 패널: 챗봇 스킬 응답 렌더러 + 발화 시뮬레이터. */
function ChatPane() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [showJson, setShowJson] = useState(false);

  // 진입 웰컴은 챗봇(스킬)이 아니라 채널 친구추가 메시지(채널 레이어)가 담당한다.
  // (카카오 웰컴 블록은 진입 시 스킬 자동호출이 안 됨 — docs/blocks.md 참고)

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
    <aside className="pane-chat">
      <header className="pane-head">
        <strong>챗봇 렌더러 <span className="pane-sub">스킬 응답 · /skill</span></strong>
        <label className="json-toggle">
          <input type="checkbox" checked={showJson} onChange={(e) => setShowJson(e.target.checked)} /> 원문 JSON
        </label>
      </header>

      <div className="chat">
        {turns.length === 0 && (
          <div className="hint">'맞춤복지'를 입력하면 온보딩 카드 흐름(지역→가구→관심)이 시작되고,<br />그 외 자유 발화는 모두 에이전트(A2A) 응답으로 렌더링됩니다. 응답마다 제약 위반 경고·원문 JSON을 확인하세요.</div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="turn">
            {turn.utterance !== undefined && (
              <div className="user-bubble">
                {turn.utterance}
                {turn.meta?.["extra"] ? <span className="extra-tag">extra</span> : null}
              </div>
            )}
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
          placeholder="발화 입력 (예: 맞춤복지, 보육료 알려줘)"
        />
        <button className="composer-send" type="submit">전송</button>
      </form>
    </aside>
  );
}

/** 우측 패널: 발송 카드 디자이너 (친구톡=채널 발송 / 메시지 템플릿=공유·개인). */
function ToolsPane() {
  const [tool, setTool] = useState<"friendtalk" | "message">("friendtalk");
  return (
    <main className="pane-tools">
      <header className="pane-head">
        <nav className="viewnav">
          <button className={tool === "friendtalk" ? "on" : ""} onClick={() => setTool("friendtalk")}>친구톡 (채널)</button>
          <button className={tool === "message" ? "on" : ""} onClick={() => setTool("message")}>메시지 템플릿 (공유)</button>
        </nav>
        <span className="pane-sub">{tool === "friendtalk" ? "비즈메시지 · 채널 친구" : "developers · 공유/개인"}</span>
      </header>
      {tool === "friendtalk" ? <FriendTalkBuilder /> : <MessageBuilder />}
    </main>
  );
}

export function App() {
  return (
    <div className="app">
      <ChatPane />
      <ToolsPane />
    </div>
  );
}

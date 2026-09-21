import { randomUUID } from "node:crypto";
import {
  RAG_ANSWER_FORMAT,
  RAG_AUTH,
  RAG_ENDPOINT,
  RAG_MOCK_ENABLED,
  RAG_TIMEOUT_MS,
  RAG_TOP_K,
} from "./config.js";
import { ragMockResult } from "./rag-mock.js";
import type {
  RagConditions,
  RagOptions,
  RagQuery,
  RagResult,
  RagSource,
  RagSuggestion,
} from "./rag-types.js";

/**
 * 실제 RAG 복지 안내 에이전트에 A2A JSON-RPC **`message/send`(단발)** 으로 질의하고,
 * artifact `welfare-guide`를 파싱해 안내문 + 카드 데이터(sources·suggestions)를 반환한다.
 * docs/rag-agent-직접연동-가이드v4.md 계약.
 *
 * 카카오는 토큰 스트리밍을 못 쓰고 5초 초과 처리는 콜백 플로우로 감싸므로, 스트리밍(message/stream)
 * 대신 단발 송수신이 더 단순·견고하다. 실측 지연 ~8초 → agent/onboarding 블록의 callback 경로에서 호출.
 *
 * 에이전트 출력은 신뢰 경계 밖이라 방어적으로 파싱하고, 어떤 실패든 ok=false + 사용자용 사유로
 * 안전 폴백한다(카카오에는 항상 무언가 표출).
 */

/** A2A Part[]에서 kind==="text" 파트만 이어붙인다. */
function partsText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) =>
      p && typeof p === "object" && (p as { kind?: string }).kind === "text"
        ? String((p as { text?: unknown }).text ?? "")
        : "",
    )
    .join("");
}

/** A2A Part[]에서 kind==="data" && data.schema 가 flow-output 인 DataPart의 data를 찾는다. */
function findFlowOutput(parts: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(parts)) return undefined;
  for (const p of parts) {
    if (!p || typeof p !== "object" || (p as { kind?: string }).kind !== "data") continue;
    const data = (p as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const schema = (data as { schema?: unknown }).schema;
      // 스키마 이름은 방어적으로: flow-output 계열이면 채택(버전이 늘 수 있음).
      if (typeof schema === "string" && schema.startsWith("rag-agent.flow-output")) {
        return data as Record<string, unknown>;
      }
    }
  }
  return undefined;
}

/** unknown[] → RagSource[] (모르는 키 무시, service_id/name 없는 항목은 버림). */
function normalizeSources(v: unknown): RagSource[] {
  if (!Array.isArray(v)) return [];
  const out: RagSource[] = [];
  for (const s of v) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const service_id = typeof o["service_id"] === "string" ? o["service_id"] : "";
    const service_name = typeof o["service_name"] === "string" ? o["service_name"] : "";
    if (!service_id && !service_name) continue;
    out.push({ ...(o as unknown as RagSource), service_id, service_name });
  }
  return out;
}

/** unknown[] → RagSuggestion[] (type 문자열 없는 항목 버림). */
function normalizeSuggestions(v: unknown): RagSuggestion[] {
  if (!Array.isArray(v)) return [];
  const out: RagSuggestion[] = [];
  for (const s of v) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (typeof o["type"] !== "string") continue;
    out.push({
      type: o["type"],
      ...(typeof o["service_id"] === "string" ? { service_id: o["service_id"] } : {}),
      ...(typeof o["service_name"] === "string" ? { service_name: o["service_name"] } : {}),
    });
  }
  return out;
}

/** RagQuery | string 을 정규화. 문자열이면 질의만 담고 조건 없음(§2.4 경로). */
function toQuery(input: RagQuery | string): RagQuery {
  return typeof input === "string" ? { query: input } : input;
}

/** conditions 에서 빈 값(빈 문자열·빈 배열·undefined)을 제거해 조건으로 만들지 않는다(§2.2). */
function pruneConditions(c: RagConditions | undefined): RagConditions | undefined {
  if (!c) return undefined;
  const out: RagConditions = {};
  for (const [k, val] of Object.entries(c)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "string" && val.trim() === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    (out as Record<string, unknown>)[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * message.metadata의 세션 외 필드 — 에이전트 측 요구 형식. sessionId만 실값(botUserKey)이고
 * ⚠️ userId·agentId·agentName은 **임시 placeholder**다(확정 값을 받으면 교체, env로도 덮어쓰기 가능).
 */
const RAG_META_USER_ID = process.env["RAG_META_USER_ID"] ?? "admin";
const RAG_META_AGENT_ID =
  process.env["RAG_META_AGENT_ID"] ?? "016316b2-e357-4eea-9f9d-ce6a50961f24";
const RAG_META_AGENT_NAME = process.env["RAG_META_AGENT_NAME"] ?? "금융 마켓 인사이트";

export async function askRagAgent(input: RagQuery | string): Promise<RagResult> {
  const q = toQuery(input);
  const query = (q.query ?? "").trim();

  // §2.6 실패: 질의가 비면 서버를 부르지 않는다(RAG_INPUT_MISSING와 동일 취지).
  if (!query) {
    return {
      ok: false,
      guideText: "무엇을 안내해 드릴까요? 궁금한 복지 내용을 입력해 주세요.",
      sources: [],
      suggestions: [],
    };
  }

  // 오프라인/로컬: canned 구조 응답으로 대체(네트워크 없음).
  if (RAG_MOCK_ENABLED) {
    console.log("[rag] mock enabled — canned 응답 반환");
    return ragMockResult(query);
  }

  const conditions = pruneConditions(q.conditions);
  const options: RagOptions = {
    top_k: q.options?.top_k ?? RAG_TOP_K,
    answer_format: q.options?.answer_format ?? RAG_ANSWER_FORMAT,
  };

  // 세션 식별: 카카오 botUserKey를 sessionId로. 같은 채팅방 턴을 에이전트가 묶을 수 있게.
  const sessionId = q.sessionId?.trim() || "anonymous";

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: {
      message: {
        role: "user",
        kind: "message",
        messageId: randomUUID(),
        metadata: {
          userId: RAG_META_USER_ID,
          sessionId,
          agentId: RAG_META_AGENT_ID,
          agentName: RAG_META_AGENT_NAME,
        },
        parts: [
          { kind: "text", text: query },
          {
            kind: "data",
            data: {
              schema: "rag-agent.flow-input.v3",
              ...(conditions ? { conditions } : {}),
              options,
            },
          },
        ],
      },
    },
  };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (RAG_AUTH) headers["authorization"] = RAG_AUTH;

  console.log(
    "[rag] →request",
    JSON.stringify({
      endpoint: RAG_ENDPOINT,
      auth: RAG_AUTH ? "Bearer ***" : "(없음)",
      query,
      sessionId,
      conditions: conditions ?? null,
      options,
    }),
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RAG_TIMEOUT_MS);
  try {
    const res = await fetch(RAG_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    console.log(`[rag] ←status ${res.status} ${res.statusText}`);
    if (res.status === 401 || res.status === 403) {
      console.error(`[rag] 인증 실패 ${res.status} — RAG_AUTH(Bearer) 주입 확인 필요`);
      return {
        ok: false,
        guideText: "AI 안내 서버 인증에 실패했어요. 잠시 후 다시 시도해 주세요.",
        sources: [],
        suggestions: [],
      };
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[rag] 요청 실패 ${res.status} body:`, errBody.slice(0, 500));
      return {
        ok: false,
        guideText: "AI 안내 서버 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.",
        sources: [],
        suggestions: [],
      };
    }

    const json = (await res.json()) as {
      result?: { status?: { state?: string }; artifacts?: unknown };
      error?: { message?: string };
    };
    if (json.error) {
      console.error("[rag] ←error", JSON.stringify(json.error));
      return {
        ok: false,
        guideText: `AI 안내 중 오류가 발생했어요: ${json.error.message ?? "unknown"}`,
        sources: [],
        suggestions: [],
      };
    }

    const result = json.result;
    const state = result?.status?.state;
    const artifacts = Array.isArray(result?.artifacts) ? result!.artifacts : [];
    // part는 위치가 아니라 name/kind/schema로 찾는다(§3.1).
    const guide = artifacts.find(
      (a) => a && typeof a === "object" && (a as { name?: unknown }).name === "welfare-guide",
    ) as { parts?: unknown } | undefined;

    const guideText = partsText(guide?.parts).trim();
    const flowOut = findFlowOutput(guide?.parts);
    const sources = normalizeSources(flowOut?.["sources"]);
    const suggestions = normalizeSuggestions(flowOut?.["suggestions"]);

    console.log(
      "[rag] ←final",
      JSON.stringify({
        state: state ?? null,
        guideLen: guideText.length,
        sources: sources.length,
        suggestions: suggestions.length,
        sourceNames: sources.map((s) => s.service_name),
      }),
    );

    // state가 completed 아니면 실패로 다루되, 안내문이 있으면 그대로 표출.
    if (state && state !== "completed") {
      console.error(`[rag] ←비정상 상태 state=${state}`);
      return {
        ok: false,
        guideText:
          guideText || "AI 안내원이 답변 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
        sources,
        suggestions,
      };
    }

    // 회수 0건은 오류가 아니다(§0·§4): 안내문 + 빈 목록으로 정상 반환.
    return {
      ok: true,
      guideText: guideText || "관련 안내를 찾지 못했어요. 조건을 바꿔 다시 물어봐 주세요.",
      sources,
      suggestions,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.error(`[rag] 호출 실패${aborted ? "(timeout)" : ""}:`, err);
    return {
      ok: false,
      guideText: aborted
        ? "AI 안내가 시간 안에 완료되지 않았어요. 잠시 후 다시 시도해 주세요."
        : "AI 안내 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      sources: [],
      suggestions: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

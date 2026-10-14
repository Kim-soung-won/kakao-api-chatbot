import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 세션 상태 파일 저장소 — botUserKey(userRequest.user.id)별 JSON 파일.
 *
 * 카카오 `context`가 요청 간 왕복되지 않아(실측) 세션 상태를 응답에 심어 보낼 수 없으므로,
 * botUserKey를 키로 서버가 상태를 보관한다. 여기 담는 건 "지금 이 사용자가 AI 복지 연결
 * 상태인가" 한 조각뿐이다. 대화 이력은 여전히 에이전트가 관리한다(sessionId = botUserKey).
 *
 * 위치: `captured-requests/session/<userId>.json` (docker 볼륨). 만료 없음 — 종료 키워드로만 해제.
 *
 * ⚠️ 단순 저장소: last-write-wins, 프로세스 로컬. 다중 인스턴스가 필요해지면
 *    동일 인터페이스(loadMode/saveMode)로 KV에 갈아끼운다.
 */

/** 세션 파일 루트. */
const SESSION_DIR = join(process.cwd(), "captured-requests", "session");

/** 대화 모드. undefined(미연결) 또는 "agent"(AI 복지 연결 = 발화가 에이전트로 흐름). */
export type SessionMode = "agent";

/** 저장 파일 포맷. */
interface SessionFile {
  userId: string;
  updatedAt: string;
  mode?: SessionMode;
}

/** botUserKey → 안전한 파일명. */
function fileFor(userId: string): string {
  const safe = (userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return join(SESSION_DIR, `${safe || "anonymous"}.json`);
}

/** 사용자의 현재 모드를 로드. 파일 없음/깨짐이면 undefined(미연결). */
export async function loadMode(userId: string): Promise<SessionMode | undefined> {
  try {
    const raw = await readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionFile>;
    return parsed?.mode === "agent" ? "agent" : undefined;
  } catch {
    return undefined;
  }
}

/** 사용자의 모드를 저장한다. mode가 null이면 세션 해제(파일 삭제 = 미연결 복귀). */
export async function saveMode(userId: string, mode: SessionMode | null): Promise<void> {
  if (mode === null) {
    await unlink(fileFor(userId)).catch(() => {});
    return;
  }
  await mkdir(SESSION_DIR, { recursive: true });
  const record: SessionFile = {
    userId: userId || "anonymous",
    updatedAt: new Date().toISOString(),
    mode,
  };
  await writeFile(fileFor(userId), JSON.stringify(record, null, 2), "utf8");
}

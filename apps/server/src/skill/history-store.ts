import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { coerceTurns, type HistoryTurn } from "./history.js";

/**
 * 대화 이력 파일 저장소 — botUserKey(userRequest.user.id)별 JSON 파일.
 *
 * 위치: `captured-requests/history/<userId>.json` (컨테이너 /app/captured-requests/history).
 * /echo 캡처와 같은 docker 볼륨(`./captured-requests:/app/captured-requests`)에 적재되므로
 * 호스트에서 대화 이력을 그대로 열람·수집할 수 있고, RAG 연동 시 이 파일이 곧 전송 소스다.
 *
 * ⚠️ 데모용 단순 저장소: 파일 단위 last-write-wins(동시 요청 경합 미보호), 프로세스 로컬.
 * 다중 인스턴스/영속성이 필요해지면 동일 인터페이스(load/append)로 KV·DB에 갈아끼운다.
 */

/** 이력 파일 루트. /echo 캡처 디렉터리(captured-requests) 하위에 둔다. */
const HISTORY_DIR = join(process.cwd(), "captured-requests", "history");

/** 저장 파일 포맷(사람이 읽고, RAG로 그대로 넘길 수 있게). */
interface HistoryFile {
  userId: string;
  updatedAt: string;
  turns: HistoryTurn[];
}

/** botUserKey → 안전한 파일명. 영숫자·-_ 외는 _로 치환, 빈 값은 anonymous. */
function fileFor(userId: string): string {
  const safe = (userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return join(HISTORY_DIR, `${safe || "anonymous"}.json`);
}

/** 사용자 이력을 파일에서 로드. 파일 없음/깨짐이면 빈 배열. */
export async function loadHistory(userId: string): Promise<HistoryTurn[]> {
  try {
    const raw = await readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<HistoryFile>;
    return coerceTurns(parsed?.turns);
  } catch {
    return [];
  }
}

/** 사용자 이력을 파일에 저장(덮어쓰기). 저장된 이력을 그대로 반환. */
export async function saveHistory(
  userId: string,
  turns: HistoryTurn[],
): Promise<HistoryTurn[]> {
  await mkdir(HISTORY_DIR, { recursive: true });
  const record: HistoryFile = {
    userId: userId || "anonymous",
    updatedAt: new Date().toISOString(),
    turns,
  };
  await writeFile(fileFor(userId), JSON.stringify(record, null, 2), "utf8");
  return turns;
}

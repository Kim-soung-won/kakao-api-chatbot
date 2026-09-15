import type { SkillBlock } from "../types.js";
import { simpleText } from "../../builders/outputs.js";
import { wrap } from "../shared.js";

/**
 * 폴백 블록 — 어떤 블록에도 매칭되지 않은 발화. (오픈빌더 폴백 블록에 대응)
 * ⭐ 실서비스에서는 이 자리에 RAG 답변 생성을 연결한다(자유 질문 처리 지점).
 */
export const fallback: SkillBlock = {
  name: "fallback",
  match: () => true,
  respond: (ctx) =>
    wrap([
      simpleText(
        `"${ctx.utterance || "(빈 발화)"}"에 대한 안내를 찾고 있어요.\n아래에서 복지 항목을 선택하거나 다시 질문해 주세요.\n(실서비스에선 이 자리에 RAG 답변이 들어갑니다.)`,
      ),
    ]),
};

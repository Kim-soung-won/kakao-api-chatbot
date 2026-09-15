import type { SkillBlock } from "../types.js";
import { itemCard, messageButton } from "../../builders/outputs.js";

const HERO_WELCOME = "https://placehold.co/640x420/1b4db5/ffffff/png?text=Gangseo+AI";

/**
 * 웰컴 블록 — 첫 인사·소개 카드. (오픈빌더 웰컴 블록에 대응)
 * "맞춤 복지 안내 시작하기" 버튼이 온보딩 시나리오로 진입시킨다.
 *
 * 웰컴 블록이 스킬을 호출할 때는 사용자 발화가 없으므로(빈 문자열),
 * 빈 발화도 웰컴 진입으로 보고 이 카드를 반환한다.
 */
export const welcome: SkillBlock = {
  name: "welcome",
  match: (ctx) => ctx.utterance === "" || /도우미|환영|강서구/.test(ctx.utterance),
  respond: () => ({
    version: "2.0",
    template: {
      outputs: [
        itemCard({
          thumbnail: { imageUrl: HERO_WELCOME },
          title: "반갑습니다! 👋",
          description:
            "저는 강서구 AI 복지도우미예요.\n한국어 교육, 보육료, 취업 지원 등\n맞춤 복지 정보를 안내해 드려요.\n\n[24시간 안내] [다국어 지원] [맞춤 추천]",
          itemList: [
            { title: "운영", description: "24시간 자동 안내" },
            { title: "언어", description: "다국어 지원" },
          ],
          buttons: [
            messageButton("맞춤 복지 안내 시작하기", "맞춤복지"),
            messageButton("바로 질문하기", "질문"),
          ],
        }),
      ],
    },
  }),
};

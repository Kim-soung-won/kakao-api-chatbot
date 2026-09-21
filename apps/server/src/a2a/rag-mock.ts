import type { RagResult } from "./rag-types.js";

/**
 * RAG 오프라인 목업(RAG_MOCK=1 또는 A2A_MOCK=1). 실제 `rag-agent.flow-output.v1` 구조와
 * 같은 모양의 canned 응답으로 네트워크 없이 렌더/블록 흐름을 검증한다.
 */
export function ragMockResult(query: string): RagResult {
  return {
    ok: true,
    guideText:
      `"${query.slice(0, 30)}" 관련 복지서비스를 안내해 드릴게요. (목업 응답)\n` +
      "아래 카드에서 신청기간·문의처를 확인하세요.",
    sources: [
      {
        service_id: "MOCK-001",
        service_name: "2026년 어르신 밥퍼 사업 1차 참여자",
        category_large: ["일자리"],
        min_age: 65,
        max_age: 100,
        apply_start: "2026-01-01",
        apply_end: "9999-12-31",
        selection_criteria: "만 65세 이상 어르신 대상",
        contact: "02-120",
        department: "총무팀",
        apply_method: "주민센터(행정복지센터) 방문 신청",
        content_snippet: "식사지원 및 안부 확인 서비스 제공",
        score: 0.97,
        doc_title: "",
        file_type: "",
        exclusion_criteria: "",
      },
      {
        service_id: "MOCK-002",
        service_name: "노인 일자리 및 사회활동 지원",
        category_large: ["일자리"],
        min_age: 65,
        max_age: 100,
        apply_start: "2026-01-01",
        apply_end: "2026-12-31",
        selection_criteria: "65세 이상 기초연금 수급자",
        contact: "1544-3388",
        department: "한국노인인력개발원",
        apply_method: "노인일자리 수행기관에 신청",
        content_snippet: "다양한 일자리 및 사회활동 지원",
        score: 0.95,
        doc_title: "",
        file_type: "",
        exclusion_criteria: "",
      },
    ],
    suggestions: [
      { type: "detail", service_id: "MOCK-001", service_name: "2026년 어르신 밥퍼 사업 1차 참여자" },
      { type: "other_category" },
    ],
  };
}

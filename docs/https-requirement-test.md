# 스킬 서버 http 노출 실측 — 카카오는 HTTPS(TLS) 강제

> 실측일: 2026-09-17
> 목적: "카카오 스킬 서버 URL은 정말 HTTPS여야 하는가?"를 **평문 http 공개 노출로 직접 검증**.
> 결론: **강제 HTTPS 확정.** 카카오는 http URL을 등록해도 접속 시 TLS 핸드셰이크를 시도한다.
> 관련: C4 모델 `sprint-kakao-c4-model.json` → `designIntent.decisions[d4]`(로컬 공개 노출),
>       도메인 스킬 `kakao-skill-response_api`(전송·노출 요건), 짝 문서 [chatbot](./chatbot.md).

## 가설

카카오 비즈니스 챗봇 가이드 본문은 스킬 URL 요건을 **"공인IP 또는 공중망 도메인만 사용
가능"**까지만 명시하고, 프로토콜(http/https)을 문장으로 못박지 않는다. 실무·연동 문서상
HTTPS가 강제로 알려져 있으나 공개 문서에 그 문장이 없어 **가설**로 남아 있었다(=`d4`의 미확정 축).

## 방법 (테스트 하니스)

cloudflared quick tunnel은 **공개 URL이 https 전용**이라 http를 노출할 수 없다 → http 검증 불가.
그래서 **평문 http를 그대로 뚫는 `bore`** 를 임시로 사용했다.

```bash
# 스킬 서버(docker) — 호스트 :3000은 다른 프로젝트가 점유 중이라 :3001로 매핑
SERVER_HOST_PORT=3001 docker compose up -d server
# 평문 http 공개 터널 (compose 네트워크의 server:3000 대상)
docker run -d --name sprint-kakao-bore ekzhang/bore:latest \
  local 3000 --to bore.pub --local-host host.docker.internal
# → listening at bore.pub:<포트>   (예: 39015)
```

우리 쪽 사전 검증(우리 서버가 공개 http로 정상 응답하는지)은 **성공**했다:

```
curl http://bore.pub:39015/health   → {"status":"ok"}
curl -X POST http://bore.pub:39015/skill -d '{"userRequest":{"utterance":"카드"}}'
    → 정상 SkillResponse(version 2.0, simpleText + quickReplies)
```

즉 **터널·서버·응답 자체는 http로 완전히 정상**이었다. 변수는 오직 "카카오가 http로 부르느냐".

## 결과 — 오픈빌더 스킬서버 전송 시 실패

오픈빌더에 `http://bore.pub:<포트>/skill`을 등록하고 "스킬서버 전송"으로 호출하자
응답 결과 로그에 다음이 찍혔다:

```
13:38:54 [INFO]  요청 형식을 서버로 전송하여 결과를 검증하는 중입니다...
13:38:56 [ERROR] 올바르지 않은 스킬 서버 응답입니다.
문제가 발생하였습니다. [not an SSL/TLS record:
485454502f312e3120343030 ...]
```

## 해석 (핵심)

- 에러의 hex `485454502f312e3120343030` = 아스키 **`HTTP/1.1 400`**.
- 즉 **카카오가 우리 포트로 TLS ClientHello를 보냈고**, 우리 평문 http 서버는 그걸 못 알아듣고
  `HTTP/1.1 400`(평문)을 돌려줬다. 카카오의 **TLS 클라이언트**가 그 평문 응답을 보고
  "not an SSL/TLS record"로 연결을 끊었다.
- 결론: **카카오는 스킬 URL 스킴이 `http`여도 접속 자체를 TLS로 강제한다.** 평문 http 엔드포인트는
  프로토콜 단계에서 무조건 실패한다. → **HTTPS(유효 인증서) 필수가 실측으로 확정.**

## 확정 사항 (가설 → 확정 승격)

| 항목 | 이전 | 실측 후 |
|---|---|---|
| 스킬 URL 프로토콜 | HTTPS 실무 전제(문서 미명시) | **HTTPS(TLS) 강제 — 확정** |
| 평문 http 노출로 연동 | 미검증 | **불가**(TLS 핸드셰이크 실패) |
| 노출 수단(`d4`) | cloudflared / localhost.run 터널 | 유효 — **https 종단 터널이라야 함** |

→ 실측 단계 노출은 **https를 종단해주는 터널**(cloudflared quick tunnel: `https://<랜덤>.trycloudflare.com`,
또는 localhost.run)만 유효하다. `bore` 같은 평문 http 릴레이는 카카오 연동에 쓸 수 없다(디버깅 전용).

## 정리(cleanup)

이 실측용으로 임시 추가했던 것은 모두 원복·삭제했다.

- `docker-compose.yml`의 임시 `bore` 서비스(`--profile http-tunnel`)와 `SERVER_HOST_PORT` 파라미터화 → **원복**.
- 테스트 컨테이너 `sprint-kakao-bore`·`sprint-kakao-server` → **삭제**(`docker rm -f`).
- 재현이 필요하면 위 "방법" 블록의 명령을 일회성으로 다시 실행(파일에 남기지 않음).

## 출처

- 카카오 비즈니스 챗봇 가이드 · [스킬 만들기](https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/make_skill)
  — "스킬은 공인IP 또는 공중망 도메인만 사용 가능", "요청은 HTTP POST … 요청·응답 모두 JSON body", "타임아웃 5초 고정".
- 본 실측 로그(오픈빌더 스킬서버 전송, 2026-09-17 13:38): `not an SSL/TLS record` → **HTTPS 강제 직접 증거**.

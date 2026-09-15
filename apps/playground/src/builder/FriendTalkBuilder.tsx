import { useEffect, useMemo, useState } from "react";
import {
  FRIENDTALK_LIMITS,
  type FriendTalkButton,
  type FriendTalkButtonType,
  type FriendTalkMessage,
} from "@sprint-kakao/contract";
import { JsonEditor } from "./JsonEditor.js";

interface BtnDraft {
  name: string;
  type: FriendTalkButtonType;
  url: string;
}

const BTN_TYPES: { v: FriendTalkButtonType; label: string }[] = [
  { v: "WL", label: "WL 웹링크" },
  { v: "AL", label: "AL 앱링크" },
  { v: "BK", label: "BK 봇키워드" },
  { v: "MD", label: "MD 메시지전달" },
];

const IMG = "https://placehold.co/800x400/1b4db5/ffffff/png?text=friendtalk";

export function FriendTalkBuilder() {
  const [message, setMessage] = useState("강서구 복지도우미입니다.\n이번 달 신규 지원 제도를 확인해보세요!");
  const [adFlag, setAdFlag] = useState(true);
  const [useImage, setUseImage] = useState(true);
  const [imgUrl, setImgUrl] = useState(IMG);
  const [imgLink, setImgLink] = useState("https://example.com");
  const [buttons, setButtons] = useState<BtnDraft[]>([{ name: "자세히 보기", type: "WL", url: "https://example.com" }]);

  const template = useMemo<FriendTalkMessage>(() => {
    const btns: FriendTalkButton[] = buttons.map((b) =>
      b.type === "WL"
        ? { name: b.name, type: "WL", url_mobile: b.url, url_pc: b.url }
        : b.type === "AL"
          ? { name: b.name, type: "AL", scheme_android: b.url, scheme_ios: b.url }
          : { name: b.name, type: b.type },
    );
    return {
      message_type: "FT",
      message,
      ...(adFlag ? { ad_flag: true } : {}),
      ...(useImage && imgUrl ? { image: { img_url: imgUrl, ...(imgLink ? { img_link: imgLink } : {}) } } : {}),
      ...(buttons.length ? { buttons: btns } : {}),
    };
  }, [message, adFlag, useImage, imgUrl, imgLink, buttons]);

  const formJson = JSON.stringify(template, null, 2);
  const [draft, setDraft] = useState(formJson);
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(formJson);
    setJsonError(null);
  }, [formJson]);
  const parsed = useMemo<FriendTalkMessage | null>(() => {
    try {
      const o = JSON.parse(draft) as unknown;
      return o && typeof o === "object" ? (o as FriendTalkMessage) : null;
    } catch {
      return null;
    }
  }, [draft]);
  const effective = parsed ?? template;

  const warnings = validate(effective);

  function patch(i: number, p: Partial<BtnDraft>) {
    setButtons((bs) => bs.map((b, j) => (j === i ? { ...b, ...p } : b)));
  }

  return (
    <div className="builder">
      <div className="builder-form">
        <div className="ft-banner">친구톡 · 채널 친구 대상 발송 (비즈메시지). 발신프로필 확보 후 발송 연결.</div>

        <div className="field">
          <label>본문 (message) — {message.length}/{FRIENDTALK_LIMITS.textMax}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        </div>

        <label className="check">
          <input type="checkbox" checked={adFlag} onChange={(e) => setAdFlag(e.target.checked)} /> 광고성 메시지 (광고 표기·수신거부 노출)
        </label>

        <label className="check">
          <input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} /> 이미지 첨부
        </label>
        {useImage && (
          <>
            <div className="field"><label>img_url</label><input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} /></div>
            <div className="field"><label>img_link (클릭 이동)</label><input value={imgLink} onChange={(e) => setImgLink(e.target.value)} /></div>
          </>
        )}

        <div className="field">
          <label>버튼 ({buttons.length}/{FRIENDTALK_LIMITS.buttonsMax})</label>
          {buttons.map((b, i) => (
            <div className="subcard" key={i}>
              <div className="btn-row">
                <input value={b.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="라벨(name)" />
                <select value={b.type} onChange={(e) => patch(i, { type: e.target.value as FriendTalkButtonType })}>
                  {BTN_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
                <button className="mini danger" onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))}>✕</button>
              </div>
              {(b.type === "WL" || b.type === "AL") && (
                <input value={b.url} onChange={(e) => patch(i, { url: e.target.value })} placeholder={b.type === "WL" ? "web url" : "app scheme"} />
              )}
            </div>
          ))}
          {buttons.length < FRIENDTALK_LIMITS.buttonsMax && (
            <button className="mini" onClick={() => setButtons((bs) => [...bs, { name: "버튼", type: "WL", url: "https://example.com" }])}>+ 버튼 추가</button>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="warnings">{warnings.map((w, i) => <div key={i} className="warning">⚠️ {w}</div>)}</div>
        )}
      </div>

      <div className="builder-preview">
        <div className="preview-label">미리보기 {parsed && parsed !== template ? "(수정된 JSON 기준)" : ""}</div>
        <div className="kakao-msg"><FriendTalkPreview t={effective} /></div>
        <div className="preview-label">친구톡 콘텐츠 JSON — 직접 수정 가능</div>
        <JsonEditor
          value={draft}
          error={jsonError}
          onChange={(v) => {
            setDraft(v);
            try { JSON.parse(v); setJsonError(null); } catch (err) { setJsonError(err instanceof Error ? err.message : String(err)); }
          }}
        />
        <div className="ft-note">
          발송 봉투(sender_key·phone_number·엔드포인트)는 발신프로필·발송 경로가 정해지면 이 콘텐츠에 감싸 완성합니다.
        </div>
      </div>
    </div>
  );
}

function FriendTalkPreview({ t }: { t: FriendTalkMessage }) {
  return (
    <div className="bot-turn">
      <div className="ft-profile">🟡 강서구 AI 복지도우미</div>
      <div className="ft-card">
        {t.ad_flag && <div className="ft-ad">(광고)</div>}
        {t.image?.img_url && <img className="ft-img" src={t.image.img_url} alt="" />}
        <div className="ft-text">{t.message || "(본문 없음)"}</div>
        {t.buttons?.length ? (
          <div className="ft-btns">
            {t.buttons.map((b, i) => (
              <button key={i} className="ft-btn" onClick={() => b.url_mobile && window.open(b.url_mobile, "_blank")}>{b.name}</button>
            ))}
          </div>
        ) : null}
        {t.ad_flag && <div className="ft-optout">무료수신거부</div>}
      </div>
    </div>
  );
}

function validate(t: FriendTalkMessage): string[] {
  const w: string[] = [];
  const msg = t.message ?? "";
  if (!msg.trim()) w.push("message(본문)가 비어 있음");
  if (msg.length > FRIENDTALK_LIMITS.textMax) w.push(`message ${msg.length}자 > ${FRIENDTALK_LIMITS.textMax}자`);
  if ((t.buttons?.length ?? 0) > FRIENDTALK_LIMITS.buttonsMax) w.push(`버튼 ${t.buttons?.length}개 > 최대 ${FRIENDTALK_LIMITS.buttonsMax}개`);
  if (t.image && !t.image.img_url) w.push("image.img_url은 필수");
  t.buttons?.forEach((b, i) => {
    if (!b.name?.trim()) w.push(`buttons[${i}].name 필수`);
    if (b.type === "WL" && !b.url_mobile) w.push(`buttons[${i}](WL) url_mobile 필요`);
  });
  return w;
}

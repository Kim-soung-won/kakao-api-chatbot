import type {
  CalendarTemplate,
  Commerce,
  CommerceTemplate,
  FeedContent,
  FeedTemplate,
  ListTemplate,
  LocationTemplate,
  MessageTemplate,
  MsgButton,
  TextTemplate,
} from "@sprint-kakao/contract";

const open = (url?: string) => url && window.open(url, "_blank");
// 직접 편집된 JSON은 필드가 없을 수 있어 방어적으로 접근한다.
const EMPTY_CONTENT = {} as FeedContent;

function Buttons({ buttons }: { buttons?: MsgButton[] }) {
  if (!buttons?.length) return null;
  return (
    <div className="msg-btns">
      {buttons.map((b, i) => (
        <button key={i} className="msg-btn" onClick={() => open(b?.link?.web_url)}>{b?.title || "버튼"}</button>
      ))}
    </div>
  );
}

/** 카카오 메시지 template object → 카카오톡 카드 미리보기 라우터. */
export function MessagePreview({ t }: { t: MessageTemplate }) {
  switch (t?.object_type) {
    case "text": return <TextPreview t={t} />;
    case "list": return <ListPreview t={t} />;
    case "commerce": return <CommercePreview t={t} />;
    case "location": return <LocationPreview t={t} />;
    case "calendar": return <CalendarPreview t={t} />;
    case "feed": return <FeedPreview t={t} />;
    default: return <div className="msg-card"><div className="msg-body"><div className="msg-desc">알 수 없는 object_type</div></div></div>;
  }
}

function FeedPreview({ t }: { t: FeedTemplate }) {
  const c = t.content ?? EMPTY_CONTENT;
  return (
    <div className="msg-card">
      {c.image_url && <img className="msg-img" src={c.image_url} alt="" />}
      <div className="msg-body">
        <div className="msg-title">{c.title || "(제목 없음)"}</div>
        {c.description && <div className="msg-desc">{c.description}</div>}
        {t.social && (
          <div className="msg-social">
            {t.social.like_count ? <span>♥ {t.social.like_count}</span> : null}
            {t.social.view_count ? <span>👁 {t.social.view_count}</span> : null}
          </div>
        )}
      </div>
      <Buttons buttons={t.buttons} />
    </div>
  );
}

function TextPreview({ t }: { t: TextTemplate }) {
  return (
    <div className="msg-card">
      <div className="msg-body"><div className="msg-text">{t.text || "(본문 없음)"}</div></div>
      {t.button_title && (
        <div className="msg-btns">
          <button className="msg-btn" onClick={() => open(t.link?.web_url)}>{t.button_title}</button>
        </div>
      )}
    </div>
  );
}

function ListPreview({ t }: { t: ListTemplate }) {
  return (
    <div className="msg-card">
      <div className="msg-list-header">{t.header_title || "(헤더 없음)"}</div>
      {(t.contents ?? []).map((c, i) => (
        <button key={i} className="msg-list-item" onClick={() => open(c?.link?.web_url)}>
          <span className="msg-list-text">
            <span className="msg-list-title">{c?.title || "(제목)"}</span>
            {c?.description && <span className="msg-list-desc">{c.description}</span>}
          </span>
          {c?.image_url && <img className="msg-list-thumb" src={c.image_url} alt="" />}
        </button>
      ))}
      <Buttons buttons={t.buttons} />
    </div>
  );
}

function CommercePreview({ t }: { t: CommerceTemplate }) {
  const c = t.content ?? EMPTY_CONTENT;
  const m: Commerce = t.commerce ?? { regular_price: 0 };
  const unit = m.currency_unit ?? "원";
  const regular = Number(m.regular_price) || 0;
  const final = m.discount_price != null ? Number(m.discount_price) : regular;
  return (
    <div className="msg-card">
      {c.image_url && <img className="msg-img" src={c.image_url} alt="" />}
      <div className="msg-body">
        <div className="msg-title">{c.title || "(상품명 없음)"}</div>
        <div className="msg-price">
          {m.discount_rate ? <span className="msg-rate">{m.discount_rate}%</span> : null}
          <span className="msg-final">{final.toLocaleString()}{unit}</span>
          {m.discount_price != null ? <span className="msg-regular">{regular.toLocaleString()}{unit}</span> : null}
        </div>
      </div>
      <Buttons buttons={t.buttons} />
    </div>
  );
}

function LocationPreview({ t }: { t: LocationTemplate }) {
  const c = t.content ?? EMPTY_CONTENT;
  return (
    <div className="msg-card">
      {c.image_url && <img className="msg-img" src={c.image_url} alt="" />}
      <div className="msg-body">
        <div className="msg-title">{c.title || "(제목 없음)"}</div>
        {c.description && <div className="msg-desc">{c.description}</div>}
        <div className="msg-addr">📍 {t.address_title ? `${t.address_title} · ` : ""}{t.address || "(주소 없음)"}</div>
      </div>
      <Buttons buttons={t.buttons} />
    </div>
  );
}

function CalendarPreview({ t }: { t: CalendarTemplate }) {
  const c = t.content ?? EMPTY_CONTENT;
  const fallback: MsgButton[] = [{ title: t.id_type === "calendar" ? "캘린더 구독하기" : "일정 등록하기", link: {} }];
  return (
    <div className="msg-card">
      {c.image_url && <img className="msg-img" src={c.image_url} alt="" />}
      <div className="msg-body">
        <div className="msg-badge">🗓 {t.id_type === "calendar" ? "구독 캘린더" : "공개 일정"}</div>
        <div className="msg-title">{c.title || "(제목 없음)"}</div>
        {c.description && <div className="msg-desc">{c.description}</div>}
      </div>
      <Buttons buttons={t.buttons?.length ? t.buttons : fallback} />
    </div>
  );
}

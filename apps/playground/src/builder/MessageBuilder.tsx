import { useEffect, useMemo, useState } from "react";
import {
  MESSAGE_LIMITS,
  type CalendarTemplate,
  type CarouselFeedItem,
  type CarouselTemplate,
  type CommerceTemplate,
  type FeedContent,
  type FeedTemplate,
  type ListItemContent,
  type ListTemplate,
  type LocationTemplate,
  type MessageObjectType,
  type MessageTemplate,
  type MsgButton,
  type TextTemplate,
} from "@sprint-kakao/contract";
import { MessagePreview } from "./preview.js";
import { JsonEditor } from "./JsonEditor.js";

interface ButtonDraft {
  title: string;
  webUrl: string;
}
interface ListDraft {
  title: string;
  description: string;
  imageUrl: string;
  webUrl: string;
}

const IMG = "https://placehold.co/640x640/1b4db5/ffffff/png?text=card";

const TYPES: { key: MessageObjectType; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "text", label: "Text" },
  { key: "list", label: "List" },
  { key: "commerce", label: "Commerce" },
  { key: "location", label: "Location" },
  { key: "calendar", label: "Calendar" },
  { key: "carousel", label: "Carousel" },
];

const toButtons = (bs: ButtonDraft[]): MsgButton[] =>
  bs.map((b) => ({ title: b.title, link: { web_url: b.webUrl } }));

const content = (title: string, description: string, imageUrl: string, webUrl: string): FeedContent => ({
  title,
  ...(description ? { description } : {}),
  ...(imageUrl ? { image_url: imageUrl, image_width: 640, image_height: 640 } : {}),
  link: { web_url: webUrl || "https://example.com" },
});

export function MessageBuilder() {
  const [objectType, setObjectType] = useState<MessageObjectType>("feed");

  // 공용 콘텐츠 필드 (feed/commerce/location/calendar)
  const [title, setTitle] = useState("강서구 복지 알림");
  const [description, setDescription] = useState("보육료 지원 신청이 시작됐어요. 지금 확인해보세요.");
  const [imageUrl, setImageUrl] = useState(IMG);
  const [webUrl, setWebUrl] = useState("https://example.com");
  const [buttons, setButtons] = useState<ButtonDraft[]>([{ title: "자세히 보기", webUrl: "https://example.com" }]);

  // feed
  const [showSocial, setShowSocial] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  // text
  const [text, setText] = useState("강서구 복지도우미입니다. 이번 달 신규 지원 제도를 확인하세요.");
  const [buttonTitle, setButtonTitle] = useState("바로 확인");
  // list
  const [headerTitle, setHeaderTitle] = useState("이번 주 복지 소식");
  const [listContents, setListContents] = useState<ListDraft[]>([
    { title: "보육료 지원", description: "월 최대 51만원", imageUrl: IMG, webUrl: "https://example.com/1" },
    { title: "교육활동비", description: "연 최대 30만원", imageUrl: IMG, webUrl: "https://example.com/2" },
  ]);
  // commerce
  const [regularPrice, setRegularPrice] = useState(208800);
  const [discountPrice, setDiscountPrice] = useState(146160);
  const [discountRate, setDiscountRate] = useState(30);
  const [currencyUnit, setCurrencyUnit] = useState("원");
  // location
  const [address, setAddress] = useState("경기 성남시 분당구 판교역로 235");
  const [addressTitle, setAddressTitle] = useState("카카오 판교오피스");
  // calendar
  const [idType, setIdType] = useState<"event" | "calendar">("event");
  const [calId, setCalId] = useState("6351f57c7ec8e318d0b809a0");
  // carousel (feed)
  const [carouselItems, setCarouselItems] = useState<ListDraft[]>([
    { title: "보육료 지원", description: "월 최대 51만원", imageUrl: IMG, webUrl: "https://example.com/1" },
    { title: "교육활동비", description: "연 최대 30만원", imageUrl: IMG, webUrl: "https://example.com/2" },
  ]);
  const [tailUrl, setTailUrl] = useState("");

  const template = useMemo<MessageTemplate>(() => {
    const btns = buttons.length ? { buttons: toButtons(buttons) } : {};
    const c = content(title, description, imageUrl, webUrl);
    switch (objectType) {
      case "text": {
        const t: TextTemplate = {
          object_type: "text",
          text,
          link: { web_url: webUrl || "https://example.com" },
          ...(buttonTitle ? { button_title: buttonTitle } : {}),
        };
        return t;
      }
      case "list": {
        const t: ListTemplate = {
          object_type: "list",
          header_title: headerTitle,
          header_link: { web_url: webUrl || "https://example.com" },
          contents: listContents.map(
            (it): ListItemContent => ({
              title: it.title,
              ...(it.description ? { description: it.description } : {}),
              ...(it.imageUrl ? { image_url: it.imageUrl } : {}),
              link: { web_url: it.webUrl || "https://example.com" },
            }),
          ),
          ...btns,
        };
        return t;
      }
      case "commerce": {
        const t: CommerceTemplate = {
          object_type: "commerce",
          content: c,
          commerce: {
            regular_price: regularPrice,
            ...(discountPrice ? { discount_price: discountPrice } : {}),
            ...(discountRate ? { discount_rate: discountRate } : {}),
            ...(currencyUnit ? { currency_unit: currencyUnit } : {}),
          },
          ...btns,
        };
        return t;
      }
      case "location": {
        const t: LocationTemplate = {
          object_type: "location",
          address,
          ...(addressTitle ? { address_title: addressTitle } : {}),
          content: c,
          ...btns,
        };
        return t;
      }
      case "calendar": {
        const t: CalendarTemplate = {
          object_type: "calendar",
          id_type: idType,
          id: calId,
          content: c,
          ...btns,
        };
        return t;
      }
      case "carousel": {
        const t: CarouselTemplate = {
          object_type: "carousel",
          type: "feed",
          items: carouselItems.map(
            (it): CarouselFeedItem => ({
              title: it.title,
              ...(it.description ? { description: it.description } : {}),
              ...(it.imageUrl ? { image_url: it.imageUrl } : {}),
              link: { web_url: it.webUrl || "https://example.com" },
            }),
          ),
          ...(tailUrl ? { tail: { link: { web_url: tailUrl } } } : {}),
        };
        return t;
      }
      default: {
        const t: FeedTemplate = {
          object_type: "feed",
          content: c,
          ...(showSocial
            ? { social: { ...(likeCount ? { like_count: likeCount } : {}), ...(viewCount ? { view_count: viewCount } : {}) } }
            : {}),
          ...btns,
        };
        return t;
      }
    }
  }, [objectType, title, description, imageUrl, webUrl, buttons, showSocial, likeCount, viewCount, text, buttonTitle, headerTitle, listContents, regularPrice, discountPrice, discountRate, currencyUnit, address, addressTitle, idType, calId, carouselItems, tailUrl]);

  // 발송 JSON: 폼을 만지면 formJson이 바뀌어 draft를 재생성하고,
  // 사용자가 JSON을 직접 편집하면 그 편집본(parsed)이 미리보기·검증을 구동한다.
  // ⚠️ 동기화 effect의 의존성은 template 객체가 아니라 stringify한 formJson(값)이어야 한다.
  // React가 useMemo 캐시를 버리고 template을 재계산하면 새 참조가 생기는데,
  // 객체를 dep으로 쓰면 폼을 안 건드려도 effect가 실행돼 수동 편집을 덮어쓴다.
  const formJson = JSON.stringify(template, null, 2);
  const [draft, setDraft] = useState(formJson);
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(formJson);
    setJsonError(null);
  }, [formJson]);
  const parsed = useMemo<MessageTemplate | null>(() => {
    try {
      const o = JSON.parse(draft) as unknown;
      return o && typeof o === "object" && typeof (o as { object_type?: unknown }).object_type === "string"
        ? (o as MessageTemplate)
        : null;
    } catch {
      return null;
    }
  }, [draft]);
  const effective = parsed ?? template;

  const warnings = validateMessage(effective);
  const usesContent = objectType === "feed" || objectType === "commerce" || objectType === "location" || objectType === "calendar";
  const usesButtons = objectType !== "text" && objectType !== "carousel";

  return (
    <div className="builder">
      <div className="builder-form">
        <div className="seg seg-wrap">
          {TYPES.map((t) => (
            <button key={t.key} className={objectType === t.key ? "on" : ""} onClick={() => setObjectType(t.key)}>{t.label}</button>
          ))}
        </div>

        {objectType === "text" && (
          <>
            <Field label={`본문 (text) — ${text.length}/${MESSAGE_LIMITS.textMax}`}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            </Field>
            <Field label="링크 (web_url)"><input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} /></Field>
            <Field label="버튼 타이틀 (button_title)"><input value={buttonTitle} onChange={(e) => setButtonTitle(e.target.value)} placeholder="비우면 버튼 없음" /></Field>
          </>
        )}

        {objectType === "list" && (
          <>
            <Field label="헤더 제목 (header_title)"><input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} /></Field>
            <Field label="헤더 링크 (header_link.web_url)"><input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} /></Field>
            <div className="field">
              <label>항목 (contents) — {listContents.length}/{MESSAGE_LIMITS.listContentsMax} (최소 {MESSAGE_LIMITS.listContentsMin})</label>
              {listContents.map((it, i) => (
                <div className="subcard" key={i}>
                  <div className="btn-row">
                    <input value={it.title} onChange={(e) => patchList(i, { title: e.target.value })} placeholder="title" />
                    {listContents.length > MESSAGE_LIMITS.listContentsMin && (
                      <button className="mini danger" onClick={() => setListContents((l) => l.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                  <input value={it.description} onChange={(e) => patchList(i, { description: e.target.value })} placeholder="description" />
                  <div className="btn-row">
                    <input value={it.imageUrl} onChange={(e) => patchList(i, { imageUrl: e.target.value })} placeholder="image_url" />
                    <input value={it.webUrl} onChange={(e) => patchList(i, { webUrl: e.target.value })} placeholder="link" />
                  </div>
                </div>
              ))}
              {listContents.length < MESSAGE_LIMITS.listContentsMax && (
                <button className="mini" onClick={() => setListContents((l) => [...l, { title: "새 항목", description: "", imageUrl: IMG, webUrl: "https://example.com" }])}>+ 항목 추가</button>
              )}
            </div>
          </>
        )}

        {objectType === "location" && (
          <>
            <Field label="주소 (address)"><input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label="주소 제목 (address_title)"><input value={addressTitle} onChange={(e) => setAddressTitle(e.target.value)} /></Field>
          </>
        )}

        {objectType === "calendar" && (
          <>
            <Field label="유형 (id_type)">
              <select value={idType} onChange={(e) => setIdType(e.target.value as "event" | "calendar")}>
                <option value="event">event (공개 일정)</option>
                <option value="calendar">calendar (구독 캘린더)</option>
              </select>
            </Field>
            <Field label="ID (id)"><input value={calId} onChange={(e) => setCalId(e.target.value)} /></Field>
          </>
        )}

        {objectType === "carousel" && (
          <>
            <div className="field">
              <label>카드 (items) — {carouselItems.length}/{MESSAGE_LIMITS.carouselItemsMax} (최소 {MESSAGE_LIMITS.carouselItemsMin})</label>
              {carouselItems.map((it, i) => (
                <div className="subcard" key={i}>
                  <div className="btn-row">
                    <input value={it.title} onChange={(e) => patchCarousel(i, { title: e.target.value })} placeholder="title" />
                    {carouselItems.length > MESSAGE_LIMITS.carouselItemsMin && (
                      <button className="mini danger" onClick={() => setCarouselItems((l) => l.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                  <input value={it.description} onChange={(e) => patchCarousel(i, { description: e.target.value })} placeholder="description" />
                  <div className="btn-row">
                    <input value={it.imageUrl} onChange={(e) => patchCarousel(i, { imageUrl: e.target.value })} placeholder="image_url" />
                    <input value={it.webUrl} onChange={(e) => patchCarousel(i, { webUrl: e.target.value })} placeholder="link" />
                  </div>
                </div>
              ))}
              {carouselItems.length < MESSAGE_LIMITS.carouselItemsMax && (
                <button className="mini" onClick={() => setCarouselItems((l) => [...l, { title: "새 카드", description: "", imageUrl: IMG, webUrl: "https://example.com" }])}>+ 카드 추가</button>
              )}
            </div>
            <Field label="tail 공통 버튼 링크 (선택)"><input value={tailUrl} onChange={(e) => setTailUrl(e.target.value)} placeholder="비우면 tail 없음" /></Field>
          </>
        )}

        {usesContent && (
          <>
            <Field label="제목 (content.title)"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="설명 (description)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
            <Field label="이미지 URL (image_url)"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="비우면 이미지 없음" /></Field>
            <Field label="링크 (content.link.web_url)"><input value={webUrl} onChange={(e) => setWebUrl(e.target.value)} /></Field>
          </>
        )}

        {objectType === "commerce" && (
          <div className="field">
            <label>가격 (commerce)</label>
            <div className="btn-row">
              <input type="number" value={regularPrice} onChange={(e) => setRegularPrice(Number(e.target.value))} placeholder="regular_price" />
              <input type="number" value={discountPrice} onChange={(e) => setDiscountPrice(Number(e.target.value))} placeholder="discount_price" />
            </div>
            <div className="btn-row">
              <input type="number" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} placeholder="discount_rate %" />
              <input value={currencyUnit} onChange={(e) => setCurrencyUnit(e.target.value)} placeholder="currency_unit" />
            </div>
          </div>
        )}

        {objectType === "feed" && (
          <>
            <label className="check">
              <input type="checkbox" checked={showSocial} onChange={(e) => setShowSocial(e.target.checked)} /> 소셜 지표 표시
            </label>
            {showSocial && (
              <div className="btn-row">
                <input type="number" value={likeCount} onChange={(e) => setLikeCount(Number(e.target.value))} placeholder="like_count" />
                <input type="number" value={viewCount} onChange={(e) => setViewCount(Number(e.target.value))} placeholder="view_count" />
              </div>
            )}
          </>
        )}

        {usesButtons && (
          <div className="field">
            <label>버튼 ({buttons.length}/{MESSAGE_LIMITS.buttonsMax})</label>
            {buttons.map((b, i) => (
              <div className="btn-row" key={i}>
                <input value={b.title} onChange={(e) => patchBtn(i, { title: e.target.value })} placeholder="라벨" />
                <input value={b.webUrl} onChange={(e) => patchBtn(i, { webUrl: e.target.value })} placeholder="web_url" />
                <button className="mini danger" onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {buttons.length < MESSAGE_LIMITS.buttonsMax && (
              <button className="mini" onClick={() => setButtons((bs) => [...bs, { title: "버튼", webUrl: "https://example.com" }])}>+ 버튼 추가</button>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="warnings">
            {warnings.map((w, i) => <div key={i} className="warning">⚠️ {w}</div>)}
          </div>
        )}
      </div>

      <div className="builder-preview">
        <div className="preview-label">미리보기 {parsed && parsed !== template ? "(수정된 JSON 기준)" : ""}</div>
        <div className="kakao-msg"><MessagePreview t={effective} /></div>
        <div className="preview-label">발송 JSON — 직접 수정 가능</div>
        <JsonEditor
          value={draft}
          error={jsonError}
          onChange={(v) => {
            setDraft(v);
            try {
              JSON.parse(v);
              setJsonError(null);
            } catch (err) {
              setJsonError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
        {jsonError && <div className="warning">⚠️ JSON 파싱 오류: {jsonError} (미리보기는 마지막 정상 값 유지)</div>}
        <div className="btn-row">
          <button className="mini" onClick={() => void navigator.clipboard?.writeText(draft)}>JSON 복사</button>
          <button className="mini" onClick={() => { setDraft(JSON.stringify(template, null, 2)); setJsonError(null); }}>폼 값으로 되돌리기</button>
        </div>
      </div>
    </div>
  );

  function patchBtn(i: number, p: Partial<ButtonDraft>) {
    setButtons((bs) => bs.map((b, j) => (j === i ? { ...b, ...p } : b)));
  }
  function patchList(i: number, p: Partial<ListDraft>) {
    setListContents((l) => l.map((it, j) => (j === i ? { ...it, ...p } : it)));
  }
  function patchCarousel(i: number, p: Partial<ListDraft>) {
    setCarouselItems((l) => l.map((it, j) => (j === i ? { ...it, ...p } : it)));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function validateMessage(t: MessageTemplate): string[] {
  const w: string[] = [];
  const buttons = "buttons" in t ? t.buttons : undefined;
  if (buttons && buttons.length > MESSAGE_LIMITS.buttonsMax) w.push(`버튼 ${buttons.length}개 > 최대 ${MESSAGE_LIMITS.buttonsMax}개`);

  switch (t.object_type) {
    case "text": {
      const text = t.text ?? "";
      if (text.length > MESSAGE_LIMITS.textMax) w.push(`text ${text.length}자 > ${MESSAGE_LIMITS.textMax}자`);
      if (!text.trim()) w.push("text가 비어 있음");
      break;
    }
    case "list": {
      if (!t.header_title?.trim()) w.push("header_title은 필수");
      const n = t.contents?.length ?? 0;
      if (n < MESSAGE_LIMITS.listContentsMin) w.push(`contents ${n}개 < 최소 ${MESSAGE_LIMITS.listContentsMin}개`);
      if (n > MESSAGE_LIMITS.listContentsMax) w.push(`contents ${n}개 > 최대 ${MESSAGE_LIMITS.listContentsMax}개`);
      t.contents?.forEach((c, i) => { if (!c?.title?.trim()) w.push(`contents[${i}].title 필수`); });
      break;
    }
    case "commerce":
      if (!t.content?.title?.trim()) w.push("content.title 필수");
      if (!(Number(t.commerce?.regular_price) > 0)) w.push("commerce.regular_price는 0보다 커야 함");
      break;
    case "location":
      if (!t.address?.trim()) w.push("address는 필수");
      if (!t.content?.title?.trim()) w.push("content.title 필수");
      break;
    case "calendar":
      if (!t.id?.trim()) w.push("id는 필수");
      break;
    case "carousel": {
      const n = t.items?.length ?? 0;
      if (n < MESSAGE_LIMITS.carouselItemsMin) w.push(`items ${n}개 < 최소 ${MESSAGE_LIMITS.carouselItemsMin}개`);
      if (n > MESSAGE_LIMITS.carouselItemsMax) w.push(`items ${n}개 > 최대 ${MESSAGE_LIMITS.carouselItemsMax}개`);
      t.items?.forEach((it, i) => { if (!it?.title?.trim()) w.push(`items[${i}].title 필수`); });
      break;
    }
    default:
      if (!t.content?.title?.trim()) w.push("content.title은 필수");
      if (!t.content?.link?.web_url) w.push("content.link에 web_url이 필요");
  }
  return w;
}

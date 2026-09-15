/**
 * SkillResponse → 카카오톡 채팅창 흉내 렌더러.
 * kakao-skill-response_domain 스킬의 컴포넌트 구조를 그대로 그린다.
 */
import type {
  BasicCard,
  Button,
  Carousel,
  CommerceCard,
  ItemCard,
  ListCard,
  Output,
  QuickReply,
  SkillResponse,
  TextCard,
} from "@sprint-kakao/contract";

export interface RendererProps {
  response: SkillResponse;
  /** 버튼/바로가기의 message·block action 클릭 시 후속 발화를 시뮬레이션. */
  onAction: (utterance: string, meta?: Record<string, unknown>) => void;
}

function Buttons({ buttons, onAction, layout }: { buttons?: Button[]; onAction: RendererProps["onAction"]; layout?: "horizontal" | "vertical" }) {
  if (!buttons?.length) return null;
  return (
    <div className={`btns ${layout === "horizontal" ? "btns-h" : "btns-v"}`}>
      {buttons.map((b, i) => (
        <button
          key={i}
          className={`btn btn-${b.action}`}
          onClick={() => {
            if (b.action === "message") onAction(b.messageText);
            else if (b.action === "block") onAction(b.label, { blockId: b.blockId, extra: b.extra });
            else if (b.action === "webLink") window.open(b.webLinkUrl, "_blank");
          }}
          title={b.action}
        >
          {b.action === "webLink" && "🔗 "}
          {b.action === "phone" && "📞 "}
          {b.action === "share" && "↗ "}
          {b.action === "operator" && "🧑‍💼 "}
          {b.label}
        </button>
      ))}
    </div>
  );
}

function TextCardView({ card, onAction }: { card: TextCard; onAction: RendererProps["onAction"] }) {
  return (
    <div className="card">
      <div className="card-body">
        {card.title && <div className="card-title">{card.title}</div>}
        {card.description && <div className="card-desc">{card.description}</div>}
      </div>
      <Buttons buttons={card.buttons} onAction={onAction} layout={card.buttonLayout} />
    </div>
  );
}

function CommerceCardView({ card, onAction }: { card: CommerceCard; onAction: RendererProps["onAction"] }) {
  const unit = card.currency === "won" || !card.currency ? "원" : ` ${card.currency}`;
  const final = card.discountedPrice ?? card.price;
  return (
    <div className="card">
      {card.thumbnails?.[0]?.imageUrl && (
        <img className="card-img ratio-2-1" src={card.thumbnails[0].imageUrl} alt="" />
      )}
      <div className="card-body">
        {card.title && <div className="card-title">{card.title}</div>}
        {card.description && <div className="card-desc">{card.description}</div>}
        <div className="commerce-price">
          {card.discountRate ? <span className="commerce-rate">{card.discountRate}%</span> : null}
          <span className="commerce-final">{final.toLocaleString()}{unit}</span>
          {card.discountedPrice != null ? (
            <span className="commerce-regular">{card.price.toLocaleString()}{unit}</span>
          ) : null}
        </div>
        {card.profile && <div className="commerce-profile">{card.profile.nickname}</div>}
      </div>
      <Buttons buttons={card.buttons} onAction={onAction} layout={card.buttonLayout} />
    </div>
  );
}

function BasicCardView({ card, onAction }: { card: BasicCard; onAction: RendererProps["onAction"] }) {
  const layout = card.thumbnail?.fixedRatio ? "horizontal" : card.buttonLayout ?? "vertical";
  return (
    <div className="card">
      {card.thumbnail && (
        <img
          className={`card-img ${card.thumbnail.fixedRatio ? "ratio-1-1" : "ratio-2-1"}`}
          src={card.thumbnail.imageUrl}
          alt={card.thumbnail.altText ?? ""}
        />
      )}
      <div className="card-body">
        {card.title && <div className="card-title">{card.title}</div>}
        {card.description && <div className="card-desc">{card.description}</div>}
      </div>
      <Buttons buttons={card.buttons} onAction={onAction} layout={layout} />
    </div>
  );
}

function ListCardView({ card, onAction }: { card: ListCard; onAction: RendererProps["onAction"] }) {
  return (
    <div className="card">
      <div className="list-header">{card.header.title}</div>
      {card.items.map((it, i) => (
        <button
          key={i}
          className="list-item"
          onClick={() => {
            if (it.action === "message" && it.messageText) onAction(it.messageText);
            else if (it.action === "block" && it.blockId) onAction(it.title, { blockId: it.blockId, extra: it.extra });
            else if (it.link?.web) window.open(it.link.web, "_blank");
          }}
        >
          {it.imageUrl && <img className="list-thumb" src={it.imageUrl} alt="" />}
          <span className="list-text">
            <span className="list-title">{it.title}</span>
            {it.description && <span className="list-desc">{it.description}</span>}
          </span>
        </button>
      ))}
      <Buttons buttons={card.buttons} onAction={onAction} />
    </div>
  );
}

function ItemCardView({ card, onAction }: { card: ItemCard; onAction: RendererProps["onAction"] }) {
  return (
    <div className="card itemcard">
      {card.thumbnail && (
        <div className="itemcard-hero">
          <img className="card-img" src={card.thumbnail.imageUrl} alt="" />
          {card.head && <span className="itemcard-badge">{card.head.title}</span>}
        </div>
      )}
      {card.profile && (
        <div className="itemcard-profile">
          {card.profile.imageUrl && <img src={card.profile.imageUrl} alt="" />}
          <span>{card.profile.title}</span>
        </div>
      )}
      <div className="card-body">
        {card.imageTitle && (
          <div className="itemcard-imagetitle">
            {card.imageTitle.imageUrl && <img src={card.imageTitle.imageUrl} alt="" />}
            <div>
              <div className="card-title">{card.imageTitle.title}</div>
              {card.imageTitle.description && <div className="card-desc">{card.imageTitle.description}</div>}
            </div>
          </div>
        )}
        {card.title && <div className="card-title">{card.title}</div>}
        {card.itemList.length > 0 && (
          <div className={`itemcard-list ${card.itemListAlignment === "right" ? "align-right" : ""}`}>
            {card.itemList.map((row, i) => (
              <div className="itemcard-row" key={i}>
                <span className="row-title">{row.title}</span>
                <span className="row-desc">{row.description}</span>
              </div>
            ))}
            {card.itemListSummary && (
              <div className="itemcard-row summary">
                <span className="row-title">{card.itemListSummary.title}</span>
                <span className="row-desc">{card.itemListSummary.description}</span>
              </div>
            )}
          </div>
        )}
        {card.description && <div className="card-desc">{card.description}</div>}
      </div>
      <Buttons buttons={card.buttons} onAction={onAction} layout={card.buttonLayout} />
    </div>
  );
}

function CarouselView({ carousel, onAction }: { carousel: Carousel; onAction: RendererProps["onAction"] }) {
  return (
    <div className="carousel">
      {carousel.type === "basicCard" &&
        (carousel.items as BasicCard[]).map((c, i) => (
          <div className="carousel-cell" key={i}><BasicCardView card={c} onAction={onAction} /></div>
        ))}
      {carousel.type === "listCard" &&
        (carousel.items as ListCard[]).map((c, i) => (
          <div className="carousel-cell" key={i}><ListCardView card={c} onAction={onAction} /></div>
        ))}
      {carousel.type === "itemCard" &&
        (carousel.items as ItemCard[]).map((c, i) => (
          <div className="carousel-cell" key={i}><ItemCardView card={c} onAction={onAction} /></div>
        ))}
      {carousel.type === "commerceCard" &&
        (carousel.items as CommerceCard[]).map((c, i) => (
          <div className="carousel-cell" key={i}><CommerceCardView card={c} onAction={onAction} /></div>
        ))}
    </div>
  );
}

function OutputView({ output, onAction }: { output: Output; onAction: RendererProps["onAction"] }) {
  if ("simpleText" in output) return <div className="bubble text">{output.simpleText.text}</div>;
  if ("simpleImage" in output)
    return (
      <div className="bubble img">
        <img src={output.simpleImage.imageUrl} alt={output.simpleImage.altText ?? ""} />
      </div>
    );
  if ("textCard" in output) return <div className="bubble"><TextCardView card={output.textCard} onAction={onAction} /></div>;
  if ("basicCard" in output) return <div className="bubble"><BasicCardView card={output.basicCard} onAction={onAction} /></div>;
  if ("commerceCard" in output) return <div className="bubble"><CommerceCardView card={output.commerceCard} onAction={onAction} /></div>;
  if ("listCard" in output) return <div className="bubble"><ListCardView card={output.listCard} onAction={onAction} /></div>;
  if ("itemCard" in output) return <div className="bubble"><ItemCardView card={output.itemCard} onAction={onAction} /></div>;
  if ("carousel" in output) return <div className="bubble wide"><CarouselView carousel={output.carousel} onAction={onAction} /></div>;
  return <div className="bubble text err">알 수 없는 출력 컴포넌트</div>;
}

function QuickReplies({ items, onAction }: { items?: QuickReply[]; onAction: RendererProps["onAction"] }) {
  if (!items?.length) return null;
  return (
    <div className="quick-replies">
      {items.map((q, i) => (
        <button
          key={i}
          className="quick-reply"
          onClick={() => {
            if (q.action === "message") onAction(q.messageText);
            else onAction(q.label, { blockId: q.blockId, extra: q.extra });
          }}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

export function KakaoRenderer({ response, onAction }: RendererProps) {
  return (
    <div className="bot-turn">
      {(response.template?.outputs ?? []).map((o, i) => (
        <OutputView key={i} output={o} onAction={onAction} />
      ))}
      <QuickReplies items={response.template?.quickReplies} onAction={onAction} />
    </div>
  );
}

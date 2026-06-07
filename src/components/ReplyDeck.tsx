import {
  BadgeHelp,
  ClipboardCheck,
  FileSearch,
  Gift,
  MessageCircle,
  ShieldX,
  Siren,
  Truck,
  UserCheck,
  SendHorizontal,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { FormEvent, KeyboardEvent, memo, useState } from "react";
import type { ReplyCard } from "../game/types";

interface ReplyDeckProps {
  cards: ReplyCard[];
  disabled: boolean;
  isThinking?: boolean;
  onChoose: (cardId: string) => void;
  onSubmitFreeReply: (text: string) => void;
}

const iconMap = {
  apology: MessageCircle,
  investigate: FileSearch,
  policy: ClipboardCheck,
  refund_check: BadgeHelp,
  logistics: Truck,
  compensation: Gift,
  reject: ShieldX,
  supervisor: UserCheck,
  template: MessageCircle,
  empathy: MessageCircle,
  pushback: Siren,
} as const;

export const ReplyDeck = memo(function ReplyDeck({
  cards,
  disabled,
  isThinking = false,
  onChoose,
  onSubmitFreeReply,
}: ReplyDeckProps) {
  const [freeReply, setFreeReply] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);

  const submitReply = () => {
    const trimmedReply = freeReply.trim();

    if (!trimmedReply || disabled) {
      return;
    }

    onSubmitFreeReply(trimmedReply);
    setFreeReply("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitReply();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitReply();
    }
  };

  return (
    <div className={`reply-deck ${cardsOpen ? "reply-deck-cards-open" : ""}`}>
      <div className="reply-heading">
        <p className="eyebrow">客服回复</p>
        <h2>输入或选择回复</h2>
      </div>
      <div className="reply-workbench">
        <form className="free-reply-form" onSubmit={handleSubmit}>
          <textarea
            aria-label="自定义客服回复"
            disabled={disabled}
            maxLength={180}
            placeholder="像真实客服一样回复，AI会判断客户反应（回车发送）..."
            value={freeReply}
            onChange={(event) => setFreeReply(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="primary-button" disabled={disabled || !freeReply.trim()} type="submit">
            <SendHorizontal size={17} aria-hidden="true" />
            {isThinking ? "AI分析中" : "发送"}
          </button>
        </form>

        <button
          className="reply-cards-toggle"
          type="button"
          aria-expanded={cardsOpen}
          onClick={() => setCardsOpen((open) => !open)}
        >
          <LayoutGrid size={16} aria-hidden="true" />
          快捷回复（{cards.length}）
          <ChevronDown className="reply-cards-toggle-chevron" size={16} aria-hidden="true" />
        </button>

        <div className="reply-grid">
          {cards.map((card) => {
            const Icon = iconMap[card.tags[0] as keyof typeof iconMap] ?? MessageCircle;

            return (
              <button
                className="reply-card"
                disabled={disabled}
                key={card.id}
                type="button"
                onClick={() => onChoose(card.id)}
                title={card.description}
              >
                <span className="reply-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="reply-copy">
                  <strong>{card.shortLabel}</strong>
                  <small>{card.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

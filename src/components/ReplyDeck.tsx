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
} from "lucide-react";
import { FormEvent, memo, useState } from "react";
import type { ReplyCard } from "../game/types";

interface ReplyDeckProps {
  cards: ReplyCard[];
  disabled: boolean;
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
  onChoose,
  onSubmitFreeReply,
}: ReplyDeckProps) {
  const [freeReply, setFreeReply] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReply = freeReply.trim();

    if (!trimmedReply || disabled) {
      return;
    }

    onSubmitFreeReply(trimmedReply);
    setFreeReply("");
  };

  return (
    <div className="reply-deck">
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
            placeholder="输入你的回复，客户会根据语义自动理解并回应..."
            value={freeReply}
            onChange={(event) => setFreeReply(event.target.value)}
          />
          <button className="primary-button" disabled={disabled || !freeReply.trim()} type="submit">
            <SendHorizontal size={17} aria-hidden="true" />
            发送
          </button>
        </form>

        <div className="reply-grid">
          {cards.map((card) => {
            const Icon = iconMap[card.tags[0]];

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

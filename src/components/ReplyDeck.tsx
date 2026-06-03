import {
  BadgeHelp,
  ClipboardCheck,
  FileSearch,
  Gift,
  MessageCircle,
  ShieldX,
  Truck,
  UserCheck,
} from "lucide-react";
import type { ReplyCard } from "../game/types";

interface ReplyDeckProps {
  cards: ReplyCard[];
  disabled: boolean;
  onChoose: (cardId: string) => void;
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
} as const;

export function ReplyDeck({ cards, disabled, onChoose }: ReplyDeckProps) {
  return (
    <div className="reply-deck">
      <div className="reply-heading">
        <p className="eyebrow">话术卡</p>
        <h2>选择下一句回复</h2>
      </div>
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
  );
}

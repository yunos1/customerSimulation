import { Sparkles, X } from "lucide-react";
import { memo } from "react";
import type { UnlockableCard } from "../game/types";

interface UnlockToastProps {
  /** 本次新解锁的高级卡（为空则不渲染）。 */
  cards: UnlockableCard[];
  onDismiss: () => void;
}

export const UnlockToast = memo(function UnlockToast({ cards, onDismiss }: UnlockToastProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="unlock-toast-stack" aria-live="polite">
      {cards.map((entry) => (
        <div className="unlock-toast" key={entry.card.id}>
          <span className="unlock-toast-icon">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span className="unlock-toast-copy">
            <span className="unlock-toast-title">
              <strong>解锁新回复卡</strong>
              <em>{entry.card.title}</em>
            </span>
            <small>{entry.hint} · 已加入你的回复牌组</small>
          </span>
          <button
            className="unlock-toast-close"
            type="button"
            onClick={onDismiss}
            aria-label="关闭"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
});

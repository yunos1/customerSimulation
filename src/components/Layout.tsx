import type { ReactNode } from "react";
import { Boxes, ChevronLeft, Shuffle } from "lucide-react";

interface LayoutProps {
  metrics: ReactNode;
  chat: ReactNode;
  status: ReactNode;
  knowledge: ReactNode;
  achievements: ReactNode;
  replies: ReactNode;
  alerts: ReactNode;
  eyebrow?: string;
  title?: string;
  shiftBadge?: string;
  accent?: "workplace" | "comedy" | "cyber" | "midnight" | "reversal";
  onBackToHub?: () => void;
  onSwitchSupportMode?: () => void;
}

export function Layout({
  metrics,
  chat,
  status,
  knowledge,
  achievements,
  replies,
  alerts,
  eyebrow = "Simulator Box · Customer Support",
  title = "亲亲，这边不建议呢",
  shiftBadge = "实习席位 · 售后 03",
  accent = "workplace",
  onBackToHub,
  onSwitchSupportMode,
}: LayoutProps) {
  return (
    <main className={`app-shell app-shell-${accent}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="topbar-actions">
          {onSwitchSupportMode ? (
            <button className="hub-back-button" type="button" onClick={onSwitchSupportMode}>
              <Shuffle size={17} aria-hidden="true" />
              切换模式
            </button>
          ) : null}
          {onBackToHub ? (
            <button className="hub-back-button" type="button" onClick={onBackToHub}>
              <ChevronLeft size={17} aria-hidden="true" />
              模拟器盒子
            </button>
          ) : null}
          <div className="shift-badge">
            <Boxes size={15} aria-hidden="true" />
            {shiftBadge}
          </div>
        </div>
      </header>

      {metrics}

      <section className="workspace">
        <div className="left-column">{chat}</div>
        <aside className="right-column">
          {status}
          {achievements}
          {knowledge}
        </aside>
      </section>

      <section className="reply-dock">{replies}</section>
      {alerts}
    </main>
  );
}

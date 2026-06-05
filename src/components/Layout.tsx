import type { ReactNode } from "react";
import { Boxes, ChevronLeft } from "lucide-react";

interface LayoutProps {
  metrics: ReactNode;
  chat: ReactNode;
  status: ReactNode;
  knowledge: ReactNode;
  achievements: ReactNode;
  replies: ReactNode;
  alerts: ReactNode;
  onBackToHub?: () => void;
}

export function Layout({
  metrics,
  chat,
  status,
  knowledge,
  achievements,
  replies,
  alerts,
  onBackToHub,
}: LayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Simulator Box · Customer Support</p>
          <h1>亲亲，这边不建议呢</h1>
        </div>
        <div className="topbar-actions">
          {onBackToHub ? (
            <button className="hub-back-button" type="button" onClick={onBackToHub}>
              <ChevronLeft size={17} aria-hidden="true" />
              模拟器盒子
            </button>
          ) : null}
          <div className="shift-badge">
            <Boxes size={15} aria-hidden="true" />
            实习席位 · 售后 03
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

import type { ReactNode } from "react";

interface LayoutProps {
  metrics: ReactNode;
  chat: ReactNode;
  status: ReactNode;
  knowledge: ReactNode;
  replies: ReactNode;
}

export function Layout({ metrics, chat, status, knowledge, replies }: LayoutProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Customer Support Simulator</p>
          <h1>亲亲，这边不建议呢</h1>
        </div>
        <div className="shift-badge">实习席位 · 售后 03</div>
      </header>

      {metrics}

      <section className="workspace">
        <div className="left-column">{chat}</div>
        <aside className="right-column">
          {status}
          {knowledge}
        </aside>
      </section>

      <section className="reply-dock">{replies}</section>
    </main>
  );
}

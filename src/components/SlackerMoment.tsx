import { useEffect } from "react";
import { SnakeGame } from "./SnakeGame";
import type { AuthUser } from "../hooks/useAuth";

interface Props {
  user: AuthUser | null;
  onBackToHub: () => void;
}

export function SlackerMoment({ user, onBackToHub }: Props) {
  // 移动端强制全屏
  useEffect(() => {
    const el = document.documentElement;
    if (window.innerWidth <= 768 && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  if (!user) {
    return (
      <div style={{
        width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#0a0e1a", color: "#fff", gap: 20,
      }}>
        <div style={{ fontSize: 48 }}>🐍</div>
        <div style={{ fontSize: 20, fontWeight: "bold" }}>摸鱼时刻 · 多人贪吃蛇</div>
        <div style={{ color: "#aaa", fontSize: 14 }}>请先登录以加入游戏</div>
        <button
          onClick={() => { window.location.href = "/auth/login"; }}
          style={{
            padding: "10px 32px", borderRadius: 8, border: "none",
            background: "#00c2ff", color: "#000", fontWeight: "bold",
            fontSize: 15, cursor: "pointer",
          }}
        >
          登录
        </button>
        <button
          onClick={onBackToHub}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.3)",
            color: "#aaa", padding: "6px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}
        >
          ← 返回首页
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0, zIndex: 100 }}>
      <SnakeGame token={user.id} onBackToHub={onBackToHub} />
    </div>
  );
}

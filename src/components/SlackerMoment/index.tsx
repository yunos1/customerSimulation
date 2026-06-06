// 摸鱼时刻：排行榜展示 + 进入游戏
import { useCallback, useEffect, useState } from "react";
import { SnakeGame } from "../SnakeGame";
import type { AuthUser } from "../../hooks/useAuth";

interface Props {
  user: AuthUser | null;
  onBackToHub: () => void;
}

interface ScoreEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  kills: number;
}

export function SlackerMoment({ user, onBackToHub }: Props) {
  const [playing, setPlaying] = useState(false);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // 读取 session cookie 作为 token（与现有 auth 一致）
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)session=([^;]*)/);
    setToken(match ? decodeURIComponent(match[1]) : null);
  }, [user]);

  // 加载排行榜
  useEffect(() => {
    if (playing) return;
    fetch("/api/snake/leaderboard")
      .then((r) => r.json() as Promise<{ leaderboard?: ScoreEntry[] }>)
      .then((d) => setBoard((d.leaderboard ?? []).slice(0, 50)));
  }, [playing]);

  const enterGame = useCallback(async () => {
    setPlaying(true);
    try {
      const el = document.documentElement;
      // requestFullscreen 含各厂商前缀回退
      const req = el.requestFullscreen?.bind(el)
        ?? (el as Element & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(el);
      if (req) await req();
    } catch { /* 用户拒绝或 iOS Safari 不支持，忽略 */ }
  }, []);

  const exitGame = useCallback(async () => {
    setPlaying(false);
    try {
      const exit = document.exitFullscreen?.bind(document)
        ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen?.bind(document);
      if (exit && document.fullscreenElement) await exit();
    } catch { /* ignore */ }
  }, []);

  if (playing) {
    return (
      // iOS Safari 不支持 Fullscreen API，用 100dvh + overscroll:none 模拟全屏
      <div style={{
        width: "100vw", height: "100dvh", position: "fixed", inset: 0, zIndex: 100,
        overscrollBehavior: "none",
      }}>
        <SnakeGame token={token} onBackToHub={exitGame} />
      </div>
    );
  }

  return (
    <main style={{
      minHeight: "100vh", background: "#0a0e1a", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 16px", fontFamily: "sans-serif",
    }}>
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>🐍 摸鱼时刻</h1>
      <p style={{ color: "#aaa", marginBottom: 32 }}>在线多人贪吃蛇 · 1000×1000 超大地图</p>

      <button
        onClick={enterGame}
        style={{
          background: "linear-gradient(135deg,#00f5ff,#7b2fff)",
          color: "#fff", border: "none", padding: "14px 48px",
          borderRadius: 30, fontSize: 18, fontWeight: "bold",
          cursor: "pointer", marginBottom: 48, letterSpacing: 1,
          boxShadow: "0 0 20px #00f5ff55",
        }}
      >
        {user ? "开始游戏" : "游客进入"}
      </button>

      <div style={{ width: "100%", maxWidth: 480 }}>
        <h2 style={{ fontSize: 16, color: "#ffd700", marginBottom: 12 }}>🏆 历史排行榜 Top 20</h2>
        {board.length === 0 ? (
          <p style={{ color: "#555" }}>暂无记录，成为第一个上榜的人吧！</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#888", borderBottom: "1px solid #222" }}>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>#</th>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>玩家</th>
                <th style={{ padding: "4px 8px", textAlign: "right" }}>分数</th>
                <th style={{ padding: "4px 8px", textAlign: "right" }}>击杀</th>
              </tr>
            </thead>
            <tbody>
              {board.map((entry, i) => (
                <tr key={entry.user_id} style={{ borderBottom: "1px solid #111" }}>
                  <td style={{ padding: "6px 8px", color: i < 3 ? "#ffd700" : "#666" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                    {entry.avatar_url && (
                      <img src={entry.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />
                    )}
                    {entry.username}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#00f5ff" }}>{entry.score}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#f87" }}>{entry.kills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={onBackToHub}
        style={{
          marginTop: 40, background: "none",
          border: "1px solid #333", color: "#888",
          padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13,
        }}
      >
        ← 返回模拟器盒子
      </button>
    </main>
  );
}

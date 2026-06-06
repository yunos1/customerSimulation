// 游戏 HUD：左上角排行榜 + 自己的分数 + 复活倒计时 + 击杀播报
import { useEffect, useRef, useState } from "react";
import type { GameSnapshot, LeaderEntry } from "./useSnakeGame";

interface Props {
  snapshot: GameSnapshot | null;
  playerId: string;
  onBackToHub: () => void;
}

export function GameHUD({ snapshot, playerId, onBackToHub }: Props) {
  const [kills, setKills] = useState<string[]>([]);
  const prevKillsRef = useRef(0);

  const me = snapshot?.snakes.find((s) => s.id === playerId);
  const leaderboard: LeaderEntry[] = snapshot?.leaderboard ?? [];

  // 检测击杀数增加，弹出通知
  useEffect(() => {
    if (!me) return;
    if (me.kills > prevKillsRef.current) {
      setKills((prev) => [`击杀 +1 (共 ${me.kills} 杀)`, ...prev].slice(0, 3));
      setTimeout(() => setKills((prev) => prev.slice(0, -1)), 3000);
    }
    prevKillsRef.current = me.kills;
  }, [me?.kills]);

  const respawnIn = me && !me.alive && me.respawnAt
    ? Math.max(0, Math.ceil((me.respawnAt - Date.now()) / 1000))
    : null;

  return (
    <>
      {/* 顶部工具栏 */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "rgba(0,0,0,0.5)", pointerEvents: "auto",
      }}>
        <button
          onClick={onBackToHub}
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
        >
          ← 返回
        </button>
        <span style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>
          🐍 摸鱼时刻 · 多人贪吃蛇
        </span>
        <span style={{ color: "#7cf", fontSize: 13 }}>
          在线 {snapshot?.snakes.filter((s) => s.alive).length ?? 0} 人
        </span>
      </div>

      {/* 左上角排行榜 */}
      <div style={{
        position: "absolute", top: 48, left: 12,
        background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "8px 12px",
        minWidth: 160, maxHeight: 220, overflowY: "auto", pointerEvents: "none",
      }}>
        <div style={{ color: "#ffd700", fontSize: 12, marginBottom: 6, fontWeight: "bold" }}>🏆 排行榜</div>
        {leaderboard.map((entry, i) => (
          <div key={entry.id} style={{
            display: "flex", justifyContent: "space-between", gap: 12,
            color: entry.id === playerId ? "#00f5ff" : "#ddd",
            fontSize: 12, marginBottom: 3, fontWeight: entry.id === playerId ? "bold" : "normal",
          }}>
            <span>{i + 1}. {entry.username.slice(0, 8)}</span>
            <span>{entry.score}分</span>
          </div>
        ))}
      </div>

      {/* 右上角自己的分数 */}
      <div style={{
        position: "absolute", top: 48, right: 12,
        background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "8px 14px",
        textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ color: "#aaa", fontSize: 11 }}>我的分数</div>
        <div style={{ color: "#00f5ff", fontSize: 22, fontWeight: "bold" }}>{me?.score ?? 0}</div>
        <div style={{ color: "#f87", fontSize: 11 }}>💀 {me?.kills ?? 0} 杀</div>
      </div>

      {/* 复活倒计时 */}
      {respawnIn !== null && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: "rgba(0,0,0,0.8)", borderRadius: 12, padding: "24px 40px",
          textAlign: "center", pointerEvents: "none",
        }}>
          <div style={{ color: "#ff6b6b", fontSize: 20, marginBottom: 8 }}>💀 你死了</div>
          <div style={{ color: "#fff", fontSize: 36, fontWeight: "bold" }}>{respawnIn}s</div>
          <div style={{ color: "#aaa", fontSize: 13, marginTop: 6 }}>随机复活中…</div>
        </div>
      )}

      {/* 击杀播报 */}
      <div style={{
        position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      }}>
        {kills.map((msg, i) => (
          <div key={i} style={{
            background: "rgba(255,100,50,0.85)", color: "#fff", padding: "4px 14px",
            borderRadius: 20, fontSize: 13, fontWeight: "bold",
            animation: "fadeIn 0.3s ease",
          }}>
            ⚔️ {msg}
          </div>
        ))}
      </div>

      {/* 操作提示 */}
      <div style={{
        position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.4)", fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap",
      }}>
        键盘 WASD/方向键 控制 · 移动端滑动控制 · 空格加速
      </div>
    </>
  );
}

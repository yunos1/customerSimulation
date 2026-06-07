// 游戏 HUD：排行榜（首屏5条，滚动看50）+ 分数 + 复活倒计时 + buff状态条 + 击杀播报
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SKILL_BY_KEY } from "./skins";
import type { GameSnapshot, LeaderEntry } from "./useSnakeGame";

const DESKTOP_LEADERBOARD_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";
const TOUCH_CONTROLS_QUERY = "(hover: none), (pointer: coarse)";
const ACTIVE_BOOST_MIN_LENGTH = 8;
const ACTIVE_BOOST_SCORE_COST = 2;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

interface Props {
  snapshot: GameSnapshot | null;
  playerId: string;
  onBackToHub: () => void;
  onBoostChange: (active: boolean) => void;
}

export const GameHUD = memo(function GameHUD({ snapshot, playerId, onBackToHub, onBoostChange }: Props) {
  const [kills, setKills] = useState<string[]>([]);
  const [boostHeld, setBoostHeld] = useState(false);
  const prevKillsRef = useRef(0);
  const prevLeaderIndexRef = useRef(-1);
  const leaderScrollRef = useRef<HTMLDivElement>(null);
  const isDesktopLeaderboard = useMediaQuery(DESKTOP_LEADERBOARD_QUERY);
  const showTouchBoost = useMediaQuery(TOUCH_CONTROLS_QUERY);

  const me = useMemo(() => snapshot?.snakes.find((s) => s.id === playerId), [snapshot, playerId]);
  const leaderboard: LeaderEntry[] = useMemo(() => snapshot?.leaderboard ?? [], [snapshot]);

  useEffect(() => {
    if (!me) return;
    if (me.kills > prevKillsRef.current) {
      setKills((prev) => [`击杀 +1 (共 ${me.kills} 杀)`, ...prev].slice(0, 3));
      setTimeout(() => setKills((prev) => prev.slice(0, -1)), 3000);
    }
    prevKillsRef.current = me.kills;
  }, [me?.kills]);

  // 自己上榜时滚动到可见
  useEffect(() => {
    const idx = leaderboard.findIndex((e) => e.id === playerId);
    if (idx < 0 || !leaderScrollRef.current) return;
    if (idx === prevLeaderIndexRef.current) return;
    prevLeaderIndexRef.current = idx;
    const children = leaderScrollRef.current.children;
    if (children[idx]) (children[idx] as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [leaderboard, playerId]);

  const respawnIn = me && !me.alive && me.respawnAt
    ? Math.max(0, Math.ceil((me.respawnAt - Date.now()) / 1000))
    : null;
  const bodyLength = me?.bodyLength ?? me?.body.length ?? 0;
  const canActiveBoost = !!me?.alive && bodyLength >= ACTIVE_BOOST_MIN_LENGTH && me.score >= ACTIVE_BOOST_SCORE_COST;
  const isActiveBoosting = boostHeld || !!me?.effects?.activeBoost;

  useEffect(() => {
    if (canActiveBoost || !boostHeld) return;
    setBoostHeld(false);
    onBoostChange(false);
  }, [boostHeld, canActiveBoost, onBoostChange]);

  useEffect(() => {
    return () => onBoostChange(false);
  }, [onBoostChange]);

  const setBoost = (active: boolean) => {
    if (active && !canActiveBoost) return;
    setBoostHeld(active);
    onBoostChange(active);
  };

  const activeBuffs = useMemo(() => {
    const effects = me?.effects ?? {};
    const now = Date.now();
    return (Object.keys(effects) as (keyof typeof effects)[])
      .map((k) => ({ key: k, remaining: Math.max(0, Math.ceil(((effects[k] ?? 0) - now) / 1000)) }))
      .filter((b) => b.remaining > 0);
  }, [me?.effects]);

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
        <span style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>🐍 摸鱼时刻 · 多人贪吃蛇</span>
        <span style={{ color: "#7cf", fontSize: 13 }}>
          在线 {snapshot?.onlineCount ?? 0} 人
        </span>
      </div>

      {/* 排行榜：固定高度约5条，可滚动到50 */}
      <div style={{
        position: "absolute", top: isDesktopLeaderboard ? 56 : 48, left: isDesktopLeaderboard ? 20 : 12,
        background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: isDesktopLeaderboard ? "12px 16px" : "8px 12px",
        minWidth: isDesktopLeaderboard ? 230 : 160, pointerEvents: "auto",
        boxShadow: isDesktopLeaderboard ? "0 10px 28px rgba(0,0,0,0.28)" : undefined,
      }}>
        <div style={{
          color: "#ffd700",
          fontSize: isDesktopLeaderboard ? 15 : 12,
          marginBottom: isDesktopLeaderboard ? 10 : 6,
          fontWeight: "bold",
        }}>🏆 排行榜</div>
        <div
          ref={leaderScrollRef}
          style={{
            maxHeight: isDesktopLeaderboard ? 250 : 112,
            overflowY: "auto",
            scrollbarWidth: "thin",
          }}
        >
          {leaderboard.map((entry, i) => (
            <div key={entry.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: isDesktopLeaderboard ? 20 : 12,
              color: entry.id === playerId ? "#00f5ff" : entry.isBot ? "#888" : "#ddd",
              fontSize: isDesktopLeaderboard ? 15 : 12,
              marginBottom: isDesktopLeaderboard ? 6 : 3,
              fontWeight: entry.id === playerId ? "bold" : "normal",
              lineHeight: isDesktopLeaderboard ? "20px" : undefined,
            }}>
              <span>{i + 1}. {entry.isBot ? "🤖" : ""}{entry.username.slice(0, isDesktopLeaderboard ? 12 : 8)}</span>
              <span>{entry.score}分</span>
            </div>
          ))}
        </div>
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

      {/* buff 状态条（右上角分数下方） */}
      {activeBuffs.length > 0 && (
        <div style={{
          position: "absolute", top: 130, right: 12,
          display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none",
        }}>
          {activeBuffs.map((b) => {
            const sk = b.key === "activeBoost"
              ? { emoji: "⚡", color: "#ffe600", label: "燃尾" }
              : SKILL_BY_KEY[b.key];
            if (!sk) return null;
            return (
              <div key={b.key} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "3px 8px",
                border: `1px solid ${sk.color}55`, fontSize: 12,
              }}>
                <span>{sk.emoji}</span>
                <span style={{ color: sk.color }}>{sk.label}</span>
                <span style={{ color: "#fff", fontWeight: "bold" }}>{b.remaining}s</span>
              </div>
            );
          })}
        </div>
      )}

      {showTouchBoost && (
        <button
          type="button"
          aria-label="按住消耗尾巴加速"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            setBoost(true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            setBoost(false);
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setBoost(false);
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            setBoost(false);
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: 18,
            bottom: 188,
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: `1px solid ${canActiveBoost ? "rgba(255,230,0,0.75)" : "rgba(255,255,255,0.18)"}`,
            background: isActiveBoosting
              ? "rgba(255,230,0,0.24)"
              : canActiveBoost
                ? "rgba(0,0,0,0.68)"
                : "rgba(0,0,0,0.36)",
            boxShadow: isActiveBoosting ? "0 0 22px rgba(255,230,0,0.45)" : "0 8px 22px rgba(0,0,0,0.22)",
            color: canActiveBoost ? "#ffe600" : "rgba(255,255,255,0.32)",
            fontSize: 28,
            lineHeight: "58px",
            textAlign: "center",
            pointerEvents: "auto",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          ⚡
        </button>
      )}

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
        WASD/方向键 控制 · 空格/⚡ 消耗尾巴加速
      </div>
    </>
  );
});

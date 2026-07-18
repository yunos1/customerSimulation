// 摸鱼时刻：房间大厅 + 排行榜 + 进入游戏
import { useCallback, useEffect, useMemo, useState } from "react";
import { SnakeGame } from "../SnakeGame";
import type { AuthUser } from "../../hooks/useAuth";
import {
  getRoomConfig,
  normalizeRoomId,
  SNAKE_PUBLIC_ROOMS,
  type SnakeRoomStatus,
} from "../../snake/protocol";

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

type RoomCard = SnakeRoomStatus & { title: string; blurb: string };

const RECENT_ROOMS_KEY = "snake:recent-rooms";
const MAX_RECENT = 5;

function loadRecentRooms(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => normalizeRoomId(id))
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function rememberRoom(roomId: string) {
  const id = normalizeRoomId(roomId);
  const next = [id, ...loadRecentRooms().filter((x) => x !== id)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

function publicMeta(roomId: string) {
  return SNAKE_PUBLIC_ROOMS.find((r) => r.id === roomId);
}

export function SlackerMoment({ user, onBackToHub }: Props) {
  const [playing, setPlaying] = useState(false);
  const [roomId, setRoomId] = useState("main");
  const [customRoom, setCustomRoom] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentRooms());
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [rooms, setRooms] = useState<RoomCard[]>(() =>
    SNAKE_PUBLIC_ROOMS.map((r) => {
      const cfg = getRoomConfig(r.id);
      return {
        roomId: r.id,
        title: r.title,
        blurb: r.blurb,
        humans: 0,
        bots: 0,
        maxPlayers: cfg.maxPlayers,
        open: true,
        botTarget: cfg.botTarget,
        foodTarget: cfg.foodTarget,
      };
    }),
  );
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // 加载排行榜
  useEffect(() => {
    if (playing) return;
    fetch("/api/snake/leaderboard")
      .then((r) => r.json() as Promise<{ leaderboard?: ScoreEntry[] }>)
      .then((d) => setBoard((d.leaderboard ?? []).slice(0, 50)))
      .catch(() => {});
  }, [playing]);

  // 房间人数（大厅轮询）
  useEffect(() => {
    if (playing) return;
    let cancelled = false;

    const load = () => {
      fetch("/api/snake/rooms")
        .then((r) => r.json() as Promise<{ rooms?: RoomCard[] }>)
        .then((d) => {
          if (cancelled) return;
          if (d.rooms?.length) setRooms(d.rooms);
          setRoomsError(null);
        })
        .catch(() => {
          if (!cancelled) setRoomsError("房间状态暂不可用");
        });
    };

    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [playing]);

  const recentCards = useMemo(() => {
    return recentIds
      .filter((id) => !SNAKE_PUBLIC_ROOMS.some((r) => r.id === id))
      .map((id) => {
        const cfg = getRoomConfig(id);
        return {
          roomId: id,
          title: id,
          blurb: "最近进入的自定义房间",
          humans: 0,
          bots: 0,
          maxPlayers: cfg.maxPlayers,
          open: true,
          botTarget: cfg.botTarget,
          foodTarget: cfg.foodTarget,
        } satisfies RoomCard;
      });
  }, [recentIds]);

  const enterGame = useCallback(async (targetRoom: string) => {
    const id = normalizeRoomId(targetRoom);
    setRoomId(id);
    setRecentIds(rememberRoom(id));
    setPlaying(true);
    try {
      const el = document.documentElement;
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
      <div style={{
        width: "100vw", height: "100dvh", position: "fixed", inset: 0, zIndex: 100,
        overscrollBehavior: "none",
      }}>
        <SnakeGame token={null} roomId={roomId} onBackToHub={exitGame} />
      </div>
    );
  }

  const renderRoomButton = (room: RoomCard, opts?: { subtle?: boolean }) => {
    const full = !room.open;
    const cfg = getRoomConfig(room.roomId);
    const botTarget = room.botTarget ?? cfg.botTarget;
    const foodTarget = room.foodTarget ?? cfg.foodTarget;
    const meta = publicMeta(room.roomId);
    return (
      <button
        key={room.roomId}
        type="button"
        disabled={full}
        onClick={() => void enterGame(room.roomId)}
        style={{
          textAlign: "left",
          background: full
            ? "#141824"
            : opts?.subtle
              ? "#121722"
              : "linear-gradient(135deg,#12202a,#1a1430)",
          border: `1px solid ${room.roomId === "main" ? "#00f5ff66" : "#333"}`,
          color: "#fff",
          borderRadius: 14,
          padding: "14px 16px",
          cursor: full ? "not-allowed" : "pointer",
          opacity: full ? 0.55 : 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <strong style={{ fontSize: 16 }}>{meta?.title ?? room.title}</strong>
          <span style={{ color: full ? "#f87" : "#00f5ff", fontSize: 13 }}>
            {full ? "已满" : `${room.humans}/${room.maxPlayers} 人`}
            {room.bots > 0 ? ` · ${room.bots} bot` : ""}
          </span>
        </div>
        <div style={{ color: "#8a93a8", fontSize: 12, marginTop: 4 }}>
          {meta?.blurb ?? room.blurb}
        </div>
        <div style={{ color: "#5f6b82", fontSize: 11, marginTop: 6 }}>
          目标 bot {botTarget} · 食物密度 ~{foodTarget}
        </div>
      </button>
    );
  };

  return (
    <main style={{
      minHeight: "100vh", background: "#0a0e1a", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 16px", fontFamily: "sans-serif",
    }}>
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>🐍 摸鱼时刻</h1>
      <p style={{ color: "#aaa", marginBottom: 28 }}>在线多人贪吃蛇 · 多房间难度 · 1000×1000 地图</p>

      <section style={{ width: "100%", maxWidth: 520, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, color: "#7df5e7", marginBottom: 12 }}>选择房间</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {rooms.map((room) => renderRoomButton(room))}
        </div>

        {recentCards.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 13, color: "#9aa6c2", marginBottom: 8 }}>最近自定义房</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {recentCards.map((room) => renderRoomButton(room, { subtle: true }))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
            placeholder="自定义房间码 a-z0-9_-"
            maxLength={24}
            style={{
              flex: 1,
              background: "#121722",
              border: "1px solid #333",
              borderRadius: 10,
              color: "#fff",
              padding: "10px 12px",
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={() => void enterGame(customRoom || "main")}
            style={{
              background: "linear-gradient(135deg,#00f5ff,#7b2fff)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "0 16px",
              fontWeight: "bold",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            加入
          </button>
        </div>
        {roomsError ? (
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>{roomsError}</p>
        ) : (
          <p style={{ color: "#555", fontSize: 12, marginTop: 8 }}>
            {user ? `以 ${user.username} 身份入场` : "游客可进；登录后记分更完整"}
            {" · "}自定义房使用主大厅默认难度
          </p>
        )}
      </section>

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

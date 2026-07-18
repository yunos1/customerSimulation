// WebSocket 连接 + 游戏状态管理
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  SNAKE_MAP_SIZE,
  SNAKE_TICK_MS,
  type FoodInfoWire,
  type LeaderEntryWire,
  type SnakeEffectsWire,
  type SnakeInfoWire,
  type SnakeVec2,
} from "../../snake/protocol";

export type Vec2 = SnakeVec2;
// 生效中的 buff -> 到期时间戳（服务端 Date.now() 基准）。仅含尚未到期的。
export type SnakeEffects = SnakeEffectsWire;
export type SnakeInfo = SnakeInfoWire;
// skill: 技能类型标识（见 skins.ts SKILL_FOODS）；普通食物无此字段
export type FoodInfo = FoodInfoWire;
export type LeaderEntry = LeaderEntryWire;

export interface GameSnapshot {
  tick: number;
  playerId: string;
  snakes: SnakeInfo[];
  foods: FoodInfo[];
  leaderboard: LeaderEntry[];
  onlineCount?: number;
  arrivalGapMs?: number;
  timelineDriftMs?: number;
  // 客户端记录的本地到达时间（performance.now()），供 render-behind 插值
  arrivedAt?: number;
}

// render-behind 缓冲保留最近 N 帧，渲染时刻回退 ~1.5 tick，永远落在两帧之间插值
const BUFFER_SIZE = 6;
const HUD_STATE_INTERVAL_MS = 500;
export type SnapshotListener = (snapshot: GameSnapshot) => void;
export type SnapshotSubscriber = (listener: SnapshotListener) => () => void;

export interface HudSnakeInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  skinId: number;
  angle: number;
  alive: boolean;
  score: number;
  kills: number;
  respawnAt: number;
  bodyLength: number;
  effects?: SnakeEffects;
  isBot?: boolean;
}

export interface GameHudSnapshot {
  tick: number;
  playerId: string;
  onlineCount: number;
  me: HudSnakeInfo | null;
  leaderboard: LeaderEntry[];
}

function toHudSnapshot(snapshot: GameSnapshot, fallbackPlayerId: string): GameHudSnapshot {
  const playerId = snapshot.playerId || fallbackPlayerId;
  const me = snapshot.snakes.find((snake) => snake.id === playerId);

  return {
    tick: snapshot.tick,
    playerId,
    onlineCount: snapshot.onlineCount ?? 0,
    leaderboard: snapshot.leaderboard,
    me: me
      ? {
          id: me.id,
          username: me.username,
          avatarUrl: me.avatarUrl,
          skinId: me.skinId,
          angle: me.angle,
          alive: me.alive,
          score: me.score,
          kills: me.kills,
          respawnAt: me.respawnAt,
          bodyLength: me.bodyLength ?? me.body.length,
          effects: me.effects,
          isBot: me.isBot,
        }
      : null,
  };
}

export function useSnakeGame(token: string | null, roomId = "main") {
  // bufferRef：最近若干帧快照（按到达顺序，末尾最新），供 GameCanvas 渲染回放。
  // 直接读 ref，不触发 React 重渲染。
  const bufferRef = useRef<GameSnapshot[]>([]);
  const tickMsRef = useRef<number>(SNAKE_TICK_MS);
  const lastArriveRef = useRef<number>(0);
  const timelineRef = useRef<{ tick: number; time: number } | null>(null);
  const lastHudUpdateRef = useRef<number>(0);
  const [hudSnapshot, setHudSnapshot] = useState<GameHudSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [mapSize, setMapSize] = useState(SNAKE_MAP_SIZE);
  const [playerId, setPlayerId] = useState("");
  const [activeRoomId, setActiveRoomId] = useState(roomId);
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>("");
  const listenersRef = useRef(new Set<SnapshotListener>());

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // Prefer cookie session (HttpOnly, auto-sent on same-origin WS). Optional token for non-cookie clients.
    const params = new URLSearchParams();
    params.set("room", roomId);
    if (token) params.set("token", token);
    const url = `${proto}//${location.host}/api/snake/ws?${params.toString()}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "init") {
        playerIdRef.current = msg.playerId;
        setPlayerId(msg.playerId);
        setMapSize(msg.mapSize);
        if (typeof msg.roomId === "string") setActiveRoomId(msg.roomId);
        if (typeof msg.tickMs === "number") tickMsRef.current = msg.tickMs;
      } else if (msg.type === "state") {
        const now = performance.now();
        const last = lastArriveRef.current;
        const arrivalGapMs = last ? now - last : 0;
        lastArriveRef.current = now;
        const snap = msg as GameSnapshot;
        if (snap.playerId && playerIdRef.current !== snap.playerId) {
          playerIdRef.current = snap.playerId;
          setPlayerId(snap.playerId);
        }
        const tickMs = tickMsRef.current || SNAKE_TICK_MS;
        const timeline = timelineRef.current;
        let arrivedAt = now;
        if (timeline && snap.tick > timeline.tick) {
          arrivedAt = timeline.time + (snap.tick - timeline.tick) * tickMs;
          const drift = now - arrivedAt;
          if (Math.abs(drift) > tickMs * 1.5) arrivedAt = now;
        }
        timelineRef.current = { tick: snap.tick, time: arrivedAt };
        snap.arrivedAt = arrivedAt;
        snap.arrivalGapMs = arrivalGapMs;
        snap.timelineDriftMs = now - arrivedAt;
        const buf = bufferRef.current;
        buf.push(snap);
        if (buf.length > BUFFER_SIZE) buf.shift();
        for (const listener of listenersRef.current) listener(snap);
        if (now - lastHudUpdateRef.current >= HUD_STATE_INTERVAL_MS) {
          lastHudUpdateRef.current = now;
          startTransition(() => {
            setHudSnapshot(toHudSnapshot(snap, playerIdRef.current));
          });
        }
      }
    };

    return () => ws.close();
  }, [token, roomId]);

  const steer = useCallback((angle: number) => {
    wsRef.current?.send(JSON.stringify({ type: "steer", angle }));
  }, []);

  const setBoosting = useCallback((active: boolean) => {
    wsRef.current?.send(JSON.stringify({ type: "boost", active }));
  }, []);

  // 主动离开：通知服务端保存分数（在断开前发送）
  const leave = useCallback(() => {
    try { wsRef.current?.send(JSON.stringify({ type: "leave" })); } catch { /* closed */ }
  }, []);

  const subscribeSnapshot = useCallback((listener: SnapshotListener) => {
    listenersRef.current.add(listener);
    for (const snap of bufferRef.current) listener(snap);
    return () => listenersRef.current.delete(listener);
  }, []);

  return {
    hudSnapshot, bufferRef, tickMsRef, subscribeSnapshot,
    connected, mapSize, playerId, roomId: activeRoomId, steer, setBoosting, leave,
  };
}

// WebSocket 连接 + 游戏状态管理
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

export interface Vec2 { x: number; y: number }
// 生效中的 buff -> 到期时间戳（服务端 Date.now() 基准）。仅含尚未到期的。
export interface SnakeEffects {
  boost?: number; slow?: number; shield?: number;
  magnet?: number; double?: number; ghost?: number; activeBoost?: number;
}
export interface SnakeInfo {
  id: string; username: string; avatarUrl: string | null;
  skinId: number; body: Vec2[]; angle: number;
  alive: boolean; score: number; kills: number; respawnAt: number; bodyLength?: number;
  // 远处蛇为节省带宽只发蛇头：bodyHead=true 表示 body 仅含头部一节
  bodyHead?: boolean;
  // bodyPartial=true 表示服务端已按当前视野裁剪 body，仅含附近片段。
  bodyPartial?: boolean;
  // 裁剪 body 中每一节对应完整蛇身的原始索引，用于插值和断开不连续片段。
  bodyIndexes?: number[];
  effects?: SnakeEffects;
  isBot?: boolean;
}
// skill: 技能类型标识（见 skins.ts SKILL_FOODS）；普通食物无此字段
export interface FoodInfo { x: number; y: number; type: number; value: number; tier: number; skill?: string }
export interface LeaderEntry { id: string; username: string; score: number; kills: number; isBot?: boolean }

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

export function useSnakeGame(token: string | null) {
  // bufferRef：最近若干帧快照（按到达顺序，末尾最新），供 GameCanvas 渲染回放。
  // 直接读 ref，不触发 React 重渲染。
  const bufferRef = useRef<GameSnapshot[]>([]);
  const tickMsRef = useRef<number>(200);
  const lastArriveRef = useRef<number>(0);
  const timelineRef = useRef<{ tick: number; time: number } | null>(null);
  const lastHudUpdateRef = useRef<number>(0);
  const [hudSnapshot, setHudSnapshot] = useState<GameHudSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [mapSize, setMapSize] = useState(1000);
  const [playerId, setPlayerId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>("");
  const listenersRef = useRef(new Set<SnapshotListener>());

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/api/snake/ws${token ? `?token=${token}` : ""}`;
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
        const tickMs = tickMsRef.current || 200;
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
  }, [token]);

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
    connected, mapSize, playerId, steer, setBoosting, leave,
  };
}

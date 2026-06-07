// WebSocket 连接 + 游戏状态管理
import { useCallback, useEffect, useRef, useState } from "react";

export interface Vec2 { x: number; y: number }
// 生效中的 buff -> 到期时间戳（服务端 Date.now() 基准）。仅含尚未到期的。
export interface SnakeEffects {
  boost?: number; slow?: number; shield?: number;
  magnet?: number; double?: number; ghost?: number;
}
export interface SnakeInfo {
  id: string; username: string; avatarUrl: string | null;
  skinId: number; body: Vec2[]; angle: number;
  alive: boolean; score: number; kills: number; respawnAt: number;
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
  // 客户端记录的本地到达时间（performance.now()），供 render-behind 插值
  arrivedAt?: number;
}

// render-behind 缓冲保留最近 N 帧，渲染时刻回退 ~1.5 tick，永远落在两帧之间插值
const BUFFER_SIZE = 6;
const SNAPSHOT_STATE_INTERVAL_MS = 200;
type SnapshotListener = (snapshot: GameSnapshot) => void;

export function useSnakeGame(token: string | null) {
  // bufferRef：最近若干帧快照（按到达顺序，末尾最新），供 GameCanvas 渲染回放。
  // 直接读 ref，不触发 React 重渲染。
  const bufferRef = useRef<GameSnapshot[]>([]);
  const tickMsRef = useRef<number>(200);
  const lastArriveRef = useRef<number>(0);
  const lastStateUpdateRef = useRef<number>(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [mapSize, setMapSize] = useState(1000);
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
        setMapSize(msg.mapSize);
        if (typeof msg.tickMs === "number") tickMsRef.current = msg.tickMs;
      } else if (msg.type === "state") {
        const now = performance.now();
        // 实测两次快照间隔，EMA 平滑后作为插值时长，吸收网络/tick 抖动。
        const last = lastArriveRef.current;
        if (last) {
          const gap = now - last;
          if (gap > 30 && gap < 1000) {
            tickMsRef.current = tickMsRef.current * 0.7 + gap * 0.3;
          }
        }
        lastArriveRef.current = now;
        const snap = msg as GameSnapshot;
        snap.arrivedAt = now;
        const buf = bufferRef.current;
        buf.push(snap);
        if (buf.length > BUFFER_SIZE) buf.shift();
        for (const listener of listenersRef.current) listener(snap);
        if (now - lastStateUpdateRef.current >= SNAPSHOT_STATE_INTERVAL_MS) {
          lastStateUpdateRef.current = now;
          setSnapshot(snap);
        }
      }
    };

    return () => ws.close();
  }, [token]);

  const steer = useCallback((angle: number) => {
    wsRef.current?.send(JSON.stringify({ type: "steer", angle }));
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
    snapshot, bufferRef, tickMsRef, subscribeSnapshot,
    connected, mapSize, playerId: playerIdRef.current, steer, leave,
  };
}

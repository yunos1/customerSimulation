// WebSocket 连接 + 游戏状态管理
import { useCallback, useEffect, useRef, useState } from "react";

export interface Vec2 { x: number; y: number }
export interface SnakeInfo {
  id: string; username: string; avatarUrl: string | null;
  skinId: number; body: Vec2[]; angle: number;
  alive: boolean; score: number; kills: number; respawnAt: number;
}
export interface FoodInfo { x: number; y: number; type: number; value: number }
export interface LeaderEntry { id: string; username: string; score: number; kills: number }

export interface GameSnapshot {
  tick: number;
  playerId: string;
  snakes: SnakeInfo[];
  foods: FoodInfo[];
  leaderboard: LeaderEntry[];
}

export function useSnakeGame(token: string | null) {
  // snapshotRef 供 GameCanvas rAF 循环读取（无 React 重渲染开销）
  // snapshot state 供 HUD / MiniMap（100ms 频率，可接受）
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [mapSize, setMapSize] = useState(1000);
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>("");

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
      } else if (msg.type === "state") {
        snapshotRef.current = msg as GameSnapshot;
        setSnapshot(msg as GameSnapshot);
      }
    };

    return () => ws.close();
  }, [token]);

  const steer = useCallback((angle: number) => {
    wsRef.current?.send(JSON.stringify({ type: "steer", angle }));
  }, []);

  return { snapshot, snapshotRef, connected, mapSize, playerId: playerIdRef.current, steer };
}

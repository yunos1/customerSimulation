// 小地图：右下角，死亡时可点击展开拖动预览
import { useEffect, useRef, useState, useCallback, memo } from "react";
import type { GameSnapshot, SnapshotSubscriber } from "./useSnakeGame";

const SIZE = 140; // 缩小后的尺寸
const EXPAND = 420; // 展开后的尺寸
const FOOD_DOT = ["rgba(100,255,100,0.5)", "#ffd700", "#00f5ff"];

interface Props {
  subscribeSnapshot: SnapshotSubscriber;
  mapSize: number;
  playerId: string;
  isDead: boolean;
}

export const MiniMap = memo(function MiniMap({ subscribeSnapshot, mapSize, playerId, isDead }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  // 拖动偏移（展开时）
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 死亡后退出展开
  useEffect(() => {
    if (!isDead) setExpanded(false);
  }, [isDead]);

  const size = expanded ? EXPAND : SIZE;

  const drawSnapshot = useCallback((snapshot: GameSnapshot | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const ctx = ctxRef.current ?? canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    const scale = size / mapSize;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, size, size);

    for (const food of snapshot.foods) {
      const tier = food.tier ?? 0;
      ctx.fillStyle = FOOD_DOT[tier] ?? FOOD_DOT[0];
      const s = tier === 2 ? (expanded ? 4 : 2.5) : tier === 1 ? (expanded ? 3 : 2) : (expanded ? 2.5 : 1.5);
      ctx.fillRect(food.x * scale, food.y * scale, s, s);
    }

    for (const snake of snapshot.snakes) {
      if (!snake.alive || !snake.body.length) continue;
      const head = snake.body[0];
      const isMe = snake.id === playerId;
      ctx.fillStyle = isMe ? "#00f5ff" : "#ff6b35";
      const r = isMe ? (expanded ? 5 : 3) : (expanded ? 3 : 2);
      ctx.beginPath();
      ctx.arc(head.x * scale, head.y * scale, r, 0, Math.PI * 2);
      ctx.fill();
      if (expanded && snake.username) {
        ctx.fillStyle = isMe ? "#00f5ff" : "rgba(255,255,255,0.7)";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(snake.username.slice(0, 6), head.x * scale, head.y * scale - 6);
      }
    }

    ctx.strokeStyle = expanded ? "rgba(255,68,68,0.8)" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = expanded ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [mapSize, playerId, expanded, size]);

  useEffect(() => {
    let frameId = 0;
    const unsubscribe = subscribeSnapshot((snapshot) => {
      latestSnapshotRef.current = snapshot;
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        drawSnapshot(latestSnapshotRef.current);
      });
    });
    return () => {
      unsubscribe();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [subscribeSnapshot, drawSnapshot]);

  useEffect(() => {
    drawSnapshot(latestSnapshotRef.current);
  }, [drawSnapshot]);

  // 拖动处理
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!expanded) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  }, [expanded, offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + e.clientX - dragRef.current.startX,
      y: dragRef.current.oy + e.clientY - dragRef.current.startY,
    });
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const handleClick = useCallback(() => {
    if (!isDead) return;
    setExpanded((v) => {
      if (!v) setOffset({ x: 0, y: 0 });
      return !v;
    });
  }, [isDead]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: expanded ? undefined : 40,
        right: expanded ? undefined : 16,
        top: expanded ? `calc(50% - ${EXPAND / 2}px + ${offset.y}px)` : undefined,
        left: expanded ? `calc(50% - ${EXPAND / 2}px + ${offset.x}px)` : undefined,
        borderRadius: 6,
        border: expanded ? "2px solid rgba(255,68,68,0.7)" : "1px solid rgba(255,255,255,0.2)",
        cursor: isDead ? (expanded ? "move" : "zoom-in") : "default",
        zIndex: expanded ? 200 : 1,
        touchAction: "none",
      }}
    />
  );
});

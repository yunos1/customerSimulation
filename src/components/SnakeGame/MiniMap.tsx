// 小地图：右下角 200×200，显示全局食物密度、所有玩家位置
import { useEffect, useRef } from "react";
import type { GameSnapshot } from "./useSnakeGame";

const SIZE = 200;

interface Props {
  snapshot: GameSnapshot | null;
  mapSize: number;
  playerId: string;
}

export function MiniMap({ snapshot, mapSize, playerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const ctx = canvas.getContext("2d")!;
    const scale = SIZE / mapSize;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 食物热图（绿色点）
    ctx.fillStyle = "rgba(100,255,100,0.5)";
    for (const food of snapshot.foods) {
      ctx.fillRect(food.x * scale, food.y * scale, 1.5, 1.5);
    }

    // 其他玩家（橙色点）
    for (const snake of snapshot.snakes) {
      if (!snake.alive || !snake.body.length) continue;
      const head = snake.body[0];
      const isMe = snake.id === playerId;
      ctx.fillStyle = isMe ? "#00f5ff" : "#ff6b35";
      const r = isMe ? 3 : 2;
      ctx.beginPath();
      ctx.arc(head.x * scale, head.y * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 边框
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }, [snapshot, mapSize, playerId]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{
        position: "absolute", bottom: 16, right: 16,
        borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
        pointerEvents: "none",
      }}
    />
  );
}

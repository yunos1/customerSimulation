// 主游戏画布：视口裁剪渲染，只绘制可视区域内的格子
import { useEffect, useRef } from "react";
import { SKINS, FOODS } from "./skins";
import type { GameSnapshot } from "./useSnakeGame";

const CELL = 20; // px per cell

interface Props {
  snapshotRef: React.RefObject<GameSnapshot | null>;
  mapSize: number;
  playerId: string;
}

export function GameCanvas({ snapshotRef, mapSize, playerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // rAF 渲染循环，直接读 ref，不触发 React 重渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number;

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width;
      const H = canvas.height;

    // 找自己的蛇头，决定视口中心
    const me = snapshot.snakes.find((s) => s.id === playerId);
    const cx = me?.alive && me.body.length ? me.body[0].x : mapSize / 2;
    const cy = me?.alive && me.body.length ? me.body[0].y : mapSize / 2;

    // 视口左上角（世界坐标，单位格）
    const vx0 = cx - W / 2 / CELL;
    const vy0 = cy - H / 2 / CELL;

    // 世界坐标 → 屏幕坐标
    const toScreen = (wx: number, wy: number) => [
      (wx - vx0) * CELL,
      (wy - vy0) * CELL,
    ] as [number, number];

    ctx.clearRect(0, 0, W, H);

    // 背景网格
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gxStart = Math.floor(vx0);
    const gyStart = Math.floor(vy0);
    const gxEnd = Math.ceil(vx0 + W / CELL);
    const gyEnd = Math.ceil(vy0 + H / CELL);
    for (let gx = gxStart; gx <= gxEnd; gx++) {
      const sx = (gx - vx0) * CELL;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = gyStart; gy <= gyEnd; gy++) {
      const sy = (gy - vy0) * CELL;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    // 边界线
    const [bx0, by0] = toScreen(0, 0);
    const [bx1, by1] = toScreen(mapSize, mapSize);
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 3;
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);

    // 食物
    ctx.font = `${CELL - 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const food of snapshot.foods) {
      const [sx, sy] = toScreen(food.x, food.y);
      if (sx < -CELL || sy < -CELL || sx > W + CELL || sy > H + CELL) continue;
      ctx.fillText(FOODS[food.type % 20], sx + CELL / 2, sy + CELL / 2);
    }

    // 蛇
    for (const snake of snapshot.snakes) {
      if (!snake.alive || !snake.body.length) continue;
      const skin = SKINS[snake.skinId % SKINS.length];
      const isMe = snake.id === playerId;

      ctx.save();
      if (skin.glow) {
        ctx.shadowColor = skin.glow;
        ctx.shadowBlur = isMe ? 12 : 6;
      }

      for (let i = snake.body.length - 1; i >= 0; i--) {
        const seg = snake.body[i];
        const [sx, sy] = toScreen(seg.x, seg.y);
        if (sx < -CELL || sy < -CELL || sx > W + CELL || sy > H + CELL) continue;

        const colorIdx = i % skin.body.length;
        ctx.fillStyle = i === 0 ? skin.head : skin.body[colorIdx];
        const r = i === 0 ? CELL / 2 - 1 : CELL / 2 - 2;
        ctx.beginPath();
        ctx.arc(sx + CELL / 2, sy + CELL / 2, r, 0, Math.PI * 2);
        ctx.fill();

        // 蛇头眼睛
        if (i === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff";
          const eyeOffset = CELL * 0.2;
          ctx.beginPath();
          ctx.arc(sx + CELL / 2 + eyeOffset, sy + CELL / 2 - eyeOffset, 3, 0, Math.PI * 2);
          ctx.arc(sx + CELL / 2 - eyeOffset, sy + CELL / 2 - eyeOffset, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.arc(sx + CELL / 2 + eyeOffset, sy + CELL / 2 - eyeOffset, 1.5, 0, Math.PI * 2);
          ctx.arc(sx + CELL / 2 - eyeOffset, sy + CELL / 2 - eyeOffset, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 用户名
      if (snake.body.length) {
        const [hx, hy] = toScreen(snake.body[0].x, snake.body[0].y);
        ctx.fillStyle = isMe ? "#fff" : "rgba(255,255,255,0.7)";
        ctx.font = isMe ? "bold 12px sans-serif" : "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(snake.username, hx + CELL / 2, hy - 2);
      }
    }

    // 边界警示覆盖层
    if (me?.alive && me.body.length) {
      const head = me.body[0];
      const WARN = 50;
      const alpha = (dist: number) => Math.max(0, Math.min(0.6, 1 - dist / WARN)) * 0.6;

      const drawWarn = (grad: CanvasGradient, a: number) => {
        if (a <= 0) return;
        grad.addColorStop(0, `rgba(255,50,50,${a})`);
        grad.addColorStop(1, "rgba(255,50,50,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      };

      if (head.x < WARN) drawWarn(ctx.createLinearGradient(0, 0, W * 0.3, 0), alpha(head.x));
      if (head.x > mapSize - WARN) drawWarn(ctx.createLinearGradient(W, 0, W * 0.7, 0), alpha(mapSize - head.x));
      if (head.y < WARN) drawWarn(ctx.createLinearGradient(0, 0, 0, H * 0.3), alpha(head.y));
      if (head.y > mapSize - WARN) drawWarn(ctx.createLinearGradient(0, H, 0, H * 0.7), alpha(mapSize - head.y));
    }
    }; // end frame

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [snapshotRef, playerId, mapSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // 响应式尺寸
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}

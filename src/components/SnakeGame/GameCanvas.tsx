// 主游戏画布：视口裁剪渲染，只绘制可视区域内的格子
import { useEffect, useRef } from "react";
import { SKINS, FOODS } from "./skins";
import type { GameSnapshot } from "./useSnakeGame";

const CELL = 26; // px per cell

// hex 颜色提亮（amount 0-1）
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

interface Props {
  snapshotRef: React.RefObject<GameSnapshot | null>;
  prevSnapshotRef: React.RefObject<GameSnapshot | null>;
  snapshotTimeRef: React.RefObject<number>;
  tickMsRef: React.RefObject<number>;
  mapSize: number;
  playerId: string;
}

export function GameCanvas({ snapshotRef, prevSnapshotRef, snapshotTimeRef, tickMsRef, mapSize, playerId }: Props) {
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

    // ── 插值：在两个 tick 快照之间平滑过渡，消除移动卡顿 ──
    const prev = prevSnapshotRef.current;
    const tickMs = tickMsRef.current || 200;
    const t = Math.min(1, (performance.now() - snapshotTimeRef.current) / tickMs);
    // 上一帧各蛇身体（按 id 索引），用于逐节点插值
    const prevBodies = new Map<string, { x: number; y: number }[]>();
    if (prev) for (const s of prev.snakes) prevBodies.set(s.id, s.body);

    // 返回某条蛇的插值后身体；服务端每 tick unshift 头、pop 尾，
    // 故 current.body[i] 一个 tick 前位于 prev.body[i]，逐索引插值即顺滑。
    const lerpBody = (snake: GameSnapshot["snakes"][number]): { x: number; y: number }[] => {
      const pb = prevBodies.get(snake.id);
      if (!pb || t >= 1) return snake.body;
      return snake.body.map((seg, i) => {
        const p = pb[i];
        if (!p) return seg; // 新增尾节点（吃食物变长），无前序，直接用当前位置
        return { x: p.x + (seg.x - p.x) * t, y: p.y + (seg.y - p.y) * t };
      });
    };

    const me = snapshot.snakes.find((s) => s.id === playerId);
    const meBody = me ? lerpBody(me) : null;
    const cx = me?.alive && meBody?.length ? meBody[0].x : mapSize / 2;
    const cy = me?.alive && meBody?.length ? meBody[0].y : mapSize / 2;

    const vx0 = cx - W / 2 / CELL;
    const vy0 = cy - H / 2 / CELL;
    // 视口世界坐标范围（用于快速裁剪，避免 toScreen 调用）
    const vxMax = vx0 + W / CELL;
    const vyMax = vy0 + H / CELL;
    const PAD = 2; // 额外格子边距

    const toScreen = (wx: number, wy: number) => [
      (wx - vx0) * CELL,
      (wy - vy0) * CELL,
    ] as [number, number];

    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, W, H);

    // 网格线（每帧只画可视范围）
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gxStart = Math.floor(vx0);
    const gyStart = Math.floor(vy0);
    const gxEnd = Math.ceil(vxMax);
    const gyEnd = Math.ceil(vyMax);
    ctx.beginPath();
    for (let gx = gxStart; gx <= gxEnd; gx++) {
      const sx = (gx - vx0) * CELL;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
    }
    for (let gy = gyStart; gy <= gyEnd; gy++) {
      const sy = (gy - vy0) * CELL;
      ctx.moveTo(0, sy); ctx.lineTo(W, sy);
    }
    ctx.stroke();

    // 边界墙
    const [bx0, by0] = toScreen(0, 0);
    const [bx1, by1] = toScreen(mapSize, mapSize);
    ctx.save();
    ctx.shadowColor = "#ff4444";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 5;
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,100,100,0.5)";
    ctx.lineWidth = 10;
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.restore();

    // 食物：直接用世界坐标裁剪，跳过视口外的
    ctx.font = `${CELL - 2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const food of snapshot.foods) {
      if (food.x < vx0 - PAD || food.x > vxMax + PAD || food.y < vy0 - PAD || food.y > vyMax + PAD) continue;
      ctx.fillText(FOODS[food.type % 20], (food.x - vx0) * CELL + CELL / 2, (food.y - vy0) * CELL + CELL / 2);
    }

    // 蛇
    const R = CELL * 0.44; // 略微缩小蛇身（原 CELL/2）
    const HR = R + 2;

    for (const snake of snapshot.snakes) {
      if (!snake.alive || !snake.body.length) continue;
      const skin = SKINS[snake.skinId % SKINS.length];
      const isMe = snake.id === playerId;
      const body = lerpBody(snake);

      // 视口内节点（直接计算屏幕坐标，避免临时对象）
      const vsegs: Array<{ i: number; sx: number; sy: number }> = [];
      for (let i = 0; i < body.length; i++) {
        const seg = body[i];
        if (seg.x < vx0 - PAD || seg.x > vxMax + PAD || seg.y < vy0 - PAD || seg.y > vyMax + PAD) continue;
        vsegs.push({ i, sx: (seg.x - vx0) * CELL, sy: (seg.y - vy0) * CELL });
      }
      if (!vsegs.length) continue;

      ctx.save();

      // 1. 管状身体（单次 stroke）
      if (skin.glow) { ctx.shadowColor = skin.glow; ctx.shadowBlur = isMe ? 18 : 10; }
      ctx.beginPath();
      ctx.lineWidth = R * 2 - 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = skin.body[0];
      let drawing = false;
      for (let vi = 0; vi < vsegs.length; vi++) {
        const { i, sx, sy } = vsegs[vi];
        const pcx = sx + R, pcy = sy + R;
        if (!drawing || (vi > 0 && i !== vsegs[vi - 1].i + 1)) {
          ctx.moveTo(pcx, pcy); drawing = true;
        } else {
          ctx.lineTo(pcx, pcy);
        }
      }
      ctx.stroke();

      // 2. 彩色节点覆盖（无渐变，直接 fillStyle，避免每节 createRadialGradient）
      ctx.shadowBlur = 0;
      for (const { i, sx, sy } of vsegs) {
        if (i === 0) continue;
        ctx.fillStyle = skin.body[i % skin.body.length];
        ctx.beginPath();
        ctx.arc(sx + R, sy + R, R - 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. 蛇头
      const headSeg = vsegs.find(({ i }) => i === 0);
      if (headSeg) {
        const hcx = headSeg.sx + R, hcy = headSeg.sy + R;
        if (skin.glow) { ctx.shadowColor = skin.glow; ctx.shadowBlur = isMe ? 24 : 14; }
        ctx.fillStyle = lighten(skin.head, 0.25);
        ctx.beginPath();
        ctx.arc(hcx, hcy, HR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // 眼睛
        const angle = (snake.angle * Math.PI) / 180;
        const ex = Math.cos(angle) * R * 0.45, ey = Math.sin(angle) * R * 0.45;
        const ep = Math.cos(angle + Math.PI / 2) * R * 0.35, eq = Math.sin(angle + Math.PI / 2) * R * 0.35;
        for (const side of [1, -1] as const) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(hcx + ex + ep * side, hcy + ey + eq * side, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#111";
          ctx.beginPath();
          ctx.arc(hcx + ex + ep * side + Math.cos(angle), hcy + ey + eq * side + Math.sin(angle), 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 用户名（头在视口内才画）
      const h0 = body[0];
      if (h0.x >= vx0 - PAD && h0.x <= vxMax + PAD) {
        const nhx = (h0.x - vx0) * CELL, nhy = (h0.y - vy0) * CELL;
        ctx.shadowColor = skin.glow ?? "transparent";
        ctx.shadowBlur = 5;
        ctx.fillStyle = isMe ? "#fff" : "rgba(255,255,255,0.75)";
        ctx.font = isMe ? "bold 13px sans-serif" : "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(snake.username, nhx + R, nhy - 4);
        ctx.shadowBlur = 0;
      }
    }

    // 边界警示
    if (me?.alive && meBody?.length) {
      const head = meBody[0];
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

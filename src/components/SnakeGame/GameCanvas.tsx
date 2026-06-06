// 主游戏画布：render-behind 插值 + sprite 缓存食物 + 视口内联渲染
import { useEffect, useRef } from "react";
import { SKINS, FOODS, FOOD_TYPE_TIER, SKILL_BY_KEY, SKILL_FOODS } from "./skins";
import type { GameSnapshot } from "./useSnakeGame";

const CELL = 26; // px per cell
const FRAME_BUDGET_MS = 18;
const LOW_DETAIL_MS = 1200;
const EYE_SIDES = [1, -1] as const;
// 渲染回退量：渲染此刻之前 N 毫秒的画面，保证始终落在两帧快照之间插值，
// 消除"追上最新帧后画面冻结"的卡顿。
const RENDER_BEHIND_MS = 250;

// ── 食物 sprite 缓存 ─────────────────────────────────────────────────────────
// 每个 type（emoji + tier）预渲染一张离屏 canvas，帧循环里 drawImage 替代
// 每帧 shadowBlur + save/restore，吃食物出现时卡顿消失。

const spriteCache = new Map<string, HTMLCanvasElement>();
let spritesWarmed = false;

function getSprite(emoji: string, glowColor: string, size: number): HTMLCanvasElement {
  const key = `${emoji}:${glowColor}:${size}`;
  let cv = spriteCache.get(key);
  if (cv) return cv;

  cv = document.createElement("canvas");
  cv.width = cv.height = size * 2; // 2x 给发光留空间
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = size * 0.7;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size - 2}px serif`;
  ctx.fillText(emoji, size, size);
  spriteCache.set(key, cv);
  return cv;
}

function warmSprites() {
  if (spritesWarmed) return;
  spritesWarmed = true;
  for (let type = 0; type < FOODS.length; type++) {
    const glyph = FOODS[type];
    const tier = FOOD_TYPE_TIER[type] ?? 0;
    getSprite(glyph, "", CELL);
    if (tier === 1) getSprite(glyph, "#ffd700", CELL);
    if (tier === 2) {
      getSprite(glyph, "#00f5ff", CELL);
      getSprite(glyph, "#00f5ff", CELL + 2);
    }
  }
  for (const sk of SKILL_FOODS) {
    getSprite(sk.emoji, sk.color, CELL + 4);
  }
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

type VisibleSeg = { i: number; sx: number; sy: number };
type PrevBody = {
  body: { x: number; y: number }[];
  indexMap?: Map<number, { x: number; y: number }>;
};

interface Props {
  bufferRef: React.RefObject<GameSnapshot[]>;
  tickMsRef: React.RefObject<number>;
  mapSize: number;
  playerId: string;
}

export function GameCanvas({ bufferRef, tickMsRef, mapSize, playerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    warmSprites();
    let rafId: number;
    const prevBodies = new Map<string, PrevBody>();
    const prevIndexMaps = new Map<string, Map<number, { x: number; y: number }>>();
    const visibleSegs: VisibleSeg[] = [];
    const tmpPoint = { x: 0, y: 0 };
    let lowDetailUntil = 0;

    const frame = () => {
      rafId = requestAnimationFrame(frame);
      const frameStart = performance.now();
      const buf = bufferRef.current;
      if (!buf.length) return;
      const W = canvas.width;
      const H = canvas.height;

      // ── render-behind：在 now-RENDER_BEHIND_MS 时刻插值 ─────────────────
      // 找到 renderT 两侧的两帧快照（from → to）
      const renderT = performance.now() - RENDER_BEHIND_MS;
      let from: GameSnapshot | null = null;
      let to: GameSnapshot | null = null;
      for (let i = buf.length - 1; i >= 0; i--) {
        const snap = buf[i];
        if ((snap.arrivedAt ?? 0) <= renderT) { from = snap; to = buf[i + 1] ?? snap; break; }
      }
      if (!from) { from = buf[0]; to = buf[1] ?? buf[0]; }
      if (!to) to = from;

      const tickMs = tickMsRef.current || 200;
      const fromT = from.arrivedAt ?? 0;
      const toT = to.arrivedAt ?? fromT + tickMs;
      const t = toT === fromT ? 1 : Math.max(0, Math.min(1, (renderT - fromT) / (toT - fromT)));

      // 上一帧各蛇 body（按 id 索引）
      prevBodies.clear();
      for (const s of from.snakes) {
        const indexes = s.bodyIndexes;
        let indexMap: Map<number, { x: number; y: number }> | undefined;
        if (indexes) {
          indexMap = prevIndexMaps.get(s.id);
          if (!indexMap) {
            indexMap = new Map();
            prevIndexMaps.set(s.id, indexMap);
          }
          indexMap.clear();
          for (let i = 0; i < s.body.length; i++) {
            indexMap.set(indexes[i] ?? i, s.body[i]);
          }
        }
        prevBodies.set(s.id, { body: s.body, indexMap });
      }

      // render-behind 使用 to 帧的蛇状态，插值到 from 帧
      const snapshot = to;

      // 插值蛇身：服务端每 tick unshift 头 pop 尾，index 对齐所以逐索引插值顺滑。
      // 只对视口内节点执行，不再分配整条蛇的新数组。
      function lerpSeg(id: string, i: number, seg: { x: number; y: number }, out: { x: number; y: number }) {
        if (t >= 1) {
          out.x = seg.x;
          out.y = seg.y;
          return out;
        }
        const prev = prevBodies.get(id);
        if (!prev) {
          out.x = seg.x;
          out.y = seg.y;
          return out;
        }
        const p = prev.indexMap?.get(i) ?? prev.body[i];
        if (!p) {
          out.x = seg.x;
          out.y = seg.y;
          return out;
        }
        out.x = p.x + (seg.x - p.x) * t;
        out.y = p.y + (seg.y - p.y) * t;
        return out;
      }

      const me = snapshot.snakes.find((s) => s.id === playerId);
      // 计算玩家头部插值坐标，用于视口中心
      let cx = mapSize / 2, cy = mapSize / 2;
      if (me?.alive && me.body.length) {
        lerpSeg(me.id, 0, me.body[0], tmpPoint);
        cx = tmpPoint.x; cy = tmpPoint.y;
      }

      const vx0 = cx - W / 2 / CELL;
      const vy0 = cy - H / 2 / CELL;
      const vxMax = vx0 + W / CELL;
      const vyMax = vy0 + H / CELL;
      const PAD = 2;
      const lowDetail = frameStart < lowDetailUntil;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, W, H);

      // 网格线
      if (!lowDetail) {
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = Math.floor(vx0); gx <= Math.ceil(vxMax); gx++) {
          const sx = (gx - vx0) * CELL;
          ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
        }
        for (let gy = Math.floor(vy0); gy <= Math.ceil(vyMax); gy++) {
          const sy = (gy - vy0) * CELL;
          ctx.moveTo(0, sy); ctx.lineTo(W, sy);
        }
        ctx.stroke();
      }

      // 边界墙：只画当前视口能看到的边，避免每帧绘制 26000px 级巨型发光矩形。
      ctx.save();
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 5;
      ctx.beginPath();
      const leftEdge = (0 - vx0) * CELL;
      const rightEdge = (mapSize - vx0) * CELL;
      const topEdge = (0 - vy0) * CELL;
      const bottomEdge = (mapSize - vy0) * CELL;
      if (leftEdge >= -16 && leftEdge <= W + 16) { ctx.moveTo(leftEdge, 0); ctx.lineTo(leftEdge, H); }
      if (rightEdge >= -16 && rightEdge <= W + 16) { ctx.moveTo(rightEdge, 0); ctx.lineTo(rightEdge, H); }
      if (topEdge >= -16 && topEdge <= H + 16) { ctx.moveTo(0, topEdge); ctx.lineTo(W, topEdge); }
      if (bottomEdge >= -16 && bottomEdge <= H + 16) { ctx.moveTo(0, bottomEdge); ctx.lineTo(W, bottomEdge); }
      ctx.stroke();
      ctx.restore();

      // ── 食物 ────────────────────────────────────────────────────────────
      // 动效（tier1 浮动 / tier2 旋转）保留 translate/scale/rotate，
      // 但用预渲染 sprite 替换 shadowBlur，帧开销从 O(食物*阴影) → O(食物*drawImage)
      const now = performance.now();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const food of snapshot.foods) {
        if (food.x < vx0 - PAD || food.x > vxMax + PAD || food.y < vy0 - PAD || food.y > vyMax + PAD) continue;
        const px = (food.x - vx0) * CELL + CELL / 2;
        const py = (food.y - vy0) * CELL + CELL / 2;

        // 技能食物
        if (food.skill) {
          const sk = SKILL_BY_KEY[food.skill];
          if (sk) {
            if (lowDetail) {
              const sprite = getSprite(sk.emoji, sk.color, CELL + 4);
              const s = CELL + 4;
              ctx.drawImage(sprite, px - s, py - s, s * 2, s * 2);
              continue;
            }
            const phase = (food.x * 12.9898 + food.y * 78.233) % (Math.PI * 2);
            const tSec = now / 1000;
            const rot = (tSec * 1.8 + phase) % (Math.PI * 2);
            const pulse = 0.5 + Math.sin(tSec * 4 + phase) * 0.5;
            const sprite = getSprite(sk.emoji, sk.color, CELL + 4);
            ctx.save();
            ctx.translate(px, py);
            // 光圈（廉价：仅 arc + stroke，无 shadowBlur）
            ctx.beginPath();
            ctx.arc(0, 0, CELL * (0.6 + pulse * 0.16), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${hexToRgb(sk.color)},${0.3 + pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.rotate(rot);
            const s = CELL + 4;
            ctx.drawImage(sprite, -s, -s, s * 2, s * 2);
            ctx.restore();
            continue;
          }
        }

        const tier = food.tier ?? FOOD_TYPE_TIER[food.type] ?? 0;
        const glyph = FOODS[food.type % FOODS.length];

        if (tier === 0) {
          // 静态基础食物：直接 drawImage（sprite 已含静态光晕，一次性烘焙）
          const sprite = getSprite(glyph, "", CELL);
          ctx.drawImage(sprite, px - CELL, py - CELL, CELL * 2, CELL * 2);
          continue;
        }

        const phase = (food.x * 12.9898 + food.y * 78.233) % (Math.PI * 2);
        const tSec = now / 1000;

        if (tier === 1 && !lowDetail) {
          const scale = 1.12 + Math.sin(tSec * 3 + phase) * 0.12;
          const bob = Math.sin(tSec * 2.2 + phase) * 2.5;
          const sprite = getSprite(glyph, "#ffd700", CELL);
          ctx.save();
          ctx.translate(px, py + bob);
          ctx.scale(scale, scale);
          ctx.drawImage(sprite, -CELL, -CELL, CELL * 2, CELL * 2);
          ctx.restore();
        } else if (!lowDetail) {
          // tier 2 高级：旋转 + 脉冲光环（arc+stroke，廉价）
          const rot = (tSec * 1.6 + phase) % (Math.PI * 2);
          const pulse = 0.5 + Math.sin(tSec * 4 + phase) * 0.5;
          const sprite = getSprite(glyph, "#00f5ff", CELL + 2);
          ctx.save();
          ctx.translate(px, py);
          ctx.beginPath();
          ctx.arc(0, 0, CELL * (0.62 + pulse * 0.18), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,245,255,${0.25 + pulse * 0.45})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.rotate(rot);
          ctx.drawImage(sprite, -(CELL + 2), -(CELL + 2), (CELL + 2) * 2, (CELL + 2) * 2);
          ctx.restore();
        } else {
          const sprite = getSprite(glyph, tier === 1 ? "#ffd700" : "#00f5ff", CELL);
          ctx.drawImage(sprite, px - CELL, py - CELL, CELL * 2, CELL * 2);
        }
      }

      // ── 蛇 ──────────────────────────────────────────────────────────────
      const R = CELL * 0.44;
      const HR = R + 2;

      for (const snake of snapshot.snakes) {
        if (!snake.alive || !snake.body.length) continue;
        const skin = SKINS[snake.skinId % SKINS.length];
        const isMe = snake.id === playerId;
        const bodyIndexes = snake.bodyIndexes;

        // 计算视口内节点（内联插值，不产生整条蛇的新数组）
        let visibleCount = 0;
        for (let i = 0; i < snake.body.length; i++) {
          const bodyIndex = bodyIndexes?.[i] ?? i;
          lerpSeg(snake.id, bodyIndex, snake.body[i], tmpPoint);
          const wx = tmpPoint.x;
          const wy = tmpPoint.y;
          if (wx < vx0 - PAD || wx > vxMax + PAD || wy < vy0 - PAD || wy > vyMax + PAD) continue;
          const slot = visibleSegs[visibleCount] ?? (visibleSegs[visibleCount] = { i: 0, sx: 0, sy: 0 });
          slot.i = bodyIndex;
          slot.sx = (wx - vx0) * CELL;
          slot.sy = (wy - vy0) * CELL;
          visibleCount++;
        }
        // 远处蛇服务端仅发头（bodyHead=true），视口外直接 continue
        if (!visibleCount) continue;

        ctx.save();

        // 1. 管状身体
        if (!lowDetail && skin.glow && isMe) { ctx.shadowColor = skin.glow; ctx.shadowBlur = 18; }
        ctx.beginPath();
        ctx.lineWidth = R * 2 - 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = skin.body[0];
        let drawing = false;
        for (let vi = 0; vi < visibleCount; vi++) {
          const { i, sx, sy } = visibleSegs[vi];
          const pcx = sx + R, pcy = sy + R;
          if (!drawing || (vi > 0 && i !== visibleSegs[vi - 1].i + 1)) {
            ctx.moveTo(pcx, pcy); drawing = true;
          } else {
            ctx.lineTo(pcx, pcy);
          }
        }
        ctx.stroke();

        // 2. 彩色节点覆盖
        ctx.shadowBlur = 0;
        if (!lowDetail || isMe) {
          for (let vi = 0; vi < visibleCount; vi++) {
            const { i, sx, sy } = visibleSegs[vi];
            if (i === 0) continue;
            ctx.fillStyle = skin.body[i % skin.body.length];
            ctx.beginPath();
            ctx.arc(sx + R, sy + R, R - 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 3. 蛇头
        let headSeg: VisibleSeg | undefined;
        if (visibleSegs[0]?.i === 0) {
          headSeg = visibleSegs[0];
        } else {
          for (let vi = 0; vi < visibleCount; vi++) {
            if (visibleSegs[vi].i === 0) {
              headSeg = visibleSegs[vi];
              break;
            }
          }
        }
        if (headSeg) {
          const hcx = headSeg.sx + R, hcy = headSeg.sy + R;
          if (!lowDetail && skin.glow) { ctx.shadowColor = skin.glow; ctx.shadowBlur = isMe ? 24 : 14; }
          ctx.fillStyle = lighten(skin.head, 0.25);
          ctx.beginPath();
          ctx.arc(hcx, hcy, HR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          const angle = (snake.angle * Math.PI) / 180;
          const ex = Math.cos(angle) * R * 0.45, ey = Math.sin(angle) * R * 0.45;
          const ep = Math.cos(angle + Math.PI / 2) * R * 0.35, eq = Math.sin(angle + Math.PI / 2) * R * 0.35;
          for (const side of EYE_SIDES) {
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

        // 用户名
        const h0 = snake.body[0];
        if ((!lowDetail || isMe) && h0.x >= vx0 - PAD && h0.x <= vxMax + PAD) {
          lerpSeg(snake.id, bodyIndexes?.[0] ?? 0, h0, tmpPoint);
          const nhx = (tmpPoint.x - vx0) * CELL, nhy = (tmpPoint.y - vy0) * CELL;
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

      // 边界警示（廉价渐变，无 shadowBlur）
      if (me?.alive && me.body.length) {
        lerpSeg(me.id, 0, me.body[0], tmpPoint);
        const hx = tmpPoint.x;
        const hy = tmpPoint.y;
        const WARN = 50;
        const alpha = (dist: number) => Math.max(0, Math.min(0.6, 1 - dist / WARN)) * 0.6;
        const drawWarn = (grad: CanvasGradient, a: number) => {
          if (a <= 0) return;
          grad.addColorStop(0, `rgba(255,50,50,${a})`);
          grad.addColorStop(1, "rgba(255,50,50,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        };
        if (hx < WARN) drawWarn(ctx.createLinearGradient(0, 0, W * 0.3, 0), alpha(hx));
        if (hx > mapSize - WARN) drawWarn(ctx.createLinearGradient(W, 0, W * 0.7, 0), alpha(mapSize - hx));
        if (hy < WARN) drawWarn(ctx.createLinearGradient(0, 0, 0, H * 0.3), alpha(hy));
        if (hy > mapSize - WARN) drawWarn(ctx.createLinearGradient(0, H, 0, H * 0.7), alpha(mapSize - hy));
      }

      if (!lowDetail && performance.now() - frameStart > FRAME_BUDGET_MS) {
        lowDetailUntil = performance.now() + LOW_DETAIL_MS;
      }
    }; // end frame

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [playerId, mapSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // 响应式尺寸
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(resize, 100); });
    ro.observe(canvas);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  // 接受 "#rrggbb" 或 "rgb(...)" 形式
  if (hex.startsWith("rgb")) return hex.slice(4, hex.indexOf(")")).replace(/\s/g, "");
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

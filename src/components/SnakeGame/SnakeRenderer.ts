import { SKINS, FOODS, FOOD_TYPE_TIER, SKILL_BY_KEY, SKILL_FOODS } from "./skins";
import type { GameSnapshot } from "./useSnakeGame";

const CELL = 26;
const FRAME_BUDGET_MS = 18;
const RENDER_BEHIND_MS = 80;
const MAX_LOCAL_PREDICT_MS = 130;
const BUFFER_SIZE = 6;
const CAMERA_SMOOTHING = 0.22;
const EYE_SIDES = [1, -1] as const;

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas;
type VisibleSeg = { i: number; sx: number; sy: number };
type PrevBody = {
  body: { x: number; y: number }[];
  indexMap?: Map<number, { x: number; y: number }>;
};

interface RendererOptions {
  mapSize: number;
  playerId: string;
  tickMs: number;
}

interface RendererConfig {
  mapSize?: number;
  playerId?: string;
  tickMs?: number;
}

export interface SnakeRenderer {
  resize: (width: number, height: number) => void;
  setConfig: (config: RendererConfig) => void;
  setLocalSteer: (angle: number) => void;
  pushSnapshot: (snapshot: GameSnapshot, tickMs?: number) => void;
  drawFrame: () => void;
  dispose: () => void;
}

// LRU sprite cache — cap at 128 entries to avoid unbounded memory growth / GC pauses
const SPRITE_CACHE_MAX = 128;
const spriteCache = new Map<string, SpriteCanvas>();
function getSpriteCached(key: string, factory: () => SpriteCanvas): SpriteCanvas {
  const hit = spriteCache.get(key);
  if (hit) {
    // Move to end (most-recently-used)
    spriteCache.delete(key);
    spriteCache.set(key, hit);
    return hit;
  }
  const canvas = factory();
  if (spriteCache.size >= SPRITE_CACHE_MAX) {
    // Evict LRU (first entry)
    spriteCache.delete(spriteCache.keys().next().value!);
  }
  spriteCache.set(key, canvas);
  return canvas;
}
let spritesWarmed = false;

function getContext2d(canvas: RenderCanvas | SpriteCanvas): RenderContext | null {
  return (canvas as unknown as { getContext: (type: "2d") => RenderContext | null }).getContext("2d");
}

function createSpriteCanvas(size: number): SpriteCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function getSprite(emoji: string, glowColor: string, size: number): SpriteCanvas {
  const key = `${emoji}:${glowColor}:${size}`;
  return getSpriteCached(key, () => {
    const canvas = createSpriteCanvas(size * 2);
    const ctx = getContext2d(canvas);
    if (!ctx) return canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = size * 0.7;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size - 2}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif`;
    ctx.fillText(emoji, size, size);
    return canvas;
  });
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
  for (const skill of SKILL_FOODS) {
    getSprite(skill.emoji, skill.color, CELL + 4);
  }
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): string {
  if (hex.startsWith("rgb")) return hex.slice(4, hex.indexOf(")")).replace(/\s/g, "");
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

export function createSnakeRenderer(canvas: RenderCanvas, options: RendererOptions): SnakeRenderer {
  const ctx = getContext2d(canvas);
  if (!ctx) {
    throw new Error("Snake canvas 2D context is unavailable.");
  }

  warmSprites();

  const buffer: GameSnapshot[] = [];
  const prevBodies = new Map<string, PrevBody>();
  const prevIndexMaps = new Map<string, Map<number, { x: number; y: number }>>();
  const visibleSegs: VisibleSeg[] = [];
  const tmpPoint = { x: 0, y: 0 };
  // Adaptive quality: smooth EMA of recent frame times, skip expensive effects when slow
  let frameTimeEma = 16;
  let mapSize = options.mapSize;
  const camera = { x: mapSize / 2, y: mapSize / 2, ready: false };
  let playerId = options.playerId;
  let tickMs = options.tickMs || 200;
  let localSteerAngle = 0;
  let localSteerAt = 0;
  let disposed = false;

  // Offscreen grid cache — only redrawn when camera moves
  let gridCache: SpriteCanvas | null = null;
  let gridCacheW = 0;
  let gridCacheH = 0;
  let gridCacheVx0 = NaN;
  let gridCacheVy0 = NaN;

  const renderer: SnakeRenderer = {
    resize(width, height) {
      const nextWidth = Math.max(1, Math.floor(width));
      const nextHeight = Math.max(1, Math.floor(height));
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
    },

    setConfig(config) {
      if (typeof config.mapSize === "number") mapSize = config.mapSize;
      if (typeof config.playerId === "string") playerId = config.playerId;
      if (typeof config.tickMs === "number" && config.tickMs > 0) tickMs = config.tickMs;
    },

    setLocalSteer(angle) {
      localSteerAngle = ((angle % 360) + 360) % 360;
      localSteerAt = performance.now();
    },

    pushSnapshot(snapshot, nextTickMs) {
      if (disposed) return;
      if (typeof nextTickMs === "number" && nextTickMs > 0) tickMs = nextTickMs;
      buffer.push(snapshot);
      if (buffer.length > BUFFER_SIZE) buffer.shift();
    },

    drawFrame() {
      if (disposed || !buffer.length) return;

      const frameStart = performance.now();
      const wallNow = Date.now();
      const W = canvas.width;
      const H = canvas.height;
      if (W <= 0 || H <= 0) return;

      const renderT = frameStart - RENDER_BEHIND_MS;
      let from: GameSnapshot | null = null;
      let to: GameSnapshot | null = null;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const snap = buffer[i];
        if ((snap.arrivedAt ?? 0) <= renderT) {
          from = snap;
          to = buffer[i + 1] ?? snap;
          break;
        }
      }
      if (!from) {
        from = buffer[0];
        to = buffer[1] ?? buffer[0];
      }
      if (!to) to = from;

      const latestArrivedAt = to.arrivedAt ?? frameStart;
      const ownPredictionMs = Math.min(
        MAX_LOCAL_PREDICT_MS,
        Math.max(0, Math.max(renderT - latestArrivedAt, localSteerAt - latestArrivedAt)),
      );
      const fromT = from.arrivedAt ?? 0;
      const toT = to.arrivedAt ?? fromT + tickMs;
      const t = toT === fromT ? 1 : Math.max(0, Math.min(1, (renderT - fromT) / (toT - fromT)));

      prevBodies.clear();
      for (const snake of from.snakes) {
        const indexes = snake.bodyIndexes;
        let indexMap: Map<number, { x: number; y: number }> | undefined;
        if (indexes) {
          indexMap = prevIndexMaps.get(snake.id);
          if (!indexMap) {
            indexMap = new Map();
            prevIndexMaps.set(snake.id, indexMap);
          }
          indexMap.clear();
          for (let i = 0; i < snake.body.length; i++) {
            indexMap.set(indexes[i] ?? i, snake.body[i]);
          }
        }
        prevBodies.set(snake.id, { body: snake.body, indexMap });
      }

      const snapshot = to;

      function lerpSeg(
        id: string,
        i: number,
        seg: { x: number; y: number },
        out: { x: number; y: number },
      ) {
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

      function displayAngle(serverAngle: number) {
        return frameStart - localSteerAt < 600 ? localSteerAngle : serverAngle;
      }

      function predictionDistance(snake: GameSnapshot["snakes"][number], wallNow: number) {
        if (snake.id !== playerId || ownPredictionMs <= 0) return 0;
        const effects = snake.effects ?? {};
        const speedMul = wallNow < (effects.boost ?? 0)
          ? 2
          : wallNow < (effects.activeBoost ?? 0)
            ? 2
            : wallNow < (effects.slow ?? 0)
              ? 0.5
              : 1;
        return (ownPredictionMs / Math.max(80, tickMs)) * speedMul;
      }

      function applyPrediction(
        point: { x: number; y: number },
        bodyIndex: number,
        predictionDx: number,
        predictionDy: number,
      ) {
        if (predictionDx === 0 && predictionDy === 0) return point;
        const fade = Math.max(0.2, 1 - bodyIndex * 0.08);
        point.x += predictionDx * fade;
        point.y += predictionDy * fade;
        return point;
      }

      const me = snapshot.snakes.find((snake) => snake.id === playerId);
      let targetCx = mapSize / 2;
      let targetCy = mapSize / 2;
      if (me?.alive && me.body.length) {
        lerpSeg(me.id, 0, me.body[0], tmpPoint);
        const distance = predictionDistance(me, wallNow);
        const angle = (displayAngle(me.angle) * Math.PI) / 180;
        applyPrediction(tmpPoint, 0, Math.cos(angle) * distance, Math.sin(angle) * distance);
        targetCx = tmpPoint.x;
        targetCy = tmpPoint.y;
      }
      if (!camera.ready || Math.hypot(targetCx - camera.x, targetCy - camera.y) > 24) {
        camera.x = targetCx;
        camera.y = targetCy;
        camera.ready = true;
      } else {
        camera.x += (targetCx - camera.x) * CAMERA_SMOOTHING;
        camera.y += (targetCy - camera.y) * CAMERA_SMOOTHING;
      }

      const vx0 = camera.x - W / 2 / CELL;
      const vy0 = camera.y - H / 2 / CELL;
      const vxMax = vx0 + W / CELL;
      const vyMax = vy0 + H / CELL;
      const PAD = 2;
      // Adaptive quality: lowDetail when EMA frame time exceeds budget
      const lowDetail = frameTimeEma > FRAME_BUDGET_MS;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, W, H);

      if (!lowDetail) {
        // Offscreen grid cache: only rebuild when canvas size or camera tile-offset changes
        const tileX = Math.floor(vx0);
        const tileY = Math.floor(vy0);
        if (
          !gridCache ||
          gridCacheW !== W || gridCacheH !== H ||
          gridCacheVx0 !== tileX || gridCacheVy0 !== tileY
        ) {
          gridCacheW = W; gridCacheH = H;
          gridCacheVx0 = tileX; gridCacheVy0 = tileY;
          if (!gridCache || (gridCache as OffscreenCanvas).width !== W) {
            gridCache = createSpriteCanvas(W);
            (gridCache as OffscreenCanvas).height = H;
          }
          const gc = getContext2d(gridCache)!;
          gc.clearRect(0, 0, W, H);
          gc.strokeStyle = "rgba(255,255,255,0.04)";
          gc.lineWidth = 1;
          gc.beginPath();
          for (let gx = tileX; gx <= Math.ceil(vxMax); gx++) {
            const sx = (gx - vx0) * CELL;
            gc.moveTo(sx, 0); gc.lineTo(sx, H);
          }
          for (let gy = tileY; gy <= Math.ceil(vyMax); gy++) {
            const sy = (gy - vy0) * CELL;
            gc.moveTo(0, sy); gc.lineTo(W, sy);
          }
          gc.stroke();
        }
        ctx.drawImage(gridCache as CanvasImageSource, 0, 0);
      }

      ctx.save();
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 5;
      ctx.beginPath();
      const leftEdge = (0 - vx0) * CELL;
      const rightEdge = (mapSize - vx0) * CELL;
      const topEdge = (0 - vy0) * CELL;
      const bottomEdge = (mapSize - vy0) * CELL;
      if (leftEdge >= -16 && leftEdge <= W + 16) {
        ctx.moveTo(leftEdge, 0);
        ctx.lineTo(leftEdge, H);
      }
      if (rightEdge >= -16 && rightEdge <= W + 16) {
        ctx.moveTo(rightEdge, 0);
        ctx.lineTo(rightEdge, H);
      }
      if (topEdge >= -16 && topEdge <= H + 16) {
        ctx.moveTo(0, topEdge);
        ctx.lineTo(W, topEdge);
      }
      if (bottomEdge >= -16 && bottomEdge <= H + 16) {
        ctx.moveTo(0, bottomEdge);
        ctx.lineTo(W, bottomEdge);
      }
      ctx.stroke();
      ctx.restore();

      const now = frameStart;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const food of snapshot.foods) {
        if (food.x < vx0 - PAD || food.x > vxMax + PAD || food.y < vy0 - PAD || food.y > vyMax + PAD) continue;
        const px = (food.x - vx0) * CELL + CELL / 2;
        const py = (food.y - vy0) * CELL + CELL / 2;

        if (food.skill) {
          const skill = SKILL_BY_KEY[food.skill];
          if (skill) {
            const sprite = getSprite(skill.emoji, skill.color, CELL + 4);
            const size = CELL + 4;
            if (lowDetail) {
              ctx.drawImage(sprite, px - size, py - size, size * 2, size * 2);
              continue;
            }
            const phase = (food.x * 12.9898 + food.y * 78.233) % (Math.PI * 2);
            const tSec = now / 1000;
            const rot = (tSec * 1.8 + phase) % (Math.PI * 2);
            const pulse = 0.5 + Math.sin(tSec * 4 + phase) * 0.5;
            ctx.save();
            ctx.translate(px, py);
            ctx.beginPath();
            ctx.arc(0, 0, CELL * (0.6 + pulse * 0.16), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${hexToRgb(skill.color)},${0.3 + pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.rotate(rot);
            ctx.drawImage(sprite, -size, -size, size * 2, size * 2);
            ctx.restore();
            continue;
          }
        }

        const tier = food.tier ?? FOOD_TYPE_TIER[food.type] ?? 0;
        const glyph = FOODS[food.type % FOODS.length];

        if (tier === 0) {
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

      const R = CELL * 0.44;
      const HR = R + 2;

      for (const snake of snapshot.snakes) {
        if (!snake.alive || !snake.body.length) continue;
        const skin = SKINS[snake.skinId % SKINS.length];
        const isMe = snake.id === playerId;
        const bodyIndexes = snake.bodyIndexes;
        let predictionDx = 0;
        let predictionDy = 0;
        if (isMe) {
          const distance = predictionDistance(snake, wallNow);
          if (distance > 0) {
            const angle = (displayAngle(snake.angle) * Math.PI) / 180;
            predictionDx = Math.cos(angle) * distance;
            predictionDy = Math.sin(angle) * distance;
          }
        }
        let visibleCount = 0;

        for (let i = 0; i < snake.body.length; i++) {
          const bodyIndex = bodyIndexes?.[i] ?? i;
          lerpSeg(snake.id, bodyIndex, snake.body[i], tmpPoint);
          applyPrediction(tmpPoint, bodyIndex, predictionDx, predictionDy);
          const wx = tmpPoint.x;
          const wy = tmpPoint.y;
          if (wx < vx0 - PAD || wx > vxMax + PAD || wy < vy0 - PAD || wy > vyMax + PAD) continue;
          const slot = visibleSegs[visibleCount] ?? (visibleSegs[visibleCount] = { i: 0, sx: 0, sy: 0 });
          slot.i = bodyIndex;
          slot.sx = (wx - vx0) * CELL;
          slot.sy = (wy - vy0) * CELL;
          visibleCount++;
        }
        if (!visibleCount) continue;

        ctx.save();

        if (!lowDetail && skin.glow && isMe) {
          ctx.shadowColor = skin.glow;
          ctx.shadowBlur = 18;
        }
        ctx.beginPath();
        ctx.lineWidth = R * 2 - 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = skin.body[0];
        let drawing = false;
        for (let vi = 0; vi < visibleCount; vi++) {
          const { i, sx, sy } = visibleSegs[vi];
          const pcx = sx + R;
          const pcy = sy + R;
          if (!drawing || (vi > 0 && i !== visibleSegs[vi - 1].i + 1)) {
            ctx.moveTo(pcx, pcy);
            drawing = true;
          } else {
            ctx.lineTo(pcx, pcy);
          }
        }
        ctx.stroke();

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
          const hcx = headSeg.sx + R;
          const hcy = headSeg.sy + R;
          if (!lowDetail && skin.glow) {
            ctx.shadowColor = skin.glow;
            ctx.shadowBlur = isMe ? 24 : 14;
          }
          ctx.fillStyle = lighten(skin.head, 0.25);
          ctx.beginPath();
          ctx.arc(hcx, hcy, HR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          const angle = (displayAngle(snake.angle) * Math.PI) / 180;
          const ex = Math.cos(angle) * R * 0.45;
          const ey = Math.sin(angle) * R * 0.45;
          const ep = Math.cos(angle + Math.PI / 2) * R * 0.35;
          const eq = Math.sin(angle + Math.PI / 2) * R * 0.35;
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

        const head = snake.body[0];
        if ((!lowDetail || isMe) && head.x >= vx0 - PAD && head.x <= vxMax + PAD) {
          lerpSeg(snake.id, bodyIndexes?.[0] ?? 0, head, tmpPoint);
          applyPrediction(tmpPoint, bodyIndexes?.[0] ?? 0, predictionDx, predictionDy);
          const nhx = (tmpPoint.x - vx0) * CELL;
          const nhy = (tmpPoint.y - vy0) * CELL;
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

      if (me?.alive && me.body.length) {
        lerpSeg(me.id, 0, me.body[0], tmpPoint);
        const hx = tmpPoint.x;
        const hy = tmpPoint.y;
        const WARN = 50;
        const alpha = (dist: number) => Math.max(0, Math.min(0.6, 1 - dist / WARN)) * 0.6;
        const drawWarn = (gradient: CanvasGradient, a: number) => {
          if (a <= 0) return;
          gradient.addColorStop(0, `rgba(255,50,50,${a})`);
          gradient.addColorStop(1, "rgba(255,50,50,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, W, H);
        };
        if (hx < WARN) drawWarn(ctx.createLinearGradient(0, 0, W * 0.3, 0), alpha(hx));
        if (hx > mapSize - WARN) drawWarn(ctx.createLinearGradient(W, 0, W * 0.7, 0), alpha(mapSize - hx));
        if (hy < WARN) drawWarn(ctx.createLinearGradient(0, 0, 0, H * 0.3), alpha(hy));
        if (hy > mapSize - WARN) drawWarn(ctx.createLinearGradient(0, H, 0, H * 0.7), alpha(mapSize - hy));
      }

      // EMA of frame time — drives adaptive quality next frame (no hysteresis cliff)
      frameTimeEma = frameTimeEma * 0.85 + (performance.now() - frameStart) * 0.15;
    },

    dispose() {
      disposed = true;
      buffer.length = 0;
      prevBodies.clear();
      prevIndexMaps.clear();
      visibleSegs.length = 0;
      gridCache = null;
    },
  };

  return renderer;
}

/** Shared snake wire protocol + pure helpers (client + server). */

export const SNAKE_MAP_SIZE = 1000;
export const SNAKE_CELL_SIZE = 20;
export const SNAKE_TICK_MS = 200;
export const SNAKE_INIT_LENGTH = 5;
export const SNAKE_VIEW_RADIUS = 60;
export const SNAKE_BODY_VIEW_PADDING = 4;
export const SNAKE_FULL_BODY_RADIUS = 80;
export const SNAKE_COLLISION_BUCKET = 2;
/** Head-to-body hit radius squared (server uses < 0.64). */
export const SNAKE_HIT_RADIUS_SQ = 0.64;
export const SNAKE_MAX_PLAYERS = 50;

/** Lobby-listed rooms (any valid id can still be joined via custom code). */
export const SNAKE_PUBLIC_ROOMS: ReadonlyArray<{ id: string; title: string; blurb: string }> = [
  { id: "main", title: "主大厅", blurb: "默认混战 · 10 bot · 标准食物" },
  { id: "relax", title: "休闲房", blurb: "少 bot · 少食物 · 压力小" },
  { id: "rush", title: "竞速房", blurb: "多 bot · 食物更密 · 冲分" },
];

export type SnakeRoomConfig = {
  botTarget: number;
  foodTarget: number;
  maxPlayers: number;
};

const DEFAULT_ROOM_CONFIG: SnakeRoomConfig = {
  botTarget: 10,
  foodTarget: 5000,
  maxPlayers: 50,
};

const ROOM_CONFIGS: Record<string, SnakeRoomConfig> = {
  main: DEFAULT_ROOM_CONFIG,
  relax: { botTarget: 4, foodTarget: 3200, maxPlayers: 40 },
  rush: { botTarget: 16, foodTarget: 6500, maxPlayers: 50 },
};

/** Per-room difficulty / density. Unknown rooms use main defaults. */
export function getRoomConfig(roomId: string | null | undefined): SnakeRoomConfig {
  const id = normalizeRoomId(roomId);
  return ROOM_CONFIGS[id] ?? DEFAULT_ROOM_CONFIG;
}

const ROOM_ID_RE = /^[a-z0-9_-]{1,24}$/;

/** Normalize / sanitize room id for Durable Object name. Invalid → main. */
export function normalizeRoomId(raw: string | null | undefined): string {
  const s = (raw ?? "main").trim().toLowerCase();
  return ROOM_ID_RE.test(s) ? s : "main";
}

export type SnakeVec2 = { x: number; y: number };

export type SnakeRoomStatus = {
  roomId: string;
  humans: number;
  bots: number;
  maxPlayers: number;
  open: boolean;
  botTarget?: number;
  foodTarget?: number;
};

// ── Client → Server ──────────────────────────────────────────────────────────

export type SnakeClientMessage =
  | { type: "steer"; angle: number }
  | { type: "boost"; active: boolean }
  | { type: "leave" };

// ── Server → Client ──────────────────────────────────────────────────────────

export type SnakeEffectsWire = {
  boost?: number;
  slow?: number;
  shield?: number;
  magnet?: number;
  double?: number;
  ghost?: number;
  activeBoost?: number;
};

export type SnakeInfoWire = {
  id: string;
  username: string;
  avatarUrl: string | null;
  skinId: number;
  body: SnakeVec2[];
  angle: number;
  alive: boolean;
  score: number;
  kills: number;
  respawnAt: number;
  bodyLength?: number;
  bodyHead?: boolean;
  bodyPartial?: boolean;
  bodyIndexes?: number[];
  effects?: SnakeEffectsWire;
  isBot?: boolean;
};

export type FoodInfoWire = {
  x: number;
  y: number;
  type: number;
  value: number;
  tier: number;
  skill?: string;
};

export type LeaderEntryWire = {
  id: string;
  username: string;
  score: number;
  kills: number;
  isBot?: boolean;
};

export type SnakeInitMessage = {
  type: "init";
  playerId: string;
  mapSize: number;
  tickMs?: number;
  roomId?: string;
};

export type SnakeStateMessage = {
  type: "state";
  tick: number;
  playerId?: string;
  snakes: SnakeInfoWire[];
  foods: FoodInfoWire[];
  leaderboard: LeaderEntryWire[];
  onlineCount?: number;
};

export type SnakeServerMessage = SnakeInitMessage | SnakeStateMessage;

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function collisionBucketKey(x: number, y: number, bucket = SNAKE_COLLISION_BUCKET): string {
  return `${Math.floor(x / bucket)},${Math.floor(y / bucket)}`;
}

export type BodySegmentRef = { snakeId: string; x: number; y: number };

/**
 * Find a foreign body segment near (x,y) in a collision grid of neighboring buckets.
 * Matches server findBodyHit: radius² < 0.64, ignores ownId.
 */
export function findBodyHit(
  grid: Map<string, BodySegmentRef[]>,
  ownId: string,
  x: number,
  y: number,
  bucket = SNAKE_COLLISION_BUCKET,
  hitRadiusSq = SNAKE_HIT_RADIUS_SQ,
): BodySegmentRef | null {
  const bx = Math.floor(x / bucket);
  const by = Math.floor(y / bucket);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cells = grid.get(`${bx + dx},${by + dy}`);
      if (!cells) continue;
      for (const seg of cells) {
        if (seg.snakeId === ownId) continue;
        const sx = seg.x - x;
        const sy = seg.y - y;
        if (sx * sx + sy * sy < hitRadiusSq) return seg;
      }
    }
  }
  return null;
}

/** Build collision grid from live snake bodies (full rebuild). */
export function buildCollisionGrid(
  snakes: Iterable<{ id: string; alive: boolean; body: SnakeVec2[] }>,
  bucket = SNAKE_COLLISION_BUCKET,
): Map<string, BodySegmentRef[]> {
  const grid = new Map<string, BodySegmentRef[]>();
  for (const snake of snakes) {
    if (!snake.alive) continue;
    for (const seg of snake.body) {
      const key = collisionBucketKey(seg.x, seg.y, bucket);
      let cells = grid.get(key);
      if (!cells) {
        cells = [];
        grid.set(key, cells);
      }
      cells.push({ snakeId: snake.id, x: seg.x, y: seg.y });
    }
  }
  return grid;
}

/** Score after eating ordinary food (with optional double multiplier). */
export function scoreAfterFood(
  currentScore: number,
  foodValue: number,
  doubleActive: boolean,
): number {
  const mul = doubleActive ? 2 : 1;
  return currentScore + foodValue * mul;
}

/** Active boost burn: score/length costs and whether boost is allowed. */
export function canActiveBoost(length: number, score: number, minLength: number, scoreCost: number): boolean {
  return length >= minLength && score >= scoreCost;
}

export function applyActiveBoostCost(
  score: number,
  length: number,
  scoreCost: number,
  lengthCost: number,
  minLength: number,
): { score: number; length: number } {
  return {
    score: Math.max(0, score - scoreCost),
    length: Math.max(minLength, length - lengthCost),
  };
}

/** Clamp angle into [0, 360). */
export function normalizeAngle(angle: number): number {
  const a = angle % 360;
  return a < 0 ? a + 360 : a;
}

/** Whether a segment should be sent as full body vs head-only (AOI). */
export function shouldSendFullBody(
  viewerX: number,
  viewerY: number,
  targetX: number,
  targetY: number,
  fullBodyRadius = SNAKE_FULL_BODY_RADIUS,
): boolean {
  const dx = viewerX - targetX;
  const dy = viewerY - targetY;
  return dx * dx + dy * dy <= fullBodyRadius * fullBodyRadius;
}

/** Whether food is inside viewer radius (circle). */
export function inViewRadius(
  viewerX: number,
  viewerY: number,
  targetX: number,
  targetY: number,
  radius = SNAKE_VIEW_RADIUS,
): boolean {
  const dx = viewerX - targetX;
  const dy = viewerY - targetY;
  return dx * dx + dy * dy <= radius * radius;
}

export function parseClientMessage(raw: unknown): SnakeClientMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type === "leave") return { type: "leave" };
  if (msg.type === "steer" && typeof msg.angle === "number" && Number.isFinite(msg.angle)) {
    return { type: "steer", angle: msg.angle };
  }
  if (msg.type === "boost" && typeof msg.active === "boolean") {
    return { type: "boost", active: msg.active };
  }
  return null;
}

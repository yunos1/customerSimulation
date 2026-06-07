// Durable Object: 贪吃蛇游戏房间
// 每个房间最多 50 人，服务端 100ms tick 权威移动

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
}

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MAP_SIZE = 1000;
const CELL_SIZE = 20;
const TICK_MS = 200;
const FOOD_TARGET = 5000;
const INIT_LENGTH = 5;
const RESPAWN_MS = 5000;
const MAX_PLAYERS = 50;
const SKIN_COUNT = 20;
const MAX_CONNECTIONS = MAX_PLAYERS * 3;
const SAVE_INTERVAL_TICKS = 50;
const FOOD_BUCKET = 25;
const COLLISION_BUCKET = 2;
const VIEW_RADIUS = 60;
const BODY_VIEW_PADDING = 4;
// 近距离蛇发完整 body，远处蛇只发头（小地图够用），减少序列化开销
const FULL_BODY_RADIUS = 80; // 世界格数
// AI bot 常驻数量
const BOT_TARGET = 10;
const BOT_NAMES = ["小红","小蓝","老王","阿强","小花","大壮","小鹿","阿宝","老虎","小鱼"];
const BOT_WANDER_MIN_DIST = 180;
const BOT_WANDER_REACHED_DIST = 30;
const BOT_WANDER_RETARGET_TICKS = 90;
const BOT_FOOD_SCAN_RADIUS = 55;
const BOT_HIGH_VALUE_FOOD_RADIUS = 130;
const ACTIVE_BOOST_MIN_LENGTH = 8;
const ACTIVE_BOOST_SCORE_COST = 2;
const ACTIVE_BOOST_LENGTH_COST = 1;
const ACTIVE_BOOST_DURATION_MS = 900;
const ACTIVE_BOOST_BURN_INTERVAL_MS = 800;
const ACTIVE_BOOST_SPEED_MUL = 2;

// ── 食物分层 ──────────────────────────────────────────────────────────────────
// tier 0 基础, tier 1 中级, tier 2 高级（含技能食物，但技能单独控制权重）
const FOOD_TIERS = [
  { offset: 0,  count: 14, values: [1, 1, 1, 2, 2], weight: 78 }, // 基础
  { offset: 14, count: 6,  values: [3, 4, 5],        weight: 14 }, // 中级
  { offset: 20, count: 6,  values: [8, 10, 15],       weight: 4  }, // 高级（非技能）
];
const FOOD_WEIGHT_TOTAL = FOOD_TIERS.reduce((s, t) => s + t.weight, 0);

// 技能食物（server key 须与 skins.ts SKILL_FOODS[].key 一致）
const SKILLS: Array<{ key: string; weight: number; value: number; instant: boolean }> = [
  { key: "boost",  weight: 18, value: 0,  instant: false },
  { key: "slow",   weight: 16, value: 0,  instant: false },
  { key: "shield", weight: 12, value: 0,  instant: false },
  { key: "ghost",  weight: 10, value: 0,  instant: false },
  { key: "magnet", weight: 10, value: 0,  instant: false },
  { key: "double", weight: 12, value: 0,  instant: false },
  { key: "thorn",  weight: 10, value: -5, instant: true  }, // 扣分
  { key: "mine",   weight:  4, value: 0,  instant: true  }, // 致命（少）
];
const SKILL_WEIGHT_TOTAL = SKILLS.reduce((s, k) => s + k.weight, 0);
// 技能食物在全部食物抽取中的占比权重
const SKILL_POOL_WEIGHT = 4;
const TOTAL_POOL = FOOD_WEIGHT_TOTAL + SKILL_POOL_WEIGHT;

// buff 持续时长（ms）
const EFFECT_DUR: Record<string, number> = {
  boost: 10000, slow: 5000, shield: 6000, ghost: 6000, magnet: 8000, double: 8000,
};

// ── 类型 ──────────────────────────────────────────────────────────────────────

type Vec2 = { x: number; y: number };
type BodySegmentRef = { snakeId: string; x: number; y: number };
type ClientConnection = { ws: WebSocket; snakeId: string };

interface SnakeEffects {
  boost?: number; slow?: number; shield?: number;
  magnet?: number; double?: number; ghost?: number; activeBoost?: number;
}

interface Snake {
  id: string;
  username: string;
  avatarUrl: string | null;
  skinId: number;
  body: Vec2[];
  angle: number;
  alive: boolean;
  score: number;
  bestScore: number;
  kills: number;
  respawnAt: number;
  joinedAt: number;
  isBot: boolean;
  effects: SnakeEffects;
  stepAccum: number; // 变速累加器（≥1 才真正移动一格）
  boostHeld: boolean;
  nextBoostBurnAt: number;
  sessionRecorded: boolean;
  botTarget?: Vec2;
  botTargetTick?: number;
}

interface Food {
  x: number;
  y: number;
  type: number;
  value: number;
  tier: number;
  skill?: string; // 技能 key，普通食物无此字段
}

interface GameState {
  snakes: Map<string, Snake>;
  foods: Map<string, Food>;
  foodGrid: Map<string, Set<string>>;
  tick: number;
}

// ── Durable Object ────────────────────────────────────────────────────────────

export class SnakeRoom {
  private state: DurableObjectState;
  private env: Env;
  private clients: Map<string, ClientConnection> = new Map();
  private game: GameState = { snakes: new Map(), foods: new Map(), foodGrid: new Map(), tick: 0 };
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  // Persistent collision grid — rebuilt only on snake death/spawn, incremented on move
  private collisionGrid: Map<string, BodySegmentRef[]> = new Map();
  private collisionGridDirty = true;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const qToken = url.searchParams.get("token");
    const cookieToken = this.getCookieToken(request);
    const payload = qToken ? await this.verifyToken(qToken)
      : cookieToken ? await this.verifyToken(cookieToken)
      : null;

    const id = (payload?.sub as string) ?? `guest_${crypto.randomUUID().slice(0, 8)}`;
    const username = (payload?.username as string) ?? `游客${id.slice(-4)}`;
    const avatarUrl = (payload?.avatar_url as string) ?? null;

    const alreadyInRoom = this.game.snakes.has(id);
    if (!alreadyInRoom && this.humanPlayerCount() >= MAX_PLAYERS) {
      return new Response("Room full", { status: 503 });
    }
    if (this.clients.size >= MAX_CONNECTIONS) {
      return new Response("Room full", { status: 503 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const clientId = crypto.randomUUID();
    this.clients.set(clientId, { ws: server, snakeId: id });
    if (!this.game.snakes.has(id)) {
      this.spawnSnake(id, username, avatarUrl, false);
    }

    this.sendToClient(clientId, { type: "init", mapSize: MAP_SIZE, cellSize: CELL_SIZE, tickMs: TICK_MS, playerId: id });
    this.sendGameState(clientId, id);

    server.addEventListener("message", (ev) => {
      try { this.handleMessage(clientId, id, JSON.parse(ev.data as string)); }
      catch { /* ignore bad json */ }
    });

    server.addEventListener("close", () => {
      this.clients.delete(clientId);
      if (this.connectionCountForSnake(id) === 0) {
        const snake = this.game.snakes.get(id);
        if (snake && !snake.isBot) void this.saveScore(snake, { recordSession: true });
        this.game.snakes.delete(id);
      }
      if (this.clients.size === 0) this.stopTick();
    });

    this.startTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── 游戏循环 ────────────────────────────────────────────────────────────────

  private startTick() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
  }

  private tick() {
    const now = Date.now();
    this.game.tick++;

    // 补充/维持 bot
    this.maintainBots();

    // 复活检查
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive && snake.respawnAt && now >= snake.respawnAt) {
        this.respawn(snake);
      }
    }

    // 移动
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      if (snake.isBot) this.botSteer(snake);
      this.updateActiveBoost(snake, now);
      this.moveSnake(snake, now);
    }

    // 碰撞检测（头碰他人蛇身）
    if (this.collisionGridDirty) this.rebuildCollisionGrid();
    const collisionGrid = this.collisionGrid;
    const deaths: Array<{ killer: string; victim: string }> = [];
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      // 护盾/幽灵免疫碰撞（幽灵：穿过他人身体；护盾：护住自己不被其他头击杀）
      const hasGhost = now < (snake.effects.ghost ?? 0);
      if (hasGhost) continue;
      const head = snake.body[0];
      const hit = this.findBodyHit(collisionGrid, snake.id, head.x, head.y);
      if (hit) {
        const hasShield = now < (snake.effects.shield ?? 0);
        if (!hasShield) deaths.push({ killer: hit.snakeId, victim: snake.id });
      }
    }

    const died = new Set<string>();
    for (const { killer, victim } of deaths) {
      if (died.has(victim)) continue;
      died.add(victim);
      const victimSnake = this.game.snakes.get(victim)!;
      const killerSnake = this.game.snakes.get(killer);
      if (killerSnake && !killerSnake.isBot) killerSnake.kills++;
      this.killSnake(victimSnake);
    }

    // 吃食物
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      const head = snake.body[0];
      const minX = Math.floor(head.x - 0.8), maxX = Math.ceil(head.x + 0.8);
      const minY = Math.floor(head.y - 0.8), maxY = Math.ceil(head.y + 0.8);
      let eaten = false;
      outer: for (let gx = minX; gx <= maxX; gx++) {
        for (let gy = minY; gy <= maxY; gy++) {
          const key = `${gx},${gy}`;
          const food = this.game.foods.get(key);
          if (food) {
            const dx = food.x - head.x;
            const dy = food.y - head.y;
            if (dx * dx + dy * dy >= 0.64) continue;
            this.applyFood(snake, food, key, now);
            eaten = true;
            break outer;
          }
        }
      }
      if (!eaten) {
        // 磁铁：自动吸附附近食物（每 tick 朝头移动）
        if (now < (snake.effects.magnet ?? 0)) {
          this.magnetPull(snake);
        }
      }
    }

    // 补充食物
    const shortage = FOOD_TARGET - this.game.foods.size;
    if (shortage > 0) {
      const batch = Math.min(shortage, 50);
      for (let i = 0; i < batch; i++) this.spawnFood();
    }

    // 广播
    const leaderboard = Array.from(this.game.snakes.values())
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((s) => ({ id: s.id, username: s.username, score: s.score, kills: s.kills, isBot: s.isBot }));
    let onlineCount = 0;
    for (const snake of this.game.snakes.values()) {
      if (snake.alive && !snake.isBot) onlineCount++;
    }
    this.broadcastDelta(leaderboard, onlineCount, now);

    if (this.game.tick % SAVE_INTERVAL_TICKS === 0) {
      for (const snake of this.game.snakes.values()) {
          if (snake.alive && !snake.isBot) void this.saveScore(snake);
      }
    }
  }

  // ── 变速移动（步进累加器）──────────────────────────────────────────────────
  // speedMul=2 每 tick 移动 2 格，=0.5 每 2 tick 移动 1 格，平滑兼容整格移动

  private moveSnake(snake: Snake, now: number) {
    let speedMul = 1;
    if (now < (snake.effects.boost ?? 0)) speedMul = 2;
    else if (now < (snake.effects.activeBoost ?? 0)) speedMul = ACTIVE_BOOST_SPEED_MUL;
    else if (now < (snake.effects.slow ?? 0)) speedMul = 0.5;

    snake.stepAccum += speedMul;
    const steps = Math.floor(snake.stepAccum);
    if (steps <= 0) return;
    snake.stepAccum -= steps;

    const rad = (snake.angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const head = snake.body[0];
    let safeSteps = 0;
    for (let step = 1; step <= steps; step++) {
      const nx = head.x + dx * step;
      const ny = head.y + dy * step;
      if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) {
        if (safeSteps > 0) this.advanceSnakeBody(snake, safeSteps, dx, dy);
        this.killSnake(snake);
        return;
      }
      safeSteps = step;
    }
    this.advanceSnakeBody(snake, steps, dx, dy);
  }

  private advanceSnakeBody(snake: Snake, steps: number, dx: number, dy: number) {
    const body = snake.body;
    const length = body.length;
    if (length === 0) return;
    const actualSteps = Math.min(steps, length);
    const head = body[0];

    for (let i = length - 1; i >= actualSteps; i--) {
      body[i] = body[i - actualSteps];
    }
    for (let i = 0; i < actualSteps; i++) {
      const distance = actualSteps - i;
      body[i] = { x: head.x + dx * distance, y: head.y + dy * distance };
    }
    this.collisionGridDirty = true;
  }

  private updateActiveBoost(snake: Snake, now: number) {
    if (!snake.boostHeld) return;
    if (now < snake.nextBoostBurnAt) return;
    if (now < (snake.effects.boost ?? 0)) {
      snake.nextBoostBurnAt = now + TICK_MS;
      return;
    }
    if (snake.body.length < ACTIVE_BOOST_MIN_LENGTH || snake.score < ACTIVE_BOOST_SCORE_COST) {
      snake.boostHeld = false;
      return;
    }

    snake.score = Math.max(0, snake.score - ACTIVE_BOOST_SCORE_COST);
    for (let i = 0; i < ACTIVE_BOOST_LENGTH_COST && snake.body.length > INIT_LENGTH; i++) {
      snake.body.pop();
    }
    snake.effects.activeBoost = now + ACTIVE_BOOST_DURATION_MS;
    snake.nextBoostBurnAt = now + ACTIVE_BOOST_BURN_INTERVAL_MS;
  }

  // ── 技能食物处理 ────────────────────────────────────────────────────────────

  private applyFood(snake: Snake, food: Food, key: string, now: number) {
    const sk = food.skill;
    this.removeFood(key);

    if (!sk) {
      // 普通食物
      const mul = now < (snake.effects.double ?? 0) ? 2 : 1;
      snake.score += food.value * mul;
      snake.bestScore = Math.max(snake.bestScore ?? 0, snake.score);
      snake.body.push({ ...snake.body[snake.body.length - 1] });
      return;
    }

    switch (sk) {
      case "mine":
        if (now < (snake.effects.shield ?? 0)) {
          // 护盾抵挡地雷，护盾消耗
          snake.effects.shield = 0;
        } else {
          this.killSnake(snake);
        }
        break;
      case "thorn": {
        // 荆棘扣分，并截短蛇（弹出尾节）
        const penalty = Math.abs(SKILLS.find((s) => s.key === "thorn")!.value);
        snake.score = Math.max(0, snake.score - penalty);
        if (snake.body.length > INIT_LENGTH) snake.body.pop();
        break;
      }
      case "boost":
      case "slow":
      case "shield":
      case "ghost":
      case "magnet":
      case "double":
        snake.effects[sk] = now + EFFECT_DUR[sk];
        snake.body.push({ ...snake.body[snake.body.length - 1] });
        snake.bestScore = Math.max(snake.bestScore ?? 0, snake.score);
        break;
    }
  }

  // ── 磁铁：把附近食物"吸"近 ────────────────────────────────────────────────

  private magnetPull(snake: Snake) {
    const head = snake.body[0];
    const R = 12; // 磁铁吸附半径（格）
    const nearby = this.foodsInRange(head.x, head.y, R);
    for (const food of nearby.slice(0, 5)) {
      const dx = head.x - food.x, dy = head.y - food.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.8) {
        // 到达头部，吃掉
        const key = `${Math.round(food.x)},${Math.round(food.y)}`;
        this.applyFood(snake, food, key, Date.now());
        continue;
      }
      // 向头移动一格
      const step = Math.min(1, dist);
      const nx = Math.round(food.x + (dx / dist) * step);
      const ny = Math.round(food.y + (dy / dist) * step);
      const oldKey = `${Math.round(food.x)},${Math.round(food.y)}`;
      const newKey = `${nx},${ny}`;
      if (oldKey !== newKey && !this.game.foods.has(newKey)) {
        this.removeFood(oldKey);
        this.addFood(nx, ny, food.type, food.value, food.tier, food.skill);
      }
    }
  }

  // ── Bot AI ──────────────────────────────────────────────────────────────────

  private maintainBots() {
    let botCount = 0;
    for (const snake of this.game.snakes.values()) {
      if (snake.isBot) botCount++;
    }
    const need = BOT_TARGET - botCount;
    for (let i = 0; i < need; i++) {
      const idx = rand(BOT_NAMES.length);
      const botId = `bot_${crypto.randomUUID().slice(0, 6)}`;
      this.spawnSnake(botId, BOT_NAMES[idx], null, true);
    }
  }

  private rebuildCollisionGrid() {
    const grid = this.collisionGrid;
    grid.clear();
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      for (const seg of snake.body) {
        const key = SnakeRoom.collisionBucketKey(seg.x, seg.y);
        let bucket = grid.get(key);
        if (!bucket) { bucket = []; grid.set(key, bucket); }
        bucket.push({ snakeId: snake.id, x: seg.x, y: seg.y });
      }
    }
    this.collisionGridDirty = false;
  }

  private buildCollisionGrid(): Map<string, BodySegmentRef[]> {
    const grid = new Map<string, BodySegmentRef[]>();
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      for (const seg of snake.body) {
        const key = SnakeRoom.collisionBucketKey(seg.x, seg.y);
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push({ snakeId: snake.id, x: seg.x, y: seg.y });
      }
    }
    return grid;
  }

  private findBodyHit(grid: Map<string, BodySegmentRef[]>, ownId: string, x: number, y: number): BodySegmentRef | null {
    const bx = Math.floor(x / COLLISION_BUCKET);
    const by = Math.floor(y / COLLISION_BUCKET);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${bx + dx},${by + dy}`);
        if (!bucket) continue;
        for (const seg of bucket) {
          if (seg.snakeId === ownId) continue;
          const sx = seg.x - x;
          const sy = seg.y - y;
          if (sx * sx + sy * sy < 0.64) return seg;
        }
      }
    }
    return null;
  }

  private botSteer(snake: Snake) {
    // 每 3 tick 重新计算一次转向（节省 CPU）
    if (this.game.tick % 3 !== 0) return;
    const head = snake.body[0];

    // 优先：逃墙
    const WALL_DIST = 30;
    if (head.x < WALL_DIST || head.x > MAP_SIZE - WALL_DIST ||
        head.y < WALL_DIST || head.y > MAP_SIZE - WALL_DIST) {
      // 转向地图中心
      const toCenter = Math.atan2(MAP_SIZE / 2 - head.y, MAP_SIZE / 2 - head.x) * 180 / Math.PI;
      snake.angle = ((toCenter + 360) % 360);
      return;
    }

    const foodTarget = this.pickBotFoodTarget(head);
    if (foodTarget) {
      this.steerToward(snake, foodTarget);
      return;
    }

    if (!snake.botTarget || this.shouldRefreshBotTarget(snake, head)) {
      snake.botTarget = this.randomBotTarget(head);
      snake.botTargetTick = this.game.tick;
    }
    this.steerToward(snake, snake.botTarget);
  }

  private pickBotFoodTarget(head: Vec2): Food | null {
    const nearby = this.foodsInRange(head.x, head.y, BOT_HIGH_VALUE_FOOD_RADIUS);
    let best: Food | null = null;
    let bestScore = -Infinity;
    for (const food of nearby) {
      if (food.skill === "mine") continue;
      const dx = food.x - head.x;
      const dy = food.y - head.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > BOT_HIGH_VALUE_FOOD_RADIUS * BOT_HIGH_VALUE_FOOD_RADIUS) continue;
      const closeEnough = d2 <= BOT_FOOD_SCAN_RADIUS * BOT_FOOD_SCAN_RADIUS;
      const valuable = food.tier >= 1 || !!food.skill || food.value >= 3;
      if (!closeEnough && !valuable) continue;
      const score = food.value * 30 + food.tier * 50 + (food.skill ? 70 : 0) - Math.sqrt(d2);
      if (score > bestScore) {
        bestScore = score;
        best = food;
      }
    }
    return best;
  }

  private shouldRefreshBotTarget(snake: Snake, head: Vec2): boolean {
    const target = snake.botTarget;
    if (!target) return true;
    const dx = target.x - head.x;
    const dy = target.y - head.y;
    return (
      dx * dx + dy * dy <= BOT_WANDER_REACHED_DIST * BOT_WANDER_REACHED_DIST ||
      this.game.tick - (snake.botTargetTick ?? 0) > BOT_WANDER_RETARGET_TICKS
    );
  }

  private randomBotTarget(head: Vec2): Vec2 {
    for (let i = 0; i < 20; i++) {
      const target = { x: 40 + rand(MAP_SIZE - 80), y: 40 + rand(MAP_SIZE - 80) };
      const dx = target.x - head.x;
      const dy = target.y - head.y;
      if (dx * dx + dy * dy >= BOT_WANDER_MIN_DIST * BOT_WANDER_MIN_DIST) return target;
    }
    return { x: rand(MAP_SIZE), y: rand(MAP_SIZE) };
  }

  private steerToward(snake: Snake, target: Vec2) {
    const head = snake.body[0];
    const angle = Math.atan2(target.y - head.y, target.x - head.x) * 180 / Math.PI;
    snake.angle = ((angle + 360) % 360);
  }

  private killSnake(snake: Snake) {
    snake.alive = false;
    snake.respawnAt = Date.now() + RESPAWN_MS;
    for (const seg of snake.body) {
      const x = Math.round(seg.x), y = Math.round(seg.y);
      this.addFood(x, y, rand(14), 1, 0, undefined);
    }
    snake.body = [];
    snake.effects = {} as SnakeEffects;
    this.collisionGridDirty = true;
    if (!snake.isBot) void this.saveScore(snake);
  }

  private respawn(snake: Snake) {
    snake.alive = true;
    snake.respawnAt = 0;
    snake.skinId = rand(SKIN_COUNT);
    snake.stepAccum = 0;
    snake.boostHeld = false;
    snake.nextBoostBurnAt = 0;
    snake.effects = {} as SnakeEffects;
    const pos = this.randomEmptyPos();
    snake.body = [];
    for (let i = 0; i < INIT_LENGTH; i++) snake.body.push({ x: pos.x - i, y: pos.y });
    snake.angle = 0;
    if (snake.isBot) {
      snake.botTarget = this.randomBotTarget(pos);
      snake.botTargetTick = this.game.tick;
    }
  }

  private spawnSnake(id: string, username: string, avatarUrl: string | null, isBot: boolean) {
    const pos = this.randomEmptyPos();
    const body: Vec2[] = [];
    for (let i = 0; i < INIT_LENGTH; i++) body.push({ x: pos.x - i, y: pos.y });
    this.game.snakes.set(id, {
      id, username, avatarUrl,
      skinId: rand(SKIN_COUNT), body, angle: 0,
      alive: true, score: 0, bestScore: 0, kills: 0,
      respawnAt: 0, joinedAt: Date.now(),
      isBot, effects: {} as SnakeEffects, stepAccum: 0,
      boostHeld: false, nextBoostBurnAt: 0,
      sessionRecorded: false,
      botTarget: isBot ? this.randomBotTarget(pos) : undefined,
      botTargetTick: isBot ? this.game.tick : undefined,
    });
  }

  private spawnFood() {
    const x = rand(MAP_SIZE);
    const y = rand(MAP_SIZE);
    if (this.game.foods.has(`${x},${y}`)) return;

    // 技能食物 vs 普通食物抽取
    if (rand(TOTAL_POOL) < SKILL_POOL_WEIGHT) {
      const { key, value } = rollSkill();
      this.addFood(x, y, 20 + rand(6), value, 2, key);
    } else {
      const { type, value, tier } = rollFood();
      this.addFood(x, y, type, value, tier, undefined);
    }
  }

  // ── 食物 + 空间网格 ──────────────────────────────────────────────────────────

  private static bucketKey(x: number, y: number): string {
    return `${Math.floor(x / FOOD_BUCKET)},${Math.floor(y / FOOD_BUCKET)}`;
  }

  private static collisionBucketKey(x: number, y: number): string {
    return `${Math.floor(x / COLLISION_BUCKET)},${Math.floor(y / COLLISION_BUCKET)}`;
  }

  private addFood(x: number, y: number, type: number, value: number, tier: number, skill: string | undefined) {
    const key = `${x},${y}`;
    if (this.game.foods.has(key)) return;
    this.game.foods.set(key, { x, y, type, value, tier, skill });
    const bk = SnakeRoom.bucketKey(x, y);
    let bucket = this.game.foodGrid.get(bk);
    if (!bucket) { bucket = new Set(); this.game.foodGrid.set(bk, bucket); }
    bucket.add(key);
  }

  private removeFood(key: string) {
    const food = this.game.foods.get(key);
    if (!food) return;
    this.game.foods.delete(key);
    const bk = SnakeRoom.bucketKey(food.x, food.y);
    const bucket = this.game.foodGrid.get(bk);
    if (bucket) { bucket.delete(key); if (bucket.size === 0) this.game.foodGrid.delete(bk); }
  }

  private foodsInRange(cx: number, cy: number, vr: number): Food[] {
    const out: Food[] = [];
    const bx0 = Math.floor((cx - vr) / FOOD_BUCKET), bx1 = Math.floor((cx + vr) / FOOD_BUCKET);
    const by0 = Math.floor((cy - vr) / FOOD_BUCKET), by1 = Math.floor((cy + vr) / FOOD_BUCKET);
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const bucket = this.game.foodGrid.get(`${bx},${by}`);
        if (!bucket) continue;
        for (const key of bucket) {
          const food = this.game.foods.get(key);
          if (food && Math.abs(food.x - cx) <= vr && Math.abs(food.y - cy) <= vr) out.push(food);
        }
      }
    }
    return out;
  }

  private randomEmptyPos(): Vec2 {
    for (let i = 0; i < 100; i++) {
      const x = rand(MAP_SIZE);
      const y = rand(MAP_SIZE);
      if (!this.game.foods.has(`${x},${y}`)) return { x, y };
    }
    return { x: rand(MAP_SIZE), y: rand(MAP_SIZE) };
  }

  // ── 消息处理 ────────────────────────────────────────────────────────────────

  private handleMessage(clientId: string, id: string, msg: { type: string; angle?: number; active?: boolean }) {
    if (this.clients.get(clientId)?.snakeId !== id) return;
    const snake = this.game.snakes.get(id);
    if (!snake || snake.isBot) return;
    if (msg.type === "leave") {
      void this.saveScore(snake, { recordSession: true });
      return;
    }
    if (!snake.alive) return;
    if (msg.type === "steer" && typeof msg.angle === "number") {
      snake.angle = ((msg.angle % 360) + 360) % 360;
    } else if (msg.type === "boost") {
      snake.boostHeld = msg.active === true;
      if (snake.boostHeld && snake.nextBoostBurnAt < Date.now()) {
        snake.nextBoostBurnAt = Date.now();
      }
      if (!snake.boostHeld) {
        snake.nextBoostBurnAt = 0;
        snake.effects.activeBoost = 0;
      }
    }
  }

  // ── 广播 ────────────────────────────────────────────────────────────────────

  private broadcastDelta(
    leaderboard: { id: string; username: string; score: number; kills: number; isBot: boolean }[],
    onlineCount: number,
    now: number,
  ) {
    // 蛇列表（一次序列化，逐客户端按视距裁剪 body）
    const snakeInfoFull = Array.from(this.game.snakes.values()).map((s) => ({
      id: s.id, username: s.username, avatarUrl: s.avatarUrl,
      skinId: s.skinId, body: s.body, angle: s.angle,
      bodyLength: s.body.length,
      alive: s.alive, score: s.score, kills: s.kills, respawnAt: s.respawnAt,
      isBot: s.isBot,
      effects: activeEffects(s.effects, now),
    }));

    for (const [clientId, client] of this.clients) {
      const id = client.snakeId;
      const snake = this.game.snakes.get(id);
      if (!snake) continue;

      const cx = snake.alive && snake.body.length ? snake.body[0].x : MAP_SIZE / 2;
      const cy = snake.alive && snake.body.length ? snake.body[0].y : MAP_SIZE / 2;
      const vr = VIEW_RADIUS;

      // 逐客户端按视野裁剪蛇身，长蛇不会把整条 body 都发给前端。
      const snakes = snakeInfoFull.map((s) => {
        if (!s.alive || !s.body.length) return s;
        return this.clipSnakeBodyForView(s, id, cx, cy, vr);
      });

      const visibleFoods = this.foodsInRange(cx, cy, vr);

      this.sendToClient(clientId, {
        type: "state", tick: this.game.tick, playerId: id,
        snakes, foods: visibleFoods, leaderboard, onlineCount,
      });
    }
  }

  private clipSnakeBodyForView<
    T extends { id: string; body: Vec2[]; alive: boolean },
  >(snake: T, viewerId: string, cx: number, cy: number, vr: number) {
    const head = snake.body[0];
    const dx = head.x - cx;
    const dy = head.y - cy;
    if (snake.id !== viewerId && dx * dx + dy * dy > FULL_BODY_RADIUS * FULL_BODY_RADIUS) {
      return { ...snake, body: [head], bodyIndexes: [0], bodyHead: true };
    }

    const minX = cx - vr - BODY_VIEW_PADDING;
    const maxX = cx + vr + BODY_VIEW_PADDING;
    const minY = cy - vr - BODY_VIEW_PADDING;
    const maxY = cy + vr + BODY_VIEW_PADDING;
    const body: Vec2[] = [];
    const bodyIndexes: number[] = [];
    for (let index = 0; index < snake.body.length; index++) {
      const seg = snake.body[index];
      if (index === 0 || (seg.x >= minX && seg.x <= maxX && seg.y >= minY && seg.y <= maxY)) {
        body.push(seg);
        bodyIndexes.push(index);
      }
    }

    if (body.length === snake.body.length) return snake;
    return { ...snake, body, bodyIndexes, bodyPartial: true };
  }

  private sendGameState(clientId: string, id: string) {
    const snake = this.game.snakes.get(id);
    const cx = snake?.alive && snake.body.length ? snake.body[0].x : MAP_SIZE / 2;
    const cy = snake?.alive && snake.body.length ? snake.body[0].y : MAP_SIZE / 2;
    const snakes = Array.from(this.game.snakes.values()).map((s) => {
      if (!s.alive || !s.body.length) return s;
      return this.clipSnakeBodyForView({ ...s, bodyLength: s.body.length }, id, cx, cy, VIEW_RADIUS);
    });
    const foods = this.foodsInRange(cx, cy, VIEW_RADIUS);
    this.sendToClient(clientId, {
      type: "state", tick: 0, playerId: id,
      snakes,
      foods, leaderboard: [], onlineCount: this.humanPlayerCount(),
    });
  }

  private sendToClient(clientId: string, data: unknown) {
    const client = this.clients.get(clientId);
    if (client) {
      try { client.ws.send(JSON.stringify(data)); } catch { /* closed */ }
    }
  }

  private humanPlayerCount(): number {
    let count = 0;
    for (const snake of this.game.snakes.values()) {
      if (!snake.isBot) count++;
    }
    return count;
  }

  private connectionCountForSnake(snakeId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.snakeId === snakeId) count++;
    }
    return count;
  }

  // ── 数据库 ──────────────────────────────────────────────────────────────────

  private async saveScore(snake: Snake, options: { recordSession?: boolean } = {}) {
    const scoreToSave = Math.max(snake.bestScore ?? 0, snake.score);
    if (snake.id.startsWith("guest_") || snake.id.startsWith("bot_") || scoreToSave === 0) return;
    const now = Math.floor(Date.now() / 1000);
    await this.env.DB.prepare(
      `INSERT INTO snake_scores (user_id, username, avatar_url, score, kills, skin_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username=excluded.username,
         avatar_url=excluded.avatar_url,
         score=MAX(score, excluded.score),
         kills=MAX(kills, excluded.kills),
         skin_id=excluded.skin_id,
         updated_at=excluded.updated_at`
    ).bind(snake.id, snake.username, snake.avatarUrl, scoreToSave, snake.kills, snake.skinId, now).run();

    await this.env.DB.prepare(
      `DELETE FROM snake_scores WHERE user_id NOT IN (
         SELECT user_id FROM snake_scores ORDER BY score DESC LIMIT 100
       )`
    ).run();

    if (!options.recordSession || snake.sessionRecorded) return;
    const duration = Math.floor((Date.now() - snake.joinedAt) / 1000);
    await this.env.DB.prepare(
      `INSERT INTO snake_sessions (user_id, score, kills, duration_s, played_at) VALUES (?,?,?,?,?)`
    ).bind(snake.id, scoreToSave, snake.kills, duration, now).run();
    snake.sessionRecorded = true;
  }

  private getCookieToken(request: Request): string | null {
    const cookie = request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)session=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  private async verifyToken(token: string): Promise<Record<string, unknown> | null> {
    try {
      const [header, body, sig] = token.split(".");
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(this.env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
      );
      const valid = await crypto.subtle.verify(
        "HMAC", key,
        Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)),
        new TextEncoder().encode(`${header}.${body}`)
      );
      if (!valid) return null;
      const payload = JSON.parse(atob(body));
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;
      return payload;
    } catch { return null; }
  }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function rand(n: number) { return Math.floor(Math.random() * n); }

function rollFood(): { type: number; value: number; tier: number } {
  let r = rand(FOOD_WEIGHT_TOTAL);
  let tier = 0;
  for (let i = 0; i < FOOD_TIERS.length; i++) {
    if (r < FOOD_TIERS[i].weight) { tier = i; break; }
    r -= FOOD_TIERS[i].weight;
  }
  const def = FOOD_TIERS[tier];
  return { type: def.offset + rand(def.count), value: def.values[rand(def.values.length)], tier };
}

function rollSkill(): { key: string; value: number } {
  let r = rand(SKILL_WEIGHT_TOTAL);
  for (const s of SKILLS) {
    if (r < s.weight) return { key: s.key, value: s.value };
    r -= s.weight;
  }
  return { key: SKILLS[0].key, value: 0 };
}

// 只返回尚未到期的 buff（客户端用于 HUD 显示）
function activeEffects(fx: SnakeEffects, now: number): Partial<SnakeEffects> {
  const out: Partial<SnakeEffects> = {};
  for (const k of Object.keys(fx) as (keyof SnakeEffects)[]) {
    const v = fx[k];
    if (v && v > now) (out as Record<string, number>)[k] = v;
  }
  return out;
}

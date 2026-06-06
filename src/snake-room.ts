// Durable Object: 贪吃蛇游戏房间
// 每个房间最多 50 人，服务端 100ms tick 权威移动

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
}

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MAP_SIZE = 1000;          // 地图格子数
const CELL_SIZE = 20;           // px（客户端用）
const TICK_MS = 200;            // 服务端 tick 间隔（更慢，客户端插值保证顺滑）
const FOOD_TARGET = 5000;       // 目标食物数量
const INIT_LENGTH = 5;          // 初始蛇长
const RESPAWN_MS = 5000;        // 死亡后复活等待
const MAX_PLAYERS = 50;
const BORDER_WARN = 50;         // 距边界多少格开始警告
const SAVE_INTERVAL_TICKS = 50; // 每多少 tick 保存一次存活玩家分数（约 10s）
const FOOD_BUCKET = 25;         // 食物空间网格 bucket 边长（格），用于邻近查询

const FOOD_VALUES = [1,1,1,1,2,2,2,3,3,5]; // 随机权重，总10种映射20种食物

// ── 类型 ──────────────────────────────────────────────────────────────────────

type Vec2 = { x: number; y: number };

interface Snake {
  id: string;           // player id
  username: string;
  avatarUrl: string | null;
  skinId: number;       // 0-9
  body: Vec2[];         // body[0] = 头
  angle: number;        // 0-360 当前移动角度
  alive: boolean;
  score: number;
  kills: number;
  respawnAt: number;    // timestamp, 0 = 已存活
  joinedAt: number;
}

interface Food {
  x: number;
  y: number;
  type: number; // 0-19
  value: number;
}

interface GameState {
  snakes: Map<string, Snake>;
  foods: Map<string, Food>;   // key = `${x},${y}`
  // 空间网格索引：bucketKey -> 该 bucket 内的食物 key 集合，用于邻近查询
  foodGrid: Map<string, Set<string>>;
  tick: number;
}

// ── Durable Object ────────────────────────────────────────────────────────────

export class SnakeRoom {
  private state: DurableObjectState;
  private env: Env;
  private clients: Map<string, WebSocket> = new Map();
  private game: GameState = { snakes: new Map(), foods: new Map(), foodGrid: new Map(), tick: 0 };
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // 解析 token（query 参数优先，其次 cookie session）
    const url = new URL(request.url);
    const qToken = url.searchParams.get("token");
    const cookieToken = this.getCookieToken(request);
    const payload = qToken ? await this.verifyToken(qToken)
      : cookieToken ? await this.verifyToken(cookieToken)
      : null;

    // 游客：用随机 id
    const id = (payload?.sub as string) ?? `guest_${crypto.randomUUID().slice(0, 8)}`;
    const username = (payload?.username as string) ?? `游客${id.slice(-4)}`;
    const avatarUrl = (payload?.avatar_url as string) ?? null;

    if (this.clients.size >= MAX_PLAYERS) {
      return new Response("Room full", { status: 503 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    this.clients.set(id, server);
    // 重连时保留已有蛇（分数不重置）
    if (!this.game.snakes.has(id)) {
      this.spawnSnake(id, username, avatarUrl);
    }

    // 发送初始状态
    this.sendTo(id, { type: "init", mapSize: MAP_SIZE, cellSize: CELL_SIZE, tickMs: TICK_MS, playerId: id });
    this.sendGameState(id);

    server.addEventListener("message", (ev) => {
      try { this.handleMessage(id, JSON.parse(ev.data as string)); }
      catch { /* ignore bad json */ }
    });

    server.addEventListener("close", () => {
      this.clients.delete(id);
      const snake = this.game.snakes.get(id);
      // 离开时保存分数（存活的蛇 killSnake 未触发过 saveScore）
      if (snake && snake.alive) void this.saveScore(snake);
      this.game.snakes.delete(id);
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

    // 复活检查
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive && snake.respawnAt && now >= snake.respawnAt) {
        this.respawn(snake);
      }
    }

    // 移动所有存活蛇
    const deaths: Array<{ killer: string; victim: string }> = [];
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      this.moveSnake(snake);
    }

    // 碰撞检测（头碰他人蛇身）
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      const head = snake.body[0];

      for (const other of this.game.snakes.values()) {
        if (other.id === snake.id || !other.alive) continue;
        // 从 index 1 开始（头到头不算，平等碰撞时都死）
        for (let i = 0; i < other.body.length; i++) {
          const seg = other.body[i];
          if (Math.hypot(seg.x - head.x, seg.y - head.y) < 0.8) {
            deaths.push({ killer: other.id, victim: snake.id });
            break;
          }
        }
      }
    }

    // 处理死亡
    const died = new Set<string>();
    for (const { killer, victim } of deaths) {
      if (died.has(victim)) continue;
      died.add(victim);
      const victimSnake = this.game.snakes.get(victim)!;
      const killerSnake = this.game.snakes.get(killer);
      if (killerSnake) killerSnake.kills++;
      this.killSnake(victimSnake);
    }

    // 吃食物（食物均在整数格，仅查头部周围 ±1 格，O(1) 而非全量遍历）
    for (const snake of this.game.snakes.values()) {
      if (!snake.alive) continue;
      const head = snake.body[0];
      const minX = Math.floor(head.x - 0.8), maxX = Math.ceil(head.x + 0.8);
      const minY = Math.floor(head.y - 0.8), maxY = Math.ceil(head.y + 0.8);
      let eaten = false;
      for (let gx = minX; gx <= maxX && !eaten; gx++) {
        for (let gy = minY; gy <= maxY; gy++) {
          const key = `${gx},${gy}`;
          const food = this.game.foods.get(key);
          if (food && Math.hypot(food.x - head.x, food.y - head.y) < 0.8) {
            snake.score += food.value;
            this.removeFood(key);
            snake.body.push({ ...snake.body[snake.body.length - 1] });
            eaten = true;
            break;
          }
        }
      }
    }

    // 补充食物
    const shortage = FOOD_TARGET - this.game.foods.size;
    if (shortage > 0) {
      const batch = Math.min(shortage, 50);
      for (let i = 0; i < batch; i++) this.spawnFood();
    }

    // 广播差量（排行榜只算一次）
    const leaderboard = Array.from(this.game.snakes.values())
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => ({ id: s.id, username: s.username, score: s.score, kills: s.kills }));
    this.broadcastDelta(leaderboard);

    // 定时保存存活玩家分数（每约 10s），即使未死亡也入库 / 更新排行榜
    if (this.game.tick % SAVE_INTERVAL_TICKS === 0) {
      for (const snake of this.game.snakes.values()) {
        if (snake.alive) void this.saveScore(snake);
      }
    }
  }

  private moveSnake(snake: Snake) {
    const rad = (snake.angle * Math.PI) / 180;
    const head = snake.body[0];
    const nx = head.x + Math.cos(rad);
    const ny = head.y + Math.sin(rad);

    // 碰墙死亡
    if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) {
      this.killSnake(snake);
      return;
    }

    snake.body.unshift({ x: nx, y: ny });
    snake.body.pop();
  }

  private killSnake(snake: Snake) {
    snake.alive = false;
    snake.respawnAt = Date.now() + RESPAWN_MS;

    // 全身变食物（取整到格，保证 O(1) 邻近查询能命中）
    for (const seg of snake.body) {
      const x = Math.round(seg.x), y = Math.round(seg.y);
      this.addFood(x, y, rand(20), 1);
    }
    snake.body = [];

    // 保存最高分
    void this.saveScore(snake);
  }

  private respawn(snake: Snake) {
    snake.alive = true;
    snake.respawnAt = 0;
    snake.skinId = rand(10);
    const pos = this.randomEmptyPos();
    snake.body = [];
    for (let i = 0; i < INIT_LENGTH; i++) snake.body.push({ x: pos.x - i, y: pos.y });
    snake.angle = 0;
  }

  private spawnSnake(id: string, username: string, avatarUrl: string | null) {
    const pos = this.randomEmptyPos();
    const body: Vec2[] = [];
    for (let i = 0; i < INIT_LENGTH; i++) body.push({ x: pos.x - i, y: pos.y });
    this.game.snakes.set(id, {
      id, username, avatarUrl,
      skinId: rand(10),
      body, angle: 0,
      alive: true, score: 0, kills: 0,
      respawnAt: 0, joinedAt: Date.now(),
    });
  }

  private spawnFood() {
    const x = rand(MAP_SIZE);
    const y = rand(MAP_SIZE);
    if (this.game.foods.has(`${x},${y}`)) return;
    const vi = rand(FOOD_VALUES.length);
    this.addFood(x, y, rand(20), FOOD_VALUES[vi]);
  }

  // ── 食物 + 空间网格索引 ──────────────────────────────────────────────────────
  // foods 为权威数据，foodGrid 是按 bucket 分桶的二级索引，供邻近/视口查询。

  private static bucketKey(x: number, y: number): string {
    return `${Math.floor(x / FOOD_BUCKET)},${Math.floor(y / FOOD_BUCKET)}`;
  }

  private addFood(x: number, y: number, type: number, value: number) {
    const key = `${x},${y}`;
    if (this.game.foods.has(key)) return;
    this.game.foods.set(key, { x, y, type, value });
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

  // 查询某矩形世界范围内的食物（遍历重叠的 bucket，而非全量食物）
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
      const key = `${x},${y}`;
      if (!this.game.foods.has(key)) return { x, y };
    }
    return { x: rand(MAP_SIZE), y: rand(MAP_SIZE) };
  }

  // ── 消息处理 ────────────────────────────────────────────────────────────────

  private handleMessage(id: string, msg: { type: string; angle?: number }) {
    const snake = this.game.snakes.get(id);
    if (!snake) return;

    // 主动离开：保存分数后断开（前端点击返回时发送）
    if (msg.type === "leave") {
      if (snake.alive) void this.saveScore(snake);
      return;
    }

    if (!snake.alive) return;

    if (msg.type === "steer" && typeof msg.angle === "number") {
      // 限速：每 tick 最多转一次（由客户端节流，服务端直接接受角度）
      snake.angle = ((msg.angle % 360) + 360) % 360;
    }
  }

  // ── 广播 ────────────────────────────────────────────────────────────────────

  private broadcastDelta(leaderboard: { id: string; username: string; score: number; kills: number }[]) {
    // 所有蛇列表（tick 内只序列化一次）
    const snakeList = Array.from(this.game.snakes.values()).map((s) => ({
      id: s.id, username: s.username, avatarUrl: s.avatarUrl,
      skinId: s.skinId, body: s.body, angle: s.angle,
      alive: s.alive, score: s.score, kills: s.kills, respawnAt: s.respawnAt,
    }));

    for (const [id] of this.clients) {
      const snake = this.game.snakes.get(id);
      if (!snake) continue;

      const cx = snake.alive && snake.body.length ? snake.body[0].x : MAP_SIZE / 2;
      const cy = snake.alive && snake.body.length ? snake.body[0].y : MAP_SIZE / 2;
      const vr = 60;

      const visibleFoods = this.foodsInRange(cx, cy, vr);

      this.sendTo(id, {
        type: "state", tick: this.game.tick, playerId: id,
        snakes: snakeList, foods: visibleFoods, leaderboard,
      });
    }
  }

  private sendGameState(id: string) {
    // 发送初始食物（视口内）
    const foods = Array.from(this.game.foods.values()).slice(0, 500);
    this.sendTo(id, {
      type: "state",
      tick: 0,
      playerId: id,
      snakes: Array.from(this.game.snakes.values()),
      foods,
      leaderboard: [],
    });
  }

  private sendTo(id: string, data: unknown) {
    const ws = this.clients.get(id);
    if (ws) {
      try { ws.send(JSON.stringify(data)); } catch { /* closed */ }
    }
  }

  // ── 数据库 ──────────────────────────────────────────────────────────────────

  private async saveScore(snake: Snake) {
    if (snake.id.startsWith("guest_") || snake.score === 0) return;
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
    ).bind(snake.id, snake.username, snake.avatarUrl, snake.score, snake.kills, snake.skinId, now).run();

    // 单局记录
    const duration = Math.floor((Date.now() - snake.joinedAt) / 1000);
    await this.env.DB.prepare(
      `INSERT INTO snake_sessions (user_id, score, kills, duration_s, played_at) VALUES (?,?,?,?,?)`
    ).bind(snake.id, snake.score, snake.kills, duration, now).run();

    // 只保留 snake_scores 前 100 名，超出的直接删除
    await this.env.DB.prepare(
      `DELETE FROM snake_scores WHERE user_id NOT IN (
         SELECT user_id FROM snake_scores ORDER BY score DESC LIMIT 100
       )`
    ).run();
  }

  private getCookieToken(request: Request): string | null {
    const cookie = request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)session=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ── JWT 验证 ────────────────────────────────────────────────────────────────

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

function rand(n: number) { return Math.floor(Math.random() * n); }

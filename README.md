# 冤神 启动！

面向多种职场模拟小游戏的网页应用（Simulator Box）。

## 这是什么

Hub 入口挂载多套模拟器：

| 模块 | 说明 |
|------|------|
| 客服模拟器 | 多会话售后训练，卡片/自由回复 + AI 客户反应 |
| 面试官游戏 | 有限提问下的招聘判断 |
| 门店排班 | 客流 / 岗位 / 成本试算 |
| 诊室分诊 | 优先级与资源槽位 |
| 摸鱼时刻 | Cloudflare Durable Object 多人贪吃蛇 |

登录（Linux.do OAuth）后可同步客服 meta 进度与蛇排行榜。

## 怎么跑

1. clone 仓库

```bash
git clone git@github.com:yunos1/customerSimulation.git
cd customerSimulation
```

2. 安装依赖

```bash
npm install
```

3. 配置 AI（本地 Vite 中间件与生产 Worker 共用）

复制 `.env.example` 为 `.env.local`：

```env
AI_BASE_URL=https://unity2.ai
AI_KEY=replace-with-your-key
AI_MODEL=gpt-5.5
```

生产环境请用 Wrangler secrets 配置 `AI_*`、`JWT_SECRET`、`LINUXDO_CLIENT_SECRET` 等，不要写进仓库。

4. 开发

```bash
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`（若该端口已在跑，不要重复启动）。

常用脚本：

```bash
npm test
npm run typecheck
npm run build
```

## 技术栈

- React 19 + TypeScript + Vite 6
- Cloudflare Workers / Wrangler（静态资源 + API + D1 + KV + Snake Durable Object）
- Vitest
- AI：OpenAI 兼容 Chat Completions（`src/shared/customerReaction.ts`）

## 架构速览

```
Browser SPA
  main → AppShell (src/platform/)
    ├─ SimulatorRegistry  清单驱动 Hub
    ├─ MetaProgressProvider + 云同步
    └─ active module（support / interview / … / snake）

Worker (src/worker.ts)
  /auth/*  /api/progress  /api/customer-reaction  /api/snake/*
  + D1 + KV + SnakeRoom DO
```

关键目录：

| 路径 | 职责 |
|------|------|
| `src/platform/` | 壳、注册表、Host 契约 |
| `src/simulators/support/` | 客服 UI 入口 |
| `src/game/` | 客服引擎（reducer 按域拆分） |
| `src/game/scenarios/` | 客户场景内容包 |
| `src/content/` | 生涯、政策、事件、成就 |
| `src/interview` 等 | 其它模拟器 engine + content |
| `src/components/SnakeGame/` | 蛇客户端 |
| `src/snake/protocol.ts` | 蛇 WS 协议类型 + 纯碰撞/计分工具（可单测） |
| `src/snake-room.ts` | 蛇权威房间（Durable Object，按 room id 分实例） |

摸鱼房间：`GET /api/snake/rooms` 查公共房人数；`/api/snake/ws?room=<id>` 进入对应 DO（`main` / `relax` / `rush` 或自定义码）。  
房间难度：`getRoomConfig(roomId)` 控制 bot 数量与食物密度（relax 轻松 / rush 更卷）。

| `migrations/` | D1 迁移（含基表 `0001_init.sql`） |

### 客服引擎模块

- `reducer.ts`：对外 `createInitialState` / `gameReducer`
- `reducerTick.ts` / `reducerSessions.ts` / `reducerReply.ts` / `reducerSummary.ts` / `reducerShared.ts`
- 场景生成：`customerGenerator.ts` + `scenarios/{realistic,comedy,cyber}.ts`

### 进度同步

本地 `localStorage` meta 与 `/api/progress` 使用 **字段级合并**（`mergeMetaProgress`），避免「远端 runs 更多就整包覆盖」丢档。

## 进度导出与清空

Hub 英雄区提供：

- **导出进度**：未登录导出 localStorage meta；登录后 `POST /api/progress?action=export` 附带云端副本
- **清空进度**：确认后调用 `onResetCareer()` 清本地；已登录再 `DELETE /api/progress`（同时删 D1 progress + 客服 leaderboard 行）

Worker 对 auth / progress / AI 输出结构化 JSON 日志（`event` 字段），便于 Cloudflare 日志检索。

## 如何新增一个模拟器

1. **实现组件**（可先放在 `src/components/` 或 `src/simulators/<id>/`），至少接收：

```ts
// src/platform/types.ts
type SimulatorHostProps = {
  user: AuthUser | null;
  authLoading: boolean;
  onBackToHub: () => void;
  onLogin: () => void;
  onLogout: () => void;
};
```

若只需要返回 Hub，可用现有 `wrapBackOnly` 适配 `onBackToHub`。

2. **注册 manifest**（`src/platform/registry.tsx`）：

```ts
const myManifest: SimulatorManifest = {
  id: "mySim",           // 加入 SimulatorId 联合类型
  title: "我的模拟器",
  category: "分类",
  description: "一句话说明",
  status: "live",        // 或 "soon"
  tone: "teal",
  favicon: "favicons/hub.ico",
  hubOrder: 60,
  showInLibrary: true,   // Module Bay 是否展示
  meta: ["标签1", "标签2"],
  icon: SomeLucideIcon,
};

// simulatorModules 数组追加（使用 dynamic import 做代码分割）：
{
  manifest: myManifest,
  load: () => import("../simulators/mySim").then((m) => m.MySimulator),
},
```

3. **扩展 `SimulatorId`**（`src/platform/types.ts`）。

4. （可选）需要云进度时再接入 Progress schema；蛇类实时玩法保持自有协议，不要塞进 turn-based reducer。

5. 跑通：`npm test && npm run typecheck && npm run build`，Hub 进出冒烟。

## 部署

Push `main` 触发 `.github/workflows/deploy.yml`：

`typecheck` → `test` → `build` → D1 migrations → Wrangler deploy。

## 安全提示

- 勿提交 `.env*`、API Key、OAuth token 草稿（仓库已 ignore `src/1.json` 等）。
- 会话 cookie 在 HTTPS 下带 `Secure`；生产密钥仅走 Wrangler secrets。

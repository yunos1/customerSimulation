# 冤神 启动！

## 这是什么

一个面向多种职场模拟小游戏的网页应用。

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

3. 配置 AI API key

复制 `.env.example` 为 `.env.local`，并填写：

```env
AI_BASE_URL=https://unity2.ai
AI_KEY=.env.local
AI_MODEL=gpt-5.5 claude-opus-4-8
```

4. 运行

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

## 用了什么

- React + TypeScript + Vite
- Cloudflare Workers / Wrangler
- AI API（默认模型：`gpt-5.5 claude-opus-4-8`）
- 主要功能：模拟器首页、客服模拟器、面试模拟器、门店排班模拟器、诊室分诊模拟器、摸鱼时刻，以及带 AI 客户回复的客服训练流程。

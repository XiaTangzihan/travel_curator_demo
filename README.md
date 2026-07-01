# 旅行策展人 Demo

这是第一阶段可本地跑通的旅行策展人 WebApp：

- 数据：广州黄金评论 11 条已固化为本地 JSON + 本地图片目录
- AI：`P1/P2` 使用 `DOUBAO`，`P3/P4` 接 `SEEDREAM`，失败时自动回退到本地 SVG 底片
- 前端：个人主页、作者工作台、二次确认页、动态地图页、测试追踪页壳层
- 交互：`P5` 采用确定性模板渲染，底部旅程轴与右侧评论卡按 `event_id` 一对一绑定

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 如需重新从飞书 Base 固化广州样本，运行：

```bash
npm run sync:guangzhou
npm run preprocess:guangzhou
```

3. 启动开发服务器（固定使用 `localhost:3001`）

```bash
npm run dev -- --hostname localhost --port 3001
```

4. 打开：

```text
http://localhost:3001
```

## 常用命令

```bash
npm run dev -- --hostname localhost --port 3001
npm run build
npm run test
npm run lint
npm run check
npm run sync:guangzhou
npm run preprocess:guangzhou
```

## 环境变量

真实密钥只放本地 `.env.local`，仓库只保留 `.env.local.example`。

```bash
DOUBAO_BASE_URL=
DOUBAO_API_KEY=
DOUBAO_ENDPOINT=
SEEDREAM_BASE_URL=
SEEDREAM_MODEL_ID=
SEEDREAM_API_KEY=
```

## 当前实现边界

- 当前默认首页只保留一份稳定中文样本地图 `广州两日行`
- 飞书 `Maps / Events / Files / Runs` 在线读写尚未接入，当前只用 `public/mock/` 模拟
- 测试追踪页本期只做结构壳层与文件留痕展示，不接真实调度逻辑
- `SEEDREAM` 已接通；若触发审核或参数问题，会自动回退到本地 SVG 底片，保证 localhost 可跑通

## Folder-File 架构

以下为当前项目从根目录到最后一层文件夹的真实结构说明：

```text
/
├─ .trae/
│  ├─ documents/
│  └─ rules/
├─ app/
│  ├─ api/
│  │  ├─ maps/
│  │  │  ├─ [mapId]/
│  │  │  │  ├─ confirm/
│  │  │  │  └─ regenerate/
│  │  │  └─ generate/
│  │  ├─ preprocess/
│  │  │  └─ guangzhou/
│  │  └─ runs/
│  │     └─ [runId]/
│  ├─ confirm/
│  │  └─ [mapId]/
│  ├─ maps/
│  │  └─ [mapId]/
│  ├─ runs/
│  └─ workspace/
├─ public/
│  └─ mock/
│     ├─ events/
│     ├─ files/
│     │  └─ comments/
│     ├─ maps/
│     ├─ posters/
│     ├─ raw/
│     ├─ routes/
│     └─ runs/
├─ scripts/
├─ src/
│  ├─ components/
│  ├─ config/
│  ├─ contracts/
│  ├─ engine/
│  │  ├─ pipelines/
│  │  ├─ preprocess/
│  │  ├─ prompts/
│  │  ├─ providers/
│  │  └─ renderers/
│  ├─ features/
│  │  ├─ confirm/
│  │  ├─ dynamic-map/
│  │  ├─ profile/
│  │  ├─ runs/
│  │  └─ workspace/
│  ├─ lib/
│  ├─ server/
│  │  ├─ future-feishu/
│  │  ├─ repositories/
│  │  └─ utils/
│  └─ store/
└─ tests/
   └─ unit/
```

## 数据文件说明

- `public/mock/raw/guangzhou.raw.json`
  - 广州原始样本快照
- `public/mock/events/guangzhou.events.json`
  - Part1 输出的第②套 event JSON
- `public/mock/routes/*.route.md`
  - `P2` 生成或 fallback 生成的 route 文档
- `public/mock/posters/*`
  - `P3/P4` 生成的底片图，可能是 PNG，也可能是 fallback SVG
- `public/mock/maps/*.view.json`
  - 动态地图页消费的视图模型
- `public/mock/runs/*.json`
  - 测试追踪页读取的运行留痕

## 验证结果

已验证：

- `npm run lint`
- `npm run test`
- `npm run build`
- 浏览器验证：主页 → 工作台 → 地图生成 → 动态地图页 → 测试追踪页

当前默认稳定链路会输出：

- `raw.json`
- `events.json`
- `route.md`
- `map.view.json`
- `run.json`
- 底片图（`SEEDREAM` 成功则为 PNG；否则 fallback 为 SVG）

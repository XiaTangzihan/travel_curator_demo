# 旅行策展人 Demo

这是第一阶段可本地跑通的旅行策展人 WebApp：

- 数据：广州 / 杭州 `BAM Sheet` 已统一固化为 canonical `raw/events` + 本地评论图片目录
- AI：`P1/P2` 使用 `DOUBAO`，`P3/P4` 接 `SEEDREAM`，失败时自动回退到本地 SVG 底片
- 前端：个人主页、作者工作台、二次确认页、动态地图页、测试追踪页壳层
- 交互：`P5` 采用确定性模板渲染，底部旅程轴与右侧评论卡按 `event_id` 一对一绑定

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 如需重新从 `BAM Sheet` 固化样本，运行：

```bash
npm run sync:dataset -- hangzhou
npm run preprocess:dataset -- hangzhou
npm run sync:dataset -- guangzhou
npm run preprocess:dataset -- guangzhou
npm run sync:dataset -- meishan
npm run preprocess:dataset -- meishan
```

也可使用城市别名命令：

```bash
npm run sync:hangzhou
npm run preprocess:hangzhou
npm run sync:guangzhou
npm run preprocess:guangzhou
npm run sync:meishan
npm run preprocess:meishan
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
npm run sync:dataset -- <datasetKey>
npm run preprocess:dataset -- <datasetKey>
npm run sync:guangzhou
npm run preprocess:guangzhou
npm run sync:hangzhou
npm run preprocess:hangzhou
npm run sync:meishan
npm run preprocess:meishan
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

- 当前默认数据源为杭州，但首页 / 工作台已支持基于 `datasetKey` 在广州与杭州样本间切换
- 飞书 `Maps / Events / Files / Runs` 在线读写尚未接入，当前只用 `public/mock/` 模拟
- `public/mock/maps|posters|routes|runs` 视为运行期产物，不再作为稳定的 checked-in 样本资产
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
│  │  ├─ datasets/
│  │  ├─ future-feishu/
│  │  ├─ repositories/
│  │  └─ utils/
│  └─ store/
└─ tests/
   └─ unit/
```

## 数据文件说明

- `public/mock/raw/guangzhou.raw.json`
  - 广州 canonical raw 样本
- `public/mock/raw/hangzhou.raw.json`
  - 杭州 canonical raw 样本
- `public/mock/events/guangzhou.events.json`
  - 广州 canonical events 样本
- `public/mock/events/hangzhou.events.json`
  - 杭州 canonical events 样本
- `public/mock/files/comments/*`
  - BAM Sheet 中评论图片本地化后的统一素材目录
- `public/mock/maps/*`
  - 运行期生成的地图视图模型（非稳定 checked-in 资产）
- `public/mock/posters/*`
  - 运行期生成的底片图（非稳定 checked-in 资产）
- `public/mock/routes/*`
  - 运行期生成的 route / knowledge 产物（非稳定 checked-in 资产）
- `public/mock/runs/*`
  - 运行期生成的 run 留痕（非稳定 checked-in 资产）

## 验证结果

已验证：

- `npm run lint`
- `npm run test`
- `npm run build`
- 页面 smoke test：
  - `GET /?dataset=hangzhou` -> `200`
  - `GET /?dataset=guangzhou` -> `200`
  - `GET /workspace?dataset=hangzhou` -> `200`
  - `GET /workspace?dataset=guangzhou` -> `200`

当前默认稳定链路会输出：

- `raw.json`
- `events.json`
- `route.md`
- `map.view.json`
- `run.json`
- 底片图（`SEEDREAM` 成功则为 PNG；否则 fallback 为 SVG）

# ROADMAP

## 1. 文档定位

- 本文是「今天第一阶段」的执行约束文档。
- 在你确认本文之前，不进入代码实施。
- 今日必达目标：`数据 + 前端 + AI 引擎` 在 `localhost` 跑通。
- 今日不接入飞书运行链路；运行时统一使用本地 JSON + 本地文件目录模拟 `Maps / Events / Files / Runs`。
- 任何新增阻塞项都必须先对齐，不允许擅自改数据契约或页面语义。

## 2. 已锁定决策

### 2.1 工程形态

- 单应用分层。
- 技术基线：`Next.js + TypeScript + App Router`。
- MSI 边界要求：
  - `app/` 只放路由与页面装配。
  - `src/features/` 只放前端页面域逻辑与 UI 组件。
  - `src/engine/` 只放预处理、AI 编排、Prompt、视图模型构造。
  - `src/server/` 只放本地文件仓库、读写适配器、未来飞书适配边界。
  - `src/contracts/` 只放跨层共享的数据契约与校验。

### 2.2 Demo 数据契约（已与你对齐）

- 当前广州 Base 实际字段不等于文档中的完整第①套 BAM。
- 本阶段接受 `Demo 兼容层`，但必须隔离实现，不污染后续正式契约。
- 兼容策略如下：
  - `comment_id`：暂用 Base `record_id`。
  - `author_name`：由本地 demo 配置注入固定值，不从当前 Base 读取。
  - 图片：从 Base 附件固化到本地稳定文件路径；`event.comment_pictures[]` 引用本地稳定地址，不直接依赖飞书临时链接。
  - `user_id / POI 一级行业 / POI 二级行业`：当前样本中视为不可得字段，不再补造。
  - `day / time`：虽已在 Base 中存在，但预处理脚本仍以 `评价创建时间` 为主源拆分，并校验与现有 `Day / 时间` 是否一致。

### 2.3 AI 供应商决策

- 文本类步骤：
  - `P1 目的地知识补全` 使用 `DOUBAO`。
  - `P2 route.md 生成` 使用 `DOUBAO`。
- 生图类步骤：
  - `P3 静态底片图` 使用 `SEEDREAM`。
  - `P4 二次确认后重生成` 使用 `SEEDREAM`。
- `P5` 不依赖多模态像素定位；核心实现采用确定性模板渲染。
- 真实密钥只允许存在于本地 `.env.local`；仓库只保留 `.env.local.example` 的变量名。

### 2.4 页面范围

- 今日核心 4 页必须跑通：
  - `个人主页`
  - `作者工作台`
  - `二次确认页`
  - `动态地图页`
- `测试追踪页` 本期只建设壳层与依赖留痕，不接入真实逻辑。

## 3. 第一阶段完成定义

- [x] 广州 11 条评论固化为本地原始数据快照。
- [x] 预处理 Part1 输出第②套 `event JSON`，数量 = 11。
- [x] `P1 -> P2 -> P3 -> P4 -> P5` 全链路可在 localhost 触发。
- [ ] 动态地图页具备：
  - [x] 底部旅程轴
  - [x] 右侧常驻评论卡
  - [x] 按 `event_id` 一对一确定性绑定
  - [x] 评论图可预览大图
- [x] 四个核心页面可连通演示。
- [x] `README.md` 准确标注根目录到最后一层文件夹的架构树。

## 4. 目标目录规划

> 说明：这是第一阶段计划中的目标结构；实际实施后，`README.md` 必须按真实落地结果更新。

```text
/
├─ ROADMAP.md
├─ README.md
├─ .gitignore
├─ .env.local.example
├─ package.json
├─ tsconfig.json
├─ next.config.*
├─ public/
│  └─ mock/
│     ├─ raw/
│     ├─ events/
│     ├─ routes/
│     ├─ posters/
│     ├─ maps/
│     ├─ runs/
│     └─ files/
│        └─ comments/
├─ app/
│  ├─ page.tsx
│  ├─ workspace/
│  ├─ confirm/
│  ├─ maps/
│  └─ runs/
├─ src/
│  ├─ contracts/
│  ├─ config/
│  ├─ features/
│  │  ├─ profile/
│  │  ├─ workspace/
│  │  ├─ confirm/
│  │  ├─ dynamic-map/
│  │  └─ runs/
│  ├─ engine/
│  │  ├─ preprocess/
│  │  ├─ prompts/
│  │  ├─ providers/
│  │  ├─ pipelines/
│  │  └─ renderers/
│  ├─ server/
│  │  ├─ repositories/
│  │  ├─ loaders/
│  │  ├─ writers/
│  │  └─ future-feishu/
│  ├─ components/
│  ├─ lib/
│  └─ styles/
├─ scripts/
│  ├─ preprocess/
│  ├─ generate/
│  └─ verify/
└─ tests/
   ├─ unit/
   └─ integration/
```

## 5. 里程碑 TODO

### M0. 约束冻结与工作区初始化

> 适用 skills：`using-superpowers`、`brainstorming`

- [x] 初始化 Git 仓库。
- [x] 创建 Next.js + TypeScript 单应用骨架。
- [x] 补齐基础工程文件：`.gitignore`、`.env.local.example`、基础脚本命令。
- [x] 锁定目录边界：`app / src/features / src/engine / src/server / src/contracts`。
- [x] 明确 `README.md` 必须记录真实 folder-file 架构树。

**Commit 节点 C0**

```text
chore(init): scaffold single-app demo workspace
```

### M1. 数据契约与本地文件层

> 适用 skills：`lark-base`、`lark-doc`

- [x] 从广州 Base 固化 11 条样本的本地原始快照。
- [x] 把 11 条评论的附件图片落地到本地稳定目录。
- [ ] 定义共享契约：
  - [x] `RawReview`
  - [x] `EventRecord`
  - [ ] `RouteDocument`
  - [x] `MapRecord`
  - [x] `RunTrace`
- [x] 在契约层显式标注 `Demo 兼容层` 字段来源。
- [x] 设计本地 `Maps / Events / Files / Runs` 目录和命名规范。

**Commit 节点 C1**

```text
feat(data): solidify guangzhou local dataset and shared contracts
```

### M2. 预处理 Part1 规则脚本

> 适用 skills：`using-superpowers`、`brainstorming`

- [x] 编写广州样本专用但契约通用的 Part1 规则脚本。
- [ ] 规则脚本必须覆盖：
  - [x] 字段裁剪
  - [x] `评价创建时间 -> day + time`
  - [x] `event_id` 连续生成
  - [x] 文本/图片至少一项存在校验
  - [x] 地址/POI 基础格式校验
  - [x] Base 附件到本地稳定路径映射
  - [x] `author_name` demo 注入
- [x] 产出 `public/mock/events/guangzhou.events.json`。
- [ ] 产出预处理验证报告，至少校验：
  - [x] 事件数 = 11
  - [x] `event_id` 唯一
  - [x] `comment_id` 唯一
  - [x] `day/time` 排序稳定

**Commit 节点 C2**

```text
feat(preprocess): generate guangzhou event json from local raw snapshot
```

### M3. AI 引擎分层与 Provider 适配

> 适用 skills：`using-superpowers`、`brainstorming`

- [x] 建立统一 AI provider 接口，不把模型调用散落到页面层。
- [ ] 接入文本 provider：
  - [x] `doubao` for `P1`
  - [x] `doubao` for `P2`
- [ ] 接入生图 provider：
  - [x] `seedream` for `P3`
  - [x] `seedream` for `P4`
- [ ] 固化 Prompt 资产：
  - [x] `C-通用`
  - [x] `C-风格（年轻卡通）`
  - [x] `P1`
  - [x] `P2`
  - [x] `P3`
  - [x] `P4`
- [x] `P5` 采用确定性 renderer，而不是图上热区识别。
- [ ] 统一输出物：
  - [x] `route.md`
  - [x] `poster.png`
  - [x] `map view model`
  - [x] `run trace skeleton`
- [x] 所有 provider 错误必须透传到运行留痕，不允许静默失败。

**Commit 节点 C3**

```text
feat(engine): add ai pipeline adapters for doubao and seedream
```

### M4. 本地后端替身与仓库层

> 适用 skills：`using-superpowers`

- [x] 用本地仓库层模拟 `Maps / Events / Files / Runs`。
- [x] 页面和引擎只能通过仓库接口读写，不直接拼路径。
- [ ] 为未来飞书接入预留适配器边界：
  - [x] `maps repository`
  - [x] `events repository`
  - [x] `files repository`
  - [x] `runs repository`
- [x] 留出 `future-feishu/` 边界，禁止把飞书细节泄露到前端组件。

**Commit 节点 C4**

```text
feat(storage): add local file-backed repositories for maps events files runs
```

### M5. 前端 4 页 + 测试追踪页壳层

> 适用 skills：`frontend-design`

- [ ] 个人主页：
  - [x] 顶部导航
  - [x] 作者信息区
  - [x] 行程卡片网格
- [ ] 作者工作台：
  - [x] 地图名称/城市/风格配置
  - [x] 评论选择区
  - [x] 一键生成入口
- [ ] 二次确认页：
  - [x] 底片图预览
  - [x] 修改 prompt 输入区
  - [x] 是否基于旧图修改开关
  - [x] 重新生成 / 确认保存
- [ ] 动态地图页（核心）：
  - [x] 左侧底片图区
  - [x] 底部旅程轴
  - [x] 右侧常驻评论卡
  - [x] `event_id` 确定性绑定
  - [x] 大图预览
- [ ] 测试追踪页：
  - [x] 只做页面结构
  - [x] 显示未来 6 类留痕占位
  - [x] 不接真实逻辑

**Commit 节点 C5**

```text
feat(ui): deliver core demo pages and deterministic map interaction
```

### M6. 闭环联调与验证

> 适用 skills：`TRAE-debugger`、`code-reviewer`

- [x] 打通从工作台选评论到地图页展示的完整链路。
- [x] 确保 `P1 -> P2 -> P3 -> P4 -> P5` 的文件输出可落盘。
- [ ] 增加最小必要测试：
  - [x] 预处理映射测试
  - [x] `route.md` 排序测试
  - [ ] `event_id` 绑定测试
- [ ] 运行 localhost 演示检查：
  - [x] 首页可进工作台
  - [x] 工作台可触发生成
  - [x] 二确页可重生成/确认
  - [x] 地图页可按 event 展示评论

**Commit 节点 C6**

```text
test(integration): verify local end-to-end demo loop for guangzhou
```

### M7. README 与交付清单

> 适用 skills：`using-superpowers`

- [x] 在 `README.md` 中准确写出最终 folder-file 架构树，从根目录到最后一层文件夹。
- [x] 写清本地启动步骤。
- [x] 只记录环境变量名，不记录真实密钥。
- [x] 写清 `Demo 兼容层` 与未来正式飞书接入的替换点。
- [x] 写清测试追踪页当前只做壳层的边界。

**Commit 节点 C7**

```text
docs(readme): document exact project tree and local run instructions
```

## 6. 实施红线

- 不允许把真实 API Key 写入仓库、README、脚本常量或测试快照。
- 不允许前端组件直接读写文件系统路径。
- 不允许页面层直接发模型请求。
- 不允许把 `Demo 兼容层` 混入正式契约命名；必须可一眼识别、可替换。
- 不允许为追求跑通而省略 `event_id` 确定性绑定。
- 不允许在数据不足时编造 POI、作者、类目或路线事实。

## 7. 当前已识别风险

- 风险 R1：广州 Base 与文档第①套 BAM 不一致，需靠 `Demo 兼容层` 隔离。
- 风险 R2：图片当前来自飞书附件，必须先本地稳定化，否则 localhost 与后续复现都会漂移。
- 风险 R3：P3/P4 生图质量存在模型波动，页面逻辑不得依赖图片像素级语义。
- 风险 R4：测试追踪页本期不接真实逻辑，必须在 README 与 UI 中明确其为壳层。

## 8. 下一步

- 你确认本 `ROADMAP.md` 后，我按 `M0 -> M7` 顺序实施。
- 实施过程中若出现新的数据/接口缺口，我会先停在对齐点，不会硬做。

# Demo 优化设计：生成等待流、输入门禁与海报标题约束

## 1. 目标

* 对齐当前 Demo 下一轮修改范围，避免把“体验愿望”“实现策略”“高风险改动”混写。

* 优先解决工作台空态输入、首次生成等待流、失败恢复、并发门禁、海报左上角标题语义五类问题。

* 保持现有 localhost demo 的实现边界，不为了等待页体验引入超出当前架构承受范围的后台基础设施。

* 把阶段执行门禁写成硬规则，避免执行 Agent 跨阶段连续改代码。

## 2. 已确认决策

* `safePointLabel` 在当前仓库中未查实存在；若当前实现中确已删除，则本轮不纳入修改计划。

* 本轮不处理原始列表中的 `M4（二确页改地图名）`。

* 本轮不纳入 `C1（目的地错位保护）`、`C3（工作台草稿持久化）`。

* 点击“生成”后，后台生成流程立即开始；用户同时被重定向到等待页。

* 默认成功流中，生成完成后等待页自动跳转到二次确认页。

* 二次确认页右上角需要展示“本次生图耗时”。

* 等待页采用 `方向 A`：轻量等待页，不做强科技风，不做取消生成，不做精确百分比。

* 等待页底部区域采用“横向流动胶片带”，内容来自“本次地图关联评论图片”，不是历史记录。

* 后续生成的海报中，左上角艺术字只能使用“目的地”；不能再出现地图标题如“广州两日行”“广州test01”。

* `mapName` 仍然是地图业务实体的名称；被禁止的是“海报画面中的左上角艺术字标题”，不是整个系统中的地图名字段。

* 阶段推进必须经过：阶段汇报 -> 推荐 commit message -> 用户批准并完成 commit -> refresh memory -> 下一阶段概览确认。

## 3. 当前代码现状

### 3.1 工作台输入仍带默认值

* `src/features/workspace/workspace-page.tsx` 当前会在 `useEffect` 中把 `mapName/city/style` 初始化为默认内容。

* `src/store/workspace-store.ts` 当前默认 `city = "广州"`、`style = "young-cartoon"`。

* 当前“生成”按钮只校验 `mapName`、`city`、`selectedCommentIds`，未把“风格未选择”视为禁止条件。

### 3.2 首次生成链路仍是同步阻塞

* `app/api/maps/generate/route.ts` 目前是一次请求内同步完成整条生成链路，再把 `mapId` 返回给前端。

* `src/features/workspace/workspace-page.tsx` 当前是等待接口返回后，直接跳转 `/confirm/[mapId]`。

* 这意味着当前并不存在“后台继续生成、前台先跳等待页”的运行态模型。

### 3.3 run 能留痕，但还不是等待页可用状态机

* 当前已有 `runTrace`、`listRunTraces()` 与 `/api/runs` 列表接口。

* 但当前缺少：单个 run 查询接口、运行中状态的即时落盘、等待页所需的预览图片上下文、阶段型进度字段。

### 3.4 海报标题语义仍会泄露地图名

* `src/engine/prompts/p3-poster.ts` 当前显式把 `地图名称` 输入给海报 prompt，并允许标题使用“当前地图名称或当前城市”。

* `src/engine/prompts/p4-regenerate.ts` 目前直接复用 `buildPosterPrompt`，因此会继承同样的标题语义。

* `src/engine/renderers/fallback-poster.ts` 当前本地兜底 SVG 直接把 `mapName` 画在左上角。

## 4. 本轮范围总表

| ID   | 优化项         | 目标状态                                 | 高层方案                                                                             |
| ---- | ----------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| M2   | 工作台空态与生成门禁  | `mapName/city/style` 默认均为空；任一为空时无法生成 | 调整 workspace store 与工作台 UI；`style` 改 placeholder；服务端继续保留必填校验兜底                   |
| M3   | 首次生成等待流     | 点击生成后立即进入等待页；后台生成继续执行；完成后自动跳二确页      | 将首次生成改为“提交即创建 run、后台异步推进、前台轮询 run 状态”的本地异步任务流                                    |
| M3.1 | 二确页生图耗时展示   | 二确页右上角展示当前海报对应的生图耗时                  | 基于 `mapRecord.currentRunId` 读取 image-producing run，使用 `startedAt/endedAt` 计算展示文案 |
| C2   | 等待页失败恢复     | 后台生成失败或中断时，等待页能给出清晰恢复动作              | 失败态提供错误信息、返回工作台、重试本次输入；必要时复用 `incomplete` 表达中断任务                                 |
| C4   | 提交并发门禁      | 生成链路上的提交入口不能被重复点击或交叉触发               | 对工作台、等待页、二确页涉及提交的按钮做统一 pending/disabled 约束                                       |
| M5   | 海报左上角标题语义收紧 | 海报中不再出现地图标题；左上角艺术字只能是目的地             | 调整 P3/P4 prompt、fallback SVG 与测试，禁止把 `mapName` 作为海报标题输入给模型或兜底图                   |

## 5. 方案选型

### 5.1 等待流架构选型

本轮有三种候选方案：

1. `推荐方案`：进程内异步 run
2. 子进程 worker
3. 仅前端跳等待页，后端仍同步阻塞

结论：选择 `进程内异步 run`。

原因：

* 当前项目是 localhost demo，已有文件落盘式 `runTrace`，适合在现有 Node 进程内扩一层轻量状态机。

* 相比子进程 worker，改动量和调试成本明显更可控。

* 相比“前端假等待页”，它真正满足“后台继续生成、前台先跳页”的用户体验要求。

边界：

* 本方案仅针对当前本地 demo 运行方式成立，不承诺天然兼容 serverless 场景。

* 本轮不做“取消生成”。

### 5.2 海报标题语义选型

本轮明确采用以下口径：

* `mapName` 继续用于业务页面标题、地图卡片标题、输入摘要、run 留痕。

* `city` 成为海报左上角艺术字的唯一允许来源。

* 不允许模型再接收到“把地图标题画进左上角”的指令。

* fallback 海报也必须遵守同样的语义，不能只改 live path。

这是一个高风险改动，因为它同时影响：

* 首次生成

* 二次重生成

* 本地 fallback 海报

* 现有提示词测试与未来风格稳定性判断口径

## 6. 目标设计

### 6.1 工作台空态与门禁

工作台需要从“带默认值的半自动表单”改成“真实空态输入表单”。

具体要求：

* `mapName` 初始为空

* `city` 初始为空

* `style` 初始为空

* 风格下拉框首项是不可提交的 placeholder，例如“请选择风格”

* 在 `style` 未选择时，左栏风格预览卡不展示默认风格图，而展示空态说明

* “一键生成旅行地图”按钮只有在以下条件全部满足时才可用：

  * `mapName.trim()` 非空

  * `city.trim()` 非空

  * `style` 已选择

  * 至少选中 1 条评论

  * 当前不处于提交中

服务端仍保留现有必填校验，前端门禁只是第一层。

### 6.2 等待页与 run 状态模型

#### 路由与入口

* 首次生成入口仍从工作台触发。

* 建议等待页路由为：`/workspace/generating/[runId]`

* 工作台点击生成后，请求生成启动接口；接口只负责：

  * 校验输入

  * 分配 `runId` 与 `mapId`

  * 持久化初始 `runTrace`

  * 启动后台异步任务

  * 立即返回 `runId/mapId/waitPath`

* 前端收到响应后立即跳转等待页。

#### runTrace 需要新增/强化的能力

为了支撑等待页，建议在当前 `runTrace` 基础上补齐以下字段：

* `progressStep`

  * 枚举建议：`preparing | rendering | finalizing`

  * 用于等待页三段状态感，而不是用假百分比

* `updatedAt`

  * 记录最新一次状态推进时间

  * 用于判断 run 是否长时间无更新

* `previewImagePaths`

  * 等待页胶片带使用的图片列表

  * 来源于本次选中评论的 `attachments.publicPath`

* `generateInput`

  * 最小重试载荷：`mapName/city/style/selectedCommentIds`

  * 用于失败后“重试本次输入”

说明：

* `inputSummary` 继续保留，用于人类可读展示。

* `generateInput` 是内部重放所需，不替代 `inputSummary`。

#### 后台推进方式

后台异步生成任务在单个 run 内按以下顺序推进：

1. `preparing`

   * 读取/整理输入

   * 提取等待页预览图

   * 准备事件数据与知识补全前置材料
2. `rendering`

   * 执行实际海报生成
3. `finalizing`

   * 写 route / map / poster / run artifacts

   * 更新 `mapRecord.currentRunId`

   * 收口最终状态

完成后：

* `status = completed`

* `endedAt` 写入

* 等待页自动跳转 `/confirm/[mapId]`

失败后：

* `status = failed`

* 写入 `errorMessage`

* 等待页停留在失败态

如果出现本地进程中断导致的孤儿任务，可使用现有 `incomplete` 状态兜底表达；等待页视同失败态处理。

### 6.3 等待页视觉与交互

等待页采用轻量卡片布局，视觉语言沿用当前 demo：

* 暖白底

* 柔和阴影

* 大圆角

* 低饱和强调色

* 避免强科技蓝紫风格

页面元素：

* 顶部主文案：例如“正在生成旅行海报”

* 副文案：当前阶段说明，例如“正在整理素材”“正在绘制海报”“正在收尾保存”

* 三段式状态指示器：`准备素材 -> 生成海报 -> 即将完成`

* 主视觉区域：海报 skeleton / 柔和占位卡

* 底部区域：横向流动胶片带

胶片带规则：

* 内容来自本次 run 的 `previewImagePaths`

* 进入等待页时随机打散一次

* 建议取 `8~12` 张图；不足时允许重复补位

* 通过复制首尾片段实现无缝循环

* 低速横向流动，优先使用纯前端动画，不引入额外业务状态

* 它的职责是“上下文氛围提示”，不是进度表达组件

明确不做：

* 取消生成

* 精确百分比

* 历史生成记录区

### 6.4 等待页失败恢复

等待页失败态至少需要提供：

* 明确错误文案

* 返回工作台

* 重试本次输入

其中“重试本次输入”的前提是：

* run 内已持久化 `generateInput`

* 重试时会创建新的 `runId`

* 原失败 run 仅保留留痕，不复用为新任务

失败恢复口径：

* 如果是可读错误，直接展示 `errorMessage`

* 如果是中断/孤儿任务，展示统一异常提示，例如“本次生成未正常完成，请重试”

### 6.5 二次确认页耗时展示

二次确认页当前右上角已有 `StatusPill`。本轮建议：

* 在同一区域追加“本次生图耗时”展示

* 位置与 `StatusPill` 同排，不改动主版式结构

* 数据来源：`mapRecord.currentRunId` 指向的 `generate/regenerate` run

* 展示方式：

  * `< 60s`：`18s`

  * `>= 60s`：`1m 08s`

* 若当前 run 缺少 `endedAt`，则静默不展示

### 6.6 海报左上角标题语义收紧

本轮对海报标题的约束是硬规则：

* P3 prompt 不再把“地图名称”作为海报标题语义输入给模型

* P3 prompt 只允许“目的地艺术字”

* P4 重生成链路必须继承同样规则

* fallback SVG 左上角主标题也必须改为 `city`

* 任意 live/fallback path 都不能再把 `mapName` 画进海报

为避免歧义，需要明确：

* 页面上的地图标题仍然可以显示 `mapName`

* run 留痕中的输入摘要仍然可以记录 `mapName`

* 被禁用的是“海报视觉标题”，不是整个系统中的 mapName 概念

## 7. 分阶段计划

### Phase 1：工作台空态与首次提交门禁

**执行 Agent 可用 Skills**

* `executing-plans`

* `code-reviewer`

**范围**

* M2：`mapName/city/style` 空态初始化

* M2：风格 placeholder 与空态预览

* C4（第一部分）：工作台提交并发门禁

**建议改动面**

* `src/store/workspace-store.ts`

* `src/features/workspace/workspace-page.tsx`

* 相关单测（如需要）

**验收标准**

* 工作台首次进入时三个字段都无默认内容

* 风格未选中时不展示默认风格图

* 任一字段为空时，生成按钮不可点击

* 连续快速点击不会触发多次首次生成请求

**风险提示**

* `style` 允许空值后，现有前端类型与预览逻辑需要同步收敛

### Phase 2：异步 run、等待页与失败恢复

**执行 Agent 可用 Skills**

* `executing-plans`

* `frontend-design`

* `code-reviewer`

* `TRAE-debugger`

**范围**

* M3：首次生成等待流

* M3.1：二确页展示本次生图耗时

* C2：等待页失败恢复

* C4（第二部分）：等待页与确认页提交并发门禁

**建议改动面**

* `app/api/maps/generate/route.ts`

* `app/api/runs/[runId]/route.ts`（新增）

* `app/workspace/generating/[runId]/page.tsx`（新增）

* `src/features/workspace/**`

* `src/features/confirm/confirm-page.tsx`

* `src/contracts/domain.ts`

* `src/engine/pipelines/generate-map.ts`

* `src/server/repositories/demo-repository.ts`

**验收标准**

* 点击首次生成后，用户立即进入等待页

* 后台 run 能从 `running` 推进到 `completed/failed/incomplete`

* 等待页能基于真实 `progressStep` 展示三段状态感

* 等待页底部出现横向流动胶片带，图片来自本次选中评论

* 成功后自动跳转二次确认页

* 失败后能明确告知并支持返回工作台 / 重试本次输入

* 二次确认页右上角显示本次生图耗时

* 等待页和二确页不会因重复点击造成重复任务或交叉提交

**风险提示**

* 这是本轮最核心的架构性变更，涉及接口语义从“同步返回成品”切换为“异步返回 run”

* 本地 dev server 重启可能造成孤儿任务，需要失败态口径收敛

### Phase 3：海报标题语义重构（高风险）

**执行 Agent 可用 Skills**

* `executing-plans`

* `code-reviewer`

* `TRAE-debugger`

**范围**

* M5：海报左上角艺术字只允许目的地

* live 生成、重生成、fallback 海报三条链路口径统一

**建议改动面**

* `src/engine/prompts/p3-poster.ts`

* `src/engine/prompts/p4-regenerate.ts`

* `src/engine/renderers/fallback-poster.ts`

* `tests/unit/poster-prompt.test.ts`

* 其他新增测试

**验收标准**

* 海报 prompt 中不再出现“将地图名称写成海报标题”的要求

* fallback SVG 左上角主标题改为 `city`

* 首次生成与重生成都遵守“只允许目的地艺术字”

* 测试能覆盖“不把 mapName 泄露进海报标题”这一规则

**风险提示**

* 该阶段会改变模型的标题生成语义，必须单独隔离执行与验证

* 如果 live path 与 fallback path 口径不一致，会产生肉眼可见的回归

## 8. 阶段执行门禁

以下规则是硬约束，不允许跳过。

### 8.1 阶段开始前

执行 Agent 在开始任一阶段代码修改前，必须先执行：

1. `refresh memory`

   * 重新读取 `context://memory/user_profile.md`

   * 重新读取 `context://memory/projects/-c-Users-Admin-Desktop---------/project_memory.md`

   * 重新读取最新 topic
2. 向用户汇报本阶段：

   * 目标

   * 计划改动文件

   * 验收方式

   * 风险点
3. 明确向用户请求“是否开始当前阶段”的确认
4. 只有在用户明确批准后，才允许开始本阶段代码修改

### 8.2 阶段完成后

执行 Agent 在完成一个阶段后，必须停下，不得直接进入下一阶段。必须执行：

1. 完成本阶段验证
2. 运行 `git status` 与 `git diff --stat`
3. 基于本阶段实际改动，向用户推荐 commit message
4. 推荐格式必须遵循：

```text
<type>(<scope>): 中文简述
```

例如：

```text
feat(waiting-flow): 增加首次生成等待页与异步 run 状态轮询
```

1. 向用户汇报本阶段结果并请求确认
2. 只有在用户批准并确认 commit 已完成后，才允许推进到下一阶段

### 8.3 下一阶段开始前

在下一阶段真正开始改代码前，执行 Agent 必须再次执行：

1. `refresh memory`
2. 向用户提供下一 Phase 的任务概览
3. 明确请求“是否开始下一阶段”
4. 得到确认后才能实施

禁止行为：

* 阶段 A 完成后，未确认、未 commit 就进入阶段 B

* 未做 memory refresh 就直接开始下一阶段

* 一次对话里跨多个阶段连续落代码

## 9. 非目标

* 本轮不处理 `safePointLabel` 相关修改（当前仓库未查实存在）

* 本轮不处理二确页改地图名

* 本轮不处理目的地与底层素材源错位保护

* 本轮不处理工作台草稿持久化

* 本轮不实现取消生成

* 本轮不为等待页引入正式任务队列、数据库或分布式 worker

## 10. 总体验收顺序

建议严格按以下顺序执行：

1. Phase 1：先把工作台空态和提交门禁收紧
2. Phase 2：再改首次生成为异步等待流，补齐失败恢复与耗时展示
3. Phase 3：最后单独处理海报标题语义重构

这个顺序的原因是：

* Phase 1 风险最低，能先把输入边界收紧

* Phase 2 是架构性改动，需要在输入边界稳定后实施

* Phase 3 是高风险 prompt/visual 语义变更，必须在等待流稳定后单独验证


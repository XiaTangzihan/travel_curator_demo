# 测试追踪页改造设计 v2：作品视角诊断台与统计聚合

## 1. 目标

* 把当前 `/runs` 从“run 列表壳层”改造成面向开发者的诊断台，优先服务“从前台某个旅行作品快速追到当前数据链路”这一核心需求。
* 让追踪页能够围绕作品当前态聚合展示：作品基本信息、当前使用的评论卡、`route.md`、`knowledge.json`、静态图、`map.view.json`、原始数据入口与最新 run 诊断信息。
* 在页面顶部提供能直接服务测试和调优的全局统计与数据集统计，使广州、杭州两套数据的 `map` 数和运行状态一眼可见。
* 保持测试追踪页与主端逻辑解耦。主端继续服务“作品体验”，追踪页单独承载“开发者诊断”。

## 2. 非目标

* 本轮不实现“历史 run 精确快照”能力，不为每次历史 run 冻结独立的 `route / knowledge / poster / map.view` 文件副本。
* 本轮不把 `/runs` 做成运维控制台，不在此页新增生成、确认、删除、重试等主业务写操作。
* 本轮不重写 `MapRecord / MapViewModel / RunTrace` 的主业务语义；主端页面继续围绕“作品当前态”运行。
* 本轮不引入数据库、对象存储、消息队列或后台任务系统；仍基于当前本地文件仓库机制完成诊断聚合。
* 本轮不尝试伪造恢复旧 run 的历史产物。如果现有历史 run 的路径已经被后续重生成覆盖，只能按“摘要诊断”语义展示。

## 3. 已确认决策

* `/runs` 的默认主入口改为“按作品查”，而不是继续以 run 为第一索引。
* 单个作品详情默认优先展示“当前作品当前态”，历史 run 只放在下方时间线中做摘要诊断。
* `route.md / knowledge.json / 评论卡 / 静态图 / map.view` 默认采用“摘要 + 预览”展示，而不是全文直出。
* 顶栏统计以全局 runs 为主，同时补充 `datasetKey` 级别统计；去掉 `warning run 占比`。
* 数据集统计必须让 `guangzhou / hangzhou` 各自的 `map` 数一眼可见。
* `/runs` 只允许轻操作：打开作品页、打开产物文件、复制 `mapId / runId / commentId / eventId`，不承担主业务写动作。
* 方案基线采用“独立 trace 聚合层”，而不是继续把统计和诊断逻辑直接塞进现有 `RunTrace[]` 页面组件。
* 本轮范围明确收缩为“最新作品可深追，历史 run 只做摘要诊断”；不做 run 级快照冻结。
* 单作品详情必须显式区分 `selectedPosterVersion`、`selectedPosterSourceRun`、`latestLifecycleRun`；不再把 `currentRunId` 直接等同于“最新 run”。
* 追踪页必须补一层结构化 `AI Contract` 视图，展示 route parser 解析后的 `Important Rules` 与 event 级 `subject / avoid`，而不只是 route 文本预览。
* 当前选中产物使用硬完整性检查；历史 image-producing run 的图片产物使用 `present / pruned / unknown` 软状态，避免把被确认流程裁剪的旧候选版本误报为异常。
* 主端读模型保持不动，追踪页通过旁路只读聚合拿到开发者视图，不把诊断字段回灌到主端页面。
* 历史 run 中涉及 `route / poster / map` 的路径，页面必须明确标注“非快照语义”，不能暗示其代表当时版本。

## 4. 当前代码现状

### 4.1 `/runs` 已接真实本地留痕，但仍是 run 视角壳层

* `app/runs/page.tsx` 当前只做一层 `listRunTraces()` 调用，然后把 `RunTrace[]` 直接传给 `src/features/runs/runs-page.tsx`。
* `src/features/runs/runs-page.tsx` 当前是左侧 run 列表、右侧路径卡片的结构，缺少作品索引、统计聚合、评论卡追溯和完整性诊断。
* 页面虽然能看到 `warnings / artifacts / inputSummary / referenceIds` 等字段，但仍停留在“逐条 run 展示”，无法回答“这张作品当前到底用了什么数据”。

### 4.2 底层仓库已具备作品、run 和当前产物的真实关联

* `src/server/repositories/demo-repository.ts` 当前已经是本地文件真源，负责读取 `MapRecord`、`RunTrace`、`MapViewModel`、`route.md`、`knowledge.json`、`raw/events` 等内容。
* `MapRecord` 已持有 `mapId / currentRunId / selectedCommentIds / routePath / knowledgePath / posterPath` 等关键关联字段。
* `MapViewModel` 已持有当前作品真实渲染所需的 `events / nodes / posterPath / routeMarkdown / knowledge`。
* 因此“从作品追到当前数据链路”在数据上是可聚合的，只是当前页面没有建立对应读模型。

### 4.3 当前作品当前态已经升级为海报版本选择模型

* `MapRecord` 当前已经包含 `posterVersions` 与 `selectedPosterVersionId`，不再是“单 `posterPath` + 单 run” 的简化模型。
* `selectMapPosterVersion()` 会切换当前选中的海报版本，同时改写 `posterPath / currentRunId`。
* `prunePosterVersionsForConfirm()` 会在确认保存前只保留当前选中版本，并删除未选中的候选海报产物。

### 4.4 `currentRunId` 不能再直接视为“当前海报来源 run”

* 首次生成与重生成会把 `currentRunId` 指向图片来源 run。
* 但确认保存会新建一条 `confirm` run，并把 `currentRunId` 改写为确认 run；此时当前海报仍可能来自更早的一条 `generate / regenerate` run。
* 当前真实样本里已经存在“`posterPath` 指向重生成版本，但 `currentRunId` 指向 confirm run”的情况，因此追踪页若直接拿 `currentRunId` 当主诊断 run，会得出错误结论。
* 另外，`generate` run 通常包含 `raw/events` 路径，但 `regenerate / confirm` run 当前通常只有 `route / poster / map`，因此当前作品详情不能假设主诊断 run 一定带有完整数据源路径。

### 4.5 AI 主链路已升级为 route-driven contract

* `src/engine/pipelines/generate-map.ts` 当前在生成 `routeMarkdown` 后会立即执行 `parseRouteMarkdown(routeMarkdown)`，后续海报 prompt 读取的是 `parsedRoute + knowledge`，而不是只依赖原始 event 文本。
* `src/engine/parsers/route-markdown.ts` 明确要求 route 中存在 `## Important Rules` 区块，并解析 event 级 `subject / avoid`。
* 这意味着开发者真正需要看的，不只是 `route.md` 文本，而是“当前被 AI 消费的结构化合同”。

### 4.6 历史图片产物会被确认流程主动裁剪

* `prunePosterVersionsForConfirm()` 会删除未选中的候选海报文件，因此旧 `generate / regenerate` run 的 `posterPath` 后续可能天然失效。
* 这类缺失在当前分支语义上是“被裁剪的旧版本”，不是“系统异常丢失”。
* 如果追踪页把所有历史图片缺失统一当成 missing artifact，会产生大量假阳性。

### 4.7 当前 `/runs` 缺少开发者真正关心的统计和完整性反馈

* 现在没有全局 `run` 统计、没有 `datasetKey` 维度统计、没有 `map` 级聚合，也没有“缺 route / knowledge / poster / map.view”这类完整性诊断。
* 现有 UI 无法回答：广州和杭州各有多少作品、某作品当前选中的是哪一版海报、这版海报来自哪次生成、最近一次生命周期动作是什么、当前 AI 合同是否已经跑偏、某个历史版本是被裁剪还是异常丢失。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| T1 | 作品视角索引 | `/runs` 默认按作品组织，而不是按 run 组织 | 新增 trace 聚合读模型，产出 `map` 级列表摘要 |
| T2 | 当前作品语义收口 | 单作品详情能明确区分当前选中海报版本、海报来源 run、最近生命周期 run | 聚合 `mapRecord.posterVersions + selectedPosterVersionId + related runs` |
| T3 | 当前作品深追 | 进入某作品后可直接看到当前使用的评论卡、`route`、`knowledge`、主图、`map.view` 与作品身份信息 | 聚合 `MapRecord + MapViewModel + route/knowledge/raw/events + current selection` |
| T4 | AI Contract 视图 | 能直接看到 parsed route 的 `Important Rules` 与 event 级 `subject / avoid` | 复用 route parser，输出结构化合同视图而不是只展示 route 文本 |
| T5 | 顶栏统计 | 页面顶部能展示全局统计与数据集统计，并让广州/杭州 `map` 数一眼可见 | 在聚合层集中计算 `globalStats + datasetStats` |
| T6 | 历史 run 摘要诊断 | 单作品下方可看 run 时间线、状态、耗时、失败信息与版本来源关系 | 历史 run 只展示稳定摘要字段，并区分 selected source / lifecycle / history roles |
| T7 | 历史产物状态语义 | 历史图片产物不把被确认流程裁剪的候选版本误报为异常 | 为历史 image-producing run 建立 `present / pruned / unknown` 软状态 |
| T8 | 完整性与异常提示 | 当前选中产物缺失、selected source run 断链、route 解析失败等问题可直接在追踪页暴露 | 为 detail 读模型加入 hard integrity checks 与 section-level 错误态 |
| T9 | 独立实现边界 | 追踪页诊断逻辑尽量与主端页面隔离，避免互相污染 | 新增 trace 专属读模型、查询模块和 UI 组件；主端仅读现有主业务模型 |

## 6. 分阶段计划

### Phase 1：建立 trace 聚合读模型 v2

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 建立测试追踪页专属的只读聚合层。
* 定义 `TraceOverviewViewModel` 与 `TraceMapDetailViewModel`。
* 在 detail 中显式派生 `selectedPosterVersion`、`selectedPosterSourceRun`、`latestLifecycleRun` 三个概念。
* 聚合作品索引、全局统计、数据集统计、当前作品数据、AI Contract、历史 run 摘要与完整性检查。
* 为历史 image-producing run 计算 `present / pruned / unknown` 软状态；不提供“历史快照”语义。

**建议改动面**
* `src/server/trace-diagnostics/types.ts`（新增）
* `src/server/trace-diagnostics/queries.ts`（新增）
* `src/server/repositories/demo-repository.ts`（仅在需要时补充复用读方法，不改主业务语义）
* `src/engine/parsers/route-markdown.ts`（复用，不新增客户端重复解析）
* `tests/unit/trace-diagnostics-query.test.ts`（新增）

**验收标准**
* 能从现有 `public/mock/**` 真源生成作品级索引视图。
* 单作品 detail 能正确区分当前选中海报版本、海报来源 run 与最近生命周期 run。
* 全局统计与数据集统计计算结果可被单测验证。
* 单作品 detail 能产出当前作品数据、AI Contract、history run 摘要与完整性告警。
* 当当前海报来源 run 不带 `raw/events` 路径时，detail 仍能按 `datasetKey` 补出当前数据源入口。

**风险提示**
* 如果直接把 `currentRunId` 视为主诊断 run，当前作品详情会把 confirm run 误当成海报来源 run。

### Phase 2：实现 `/runs` 的作品视角页面

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 将 `/runs` 重构为“顶栏统计 + 左侧作品索引 + 右侧诊断详情”的桌面优先页面。
* 支持以 `mapName / mapId / runId / commentId / versionId` 搜索。
* 支持以 `dataset / city / mapStatus / selectedPosterSourceRunStatus / latestLifecycleRunStatus / providerMode` 筛选。
* 详情区展示作品当前态卡、版本摘要、当前主图、当前产物摘要、AI Contract、评论卡带、最近生命周期 run 与 history run 摘要。

**建议改动面**
* `app/runs/page.tsx`
* `src/features/runs/runs-page.tsx`（或拆分为同目录下多个诊断子组件）
* `src/features/runs/components/*`（新增）
* `app/api/runs/maps/[mapId]/route.ts`（如采用懒加载 detail，则新增）

**验收标准**
* `/runs` 默认落在作品视角，而不是 run 视角。
* 进入页面后能直接看见全局统计、数据集统计和作品列表。
* 切换作品后，右侧详情同步刷新，不需要手动刷新页面。
* 广州、杭州各自的 `map` 数在页面顶栏或次顶栏位置一眼可见。
* 开发者进入单作品详情后，能直接看懂“当前选中的海报版本来自哪次生成”和“最近一次 lifecycle 动作是什么”。
* 结构化 `AI Contract` 面板能直接看到 `Important Rules` 与 event 级 `subject / avoid`。

**风险提示**
* 如果把所有 detail 一次性下发到前端，页面 payload 可能过大；需要控制 overview 与 detail 的装载边界。

### Phase 3：补齐完整性提示、异常降级与测试收口

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 为 `route / knowledge / poster / map.view` 建立分区错误态与缺失态。
* 为历史 run 补充“非快照语义”文案、角色 badge 与 `present / pruned / unknown` 状态。
* 增加聚合层、页面交互、当前态语义和完整性检查相关测试。
* 校验 `/runs` 改造后不会影响首页、工作台、确认页、地图页主链路。

**建议改动面**
* `src/features/runs/*`
* `src/server/trace-diagnostics/*`
* `tests/unit/trace-diagnostics-query.test.ts`
* `tests/unit/runs-page.test.tsx`（如当前测试体系适配）

**验收标准**
* 单个产物解析失败时，只影响对应卡片，不拖垮整页。
* 当前选中产物缺失、selected source run 断链、悬空 `currentRunId`、orphan run 等问题能被页面明确暴露。
* 被确认流程裁剪的旧候选海报不会被误报为系统异常。
* `/runs` 页面 smoke test 可验证默认加载、切换作品、显示统计与错误降级。

**风险提示**
* 如果把当前选中产物的硬检查和历史 run 的软状态混写，页面会同时出现误报和漏报。

## 7. 阶段执行门禁

### 7.1 阶段开始前

* refresh memory，重新确认本 spec、项目约束和最新工作树状态。
* 汇报本阶段目标、计划改动文件、验收方式和风险点。
* 请求用户确认是否开始该阶段。
* 未获得确认前，不进入编码。

### 7.2 阶段完成后

* 完成本阶段自检与测试。
* 运行 `git status` 与 `git diff --stat`。
* 给出符合仓库规范的 commit message 建议。
* 向用户汇报结果并请求确认是否 commit。
* 未确认前，不直接执行 `git commit`，也不进入下一阶段。

### 7.3 下一阶段开始前

* 再次 refresh memory。
* 汇报下一阶段概览、风险和验收点。
* 请求用户确认是否开始。
* 得到批准后再继续。

## 8. 总体验收顺序

1. 先验 trace 聚合层是否正确产出 `overview/detail`，尤其是 `selectedPosterVersion / selectedPosterSourceRun / latestLifecycleRun` 的区分是否成立。
2. 再验 `AI Contract` 是否稳定可读，包括 route parser、`Important Rules`、event 级 `subject / avoid` 是否能和当前作品对齐。
3. 再验“当前作品深追”是否成立，包括评论卡、当前产物、当前主图与完整性检查是否能对上同一张作品。
4. 再验全局统计与数据集统计，确保广州/杭州 `map` 数和运行态摘要准确。
5. 再验搜索与筛选，确认 `mapName / mapId / runId / commentId / versionId` 都能把人带到对的作品。
6. 最后验历史 run 角色与产物状态，确认 `present / pruned / unknown`、坏 JSON、orphan run、历史非快照语义都能被明确表达。

这个顺序优先控制“数据正确性”风险，而不是优先做视觉外观。

## 9. 方案选型

### 9.1 作品视角 trace 聚合层（推荐方案）

结论：本轮选择“独立 trace 聚合层 v2 + 当前作品当前态深追 + 历史 run 摘要诊断”。

原因：

* 它直接对齐用户真实问题：先找作品，再追当前数据链路。
* 它复用现有 `demo-repository` 作为真源，不需要重写主端模型。
* 它能把“当前选中的海报版本来自哪次生成”和“最近一次生命周期动作是什么”这两个问题拆开表达，而不是混在一个 `currentRunId` 上。
* 它能直接暴露 route-driven `AI Contract`，让开发者看到当前真正送进 P3/P4 的规则与 event 语义。
* 它能把当前选中产物的硬完整性检查与历史 run 的软状态集中处理，不污染主端组件。

成立边界：

* 只对“当前作品”提供深追能力。
* 历史 run 只做摘要诊断，不承诺历史快照。

### 9.2 继续扩充现有 run 列表页（不选）

不选原因：

* 现有 `/runs` 天然是 run 视角，很难优雅回答“某个前台作品现在对应哪套数据”。
* 一旦继续直接往 `RunTrace[]` 页面上堆统计和详情，组件内逻辑会越来越混乱，且难以与主端边界隔离。

### 9.3 引入历史 run 快照系统（本轮不选）

不选原因：

* 要想让历史 run 真正可追，需要为每次 run 冻结独立的 `route / knowledge / poster / map.view` 副本。
* 这会显著扩大写入链路、I/O 和存储管理复杂度，也会让本轮范围从“追踪页改造”膨胀成“产物版本化系统”。
* 当前用户已明确要求改回轻量版，因此本轮不进入该方向。

## 10. 目标设计

### 10.1 页面信息架构

`/runs` 页面仍采用三段式，但右侧详情改为 5 个层次：

* 顶栏：全局统计卡 + 数据集统计卡
* 左侧：作品索引与搜索筛选
* 右侧详情：
  * 当前作品当前态与版本语义
  * `AI Contract`
  * 当前产物摘要
  * 当前评论卡
  * run 时间线

默认行为：

* 页面加载后默认选中最新更新的作品。
* 右侧默认先回答“当前前台正在展示哪一版海报，它来自哪次生成”，再展示历史 run。

### 10.2 顶栏统计定义

全局统计建议固定为：

* 总 `map` 数
* 总 `run` 数
* 成功数
* 失败数
* `incomplete` 数
* 平均耗时
* fallback 数 / fallback 占比

数据集统计卡至少包含：

* `datasetKey`
* `map` 数（主数字）
* `run` 数
* 成功数
* 失败 + incomplete 数
* 最近更新时间

平均耗时只统计有有效 `startedAt/endedAt` 的终态 runs。

### 10.3 作品索引行为

左侧作品索引项至少展示：

* `mapName`
* `city`
* `datasetKey`
* `mapStatus`
* 候选海报版本数
* 当前选中版本摘要
* `selectedPosterSourceRun` 状态
* `latestLifecycleRun` 状态
* 最近更新时间
* 异常 badge（`failed / incomplete / fallback / missing current artifacts`）

搜索应支持：

* `mapName`
* `mapId`
* `runId`
* `commentId`
* `versionId`

筛选应支持：

* `datasetKey`
* `city`
* `mapStatus`
* `selectedPosterSourceRunStatus`
* `latestLifecycleRunStatus`
* `providerMode`

当以 `runId / commentId / versionId` 命中时，结果仍回到所属作品，而不是切换为 run 视角页面。

### 10.4 当前作品当前态语义

detail 读模型必须显式派生以下概念：

* `currentRunIdRaw`
  * `MapRecord.currentRunId` 的原始值
  * 只作为底层事实展示，不直接等价于主诊断 run

* `selectedPosterVersion`
  * 当前前台正在展示的海报版本
  * 优先由 `selectedPosterVersionId` 定位；若旧数据缺字段，则回退到 `posterPath` 匹配

* `selectedPosterSourceRun`
  * 产出当前选中海报版本的图片来源 run
  * 这是当前作品详情的主诊断对象

* `latestLifecycleRun`
  * 该作品最近一次生命周期动作对应的 run
  * 往往可能是 `confirm`

使用规则：

* 页面默认主诊断对象是 `selectedPosterSourceRun`，而不是 `currentRunIdRaw`。
* `latestLifecycleRun` 必须单独展示，不能和 `selectedPosterSourceRun` 合并。
* 若两者恰好是同一条 run，可在 UI 上折叠为 “same run”。
* 若存在 `selectedPosterVersion` 但找不到来源 run，视为硬告警。

### 10.5 当前作品详情结构

右侧详情区按以下顺序组织：

1. **当前态身份卡**
   * `mapId`
   * `mapName`
   * `city`
   * `datasetKey`
   * `mapStatus`
   * `eventCount`
   * `updatedAt`
   * `currentRunIdRaw`

2. **版本与来源卡**
   * `selectedPosterVersionId`
   * 候选海报版本数
   * `selectedPosterSourceRun`
   * `latestLifecycleRun`
   * 打开 `/maps/[mapId]`
   * 复制 `mapId / selectedPosterSourceRun.runId / latestLifecycleRun.runId`

3. **当前主图**
   * 直接预览当前选中 `posterPath`
   * 提供打开原图入口

4. **当前产物摘要**
   * `rawPath`
     * 由 `datasetKey` 显式推导，不要求 `selectedPosterSourceRun` 自带该路径
   * `eventsPath`
     * 同样由 `datasetKey` 推导
   * `route.md`
     * 显示路径、标题摘要、前若干行预览、解析状态
   * `knowledge.json`
     * 显示路径、条目数、前若干项预览
   * `map.view.json`
     * 显示路径、节点数、`selectedEventId` 等摘要
   * `poster`
     * 显示当前选中版本路径与来源 run

5. **评论卡带**
   * 基于当前作品实际使用的评论数据展示卡片
   * 每张卡至少包含 `commentId / eventId / poiName / excerpt / 缩略图`
   * 允许同时展示轻量 `subject / avoid` 预览，便于和 `AI Contract` 对照
   * 支持复制 `commentId` 和 `eventId`

### 10.6 `AI Contract` 面板

追踪页必须补一个结构化 `AI Contract` 面板，而不是只展示 `route.md` 文本。

该面板至少包含：

* route front matter 摘要
  * `mapName`
  * `city`
  * `styleLabel`
  * `days`
  * `eventCount`
  * `knowledgeCount`

* `Important Rules`
  * 以结构化列表展示

* event 合同表
  * `sequence`
  * `shortName`
  * `poi`
  * `imagePath`
  * `subject`
  * `avoid`

* `knowledge` 摘要
  * 条目数
  * 前若干个 landmark 名称与 visual 摘要

语义要求：

* 该面板展示的是“当前真正送进 P3/P4 的结构化合同”。
* 若当前 `route.md` 缺失或 parser 失败，该面板必须显示 blocker 级错误态。
* 如需降级预览，可使用 `MapViewModel.routeMarkdown` 作为只读文本备用，但不能伪装成“解析成功”。

### 10.7 run 时间线与历史产物状态

run 时间线至少分为三类角色：

* `selected source`
  * 当前选中海报的来源 run

* `latest lifecycle`
  * 最近一次生命周期 run

* `history`
  * 其余历史 run

每条历史 image-producing run 的图片产物状态使用软分类：

* `present`
  * 路径存在且文件可访问

* `pruned`
  * 路径不存在，但该 run 属于历史候选版本，且缺失与确认流程裁剪语义一致

* `unknown`
  * 无路径或无法可靠判断

规则：

* 当前选中海报及当前作品关键产物使用硬完整性检查，不使用 `pruned / unknown`。
* 历史 `generate / regenerate` run 不再简单以 “poster 缺失 = 异常” 处理。
* 固定显示提示：
  * 历史 run 产物路径仅表示当前可定位文件，不代表历史快照。

### 10.8 只读接口与装载策略

推荐装载方式：

* `app/runs/page.tsx` 在服务端直接读取 `TraceOverviewViewModel`
* 右侧 detail 可按需读取 `TraceMapDetailViewModel`
* 若需要客户端切换详情时无整页刷新，可新增 `GET /api/runs/maps/[mapId]`

边界要求：

* 追踪页不直接在客户端拼文件系统路径，路径解析统一走服务端聚合层。
* route parser 只在服务端复用，不在客户端重新实现一套文本解析。
* 追踪页不复用主端业务组件；仅允许复用通用 UI 基础件，如 `SiteShell`、`StatusPill`。

### 10.9 完整性检查与异常降级

detail 读模型需要输出两类检查。

**当前选中态的硬检查**

* `selectedPosterVersion` 无法解析
* `selectedPosterSourceRun` 缺失
* `route` 缺失或解析失败
* `knowledge` 缺失或 JSON 解析失败
* 当前选中 `poster` 缺失
* `map.view` 缺失或 JSON 解析失败
* `MapRecord.selectedCommentIds` 与当前 `events` 不匹配
* 存在 run，但找不到对应 `map`

**历史 run 的软状态**

* `present`
* `pruned`
* `unknown`

页面降级规则：

* 任一当前产物解析失败，只影响对应卡片，不影响整页其他部分。
* 历史 run 不做伪造恢复；只显示摘要、角色与状态语义。
* `AI Contract` 解析失败时，允许其他卡片继续渲染，但该面板必须显式报错。

### 10.10 测试要求

至少补齐以下验证：

* `TraceOverviewViewModel` 的全局统计和数据集统计单测
* `TraceMapDetailViewModel` 的当前态语义单测
  * `selectedPosterVersion`
  * `selectedPosterSourceRun`
  * `latestLifecycleRun`
* `AI Contract` 解析单测
  * `Important Rules`
  * event 级 `subject / avoid`
* 当前海报来源 run 不带 `raw/events` 路径时，仍能按 `datasetKey` 正确补全数据源入口
* 历史图片产物状态分类单测
  * `present / pruned / unknown`
* 关键完整性告警单测
  * route 解析失败
  * selected source run 缺失
  * 当前海报缺失
  * orphan run
* `/runs` 页面 smoke test
  * 默认进入作品视角
  * 能切换作品
  * 能看到广州/杭州 `map` 数
  * 能分清当前选中海报来源 run 与最新 lifecycle run

验收口径：

* 先对齐数据正确性，再看 UI 呈现；只要当前态语义、`AI Contract` 或历史状态分类不稳，本轮不算完成。

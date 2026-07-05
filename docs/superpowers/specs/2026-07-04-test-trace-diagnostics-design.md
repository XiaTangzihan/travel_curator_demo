# 测试追踪页改造设计：作品视角诊断台与统计聚合

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
* 单个作品详情默认优先展示“最新 run”，历史 run 只放在下方时间线中做摘要诊断。
* `route.md / knowledge.json / 评论卡 / 静态图 / map.view` 默认采用“摘要 + 预览”展示，而不是全文直出。
* 顶栏统计以全局 runs 为主，同时补充 `datasetKey` 级别统计；去掉 `warning run 占比`。
* 数据集统计必须让 `guangzhou / hangzhou` 各自的 `map` 数一眼可见。
* `/runs` 只允许轻操作：打开作品页、打开产物文件、复制 `mapId / runId / commentId / eventId`，不承担主业务写动作。
* 方案基线采用“独立 trace 聚合层”，而不是继续把统计和诊断逻辑直接塞进现有 `RunTrace[]` 页面组件。
* 本轮范围明确收缩为“最新作品可深追，历史 run 只做摘要诊断”；不做 run 级快照冻结。
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

### 4.3 run 留痕字段对统计和诊断已有一定基础，但还不够页面化

* `RunTrace` 当前包含 `status / stage / providerMode / warnings / errorMessage / inputSummary / generateInput / referenceIds / startedAt / endedAt / artifacts`。
* `app/api/runs/route.ts` 和 `app/api/runs/[runId]/route.ts` 已经存在，说明追踪数据本身是可以通过只读接口暴露的。
* 现有字段足够支持全局统计、数据集统计、最新 run 诊断和历史 run 摘要，但不足以直接支撑作品视角页面。

### 4.4 当前历史 run 的产物路径不具备精确历史语义

* `src/engine/pipelines/generate-map.ts` 与 `app/api/maps/[mapId]/confirm/route.ts` 当前写入的 `route / poster / map` 路径仍以 `mapId` 为主。
* 同一作品重生成后，这些 map 级路径会被覆盖，因此旧 run 即使仍存在，其 `artifacts` 指向的也可能是“当前最新作品”而非“当时版本”。
* 这使得历史 run 只能安全地做摘要诊断，不能在本轮被包装成历史快照浏览器。

### 4.5 当前 `/runs` 缺少开发者真正关心的统计和完整性反馈

* 现在没有全局 `run` 统计、没有 `datasetKey` 维度统计、没有 `map` 级聚合，也没有“缺 route / knowledge / poster / map.view”这类完整性诊断。
* 现有 UI 无法回答：广州和杭州各有多少作品、某作品最近一次成功/失败是什么时候、某作品当前产物是否缺失、某次 fallback 是否已经影响到当前展示态。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| T1 | 作品视角索引 | `/runs` 默认按作品组织，而不是按 run 组织 | 新增 trace 聚合读模型，产出 `map` 级列表摘要 |
| T2 | 当前作品深追 | 进入某作品后可直接看到当前使用的评论卡、`route`、`knowledge`、主图、`map.view` 与作品身份信息 | 聚合 `MapRecord + MapViewModel + route/knowledge/raw/events + latest run` |
| T3 | 顶栏统计 | 页面顶部能展示全局统计与数据集统计，并让广州/杭州 `map` 数一眼可见 | 在聚合层集中计算 `globalStats + datasetStats` |
| T4 | 历史 run 摘要诊断 | 单作品下方可看 run 时间线、状态、耗时、失败信息和 fallback 痕迹 | 历史 run 只展示稳定摘要字段，并明确“非快照语义” |
| T5 | 完整性与异常提示 | 作品缺关键产物、`currentRunId` 悬空、run orphan 等问题可直接在追踪页暴露 | 为 detail 读模型加入 `integrityChecks` 和 section-level 错误态 |
| T6 | 独立实现边界 | 追踪页诊断逻辑尽量与主端页面隔离，避免互相污染 | 新增 trace 专属读模型、查询模块和 UI 组件；主端仅读现有主业务模型 |

## 6. 分阶段计划

### Phase 1：建立 trace 聚合读模型

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 建立测试追踪页专属的只读聚合层。
* 定义 `TraceOverviewViewModel` 与 `TraceMapDetailViewModel`。
* 聚合作品索引、全局统计、数据集统计、最新 run 摘要与完整性检查。
* 历史 run 只输出稳定摘要字段，不提供“历史快照”语义。

**建议改动面**
* `src/server/trace-diagnostics/types.ts`（新增）
* `src/server/trace-diagnostics/queries.ts`（新增）
* `src/server/repositories/demo-repository.ts`（仅在需要时补充复用读方法，不改主业务语义）
* `tests/unit/trace-diagnostics-query.test.ts`（新增）

**验收标准**
* 能从现有 `public/mock/**` 真源生成作品级索引视图。
* 全局统计与数据集统计计算结果可被单测验证。
* 单作品 detail 能产出当前作品数据、latest run、history run 摘要和完整性告警。

**风险提示**
* 如果把诊断读模型直接写进 `domain.ts` 或主业务组件，会污染主端边界。

### Phase 2：实现 `/runs` 的作品视角页面

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 将 `/runs` 重构为“顶栏统计 + 左侧作品索引 + 右侧诊断详情”的桌面优先页面。
* 支持以 `mapName / mapId / runId / commentId` 搜索。
* 支持以 `dataset / city / mapStatus / latestRunStatus / providerMode` 筛选。
* 详情区展示作品身份卡、当前主图、产物摘要、评论卡带、latest run 与 history run 摘要。

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

**风险提示**
* 如果把所有 detail 一次性下发到前端，页面 payload 可能过大；需要控制 overview 与 detail 的装载边界。

### Phase 3：补齐完整性提示、异常降级与测试收口

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 为 `route / knowledge / poster / map.view` 建立分区错误态与缺失态。
* 为历史 run 补充“非快照语义”文案和 badge。
* 增加聚合层、页面交互和完整性检查相关测试。
* 校验 `/runs` 改造后不会影响首页、工作台、确认页、地图页主链路。

**建议改动面**
* `src/features/runs/*`
* `src/server/trace-diagnostics/*`
* `tests/unit/trace-diagnostics-query.test.ts`
* `tests/unit/runs-page.test.tsx`（如当前测试体系适配）

**验收标准**
* 单个产物解析失败时，只影响对应卡片，不拖垮整页。
* 缺关键产物、悬空 `currentRunId`、orphan run 等问题能被页面明确暴露。
* `/runs` 页面 smoke test 可验证默认加载、切换作品、显示统计与错误降级。

**风险提示**
* 如果历史 run 的语义提示不明确，开发者会误把“当前最新产物”理解为“历史当时产物”。

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

1. 先验 trace 聚合层是否正确产出 `overview/detail`，因为 UI 只是消费结果，聚合不稳则页面一定漂移。
2. 再验“当前作品深追”是否成立，包括评论卡、当前产物、latest run 和完整性检查是否能对上同一张作品。
3. 再验全局统计与数据集统计，确保广州/杭州 `map` 数和运行态摘要准确。
4. 再验搜索与筛选，确认 `mapName / mapId / runId / commentId` 都能把人带到对的作品。
5. 最后验异常降级与历史 run 文案，确认缺文件、坏 JSON、orphan run、历史非快照语义都能被明确表达。

这个顺序优先控制“数据正确性”风险，而不是优先做视觉外观。

## 9. 方案选型

### 9.1 作品视角 trace 聚合层（推荐方案）

结论：本轮选择“独立 trace 聚合层 + 当前作品深追 + 历史 run 摘要诊断”。

原因：

* 它直接对齐用户真实问题：先找作品，再追当前数据链路。
* 它复用现有 `demo-repository` 作为真源，不需要重写主端模型。
* 统计、完整性诊断、历史 run 语义都可以在只读聚合层集中处理，不污染主端组件。

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

`/runs` 页面改为三段式：

* 顶栏：全局统计卡 + 数据集统计卡
* 左侧：作品索引与搜索筛选
* 右侧：作品诊断详情

默认行为：

* 页面加载后默认选中最新更新的作品。
* 右侧先展示“当前作品数据”，然后是 `latest run`，最后是 `history run` 摘要时间线。

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
* 最新 run 状态
* 最近更新时间
* 异常 badge（`failed / incomplete / fallback / missing artifacts`）

搜索应支持：

* `mapName`
* `mapId`
* `runId`
* `commentId`

筛选应支持：

* `datasetKey`
* `city`
* `mapStatus`
* `latestRunStatus`
* `providerMode`

当以 `runId / commentId` 命中时，结果仍回到所属作品，而不是切换为 run 视角页面。

### 10.4 当前作品详情结构

右侧详情区按以下顺序组织：

1. **作品身份卡**
   * `mapId`
   * `mapName`
   * `city`
   * `datasetKey`
   * `mapStatus`
   * `eventCount`
   * `currentRunId`
   * `updatedAt`

2. **前台入口**
   * 打开 `/maps/[mapId]`
   * 复制 `mapId`

3. **当前主图**
   * 直接预览 `posterPath`
   * 提供打开原图入口

4. **当前产物摘要**
   * `rawPath`：显示数据集原始文件路径与评论总数
   * `eventsPath`：显示事件文件路径与事件总数
   * `route.md`：显示路径、标题摘要、前若干行预览
   * `knowledge.json`：显示路径、条目数、前若干项预览
   * `map.view.json`：显示路径、节点数、`selectedEventId` 等摘要

5. **评论卡带**
   * 基于当前作品实际使用的评论数据展示卡片
   * 每张卡至少包含 `commentId / eventId / poiName / excerpt / 缩略图`
   * 支持复制 `commentId` 和 `eventId`

### 10.5 latest run 与 history run

`latest run` 区显示：

* `runId`
* `status`
* `stage`
* `providerMode`
* `startedAt / endedAt / duration`
* `styleKey / promptVersion / referenceIds`
* `warnings`
* `errorMessage`
* 已记录的 artifact 路径

`history run` 区只显示摘要时间线：

* `runId`
* `status`
* `stage`
* `providerMode`
* `duration`
* `startedAt`
* 是否失败 / 是否 fallback
* 简短错误或警告摘要

并固定显示提示：

* 历史 run 产物路径仅表示当前可定位文件，不代表历史快照。

### 10.6 只读接口与装载策略

推荐装载方式：

* `app/runs/page.tsx` 在服务端直接读取 `TraceOverviewViewModel`
* 右侧 detail 可按需读取 `TraceMapDetailViewModel`
* 若需要客户端切换详情时无整页刷新，可新增 `GET /api/runs/maps/[mapId]`

边界要求：

* 追踪页不直接读写文件系统路径字符串拼接逻辑，路径解析统一走服务端聚合层。
* 追踪页不复用主端业务组件；仅允许复用通用 UI 基础件，如 `SiteShell`、`StatusPill`。

### 10.7 完整性检查与异常降级

detail 读模型需要输出至少以下检查项：

* `route` 缺失
* `knowledge` 缺失或 JSON 解析失败
* `poster` 缺失
* `map.view` 缺失或 JSON 解析失败
* `currentRunId` 指向不存在的 run
* `MapRecord.selectedCommentIds` 与当前 `events` 不匹配
* 存在 run，但找不到对应 `map`

页面降级规则：

* 任一产物解析失败，只影响对应卡片，不影响整页其他部分。
* 无法精确解释的历史 run，不做伪造恢复，只显示摘要和语义提示。

### 10.8 测试要求

至少补齐以下验证：

* `TraceOverviewViewModel` 的全局统计和数据集统计单测
* `TraceMapDetailViewModel` 的作品详情拼装单测
* 关键完整性告警单测：缺 route / knowledge / poster / map.view、悬空 `currentRunId`、orphan run
* `/runs` 页面 smoke test：默认进入作品视角、能切换作品、能看到广州/杭州 `map` 数

验收口径：

* 先对齐数据正确性，再看 UI 呈现；只要聚合结果不稳，本轮不算完成。

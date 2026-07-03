# BAM 数据统一重构设计：Canonical Raw/Events v2

## 1. 目标

* 建立一套以 `BAM Sheet` 为唯一上游范式的数据转换机制，使新增城市数据集的接入退化为“登记数据源 -> 执行统一命令 -> 产出统一 raw/events”。
* 将广州与杭州统一迁移到同一套 `Canonical Raw v2 / Canonical Events v2` 合同，不再允许“同字段不同语义”或“同城市不同脚本”的并行链路继续存在。
* 将数据转换机制与下游数据应用层彻底解耦。AI 能力层、页面层、run 留痕层只允许消费标准化 `raw/events` 与 `datasetKey`，不得知道上游 Sheet 列结构、旧 Base 结构或城市特判逻辑。
* 在建立统一机制后删除所有过时代码、过时接口与可丢弃历史产物，保持代码库纯净、可观测、可维护。

## 2. 非目标

* 本轮不保留 `Base` 输入兼容层，不做“BAM + Base 双上游并存”。
* 本轮不保留旧历史 `maps/posters/routes/runs` 产物的可读兼容；这些产物全部视为可丢弃。
* 本轮不引入数据库、消息队列、对象存储或正式任务调度系统；仍以本地文件与本地命令链路作为 Demo 基础设施。
* 本轮不扩展新的业务能力，只做统一数据机制、统一合同和旧链路删除。
* 本轮不设计“任意表结构”的万能导入器；目标是处理“与 `【BAM规范】杭州市` 分表相似”的 BAM Sheet。

## 3. 已确认决策

* 统一上游只保留 `BAM Sheet`。`Base` 不再作为正式上游形态存在。
* 统一标准采用“杭州基线 + 最小清洗”的 `canonical v2`，而不是机械复制当前 `hangzhou.raw/events` 现状。
* `createdAt` 是唯一时间真源。`sourceDay/sourceTime` 删除，不再进入 canonical 合同。
* `src/engine/preprocess/part1.ts` 重命名为 `src/engine/preprocess/raw_to_events.ts`，并成为唯一 `raw -> events` 实现。
* 广州不做旧标准兼容补丁，而是使用对应的 `BAM` 规范分表，重新生成 `guangzhou.raw.json` 与 `guangzhou.events.json`。
* 下游 AI / 页面 / run trace 只消费 canonical `raw/events` 与 `datasetKey`，不得直接知道列号、表头、`Base token` 或城市专属脚本。
* 当前重构不新建分支，继续在现有 `feat/more-data` 分支上推进。
* 在正式改造开始前，必须先做一次 `checkpoint commit`，用于保存当前中间态并提供可回滚锚点。
* 旧的、并行的、过时的脚本、接口和历史 Demo 产物都应在统一机制落地后删除。

## 4. 当前代码现状

### 4.1 转换入口仍是双轨并行

* [`scripts/sync-dataset.mjs`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/scripts/sync-dataset.mjs) 目前同时包含 `syncFromBase()` 与 `syncFromSheet()` 两条主逻辑。
* `syncFromSheet()` 仍硬编码 `A1:X200`、`P:X` 图片列范围和具体列字母映射。
* [`scripts/dataset-registry.mjs`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/scripts/dataset-registry.mjs) 仍保留广州 `base` 配置与杭州 `sheet` 配置。

### 4.2 广州旧链路仍然存在

* [`scripts/sync-guangzhou-dataset.mjs`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/scripts/sync-guangzhou-dataset.mjs) 与 [`scripts/preprocess-guangzhou.mjs`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/scripts/preprocess-guangzhou.mjs) 仍作为独立脚本存在。
* [`app/api/preprocess/guangzhou/route.ts`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/app/api/preprocess/guangzhou/route.ts) 仍作为广州专用预处理入口存在。

### 4.3 Canonical 合同尚未建立

* [`src/contracts/domain.ts`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/src/contracts/domain.ts) 仍存在 `sourceDay/sourceTime`，且 `datasetKey` 多处仍以 `optional().default("guangzhou")` 方式兜底。
* [`public/mock/raw/guangzhou.raw.json`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/public/mock/raw/guangzhou.raw.json) 仍是旧形态：没有 `datasetKey`，`source` 也不是显式 `sheet` 结构。
* [`public/mock/raw/hangzhou.raw.json`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/public/mock/raw/hangzhou.raw.json) 已是新中间态，但字段集合和语义还未被正式升格为 canonical。

### 4.4 `raw -> events` 逻辑重复存在

* [`scripts/preprocess-dataset.mjs`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/scripts/preprocess-dataset.mjs) 中实现了一份 `raw -> events` 逻辑。
* [`src/engine/preprocess/part1.ts`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/src/engine/preprocess/part1.ts) 中又实现了另一份几乎相同的逻辑。

### 4.5 下游消费层基本解耦，但仍有残余耦合

* [`src/server/repositories/demo-repository.ts`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/src/server/repositories/demo-repository.ts) 已能按 `datasetKey` 解析 `raw/events` 文件路径。
* [`src/engine/pipelines/generate-map.ts`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/src/engine/pipelines/generate-map.ts) 已主要通过 repository 消费数据，但仍存在 `fallbackKnowledge(city)` 这种城市特判逻辑。

### 4.6 工作台 raw 卡片仍消费源侧残留字段

* [`src/features/workspace/workspace-page.tsx`](file:///c:/Users/Admin/Desktop/旅行策展人-备用/src/features/workspace/workspace-page.tsx) 仍直接展示 `review.sourceDay / review.sourceTime`。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| D1 | 统一上游 | 代码库只保留 `BAM Sheet` 一种上游范式 | 删除 `Base` 主链路；建立 `registry + bam_reader + bam_to_raw` |
| D2 | Canonical Raw v2 | 广州与杭州产出完全同构、同语义的 `raw.v2` | 统一字段、统一时间真源、统一附件语义、统一 source 结构 |
| D3 | Canonical Events v2 | 广州与杭州产出完全同构、同语义的 `events.v2` | 将 `part1.ts` 重命名为 `raw_to_events.ts`，作为唯一实现 |
| D4 | 广州迁移 | 广州不再依赖旧脚本或旧 Base 结构 | 使用广州 BAM 规范分表重生广州 raw/events |
| D5 | 下游消费收口 | AI / 页面 / run trace 仅消费 canonical `raw/events + datasetKey` | repository 保持唯一入口，移除城市特判和源结构知识 |
| D6 | 旧代码清理 | 旧脚本、旧接口、旧字段、旧历史产物全部删除 | 分阶段替换完成后集中删除并用 `rg` 验证 |
| D7 | 过程与验证 | 当前分支先 checkpoint，再按 Phase 推进并逐阶段 commit | 不新建分支，执行严格阶段门禁与终局验证 |

## 6. 分阶段计划

### Phase 0：Checkpoint Commit（当前分支）

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 在当前 `feat/more-data` 分支上保存一次重构前检查点。
* checkpoint 只用于回滚与对比，不代表统一机制已完成。
* 将当前 `app/**`、`src/**`、`scripts/**`、`package.json` 与杭州 `raw/events/comments` 一并纳入检查点。
* 明确排除当前可丢弃历史产物：`public/mock/maps/**`、`public/mock/posters/**`、`public/mock/routes/**`、`public/mock/runs/**`。

**建议改动面**
* 当前工作区已修改代码与文档
* `public/mock/raw/hangzhou.raw.json`
* `public/mock/events/hangzhou.events.json`
* `public/mock/files/comments/sheet_hangzhou_*`

**验收标准**
* 当前分支存在一个可回滚 checkpoint commit。
* checkpoint 不包含可丢弃历史地图与 run 产物。

**风险提示**
* 若 checkpoint 混入可丢弃历史产物，会污染后续清理边界与 commit 历史。

### Phase 1：建立 Canonical Contract，并重命名 `part1.ts`

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 建立 `Canonical Raw v2 / Canonical Events v2` 合同。
* 将 `src/engine/preprocess/part1.ts` 重命名为 `src/engine/preprocess/raw_to_events.ts`。
* 删除 `sourceDay/sourceTime`。
* 强制 `createdAt` 成为唯一时间真源。
* 将 `datasetKey` 从迁移期可缺省提升为正式必填。

**建议改动面**
* `src/contracts/domain.ts`
* `src/engine/preprocess/part1.ts` -> `src/engine/preprocess/raw_to_events.ts`
* `tests/unit/preprocess.test.ts`
* `src/features/workspace/workspace-page.tsx`

**验收标准**
* `raw_to_events.ts` 成为唯一 `raw -> events` 实现文件。
* `domain.ts` 中不再出现 `sourceDay/sourceTime`。
* `createdAt` 在 canonical raw 中有明确、统一、可解析的格式规范。

**风险提示**
* 文件重命名与合同重写会波及 imports、测试和下游时间展示逻辑。

### Phase 2：建立统一 BAM 读取器与 Raw Builder

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`
* `TRAE-debugger`

**范围**
* 建立统一 BAM 数据转换层。
* Reader 只按表头读取数据，不再让 orchestrator 直接知道列字母。
* Adapter 只负责把 BAM 行映射为 `CanonicalRawReviewV2`。
* 附件本地化统一收口到一个模块。
* 脚本层退化为薄封装，不再承载核心转换逻辑。

**建议改动面**
* `src/server/datasets/registry.ts`（新增）
* `src/server/datasets/bam-reader.ts`（新增）
* `src/server/datasets/bam-to-raw.ts`（新增）
* `src/server/datasets/localize-attachments.ts`（新增）
* `src/server/datasets/sync-dataset.ts`（新增）
* `scripts/sync-dataset.mjs`
* `scripts/dataset-registry.mjs`

**验收标准**
* 不再存在 `syncFromBase / syncFromSheet` 双轨主逻辑。
* BAM 读取逻辑不再硬编码 `A1:X200`、`P:X` 这类城市级实现细节到 orchestrator。
* 新增城市接入只需要在 registry 登记 BAM 元信息，不需要再写城市专属同步脚本。

**风险提示**
* BAM 表头如出现轻微变体，需要通过 header alias 或 anchor 规则吸收，而不是重新写城市专属逻辑。

### Phase 3：使用同一 BAM 机制重生广州与杭州

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 使用 Phase 2 的统一 BAM 链路重新生成杭州 `raw/events`。
* 使用广州对应 BAM 规范分表重新生成广州 `raw/events`。
* 让广州与杭州同时回到同一套 canonical 合同。

**建议改动面**
* `public/mock/raw/guangzhou.raw.json`
* `public/mock/events/guangzhou.events.json`
* `public/mock/raw/hangzhou.raw.json`
* `public/mock/events/hangzhou.events.json`
* `public/mock/files/comments/**`

**验收标准**
* 广州与杭州的 `raw` 结构完全同构、同语义。
* 广州与杭州的 `events` 结构完全同构、同语义。
* 所有城市的评论图本地化产物路径规则一致。

**风险提示**
* 若广州 BAM 分表质量与杭州不一致，必须在 adapter 或 header alias 层吸收，不得重新引入城市专属脚本。

### Phase 4：收口下游 AI / 页面 / run trace 消费边界

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`
* `TRAE-debugger`

**范围**
* repository 只按 `datasetKey` 读写 canonical 文件。
* AI 主链路只消费 canonical `raw/events`。
* 工作台 raw 卡片改为从 `createdAt` 派生展示时间。
* 将 `fallbackKnowledge(city)` 等城市特判从 AI pipeline 主体中移出。

**建议改动面**
* `src/server/repositories/demo-repository.ts`
* `src/engine/pipelines/generate-map.ts`
* `app/api/preprocess/route.ts`
* `app/api/maps/generate/route.ts`
* `app/api/maps/[mapId]/regenerate/route.ts`
* `app/api/maps/[mapId]/confirm/route.ts`
* `src/features/workspace/workspace-page.tsx`
* `src/features/profile/profile-home.tsx`
* `src/features/generating/generating-page.tsx`
* `src/features/confirm/confirm-page.tsx`
* `src/features/dynamic-map/dynamic-map-page.tsx`

**验收标准**
* 下游不再知道 Sheet 列号、Sheet 表头、Base token 或 `source.type`。
* AI 主链路中不再出现以城市名为分支条件的核心消费逻辑。
* 工作台 raw 卡片时间展示仅来自 `createdAt` 派生。

**风险提示**
* 若消费者层仍残留上游细节，后续接入眉山仍会再次发生“机制假统一、消费真耦合”。

### Phase 5：删除旧代码与可丢弃历史产物

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 删除旧广州专用脚本与旧广州专用预处理接口。
* 删除所有 Base 输入主链路。
* 删除可丢弃的历史 `maps/posters/routes/runs` 产物。

**建议改动面**
* `scripts/sync-guangzhou-dataset.mjs`（删除）
* `scripts/preprocess-guangzhou.mjs`（删除）
* `app/api/preprocess/guangzhou/route.ts`（删除）
* `scripts/dataset-registry.mjs` 中 Base 专用配置与逻辑（删除/替换）
* `public/mock/maps/**`（删除）
* `public/mock/posters/**`（删除）
* `public/mock/routes/**`（删除）
* `public/mock/runs/**`（删除）

**验收标准**
* `rg` 搜索不到旧广州专用链路、旧 Base 主链路和 `sourceDay/sourceTime`。
* `public/mock/` 下只保留新的 canonical `raw/events/comments` 与新链路生成的必要产物。

**风险提示**
* 必须在 Phase 3 和 Phase 4 完成后再删，否则容易出现“旧链路删掉了，但新链路未完全接好”的中间断层。

### Phase 6：最终验证与文档收口

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`
* `TRAE-debugger`

**范围**
* 从统一 BAM 机制重新生成广州与杭州数据。
* 执行全量 lint/test/build。
* 执行浏览器 smoke test。
* 同步 README 与常用命令说明。

**建议改动面**
* `README.md`
* `package.json`
* `tests/unit/**`
* 必要的验证脚本或验证说明

**验收标准**
* `npm run lint` 通过
* `npm run test` 通过
* `npm run build` 通过
* 广州与杭州均可完成：工作台进入 -> 预处理 -> 生成 -> 确认 -> 动态地图页浏览

**风险提示**
* 如果 README、命令名和真实机制不一致，会再次制造“代码已统一、认知未统一”的可观测性问题。

## 7. 阶段执行门禁

以下流程为硬规则，不允许跳过。

### 7.1 阶段开始前

1. refresh memory
2. 向用户汇报本阶段目标、计划改动文件、验收方式、风险点
3. 明确请求用户批准后再开始编码

### 7.2 阶段完成后

1. 完成本阶段自验证
2. 运行 `git status` 与 `git diff --stat`
3. 给出本阶段 commit 建议
4. 请求用户确认是否执行 commit
5. 未确认前不得进入下一阶段

### 7.3 下一阶段开始前

1. 再次 refresh memory
2. 汇报下一阶段概览
3. 明确请求批准
4. 得到确认后才能继续

### 7.4 分支与 checkpoint 约束

* 本轮不新建分支，继续在 `feat/more-data` 上推进。
* Phase 0 的 checkpoint commit 是强约束，在任何正式删除动作开始前必须完成。
* 旧历史产物不得混入 checkpoint commit。

## 8. 总体验收顺序

建议严格按以下顺序推进：

1. Phase 0：先保存 checkpoint commit
2. Phase 1：先立 canonical 合同，并完成 `part1.ts -> raw_to_events.ts`
3. Phase 2：再建立统一 BAM 转换层
4. Phase 3：然后让广州与杭州都通过同一条链路重生
5. Phase 4：再改下游消费者，切断所有上游细节泄露
6. Phase 5：最后删除旧代码与旧历史产物
7. Phase 6：做最终全量验证与说明文档收口

原因：

* 先立合同，后续实现才不会边写边漂移。
* 先建统一 BAM 机制，广州与杭州才能在同一机制下重生。
* 旧代码删除必须晚于新链路接通，否则会出现断层。

## 9. 方案选型

### 9.1 上游统一方案

候选方案：

1. 保留 `Base + BAM Sheet` 双上游
2. 只保留 `BAM Sheet` 单上游
3. 继续维持“广州旧链路 + 杭州新链路”双轨

结论：选择 `只保留 BAM Sheet`。

### 9.2 统一标准方案

候选方案：

1. 机械复制当前杭州 JSON 结构
2. 杭州基线 + 最小清洗，建立 `canonical v2`
3. 继续容忍“广州旧标准 + 杭州新标准”

结论：选择 `canonical v2`。

### 9.3 历史产物处理方案

候选方案：

1. 全部保留并迁移
2. 保留地图、丢弃 runs
3. 全部视为可丢弃

结论：选择 `全部视为可丢弃`。

## 10. 目标设计

### 10.1 统一数据生命周期

统一后，每个城市数据集的生命周期固定为：

`BAM Sheet -> BAM Reader -> BAM Adapter -> Canonical Raw v2 -> Canonical Events v2 -> App / AI / Run Trace`

新增城市（如眉山）时，只允许执行以下动作：

1. 在 registry 中新增 `datasetKey` 与 BAM Sheet 元信息
2. 运行统一 `sync` 命令，生成 `<datasetKey>.raw.json`
3. 运行统一 `preprocess` 命令，生成 `<datasetKey>.events.json`
4. 下游以 `datasetKey` 切换数据源并直接消费

### 10.2 Canonical Raw v2

`raw.v2` 统一结构：

* snapshot
  * `datasetKey`
  * `datasetId`
  * `authorName`
  * `source`
  * `syncedAt`
  * `reviews`
* source
  * `type: "sheet"`
  * `spreadsheetToken`
  * `sheetId`
  * `sheetName`
  * `url`
  * `adapterVersion`
* review
  * `recordId`
  * `sourceReviewId`
  * `sourceRowNumber`
  * `createdAt`
  * `commentText`
  * `poiName`
  * `poiLocation`
  * `poiProvince`
  * `poiCity`
  * `poiDistrict`
  * `categoryL1`
  * `categoryL2`
  * `categoryL3`
  * `attachments`
* attachment
  * `sourceUrl`
  * `name`
  * `size`
  * `localPath`
  * `publicPath`

时间规范：

* `createdAt` 统一为带时区的 ISO 8601 字符串，例如 `2024-11-25T19:10:00+08:00`
* 这是 raw 层唯一时间真源
* `sourceDay/sourceTime` 永久删除

### 10.3 Canonical Events v2

`raw_to_events.ts` 作为唯一实现，从 `raw.v2` 派生：

* `eventId`
* `commentId`
* `day`
* `time`
* `commentText`
* `commentPictures`
* `poiName`
* `poiLocation`
* `poiProvince`
* `poiCity`
* `poiDistrict`
* `categoryL1`
* `categoryL2`
* `categoryL3`
* `authorName`

约束：

* `day/time` 只由 `createdAt` 派生
* 不再依赖任何源侧残留日期字段
* script 与 app 共享同一份 `raw_to_events.ts`

### 10.4 BAM Reader 与 Adapter 设计

* `bam-reader` 只做“按表头读取 BAM Sheet”
* 它可以包含 header alias、锚点列识别与图片列扫描规则
* 它不能包含城市业务字段拼装逻辑

* `bam-to-raw` 只做“把 BAM 行映射为 canonical raw”
* 新增城市时，如果确有必要做轻微差异吸收，只能改 adapter 配置，不允许再新写一套城市专属同步脚本

### 10.5 下游 AI 链路改造边界

AI / 页面 / run trace 允许依赖：

* `datasetKey`
* canonical `raw/events`
* style preset
* map input / run input

AI / 页面 / run trace 禁止依赖：

* Sheet URL / sheetId / sheetName
* 行号 / 列字母 / 图片列范围
* Base token / tableId / viewId
* `source.type`
* `if city === "广州"` 这种数据来源级特判

具体要求：

* 工作台 raw 卡片展示时间时，从 `createdAt` 现算
* `generate-map.ts` 内的 `fallbackKnowledge(city)` 迁出主 pipeline，可落到 dataset metadata 或单独 fallback provider

### 10.6 代码删除完成后的代码库形态

统一完成后，代码库只应剩下：

* 一套 `BAM Sheet` 上游
* 一套 `Canonical Raw v2`
* 一套 `Canonical Events v2`
* 一套 `raw_to_events.ts`
* 一套下游消费方式

必须消失的内容：

* 广州专用同步脚本
* 广州专用预处理脚本
* 广州专用预处理接口
* Base 主链路
* `sourceDay/sourceTime`
* 可丢弃历史 `maps/posters/routes/runs`

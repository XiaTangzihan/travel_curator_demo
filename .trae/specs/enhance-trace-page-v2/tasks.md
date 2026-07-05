# Tasks

> Source of truth spec:
> `docs/superpowers/specs/2026-07-04-test-trace-diagnostics-design.md`

- [x] Task 1: 完成 Phase 1 的 trace 聚合读模型 v2
  - [x] SubTask 1.1: 新增 `src/server/trace-diagnostics/types.ts`，定义 `TraceOverviewViewModel / TraceMapDetailViewModel / TraceMapListItem / TraceAssetState` 等只读模型
  - [x] SubTask 1.2: 在 `src/server/trace-diagnostics/queries.ts` 中聚合 `MapRecord / MapViewModel / RunTrace`，显式派生 `currentRunIdRaw / selectedPosterVersion / selectedPosterSourceRun / latestLifecycleRun`
  - [x] SubTask 1.3: 在聚合层实现全局统计与 `datasetKey` 统计，确保广州、杭州 `map` 数、`run` 数与终态摘要可直接输出
  - [x] SubTask 1.4: 在聚合层补齐当前作品数据入口；当 `selectedPosterSourceRun` 不带 `rawPath / eventsPath` 时，按 `datasetKey` 回推当前 `raw/events` 文件入口
  - [x] SubTask 1.5: 在服务端复用 `parseRouteMarkdown()`，输出结构化 `AI Contract` 视图，包括 `Important Rules`、event 级 `subject / avoid` 与 `knowledge` 摘要
  - [x] SubTask 1.6: 为历史 image-producing run 计算 `present / pruned / unknown` 产物状态，避免把确认流程裁剪的旧候选版本误报为异常
  - [x] SubTask 1.7: 为 Phase 1 增加聚合层单测，覆盖当前态语义拆分、dataset 统计、`AI Contract` 解析与历史产物状态分类

- [x] Task 2: 完成 Phase 2 的 `/runs` 作品视角页面
  - [x] SubTask 2.1: 重写 `app/runs/page.tsx` 的数据入口，改为读取 `TraceOverviewViewModel`，默认选中最新更新的作品
  - [x] SubTask 2.2: 重构 `src/features/runs/runs-page.tsx`，将页面从 run 列表壳层改为“顶栏统计 + 左侧作品索引 + 右侧诊断详情”
  - [x] SubTask 2.3: 为左侧作品索引加入 `mapName / mapId / runId / commentId / versionId` 搜索与 `dataset / city / mapStatus / selectedPosterSourceRunStatus / latestLifecycleRunStatus / providerMode` 筛选
  - [x] SubTask 2.4: 在详情区实现“当前态身份卡 + 版本与来源卡”，明确展示 `selectedPosterVersion / selectedPosterSourceRun / latestLifecycleRun`
  - [x] SubTask 2.5: 在详情区实现“当前主图 + 当前产物摘要 + 评论卡带”，并允许复制 `mapId / runId / commentId / eventId`
  - [x] SubTask 2.6: 在详情区实现结构化 `AI Contract` 面板，展示 front matter 摘要、`Important Rules`、event 合同表与 `knowledge` 摘要
  - [x] SubTask 2.7: 在详情区实现 run 时间线，明确区分 `selected source / latest lifecycle / history` 三类角色，并展示历史图片产物状态
  - [x] SubTask 2.8: 若客户端切换 detail 需要避免整页刷新，则新增 `GET /api/runs/maps/[mapId]` 只读接口

- [x] Task 3: 完成 Phase 3 的完整性提示、异常降级与测试收口
  - [x] SubTask 3.1: 为当前选中态建立硬完整性检查，覆盖 `selectedPosterVersion` 缺失、`selectedPosterSourceRun` 缺失、route 解析失败、当前海报缺失、`map.view` 缺失等问题
  - [x] SubTask 3.2: 为 `AI Contract`、`knowledge`、`map.view`、历史 run 时间线等区域补齐 section-level 错误态，保证单卡失败不拖垮整页
  - [x] SubTask 3.3: 为历史 `generate / regenerate` run 的 `posterPath` 缺失场景实现 `pruned` 语义展示，而不是统一按 missing artifact 报错
  - [x] SubTask 3.4: 增加页面与聚合测试，覆盖当前态语义、搜索筛选、`AI Contract` 面板、`present / pruned / unknown` 状态与错误降级
  - [x] SubTask 3.5: 运行与本页改造相关的最小必要验证，确认首页、工作台、确认页、地图页主链路未被破坏
  - [x] SubTask 3.6: 对照 v2 spec 与 checklist 逐项核验，避免实现与文档口径漂移

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2

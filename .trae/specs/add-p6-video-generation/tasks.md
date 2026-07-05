# Tasks
- [ ] Task 1: 完成 Phase 1 的数据契约与本地视频存储基础
  - [ ] SubTask 1.1: 在 `src/contracts/domain.ts` 中为 `MapRecord / MapViewModel / RunTrace` 增加 `currentVideoRunId`、`videoPath`、`videoDurationSeconds`、`providerTaskId` 等 P6 最小字段
  - [ ] SubTask 1.2: 为 `RunTrace.stage` 与 `artifacts` 扩展 `video_generate` 和 `videoPath`
  - [ ] SubTask 1.3: 在 `src/server/repositories/demo-repository.ts` 与 `storage` 相关工具中加入 `public/mock/videos/{mapId}.mp4` 的路径助手、读取、写入与删除聚合

- [ ] Task 2: 完成 Phase 2 的 Seedance Provider 与异步 run 编排
  - [ ] SubTask 2.1: 在 `src/engine/providers/ark-provider.ts` 中新增创建 Seedance 视频任务、查询任务状态与下载 MP4 的能力
  - [ ] SubTask 2.2: 建立服务端视频模型 registry，至少支持 `seedance-1-5-pro` 与 `seedance-1-0-pro-fast` 两个选择位
  - [ ] SubTask 2.3: 在 P6 pipeline 中固定 `generate_audio = true`，并只允许 `5 / 7 / 9` 三档时长
  - [ ] SubTask 2.4: 将默认验证模型落为 `doubao-seedance-1-5-pro-251215`，并为 `1.0-pro-fast` 预留官方 model id 配置位
  - [ ] SubTask 2.5: 在 `src/engine/prompts/` 下按与图片 prompt 同构的“通用 + 风格 + 统一导出入口”方式组织视频提示词
  - [ ] SubTask 2.6: 明确视频 Prompt 继承当前地图 `style`
  - [ ] SubTask 2.7: 在服务端为 `svg` 底片增加硬门禁与可读错误

- [ ] Task 3: 完成 Phase 3 的 P6 API 与等待页链路
  - [ ] SubTask 3.1: 新增 `POST /api/maps/[mapId]/video/generate`，返回 `runId` 与 `waitPath`
  - [ ] SubTask 3.2: 新增 `/maps/[mapId]/video/generating/[runId]` 等待页，并复用 `GET /api/runs/[runId]` 轮询状态
  - [ ] SubTask 3.3: 成功后自动回到 `/maps/[mapId]?tab=video`，失败后允许返回地图页继续重试

- [ ] Task 4: 完成 Phase 4 的动态地图页双 tab 体验
  - [ ] SubTask 4.1: 将动态地图页改为 `地图 / 视频 / 图文` 三 detab，保持 `地图` detab 原有浏览体验不变
  - [ ] SubTask 4.2: 在 `视频` detab 中实现空态、时长选择器、视频模型选择器、生成按钮和说明文案
  - [ ] SubTask 4.3: 在 `视频` detab 中实现本地 MP4 播放器与下载按钮
  - [ ] SubTask 4.4: 维持 `图文` detab 灰态占位，不提前实现
  - [ ] SubTask 4.5: 在 `svg` 底片场景中展示禁用态说明，而不是允许点击生成

- [ ] Task 5: 完成 Phase 5 的追踪、测试与文档收口
  - [ ] SubTask 5.1: 在 `src/features/runs/runs-page.tsx` 中展示 `video_generate`、`videoDurationSeconds` 与 `artifacts.videoPath`
  - [ ] SubTask 5.2: 增加测试覆盖 `5 / 7 / 9` 时长约束、`generate_audio = true`、`svg` 门禁、等待页回跳和视频成功态
  - [ ] SubTask 5.3: 对照当前 spec 与 checklist 逐项核验，避免实现与文档口径漂移

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1 and Task 3
- Task 5 depends on Task 2, Task 3, and Task 4

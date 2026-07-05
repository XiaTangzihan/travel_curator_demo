# P6 视频增强 Refactor Spec

## 目标

- 将 `P6` 固化为“确认后的可选增强能力”，并且只挂载在动态地图页，不反向扰动现有 `P1-P5` 主链路。
- 在现有 demo 的本地 mock 架构、异步 run 留痕和等待页交互基础上，收敛出一套可实现、可验收、可分阶段推进的视频能力方案，避免把需求继续扩散成愿望清单。

## 非目标

- 本轮不改造工作台、二次确认页和 `P1-P5` 的产品目标，只在它们已有结果上追加 `P6`。
- 本轮不新增独立“视频风格选择器”；视频风格默认继承当前地图 `style`。
- 本轮不做视频历史版本、视频列表页、视频删除回收站或视频与海报的自动过期联动。
- 本轮不制定成本、额度、限流和超时策略；仅保留必要的错误恢复和等待态。
- 本轮不在 spec 中展开 Seedance 开通流程本身；实现与结构设计按 `model access given` 假设推进，真实联调待用户后续通知模型已开通。

## 已确认决策

- `P6` 作为“确认后的可选增强能力”，主入口只放在动态地图页，并建立在既有 IA 前提之上：动态地图页最终采用 `地图 / 视频 / 图文` 三个 detab。
- 视频存储采用方案 `A`：最终 MP4 下载到本地并落盘到 `public/mock/videos/{mapId}.mp4`。
- 请求默认 `generate_audio = true`，当前版本不向用户暴露音频开关。
- 视频时长档位固定为 `5s / 7s / 9s`，默认选中 `5s`。
- `P6` 对现有三种地图风格全部开放；用户不单独选择视频风格，视频默认继承当前地图 `style`。
- 发起视频生成后，用户应跳转到独立等待页；等待页设计和交互逻辑参考当前图片生成等待页。
- 动态地图页遵循上游 spec 已确定的 detab IA：`地图 / 视频 / 图文`。其中 `视频` detab 由本 spec 激活，`图文` 继续保持灰态占位。
- 海报后续变化不会自动使已生成视频失效；旧视频保留，直到用户再次生成并覆盖。
- Seedance 输入规格按当前共识处理：支持 `png/jpg/webp`，不支持 `svg`，视频任务为异步。
- 视频模型选择采用服务端 registry，不在前端硬编码模型 ID。
- 当前已验证可用的默认视频模型是 `doubao-seedance-1-5-pro-251215`。
- `.env.local` 当前已预留两组视频模型配置位：
  - `SEEDANCE_1_5_MODEL_ID / SEEDANCE_1_5_API_KEY`
  - `SEEDANCE_1_0_PRO_FAST_MODEL_ID / SEEDANCE_1_0_PRO_FAST_API_KEY`
- 根据当前公开资料，`1.0-pro-fast` 的默认候选 model id 采用 `doubao-seedance-1-0-pro-fast-251015`，最终以本地环境配置为准。
- 视频提示词在架构上采用与图片提示词相同的“通用提示词 + 风格提示词”双层结构，位置、命名和导出方式应模仿现有图片 prompt 体系，便于后续开发者查看、调试和追溯。
- Seedance 环境约定为独立的 `SEEDANCE_BASE_URL / SEEDANCE_MODEL_ID / SEEDANCE_API_KEY`，真实密钥不进仓库。

## 当前代码现状

- `src/features/dynamic-map/dynamic-map-page.tsx`
  - 当前是单页式动态地图浏览器：左侧展示海报和路线轴，右侧展示当前地点图文。
  - 页面没有 tab 结构，也没有任何视频入口、视频状态或下载能力。

- `docs/superpowers/specs/2026-07-05-profile-workspace-regenerate-model-alignment-design.md`
  - 已明确把动态地图页 IA 收敛为 `地图 / 视频 / 图文` detab，其中 `视频 / 图文` 原本为灰态占位。
  - 本 spec 需要在不打破该 IA 前提的情况下，激活 `视频` detab，而不是另起一套双 tab 结构。

- `app/api/maps/generate/route.ts`、`app/workspace/generating/[runId]/page.tsx`、`src/features/generating/generating-page.tsx`
  - 图片主链路已经改为异步 run + 独立等待页。
  - 等待页会轮询 `/api/runs/[runId]`，完成后自动跳转到二次确认页。
  - 这套交互和轮询结构可以复用于 `P6`，避免再发明第二套等待机制。

- `src/contracts/domain.ts`
  - 当前 `RunTrace` 已支持 `progressStep`、`generateInput`、`previewImagePaths` 等图片等待页字段。
  - 但 `stage` 仍只有 `preprocess / generate / regenerate / confirm`，`artifacts` 也没有 `videoPath`。
  - `MapRecord` 只有 `currentRunId`，没有与 `P6` 独立的 `currentVideoRunId`、`videoPath` 或视频元数据字段。
  - `MapViewModel` 也没有视频播放所需字段。

- `src/engine/providers/ark-provider.ts`
  - 当前只有 `runDoubaoChat` 和 `runSeedreamImage` 两类能力。
  - 尚未接入 Seedance 的“创建任务 / 查询任务 / 下载最终 MP4”契约。

- `src/engine/prompts/shared.ts`、`src/engine/prompts/styles/*.ts`、`src/engine/prompts/index.ts`
  - 当前图片提示词已经采用“通用 prompt + 风格 preset + 统一导出入口”的组织方式。
  - `P6` 当前 spec 还没有把视频提示词的目录和配置方式硬性对齐到这套结构，这会影响后续查看、调试和追溯效率。

- `src/server/repositories/demo-repository.ts`
  - 当前管理 `raw / events / routes / posters / maps / runs` 本地 mock 产物。
  - 尚未提供 `videos` 目录的路径助手、视频读写与删除聚合。
  - 当前删除地图时也不会处理视频产物。

- `src/features/runs/runs-page.tsx`
  - 当前追踪页能展示已有 run 的阶段、warnings 与 artifact 路径。
  - 但 artifact 面板未纳入视频文件路径，也没有视频 stage 文案。

## 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| P6-1 | 数据契约与本地存储 | `MapRecord / MapViewModel / RunTrace / repository` 能表达视频状态与视频产物 | 增加 `currentVideoRunId`、`videoPath`、`videoDurationSeconds`、`providerTaskId` 等最小字段，并引入 `public/mock/videos` |
| P6-2 | Seedance 接入与视频模型选择 | 代码可创建 Seedance 异步任务、查询状态并下载 MP4，且用户可选择视频模型 | 在 provider 层新增视频模型 registry 与视频任务 API 封装，显式处理异步与远端临时 URL |
| P6-3 | P6 API 与等待页 | 动态地图页发起视频生成后跳转等待页，完成后回到 `?tab=video` | 新增 `POST /api/maps/[mapId]/video/generate` 与 `/maps/[mapId]/video/generating/[runId]` |
| P6-4 | 动态地图页视频体验 | 页面采用 `地图 / 视频 / 图文` 三 detab，激活 `视频`，保留 `图文` 灰态 | 在现有动态地图页内局部改造，不拆新的作品详情页 |
| P6-5 | 追踪与验证 | P6 可被测试追踪页看到，并有稳定的验收清单 | 扩展 run 展示、补单测和关键 smoke test |

## 分阶段计划

### Phase 1：P6 数据契约与本地视频存储基础

**执行 Agent 可用 Skills**
* `无强制 Skill`

**范围**
* 为 `MapRecord / MapViewModel / RunTrace` 引入 `P6` 所需最小字段
* 建立本地视频路径规范与删除聚合规则
* 明确 `P6` 不得复用 `currentRunId` 覆盖原有图片主链路

**建议改动面**
* `src/contracts/domain.ts`
* `src/server/repositories/demo-repository.ts`
* `src/server/utils/storage.ts`

**验收标准**
* `MapRecord` 可独立表达 `currentVideoRunId`
* `MapRecord / MapViewModel / RunTrace` 可表达 `videoPath`
* 仓储层可生成和读取 `public/mock/videos/{mapId}.mp4`
* 删除地图时会一并纳入本地视频文件

**风险提示**
* 若继续让 `P6` 复用 `currentRunId`，会污染现有图片生成与确认链路语义，后续页面读取会变得混乱。

### Phase 2：Seedance Provider 与异步 run 编排

**执行 Agent 可用 Skills**
* `TRAE-debugger`

**范围**
* 接入 Seedance 创建任务、查询任务和下载 MP4 的能力
* 明确 `generate_audio = true`、`5s / 7s / 9s` 和当前地图风格继承
* 对 `svg` 底片做硬门禁
* 将视频 prompt 架构对齐到现有图片 prompt 的“通用 + 风格”组织方式
* 建立视频模型 registry，支持用户在生成视频时选择模型

**建议改动面**
* `src/engine/providers/ark-provider.ts`
* `src/engine/pipelines/`（新增或扩展 P6 pipeline）
* `src/engine/prompts/video/**` 或与现有图片 prompt 同构的目录
* `.env.local.example`

**验收标准**
* provider 可表达“创建任务 -> 查询任务 -> 下载视频”三段式调用
* 请求体默认带 `generate_audio = true`
* 输入时长仅允许 `5 / 7 / 9`
* 当底片为 `svg` 时，后端直接拒绝 P6 请求并返回可读错误
* 服务端 registry 至少支持 `1.5-pro` 和 `1.0-pro-fast` 两个视频模型槽位
* 用户可在生成视频时选择模型；当某模型环境配置不完整时，不展示为可选项
* 视频 prompt 采用“通用提示词 + 风格提示词”双层组装，且目录、命名、导出方式与图片 prompt 体系同构

**风险提示**
* 这是本轮最高风险阶段，外部模型契约、异步轮询、远端临时 `video_url` 下载都集中在这里，必须独立隔离。

### Phase 3：P6 API 与等待页链路

**执行 Agent 可用 Skills**
* `无强制 Skill`

**范围**
* 增加地图页触发视频生成的接口
* 新增视频等待页，并复用现有 run 查询接口
* 统一等待态成功回跳规则

**建议改动面**
* `app/api/maps/[mapId]/video/generate/route.ts`
* `app/maps/[mapId]/video/generating/[runId]/page.tsx`
* `src/features/generating/` 或新的 `src/features/video-generating/`
* `app/api/runs/[runId]/route.ts`

**验收标准**
* 发起视频生成后立即返回 `runId` 和等待页路径
* 等待页可轮询 `run`
* 成功后自动跳转到 `/maps/[mapId]?tab=video`
* 失败态可回到地图页继续发起下一次生成

**风险提示**
* 若直接在动态地图页内轮询和卡住用户，会与现有“独立等待页”体验割裂，也会让状态恢复路径变复杂。

### Phase 4：动态地图页双 tab 与视频成功态

**执行 Agent 可用 Skills**
* `frontend-design`

**范围**
* 在动态地图页引入 `地图 / 视频 / 图文` 三个 detab
* 实现视频空态、禁用态、成功态与失败后的回到视频 tab 行为
* 提供本地 MP4 播放与下载

**建议改动面**
* `src/features/dynamic-map/dynamic-map-page.tsx`
* `app/maps/[mapId]/page.tsx`
* `src/components/**`（若需要抽小组件）

**验收标准**
* `地图` detab 原有路线浏览体验保持不变
* `视频` detab 空态提供时长选择、模型选择和生成入口
* 成功态可播放本地 MP4 并下载
* `图文` detab 继续保持灰态占位，不提前实现
* `svg` 底片会展示禁用态说明，不允许点击生成

**风险提示**
* 页面是现有作品详情主入口，若忽略上游 spec 已确定的三 detab IA，后续会出现跨 spec 结构冲突。

### Phase 5：追踪页、测试与阶段收口

**执行 Agent 可用 Skills**
* `TRAE-code-review`
* `code-reviewer`

**范围**
* 扩展测试追踪页的 `P6` 文案与 artifact 展示
* 补齐单测和最小 smoke test
* 完成文档、清单和实现的一致性收口

**建议改动面**
* `src/features/runs/runs-page.tsx`
* `tests/unit/**`
* `.trae/specs/add-p6-video-generation/tasks.md`
* `.trae/specs/add-p6-video-generation/checklist.md`

**验收标准**
* 追踪页能看见 `P6` 的 stage、warnings、video artifact
* 关键约束存在测试覆盖：时长选项、音频默认开启、`svg` 门禁、等待页回跳
* 本 spec、tasks、checklist 与最终实现口径一致

**风险提示**
* 若没有在最后一阶段统一做追踪与清单收口，后续极易出现“UI 看似完成，但 run 留痕、删除聚合和异常分支漏掉”的假完成状态。

## 阶段执行门禁

### 1. 阶段开始前

- 必须先 refresh memory，阅读当前项目约束与上阶段确认结论。
- 必须在阶段首部明确标注本阶段实际要用的 Skill。
- 必须向用户汇报：本阶段目标、计划改动文件、验收方式、风险点。
- 未得到用户确认前，不允许开始编码。

### 2. 阶段完成后

- 必须先完成本阶段自测或验证。
- 必须运行 `git status` 与 `git diff --stat` 查看变更概览。
- 必须给出推荐的 commit message，遵守“首部英文 + 主体中文”的格式。
- 必须向用户汇报阶段结果并请求确认。
- 用户未确认、未处理 commit 之前，不得直接进入下一阶段。

### 3. 下一阶段开始前

- 必须再次 refresh memory。
- 必须汇报下一阶段概览和与上一阶段的依赖关系。
- 必须再次请求用户确认是否开始。
- 得到批准后，才允许进入下一阶段实施。

## 总体验收顺序

1. 先验收 `Phase 1` 的数据契约和本地视频路径是否成立，因为后续所有 UI 和 API 都依赖它。
2. 再验收 `Phase 2` 的 Seedance 异步编排，因为它是唯一外部系统风险源。
3. 然后验收 `Phase 3` 的等待页链路，确认用户真正能“发起 -> 等待 -> 回跳”。
4. 再验收 `Phase 4` 的动态地图页双 tab 和播放下载体验，确认用户侧目标达成。
5. 最后验收 `Phase 5` 的 run 追踪与测试，防止只交付表面 UI，遗漏运维与回归能力。

这个顺序服务于风险控制，而不是单纯按页面先后写代码。真正高风险的是外部异步任务和本地文件持久化，不是 tab 本身。

## 方案选型

### 1. 视频存储方案

- 方案 A：把最终 MP4 下载到 `public/mock/videos/{mapId}.mp4`
- 方案 B：把视频放到项目外目录或私有数据目录，再通过 `/api/videos/[id]` 流式输出

**结论：选择 A。**

**原因：**
- 与当前 `public/mock/**` 的 demo 存储方式一致，最少改动。
- 结果文件可直接被页面 `<video>` 消费，也天然支持下载。
- 能直接回应“远端临时 URL 不稳定”的风险：先下载再播放，而不是把临时 URL 暴露给前端。

**不选 B 的原因：**
- 会额外引入流式接口、鉴权边界和路径管理复杂度。
- 对当前本地 demo 阶段是过度设计。

### 2. 视频风格选择方案

- 方案 A：视频风格继承当前地图 `style`
- 方案 B：新增独立视频风格选择器

**结论：选择 A。**

**原因：**
- 用户已明确“未提及点默认按当前 mental model”推进；当前 mental model 是三种现有风格全部开放，但继承当前地图风格，不另开一组视频风格配置。
- 这能保持静态图和视频的一致性，且减少 UI 选择负担。

### 3. 等待态方案

- 方案 A：视频生成跳转独立等待页
- 方案 B：在地图详情页内嵌 loading 区域并原地轮询

**结论：选择 A。**

**原因：**
- 用户已明确要求“视频后台生成时，重定向到等待页”。
- 代码库里已有图片生成等待页骨架，可复用交互与轮询模型。

### 4. 视频结果暴露方式

- 方案 A：任务成功后先下载到本地，再以本地 URL 播放和下载
- 方案 B：前端直接播放 Seedance 返回的临时 `video_url`

**结论：选择 A。**

**原因：**
- 官方 `content.video_url` 是远端结果 URL，稳定性和时效性都不适合直接作为 demo 的长期作品链接。
- A 方案与本地 mock 路线、海报、map、run 的思路一致，语义更完整。

## 目标设计

### 1. 页面行为

#### 1.1 动态地图页

- 动态地图页采用三 detab：
  - `地图`
  - `视频`
  - `图文`
- 默认进入 `地图` detab；当 URL 带 `?tab=video` 时直接打开 `视频` detab。
- `地图` detab 保持现有路线轴、地点卡片和图片预览体验，不因 `P6` 改造而降级。
- `图文` detab 本轮继续灰态不可点。

#### 1.2 视频 tab

- 空态：
  - 展示视频能力说明
  - 展示 `5s / 7s / 9s` 三档时长选择
  - 展示视频模型选择器
  - 展示“生成视频”按钮
- 禁用态：
  - 当 `posterPath` 为 `svg` 时，按钮禁用
  - 展示明确说明：“当前底片不支持视频生成，请先获得 PNG/JPG/WebP 底片”
- 成功态：
  - 播放本地 MP4
  - 展示时长信息
  - 提供下载按钮
- 失败态：
  - 回到 `?tab=video` 后展示失败提示
  - 允许重新发起生成

### 2. 接口语义

#### 2.1 创建视频任务

- 新增接口：`POST /api/maps/[mapId]/video/generate`
- 最小请求体：

```json
{
  "durationSeconds": 5,
  "videoModel": "seedance-1-5-pro"
}
```

- 合法值仅允许：`5 | 7 | 9`
- `videoModel` 至少支持：
  - `seedance-1-5-pro`
  - `seedance-1-0-pro-fast`
- 服务端根据 `mapId` 读取当前地图：
  - 复用当前 `style`
  - 读取当前 `posterPath`
  - 校验 `posterPath` 是否为非 `svg`
- 返回：

```json
{
  "mapId": "map_xxx",
  "runId": "run_xxx",
  "waitPath": "/maps/map_xxx/video/generating/run_xxx"
}
```

#### 2.2 等待页

- 新增路由：`/maps/[mapId]/video/generating/[runId]`
- 页面轮询现有 `GET /api/runs/[runId]`
- 成功后自动跳转：`/maps/[mapId]?tab=video`
- 失败后展示错误说明与返回地图页入口

### 3. 状态字段与数据结构

#### 3.1 MapRecord

- 增加可选字段：
  - `currentVideoRunId`
  - `videoPath`
  - `videoDurationSeconds`
  - `videoUpdatedAt`
- `currentRunId` 继续服务于图片主链路，不允许被 `P6` 覆盖。

#### 3.2 MapViewModel

- 增加可选字段：
  - `videoPath`
  - `videoDurationSeconds`
  - `videoUpdatedAt`

#### 3.3 RunTrace

- `stage` 增加：`video_generate`
- 增加可选字段：
  - `providerTaskId`
  - `videoDurationSeconds`
  - `videoModel`
- `artifacts` 增加：
  - `videoPath`

#### 3.4 覆盖语义

- `P6` 不做视频历史版本管理。
- 同一地图后续再次生成成功时，继续写入同一个本地目标路径 `/mock/videos/{mapId}.mp4`，即覆盖旧视频。
- 这不叫“自动过期”，而是当前 demo 下的“单视频最新成功产物”策略。

### 4. Provider 与任务编排

- 新增 Seedance provider 封装三段能力：
  1. 创建视频任务
  2. 查询任务状态
  3. 下载最终 MP4 到本地
- 视频模型通过服务端 registry 组织，至少包含：
  - `seedance-1-5-pro -> doubao-seedance-1-5-pro-251215`
  - `seedance-1-0-pro-fast -> doubao-seedance-1-0-pro-fast-251015`（默认候选值，最终以本地 env 为准）
- 视频 prompt 采用与图片 prompt 相同的配置方式：
  1. 一份视频通用提示词
  2. 三份视频风格提示词
  3. 一个统一的 prompt 组装入口
- 目录、命名和导出方式应尽量模仿现有图片 prompt 体系，避免把视频 prompt 硬编码在 pipeline 或 provider 中。
- 当前默认验证模型是 `doubao-seedance-1-5-pro-251215`
- 请求默认带：
  - `generate_audio = true`
  - `duration = 5 | 7 | 9`
- 输入源使用当前地图海报：
  - 若为 `png/jpg/webp`，允许发起
  - 若为 `svg`，后端直接拒绝

### 5. 异常分支

- 模型未开通 / 鉴权失败：
  - run 标记为 `failed`
  - 错误信息返回等待页或视频 tab
- 任务长时间未完成：
  - run 标记为 `incomplete`
  - 用户可回到 `视频` tab 重试
- 远端任务成功但本地下载失败：
  - 不视为成功
  - run 标记为 `failed`
  - 页面不得展示远端临时 URL 作为成功态

### 6. 追踪与验收

- 测试追踪页需要看到：
  - `video_generate` stage
  - `videoDurationSeconds`
  - `artifacts.videoPath`
  - `warnings / providerMode / errorMessage`
- 最小回归重点：
  - `5 / 7 / 9` 时长约束
  - 默认 `generate_audio = true`
  - `svg` 门禁
  - 等待页回跳到 `?tab=video`
  - 成功态本地播放与下载

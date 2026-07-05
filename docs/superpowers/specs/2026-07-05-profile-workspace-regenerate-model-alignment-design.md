# 个人主页、工作台与二确重生成链路对齐 Refactor Spec

## 目标

- 将本轮需求收口为一组可分阶段落地的页面与契约调整，覆盖个人主页筛选、工作台选模、等待页信息收口、二确重生成拆分、动态地图页导航与下载。
- 保持现有 `route.md -> posterVersions -> confirm -> dynamic-map` 主链路不被打散，避免把“轻量 UI 调整”和“高风险重生成语义调整”混在同一阶段实施。
- 在当前分支已经引入多数据集与诊断台共享契约的前提下，明确本轮新增字段和页面行为如何兼容现有存量数据，避免后续出现筛选失真或 trace 契约漂移。

## 非目标

- 本轮不实现真实的 `视频` 或 `图文` 内容页，只在动态地图页提供灰态 detab 占位，不接入 P6 播放、生成或图文排版能力。
- 本轮不改造 BAM 数据读取、评论预处理、`route.md` 解析或诊断台页面本身，只做必要的共享契约扩展兼容。
- 本轮不重做个人主页的批量删除交互，不调整全局 `SiteShell` 导航结构，不改已有地图删除语义。
- 本轮不把用户提供的 Seedream API key 明文写入仓库文档或前端代码；只设计服务端 registry 替代原有单一 key 方案。
- 本轮不对历史存量地图做“猜测式模型回填”；无法确认来源模型的旧记录不伪造为 `4.0 / 4.5 / 5.0` 中任一项。

## 已确认决策

- 个人主页中的“目的地”筛选条件只认 `datasetKey`，与地图名称和地图 `city` 文案无关。
- 个人主页的三种筛选入口为同一行的 dropdown：`目的地 / 生图模型 / 地图风格`。
- 个人主页右上统计区删除“旅行足迹”卡片；统计与地图卡片必须共享同一套筛选上下文，不允许顶部统计和下方卡片口径分裂。
- 当前分支已新增 `meishan` 数据集；本轮所有目的地筛选与下拉选项必须动态来自 `supportedDatasetKeys`，不能把广州/杭州写死在页面里。
- 工作台中的“更新素材列表”按钮改为“清空评论选择”，不再承担预处理同步入口语义。
- “选中评价 > 8”的风险提示要移到“一键生成旅行地图”操作区左侧，就近提醒，不再放在评论列表头部。
- 风格参考图预览区改为 `16:9`，并支持单击放大预览。
- 生图模型第一期开放 `SEEDREAM 4.0 / 4.5 / 5.0` 三档；工作台与二确页都要能选择，后端不再依赖单一 Seedream key。
- 生图等待页隐藏 `run_id`，保留对用户有意义的上下文信息即可。
- 二确页不再展示“已选内容：N个足迹”。
- 二确页的“重新生成”拆成两条显式路径：
  - `再来一张`：不参考旧图，不要求输入修改 prompt，生成新的候选版本且不覆盖旧图。
  - `修改原图`：以当前选中版本为参考图，要求用户输入至少 8 个字的修改 prompt，生成新的候选版本且不覆盖旧图。
- 当前已有 `posterVersions + selectedPosterVersionId` 多版本机制；本轮继续沿用 append-only 版本管理，直到确认保存时再做未选版本清理。
- 动态地图页新增“回到主页”按钮，并在右上角增加 `地图 / 视频 / 图文` detab；其中后两者本轮灰化不可打开。
- 仓库中已有 `.trae/specs/add-p6-video-generation/spec.md`；本轮只落地占位 detab，不提前实现其中的视频成功态与下载链路。

## 当前代码现状

- `src/config/demo.ts`
  - 当前 `demoConfig.datasets` 已包含 `guangzhou / hangzhou / meishan` 三个数据集。
  - 这意味着个人主页和工作台中所有“目的地/素材城市”入口都应按配置动态生成，而不是复用之前只面向双城市的假设。

- `app/page.tsx` 与 `src/features/profile/profile-home.tsx`
  - 首页当前只把 `searchParams.dataset` 用于读取当前 raw dataset 的 `rawCount`，但实际传给 `ProfileHome` 的 `maps` 是完整列表，卡片并未按目的地筛选。
  - 个人主页顶部仍使用城市胶囊 Link，不是 dropdown。
  - 顶部统计当前包含 `旅行作品 / 旅程足迹 / 当前素材` 三张卡，其中“旅程足迹”与本轮需求冲突。
  - 页面上下两部分没有 sticky 分离，向下滚动时名片区会一起离开视口。

- `src/contracts/domain.ts`
  - `MapRecord`、`PosterVersion`、`MapViewModel`、`GenerateRunInput`、`RunTrace` 当前都没有 `imageModel` 相关字段。
  - 现有 schema 只能表达 `style`、`styleKey` 和 `basedOnExistingImage`，无法支撑模型切换、模型筛选和版本级模型追踪。
  - 当前分支近期已实现 `src/server/trace-diagnostics/types.ts` 与 `queries.ts` 的聚合读模型，本轮新增共享字段必须保持向后兼容，避免让诊断台读旧 JSON 失败。
  - 当前工作区另有一组未提交中的 `shortName` 收口修改，也落在 `src/contracts/domain.ts` 上；本轮后续实施若进入 Phase 1，必须在同一文件里与该改动并行整合，不能覆盖式回写。

- `src/engine/providers/ark-provider.ts`
  - 当前图片能力只支持单一 `SEEDREAM_BASE_URL / SEEDREAM_API_KEY / SEEDREAM_MODEL_ID` 组合。
  - 生图调用入口 `runSeedreamImage` 还不能根据用户选择切换不同模型和凭证。

- `src/features/workspace/workspace-page.tsx` 与 `src/store/workspace-store.ts`
  - 工作台当前只有“风格”选择，没有“生图模型”选择。
  - 左侧次按钮仍是“更新素材列表”，点击会调用 `/api/preprocess`。
  - 风险提示仍位于评论列表上方，而不是生成区左侧。
  - 风格参考图容器仍是 `aspect-[4/5]`，不符合真实成图比例，也没有放大预览。

- `app/api/maps/generate/route.ts`、`src/engine/pipelines/generate-map.ts`
  - 首次生成请求体当前只接收 `datasetKey / mapName / city / style / selectedCommentIds`。
  - `generateMapDraftCore`、`writePosterFile`、`writeRegeneratedPosterFile` 均未接收用户显式选择的图片模型。
  - 当前工作区还有围绕 `shortName` 生成与 P2 重试的未提交修改，已触及 `src/engine/pipelines/generate-map.ts`；这不会改变本轮 spec 结构，但会提高后续 Phase 1 和 Phase 4 的合并风险。

- `src/features/generating/generating-page.tsx`
  - 等待页顶部仍会展示 `Run {runId}` 标签。
  - 这与本轮“隐藏 run_id”要求冲突。

- `src/features/confirm/confirm-page.tsx`、`app/api/maps/[mapId]/regenerate/route.ts`、`src/engine/pipelines/generate-map.ts`
  - 当前二确页只有一个“生成新版本”按钮和一个 `basedOnExistingImage` 复选框。
  - 当前后端重生成契约仍是 `{ instruction, basedOnExistingImage }`，语义是“有 prompt 时再决定是否参考旧图”。
  - 当 `instruction` 为空时，pipeline 会强制把 `basedOnExistingImage` 置为 `false`；这虽然接近“再来一张”，但没有把两种行为拆成可验收的显式产品路径。
  - 当前二确页仍展示“已选内容：N个足迹”，与本轮需求冲突。

- `src/features/dynamic-map/dynamic-map-page.tsx`
  - 当前作品详情页只有“动态地图”单视图，没有 detab、没有回到主页按钮、没有海报下载入口。
  - 页面右上 actions 当前只有城市、站点数和删除路线按钮。

- `public/mock/maps/**` 与 `public/mock/runs/**`
  - 仓库里已有大量历史地图与 run 样本，但它们没有 `imageModel` 元数据。
  - 这对首页“按生图模型筛选”形成真实兼容问题：旧图若不做兼容策略，筛选结果会失真或直接报错。

## 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| R1 | 生图模型契约与 registry | 生成、重生成、版本记录、Run 留痕都能表达 `imageModel` | 在共享 schema 中新增模型枚举和最小字段，图片 provider 改为服务端 registry 驱动 |
| R2 | 个人主页三维筛选 | 目的地、模型、风格三种筛选统一由 dropdown 驱动，顶部统计与卡片口径一致 | 用统一 filter state 驱动首页卡片与统计；目的地选项动态来自 `supportedDatasetKeys` |
| R3 | 个人主页 sticky 信息架构 | 名片区与地图区物理分离，地图区滚动时上半部分位置不动 | 页面改为上半区 sticky + 下半区内容区结构 |
| R4 | 工作台交互对齐 | 支持模型选择、清空评论选择、风险提示位移、16:9 预览与放大 | 保持现有布局骨架，只在左侧配置区和生成区局部重排 |
| R5 | 等待页信息收口 | 对用户隐藏 `run_id`，保留地图名、目的地、状态与评论上下文 | 调整等待页头部信息展示，不改异步轮询机制 |
| R6 | 二确双路径重生成 | “再来一张”和“修改原图”成为显式动作，且都追加新版本不覆盖旧图 | 后端契约改为显式 mode，而非复选框布尔语义 |
| R7 | 动态地图页 IA 对齐 | 提供海报下载、回主页入口和 `地图 / 视频 / 图文` 灰态 detab | 先落地占位 IA，不接入 P6 视频生成或图文页 |
| R8 | 共享契约兼容与回归 | 新字段不破坏 trace 读模型和历史 mock 数据 | 新增字段默认可缺省，旧记录按 `unknown` 兼容读取 |

## 分阶段计划

### Phase 1：图片模型契约与服务端 registry

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 为 `GenerateRunInput / RunTrace / MapRecord / PosterVersion / MapViewModel` 增加 `imageModel` 最小字段
* 将图片 provider 从单一 Seedream key 改为服务端 registry 选择
* 明确旧记录缺失模型时的兼容策略

**建议改动面**
* `src/contracts/domain.ts`
* `src/engine/providers/ark-provider.ts`
* `src/engine/pipelines/generate-map.ts`
* `app/api/maps/generate/route.ts`
* `app/api/maps/[mapId]/regenerate/route.ts`
* 新增 `src/engine/providers/seedream-model-registry.ts` 或同类服务端专用模块

**验收标准**
* 首次生成与重生成接口都能接收显式 `imageModel`
* `MapRecord` 与 `PosterVersion` 都能记录当前图像版本使用的模型
* `RunTrace` 能留痕 `imageModel`
* 缺失 `imageModel` 的旧 JSON 仍能被 schema 解析，并以内置 `unknown` 兼容值或等效缺省语义读取

**风险提示**
* 这是共享契约阶段，当前分支的诊断台与历史 mock 数据都依赖这些 schema；若把新字段做成必填硬迁移，会直接破坏旧数据可读性。
* 同时 `src/contracts/domain.ts` 目前已有未提交中的 `shortName` 改动，实施时必须按“同文件并行整合”处理，而不是基于旧版本直接重写。

### Phase 2：首页筛选与 sticky 信息架构

**执行 Agent 可用 Skills**
* `frontend-design`
* `executing-plans`

**范围**
* 将首页目的地入口从胶囊 Link 改为 dropdown，并新增模型、风格 dropdown
* 统一顶部统计和卡片列表的筛选口径
* 删除“旅行足迹”统计卡片
* 重构首页布局为上半区 sticky、下半区独立滚动

**建议改动面**
* `app/page.tsx`
* `src/features/profile/profile-home.tsx`
* 如需要，新增首页筛选参数解析或选项构建助手模块

**验收标准**
* 首页顶部存在同一行的三个 dropdown：`目的地 / 生图模型 / 地图风格`
* 切换“目的地”时，地图卡片与顶部统计同步变化，筛选依据只看 `datasetKey`
* “旅行足迹”卡片已删除
* 页面滚动卡片区时，上半部分个人名片保持固定
* 目的地下拉项随 `supportedDatasetKeys` 自动变化，新增数据集不需要改 UI 字面量

**风险提示**
* 这是与近期 `meishan` 数据集接入直接耦合的阶段；若继续把城市选项硬编码在页面里，后续每加一个数据集都要重新改首页结构。

### Phase 3：工作台与等待页轻量对齐

**执行 Agent 可用 Skills**
* `frontend-design`
* `executing-plans`

**范围**
* 工作台新增模型选择
* “更新素材列表”改为“清空评论选择”
* 风险提示移到生成区左侧
* 风格参考图改为 `16:9` 并支持单击放大
* 等待页隐藏 `run_id`

**建议改动面**
* `src/features/workspace/workspace-page.tsx`
* `src/store/workspace-store.ts`
* `src/features/generating/generating-page.tsx`
* 如需要，抽出工作台图片预览弹层小组件

**验收标准**
* 工作台左侧可选择 `SEEDREAM 4.0 / 4.5 / 5.0`
* “清空评论选择”按钮执行的是清空当前已选评论，不再触发 `/api/preprocess`
* 当选中评论数大于 8 时，风险提示出现在生成主按钮左侧附近
* 风格参考图区呈现 `16:9` 比例，并可单击进入大图观察
* 等待页不再展示 `Run {runId}`

**风险提示**
* 该阶段虽然以 UI 为主，但会改变工作台生成请求载荷；若未与 Phase 1 的 `imageModel` 契约一并对齐，前后端会出现请求字段脱节。

### Phase 4：二确页双路径重生成

**执行 Agent 可用 Skills**
* `TRAE-debugger`
* `code-reviewer`

**范围**
* 将二确页重生成拆成 `再来一张` 与 `修改原图`
* 新增二确页模型选择，并与工作台可选模型保持一致
* 删除“已选内容：N个足迹”
* 重构重生成 API 契约为显式 `mode`

**建议改动面**
* `src/features/confirm/confirm-page.tsx`
* `app/api/maps/[mapId]/regenerate/route.ts`
* `src/engine/pipelines/generate-map.ts`
* 如需要，新增二确页重生成参数校验助手

**验收标准**
* 二确页存在两个独立按钮：`再来一张`、`修改原图`
* `再来一张` 不依赖修改 prompt，不参考当前旧图，生成后新增一个候选版本并自动选中
* `修改原图` 要求 prompt 至少 8 个字，参考当前 `selectedPosterVersion` 对应图片，生成后新增一个候选版本并自动选中
* 任一重生成都不会覆盖旧版本，直到确认保存时才清理未选版本
* 二确页已移除“已选内容：N个足迹”

**风险提示**
* 这是本轮最高风险阶段。当前系统的重生成语义还停留在布尔开关层，如果不改成显式 mode，就很难保证“再来一张”和“修改原图”在行为、校验和版本留存上稳定分离。
* `src/engine/pipelines/generate-map.ts` 当前也是未提交 `shortName/P2` 改动的共享热点文件；实施时需要先读懂现状再叠加，不允许回滚用户正在进行的改动。

### Phase 5：动态地图页下载、占位 detab 与导航收口

**执行 Agent 可用 Skills**
* `frontend-design`
* `executing-plans`

**范围**
* 提供海报下载能力
* 在右上角增加 `地图 / 视频 / 图文` detab
* 新增“回到主页”按钮
* 明确本轮 `视频 / 图文` 为灰态占位，不接真实内容

**建议改动面**
* `src/features/dynamic-map/dynamic-map-page.tsx`
* `app/maps/[mapId]/page.tsx`
* 如需要，新增下载按钮或灰态 detab 小组件

**验收标准**
* 动态地图页右上角有“回到主页”按钮，跳转 `/`
* 当前页存在 `地图 / 视频 / 图文` 三个 detab，只有 `地图` 可用
* `视频 / 图文` 为明显灰态且不可点击
* 用户可下载当前海报图片

**风险提示**
* 仓库里已经存在 P6 视频增强 spec；若本轮把视频 tab 做成半激活状态或塞入临时内容，会与既有 spec 的后续实现边界冲突。

### Phase 6：测试、诊断兼容与阶段收口

**执行 Agent 可用 Skills**
* `code-reviewer`
* `TRAE-code-review`

**范围**
* 补齐模型契约、首页筛选、二确重生成 mode 的测试
* 验证 trace 相关共享 schema 对旧数据仍兼容
* 收口实现、spec 与现有 P6 占位边界

**建议改动面**
* `tests/unit/**`
* `src/server/trace-diagnostics/types.ts`
* `src/server/trace-diagnostics/queries.ts`
* 如需要，补充针对首页筛选与重生成模式的新增单测

**验收标准**
* 至少有测试覆盖：旧记录缺失 `imageModel` 的解析、首页三维筛选结果、`修改原图` 的最小字数校验、`再来一张` 不参考旧图
* 诊断台相关聚合读取不会因为新字段缺失而报错
* 本 spec 中的占位 detab 与后续 P6 spec 边界已在文档和代码中保持一致

**风险提示**
* 若不在最后阶段统一做共享契约兼容验证，这轮最容易出现“UI 看起来完成了，但诊断台或历史 mock 读取悄悄损坏”的假完成状态。

## 阶段执行门禁

### 1. 阶段开始前

- 必须先 refresh memory，并阅读当前项目约束、最新 topic 和记忆中的共享契约规则。
- 必须向用户汇报：本阶段目标、计划改动文件、验收方式、风险点。
- 必须请求用户确认是否开始当前阶段。
- 未得到用户批准前，不允许开始编码。

### 2. 阶段完成后

- 必须完成本阶段自测或验证。
- 必须运行 `git status` 与 `git diff --stat` 查看变更概览。
- 必须给出推荐 commit message，遵守“首部英文 + 主体中文”的格式。
- 必须向用户汇报阶段结果并请求确认。
- 未确认前不得直接进入下一阶段。

### 3. 下一阶段开始前

- 必须再次 refresh memory。
- 必须汇报下一阶段概览和与上一阶段的依赖关系。
- 必须再次请求用户确认。
- 得到批准后才能进入下一阶段实施。

## 总体验收顺序

1. 先验收 Phase 1 的模型契约与 registry，因为后续首页筛选、工作台选模、二确重生成都依赖它。
2. 再验收 Phase 2 的首页筛选与 sticky 结构，确认多数据集接入后的首页语义已经正确。
3. 然后验收 Phase 3 的工作台与等待页轻量调整，确保新模型选择和等待页信息收口没有破坏现有生成流。
4. 再验收 Phase 4 的二确双路径重生成，这是唯一会改变核心生成语义的高风险阶段。
5. 最后验收 Phase 5 和 Phase 6，把动态地图 IA 占位、下载能力、测试与 trace 兼容统一收口。

这个顺序服务于风险控制，而不是按页面视觉先后排队。真正的高风险点是共享契约和重生成 mode，而不是首页 dropdown 皮肤本身。

## 方案选型

### 1. 图片模型管理方案

- 方案 A：继续使用单一 `SEEDREAM_*` 环境变量，只在前端做伪选择
- 方案 B：建立服务端图片模型 registry，由 `imageModel` 枚举映射到不同模型与 key
- 方案 C：把三组 key 直接写进前端常量

**结论：选择 B。**

**原因：**

- 用户明确要求三档模型替代原有单一 key。
- 只有服务端 registry 能同时满足“真实切模”和“密钥不下发前端”。
- 这套结构还能直接支撑 Run 留痕和首页模型筛选。

**不选 A 的原因：**

- 只能得到假 dropdown，无法形成真实模型切换与版本追溯。

**不选 C 的原因：**

- 会把密钥暴露到前端与仓库，违反最基本的安全边界。

### 2. 首页筛选状态来源方案

- 方案 A：三个筛选都只保存在组件本地 state
- 方案 B：三个筛选统一由 URL search params 表达，页面和组件共用同一状态来源
- 方案 C：只让“目的地”进 URL，其余两个本地化

**结论：选择 B。**

**原因：**

- 三个入口在产品上是平级 dropdown，统一状态来源更容易保证统计和卡片口径一致。
- 当前首页本来就有 `dataset` 查询参数，扩展成完整筛选上下文成本可控。
- 刷新页面后筛选状态不丢，更适合演示和验收。

### 3. 存量地图模型兼容方案

- 方案 A：把所有旧图强行回填成 `SEEDREAM 5.0`
- 方案 B：根据时间或历史 run 猜测回填 `4.5 / 5.0`
- 方案 C：缺失模型的旧记录按 `unknown` 兼容，不伪造真实来源

**结论：选择 C。**

**原因：**

- 当前仓库已存在大量历史地图和 run 样本，但并没有可靠的版本来源信息。
- 模型筛选若建立在猜测式回填上，会让首页统计与版本追踪看起来“能筛”，但实际上不可信。
- `unknown` 是对历史数据最保守、最可解释的兼容语义。

### 4. 二确重生成语义方案

- 方案 A：继续沿用 `instruction + basedOnExistingImage` 布尔契约
- 方案 B：把重生成改成显式 `mode: variant | edit`

**结论：选择 B。**

**原因：**

- 用户已经把“再来一张”和“修改原图”定义成两种不同产品行为。
- 显式 mode 才能把 prompt 校验、参考图选择、版本留存策略拆开，便于测试与回归。
- 当前布尔契约虽然能近似表达部分行为，但读写语义太弱，容易被 UI 误用。

### 5. 动态地图页视频入口方案

- 方案 A：立即接入既有 P6 spec 的真实视频 tab
- 方案 B：先只落地 `地图 / 视频 / 图文` 占位 detab，并把后两者灰化

**结论：选择 B。**

**原因：**

- 用户明确要求“另外两个 detab 先灰化，不可打开”。
- 仓库已有独立 P6 视频 spec，本轮只需要稳定 IA，不需要跨阶段偷跑视频实现。

## 目标设计

### 1. 个人主页

#### 1.1 页面行为

- 顶部筛选区改为三枚同排 dropdown：`目的地 / 生图模型 / 地图风格`。
- `目的地` 切换仅依据 `datasetKey` 过滤地图；不允许使用 `mapName` 或 `map.city` 做模糊匹配。
- 地图卡片列表按三种筛选共同作用后的结果展示。
- 顶部统计中：
  - `旅行作品` 使用当前筛选后的地图数量。
  - `当前素材` 使用当前目的地下 raw dataset 的评论数量。
  - 删除 `旅行足迹` 卡片，不新增替代卡片。
- 上半部分个人名片与统计区固定在页面上半区，下半部分地图卡片区独立滚动。

#### 1.2 状态与参数

- 首页筛选状态至少包含：`datasetKey / imageModel / style`。
- 缺失 `imageModel` 的历史地图在“全部”下可见；当选择具体模型时，不参与命中。
- 默认筛选值：
  - `datasetKey`：当前 URL 或默认数据集
  - `imageModel`：`all`
  - `style`：`all`

#### 1.3 异常与空态

- 若某筛选组合无结果，空态文案要明确提示“当前筛选条件下暂无作品”，而不是误导成“从未生成过作品”。
- 若当前目的地 raw dataset 读取失败，顶部 `当前素材` 降级为 `0` 或可解释空态，但不应导致整页崩溃。

### 2. 图片模型共享契约

#### 2.1 字段设计

- `GenerateRunInput` 增加 `imageModel`
- `RunTrace` 增加 `imageModel`
- `PosterVersion` 增加 `imageModel`
- `MapRecord` 增加当前选中版本对应的 `imageModel`
- `MapViewModel` 增加当前海报对应的 `imageModel`

#### 2.2 registry 设计

- 服务端维护一个 `imageModel` 枚举到模型配置的映射。
- 前端只接收枚举与展示 label，例如：
  - `seedream-4-0`
  - `seedream-4-5`
  - `seedream-5-0`
- 明文 key 只存在于服务端本地配置，不进入客户端 bundle 和提交文档。

#### 2.3 兼容策略

- 旧记录缺失 `imageModel` 时按 `unknown` 兼容。
- `unknown` 允许在详情页和诊断台里被解释为“历史未记录”，但默认不出现在首页模型 dropdown 选项中。

### 3. 作者工作台

#### 3.1 页面行为

- 左侧配置区新增“生图模型” dropdown，位置与“风格”同层级。
- “更新素材列表”改为“清空评论选择”，动作语义改为一次性清空 `selectedCommentIds`。
- 风险提示从评论列表头部移动到生成主按钮左侧，视觉上与最终提交动作绑定。
- 风格参考图区改为 `16:9`，支持单击后全屏或模态放大预览。

#### 3.2 请求语义

- 首次生成请求体变为：
  - `datasetKey`
  - `mapName`
  - `city`
  - `style`
  - `imageModel`
  - `selectedCommentIds`

#### 3.3 异常与空态

- 当用户清空评论后，“一键生成旅行地图”保持禁用，并给出已有的缺参错误提示。
- 若风格参考图资源缺失，预览区展示可解释空态，不影响用户切换模型和风格。

### 4. 生图等待页

#### 4.1 页面行为

- 隐藏 `run_id` 标签，不向用户展示内部标识。
- 头部仅保留对用户可感知的上下文：地图名称、目的地、阶段状态。
- 保持现有轮询与自动跳转逻辑，不新增取消或复杂控制。

#### 4.2 异常

- 失败态仍可回退工作台或重试，但错误信息里不应要求用户识别 `runId`。

### 5. 二确页

#### 5.1 页面行为

- 当前页新增“生图模型” dropdown，与工作台模型选项保持一致，但不强制继承本次页面打开时的模型值。
- 删除“已选内容：N个足迹”卡片，仅保留候选版本与说明。
- 按钮改为：
  - `再来一张`
  - `修改原图`
  - `确认并保存`

#### 5.2 API 语义

- 重生成接口改为接收显式 `mode`：
  - `mode = "variant"`：不参考旧图，不要求 prompt
  - `mode = "edit"`：参考当前选中海报版本，要求 `instruction.trim().length >= 8`
- 请求体同时接收 `imageModel`

#### 5.3 状态字段与版本策略

- `再来一张`：
  - 不读取当前选中版本图片作为参考输入
  - 复用地图已有 route、knowledge、selectedCommentIds、style
  - 新增一个 `posterVersion`
- `修改原图`：
  - 参考当前 `selectedPosterVersion`
  - 使用新 prompt 和当前选择的 `imageModel`
  - 新增一个 `posterVersion`
- 两种路径都不覆盖旧版本，不清理既有版本；确认保存时才统一 prune 未选版本。

#### 5.4 异常

- `修改原图` 若 prompt 少于 8 个字，前端应阻止提交并给出明确提示；后端也要做兜底校验。
- 若当前选中版本底图不可读或不支持作为参考图，后端要返回可解释错误，不能静默回退成“再来一张”。

### 6. 动态地图页

#### 6.1 页面行为

- 右上角增加“回到主页”按钮，点击跳转 `/`。
- 右上角新增 detab：`地图 / 视频 / 图文`
  - `地图`：当前页内容
  - `视频`：灰态占位，不可点击
  - `图文`：灰态占位，不可点击
- 提供当前海报图片下载能力，下载对象为当前地图使用中的海报。

#### 6.2 异常与占位语义

- 本轮不显示“敬请期待”详情页，不打开空白 tab，不做伪跳转。
- 若当前海报路径异常，下载按钮进入禁用态并给出提示，不影响地图正文浏览。

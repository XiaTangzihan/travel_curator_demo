# Demo 改造设计：route.md 权威输入、event 语义补全与静态图生成对齐

## 1. 目标

* 把静态图生成的核心输入收口为 `route.md + knowledge + C-通用 + C-风格`，避免当前“产物是 route.md、实际输入却仍是内存 events”的语义错位。
* 提升 event 配图语义稳定性，引入由文本 LLM 生成的 `subject/avoid`，减少店名、景点名、评论噪声对静态图内容的误导。
* 收紧“背景标志去文字化”约束：背景地标只承担背景视觉，不给地标配文。
* 修复图片重生成后的用户体验 gap：重生成后页面应展示新图，并允许回退到上一次图片版本。
* 对多 event 场景做风险提示而不是硬阻断：工作台在选中评价数 `> 8` 时展示 warning，但不禁止继续生成。

## 2. 非目标

* 本轮不采用“编号/名称改程序后绘制”方案。
* 本轮不引入 `comment_excerpt`。
* 本轮不把 `knowledge.visual` 改写为“纯视觉描述”；保留现有知识文本，只通过提示词约束收紧输出。
* 本轮不增加 OCR / 规则校验失败回退逻辑。
* 本轮不引入底线审核 agent。
* 本轮不做旧数据兼容与迁移；旧数据格式化由其他 Agent 另行处理。
* 本轮不对用户可选评价数做硬限制，不把 `> 8` 变成后端校验错误。
* 本轮不处理路径几何走向重构（如强制 Z 字形、强制横轴无回头路）的独立算法升级。

## 3. 已确认决策

* 静态图生成的核心输入必须是 `route.md + knowledge + C-通用 + C-风格`。
* 允许在设计上新增 `route.md parser`，让 P3/P4 真正从 `route.md` 读取，而不是继续直接消费原始 `events` 内存对象。
* `route.md` 中新增 `## Important Rules` 区块，用于承载生图必须遵守的硬约束。
* `## Important Rules` 中关于风格统一的固定措辞为：`所有 event 配图统一服从给定 style，不得自行发散风格。`
* 每个 event 的语义补全由文本 LLM 生成，输入只使用 `poiName + categoryL1 + commentText`。
* event 语义补全只产出两个字段：
  * `subject`：一句描述一幅图的完整句子
  * `avoid`：3-5 个要避免的意象词
* `subject` 不负责定义风格；event 配图风格必须统一服从用户选择的全局 style。
* 背景标志去文字化仅通过更强的提示词约束实现，不改写 `knowledge.visual` 文本本身。
* Seedream 图像接口不作为“可靠支持独立 `system_prompt`”的契约处理；需要强调的通用规则统一写进主 prompt 顶部的“重要事项区”。
* 图片重生成只支持“回退上一次”，不引入完整历史版本管理。
* 工作台对 `selectedCommentIds.length > 8` 只做 warning，不做硬阻断。
* 本轮不为旧 route 兼容性额外加 fallback 逻辑。

## 4. 当前代码现状

### 4.1 `route.md` 当前只是产物，不是 P3/P4 的真实输入

* `src/engine/renderers/route-markdown.ts` 当前会输出 front matter、Day/Event 分层、`event标志生图提示`，但没有 `Important Rules`、`subject`、`avoid`。
* `src/engine/pipelines/generate-map.ts` 当前虽然先生成并保存 `routeMarkdown`，但保存后仍直接把 `selectedEvents` 和 `knowledge` 传给 `writePosterFile()` / `writeRegeneratedPosterFile()`，没有从 route 反读。
* 这导致“route 是展示件、events 才是生图真实输入”的双轨语义。

### 4.2 当前没有 `route.md parser` 和对应 schema

* 仓库中没有 `src/engine/parsers/route-markdown.ts`。
* `src/contracts/domain.ts` 当前没有 `parsedRoute`、`importantRules`、`parsedRouteEvent.subject/avoid` 等 schema。
* `tests/unit/route-markdown.test.ts` 当前只覆盖 front matter 和基础 Day/Event 输出，没有覆盖 route 语义字段或 parser 失败口径。

### 4.3 P3/P4 仍按原始 `EventRecord[]` 组 prompt

* `src/engine/prompts/p3-poster.ts` 当前输入是 `EventRecord[] + Landmark[]`，通过 `sequence`、`shortName`、`knowledge.visual` 直接组 prompt。
* `src/engine/prompts/p4-regenerate.ts` 当前直接复用 `buildPosterPrompt()`，没有独立的 route 驱动层。
* 当前不存在“Important Rules 先于 event 语义进入 prompt”的结构化拼装过程。

### 4.4 当前图片接口层没有可依赖的独立 `system_prompt` 契约

* `src/engine/providers/ark-provider.ts` 当前只向图像接口传 `prompt/images/response_format/size`。
* 本轮实测结论是：不能把 Seedream 当成“可靠支持独立 `system_prompt` 注入”的接口能力来设计。
* 因此，若需要强调“背景标志不配文”“所有 event 配图统一服从给定 style”等硬规则，只能通过主 prompt 顶部的重要事项区实现。

### 4.5 当前重生成会覆写同一路径海报，缺少“回退上一次”所需状态

* `src/server/repositories/demo-repository.ts` 当前 `posterOutputPath(mapId)` / `posterPublicPath(mapId)` 都只按 `mapId` 生成固定文件名。
* `src/contracts/domain.ts` 中 `mapRecordSchema` 当前只有 `posterPath`，没有 `previousPosterPath` 或上一版本关联字段。
* `src/features/confirm/confirm-page.tsx` 当前重生成成功后只执行 `router.refresh()`，没有版本化路径切换，也没有回退入口。

### 4.6 工作台当前没有“> 8 条评价”的软提示

* `src/features/workspace/workspace-page.tsx` 当前会统计 `selectedCommentIds.length`，但只用于生成门禁与已选数量展示。
* 当前不存在在 `selectedCommentIds.length > 8` 时提示“静态图稳定性风险升高”的非阻断 warning。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| R1 | `route.md` 契约升级 | `route.md` 成为 P3/P4 的权威输入，包含 `Important Rules` 与 event 级 `subject/avoid` | 升级 route renderer，删除旧 `event标志生图提示`，用显式字段替代 |
| R2 | event 语义补全 | 每个 event 都有符合 schema 的 `subject/avoid` | 在 route 落盘前由文本 LLM 生成结构化语义并写回 route |
| R3 | `route.md parser` | P3/P4 能从 route 读取结构化输入；route 非法时明确失败 | 新增 parser + zod schema，严格校验 front matter / rules / events |
| R4 | P3/P4 route-driven prompt | P3/P4 的最终 prompt 来源切换为 `parsedRoute + knowledge + C-通用 + C-风格` | 调整 prompt builder 与 generate/regenerate pipeline，禁止再直接用原始 events 组最终图像语义 |
| R5 | 背景标志去文字化收紧 | 背景地标只作为背景视觉，不给地标配文 | 在 `Important Rules` 与 P3/P4 prompt 顶部强化硬约束，不改写 `knowledge.visual` |
| R6 | 重生成刷新与回退 | 重生成成功后展示新图，并允许回退上一次图片版本 | 海报文件路径版本化，MapRecord 增加上一版本指针，新增回退接口与确认页入口 |
| R7 | 工作台高风险提示 | 选中评价数 `<= 8` 时静默，`> 8` 时展示 warning，但仍允许生成 | 在工作台新增非阻断提示文案，不进入后端强校验 |

## 6. 分阶段计划

### Phase 1：Route 契约升级与 `subject/avoid` 生成

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 升级 `route.md` 输出结构，新增 `## Important Rules`
* 删除旧 `event标志生图提示`
* 新增 event 级 `subject/avoid` 生成器
* 为 route 渲染和 `subject/avoid` 结构校验补单测

**建议改动面**
* `src/engine/renderers/route-markdown.ts`
* `src/engine/prompts/p2-event-visual-brief.ts`（新增）
* `src/engine/prompts/index.ts`
* `src/engine/pipelines/generate-map.ts`
* `tests/unit/route-markdown.test.ts`
* `tests/unit/event-visual-brief.test.ts`（新增）

**验收标准**
* 新生成的 `route.md` 包含 `## Important Rules`
* `Important Rules` 中包含固定措辞：`所有 event 配图统一服从给定 style，不得自行发散风格。`
* 每个 event 都包含 `subject` 与 `avoid`
* `subject` 为非空完整句子，`avoid` 为 3-5 个意象词
* 仓库中不再写出旧 `event标志生图提示`

**风险提示**
* 文本 LLM 输出易出现结构漂移，必须在落 route 前就做 schema 校验
* 这是 route 契约的破坏性升级，后续 parser/P3/P4 都会依赖该结构

### Phase 2：`route.md parser` 与 P3/P4 route-driven 切换

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`
* `TRAE-debugger`

**范围**
* 新增 `route.md parser`
* 新增 `parsedRoute` schema
* P3/P4 改为读取 `parsedRoute + knowledge + C-通用 + C-风格`
* 将“背景地标不配文”“event 配图统一服从给定 style”等规则写入主 prompt 顶部重要事项区

**建议改动面**
* `src/engine/parsers/route-markdown.ts`（新增）
* `src/contracts/domain.ts`
* `src/engine/prompts/p3-poster.ts`
* `src/engine/prompts/p4-regenerate.ts`
* `src/engine/pipelines/generate-map.ts`
* `tests/unit/route-parser.test.ts`（新增）
* `tests/unit/poster-prompt.test.ts`

**验收标准**
* P3/P4 在生成最终图像 prompt 前会显式 parse route
* parser 能解析 front matter、`Important Rules`、events
* parser 在缺字段、`avoid` 数量错误、`sequence` 冲突时明确失败
* P3/P4 不再直接把原始 `EventRecord[]` 当成最终图像语义输入
* 生图重要约束写在主 prompt 顶部，而不是依赖独立 `system_prompt`

**风险提示**
* 这是本轮最核心的架构切换：route 从“展示产物”变成“权威输入”
* parser 严格失败会直接改变当前 happy path，需要单独隔离验证

### Phase 3：重生成版本化刷新与上一次回退

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 海报输出路径版本化，不再按 `mapId` 固定覆写
* MapRecord 增加上一版本图片指针
* 确认页重生成后展示新图
* 新增“回退上一次”动作，只支持单步回退

**建议改动面**
* `src/contracts/domain.ts`
* `src/server/repositories/demo-repository.ts`
* `src/engine/pipelines/generate-map.ts`
* `app/api/maps/[mapId]/regenerate/route.ts`
* `app/api/maps/[mapId]/rollback/route.ts`（新增）
* `src/features/confirm/confirm-page.tsx`
* `tests/unit/demo-repository.test.ts`

**验收标准**
* 每次重生成后 `posterPath` 变为新版本路径
* 确认页刷新后能看到新图而不是旧缓存图
* `mapRecord` 能保留“上一次图片版本”的最小回退信息
* 用户可在确认页执行“回退上一次”
* 回退后不进入多版本历史管理，只保留当前图与下一次可能的新上一次

**风险提示**
* 海报产物命名规则变化会影响删除逻辑、run artifacts 与缓存行为
* 当前图与上一次图的指针切换如果不严谨，会产生回退错位

### Phase 4：工作台 `> 8` 风险 warning 与整链路回归

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 在工作台增加 `selectedCommentIds.length > 8` 的非阻断 warning
* 做 generate / regenerate / rollback 的整链路回归检查

**建议改动面**
* `src/features/workspace/workspace-page.tsx`
* `tests/unit/workspace-page.test.tsx`（如仓库已有 UI 测试基础则补充，否则采用现有测试口径）

**验收标准**
* 选中评价数 `<= 8` 时页面静默
* 选中评价数 `> 8` 时页面展示稳定性 warning，但生成按钮仍可点击
* route-driven 生成、重生成、回退三条链路都能通过回归验证

**风险提示**
* 该阶段风险较低，但应放在主链路稳定后执行，避免把输入 warning 和架构问题混在一起调试

## 7. 阶段执行门禁

### 7.1 阶段开始前

1. refresh memory，重新读取项目约束、近期 topic 与最新阶段状态。
2. 向用户汇报本阶段：
   * 本阶段目标
   * 计划改动文件
   * 验收方式
   * 风险点
3. 明确请求“是否开始当前 Phase”的确认。
4. 只有在用户明确批准后，才允许进入本阶段编码。

### 7.2 阶段完成后

1. 完成本阶段验证，不得跳过。
2. 运行 `git status` 与 `git diff --stat`，给出本阶段改动概览。
3. 推荐 commit message，格式保持“首部英文 + 主体中文”，例如：

```text
feat(route-parser): 切换 P3/P4 为 route 驱动生图输入
```

4. 向用户汇报本阶段结果并请求确认。
5. 未得到用户确认前，不得直接进入下一阶段。

### 7.3 下一阶段开始前

1. 再次 refresh memory。
2. 汇报下一阶段目标摘要与风险。
3. 明确请求“是否开始下一阶段”。
4. 得到确认后再实施。

禁止行为：

* 跨多个 Phase 连续改代码。
* 未做验证就推荐 commit。
* 未 refresh memory 就直接进入下一阶段。

## 8. 总体验收顺序

建议按以下顺序验收：

1. 先验 `route.md` 契约升级是否成立。
2. 再验 parser 是否能严格读取并校验新 route。
3. 再验 P3/P4 是否已真正改为 route-driven。
4. 再验重生成的新图展示与上一次回退。
5. 最后验工作台 `> 8` warning 与整链路回归。

这样排序的原因是：

* `route.md` 契约是整个改造的地基。
* parser 是把“人类可读 route”转成“机器可用输入”的门。
* 只有 route-driven 生图链稳定后，重生成版本化和回退才有可靠价值。
* 工作台 warning 不改变核心架构，应最后纳入，避免分散主链路调试注意力。

## 9. 方案选型

### 9.1 权威输入选型

候选方案：

1. `推荐方案`：新增 `route.md parser`，让 P3/P4 真正从 route 读取。
2. 继续保持 `events + knowledge` 为真实输入，route 只做展示产物。
3. 新增独立 JSON 中间产物作为生图真实输入，route 只做镜像展示。

结论：选择方案 1。

原因：

* 它与用户对 `route.md` 的定位一致。
* 它能把“讨论后的语义契约”直接沉淀到可读、可校验、可复用的文档输入上。
* 相比新建另一份 JSON 中间产物，它不会制造新的双轨输入源。

不选方案 2 的原因：

* 继续维持“route 看起来是核心输入、代码里却不是”的认知裂缝。

不选方案 3 的原因：

* 会引入新的隐形权威数据源，与用户明确要求相违背。

### 9.2 event 语义字段选型

候选方案：

1. `推荐方案`：只产 `subject/avoid`
2. `commentText + comment_excerpt + subject/avoid`
3. 保留旧 `event标志生图提示`

结论：选择方案 1。

原因：

* `subject/avoid` 已能覆盖“画什么 / 避开什么”两类核心控制信号。
* `comment_excerpt` 会引入内容重复和额外歧义。
* 旧 `event标志生图提示` 是压缩字符串，语义不稳定，无法作为权威契约。

### 9.3 图像模型强调规则的方式选型

候选方案：

1. `推荐方案`：把重要规则写进主 prompt 顶部的“重要事项区”
2. 依赖独立 `system_prompt`

结论：选择方案 1。

原因：

* 当前项目封装与现有实测都不足以把 Seedream 的独立 `system_prompt` 视为可靠契约。
* 主 prompt 顶部的重要事项区可被当前代码路径直接稳定控制。

### 9.4 重生成回退方案选型

候选方案：

1. `推荐方案`：海报路径版本化 + MapRecord 保留上一版本指针
2. 继续覆写同一路径，仅靠 `router.refresh()` 强刷
3. 引入完整历史版本管理

结论：选择方案 1。

原因：

* 它正好满足“重生成后看见新图 + 支持回退上一次”的最小需求。
* 相比覆写同一路径，它能避免缓存错觉。
* 相比完整历史版本管理，它的状态和交互都更收敛。

## 10. 目标设计

### 10.1 `route.md` 新契约

`route.md` 继续保留 front matter 和 Day/Event 分层，并新增 `## Important Rules`。

建议结构如下：

```md
---
map_name: 广州02
city: 广州市
style: 年轻卡通风
days: 2
event_count: 6
knowledge_count: 10
---

## Important Rules
- 所有 event 配图统一服从给定 style，不得自行发散风格。
- 背景地标只作为背景视觉参考，不给地标配文。
- 每个 event 的 subject 必须是一句完整画面描述。
- 每个 event 的 avoid 必须是 3-5 个要避免的意象词。

# Day 2 (2024:06:02)

## Event 4 · 金元泰
- sequence: 4
- poi: 金元泰·泰式按摩·SPA(丽影广场客村店)
- short_name: 金元泰
- 类目: 休闲娱乐 / 洗浴按摩 / 足疗/按摩
- 文案: 电梯上三楼，过了一家桌游店就是这家泰式按摩了……
- 配图: /mock/files/comments/recvo6qYsLaggU_1.jpeg
- subject: 一间温暖放松的泰式按摩门店内景，按摩床与草本热敷用品摆放整齐，呈现舒缓护理中的休憩感。
- avoid: 台阶, 楼层指示牌, 套餐价格字样, 说明性长文字, 随机英文标语
```

说明：

* 旧 `event标志生图提示` 从新契约中移除。
* `subject/avoid` 写进 route 本身，而不是额外落一份中间 JSON。

### 10.2 `subject/avoid` 生成器

生成器在 route 落盘前运行，其职责是把原始 event 补全成生图可消费的语义字段。

输入：

* `poiName`
* `categoryL1`
* `commentText`
* `styleLabel`（仅作为“服从全局 style”的约束说明，不用于发散 event 风格）

输出：

* `subject`
* `avoid`

system prompt 需要明确：

* `subject` 必须是一句完整自然语言，不允许关键词堆砌。
* `subject` 只描述主体、动作、场景，不写编号、标题、版式。
* `subject` 不单独指定风格，event 配图统一服从给定 style。
* `avoid` 必须是 3-5 个短词，不允许长句解释。
* 不允许输出 Markdown，只允许输出可校验 JSON。

失败口径：

* 若文本 LLM 返回结构不合法，则当前 generate/regenerate 直接失败。
* 本轮不为 `subject/avoid` 增加第二套 heuristic fallback。

### 10.3 `route.md parser`

新增 `src/engine/parsers/route-markdown.ts`，按固定格式解析 route。

parser 只解析：

* front matter
* `Important Rules`
* Day/Event 段与 event 字段

不解析 `knowledge`，`knowledge` 仍继续来自 `knowledge.json`。

parser 失败条件：

* front matter 缺核心字段
* `Important Rules` 缺失
* event 缺 `subject/avoid`
* `avoid` 不是 3-5 个词
* `sequence` 非正数、重复，或总数与 `event_count` 不一致

当 parser 失败时：

* 当前 run 直接失败
* 不静默降级回“按原始 events 拼 prompt”

### 10.4 P3/P4 prompt 组装

P3/P4 最终图像 prompt 的来源统一改成：

* `parsedRoute`
* `knowledge`
* `C-通用`
* `C-风格`

组装顺序建议为：

1. 主 prompt 顶部：`Important Rules`
2. 全局风格：`C-通用 + C-风格`
3. 背景知识：`knowledge.visual`
4. event 列表：`sequence + short_name + subject + avoid`
5. regenerate 场景下再追加用户 `instruction`

强约束：

* `knowledge` 只作为背景视觉参考，不给地标配文。
* event 配图统一服从给定 style，不允许单个 event 自行风格漂移。
* P3/P4 不再依赖独立 `system_prompt`。

### 10.5 重生成与回退

重生成成功后，不再覆写 `posterPath` 对应的同一路径文件。

建议：

* 新图按 `mapId + runId` 生成版本化路径，例如：`/mock/posters/<mapId>__<runId>.png`
* `mapRecord.posterPath` 指向当前图
* 新增 `previousPosterPath`、`previousPosterRunId`（或等效字段）指向上一次图

重生成成功流：

1. 生成新图
2. 把当前 `posterPath` 挂到 `previousPosterPath`
3. 把新版本路径写入 `posterPath`
4. 确认页 refresh 后展示新图

回退流：

1. 用户点击“回退上一次”
2. 后端把 `previousPosterPath` 切回当前 `posterPath`
3. 回退成功后清空上一次指针，不进入完整历史版本管理

这样设计可以保证：

* 用户一定能看到新图
* 回退只支持一步
* 状态模型仍然收敛

### 10.6 工作台 `> 8` warning

工作台新增非阻断 warning，位置建议靠近“生成”按钮或已选数量区域。

规则：

* `selectedCommentIds.length <= 8`：静默
* `selectedCommentIds.length > 8`：展示 warning
* 不改变按钮可点击状态
* 不进入后端硬校验

文案应明确：

* 这是静态图质量/稳定性风险提示
* 不是禁止生成

### 10.7 测试与回归口径

单测至少覆盖：

* route renderer 新字段输出
* `subject/avoid` schema 校验
* route parser 成功/失败用例
* P3 prompt 来源切换为 parsed route
* regenerate 版本化与回退指针切换

人工抽检建议覆盖：

* 1 个容易被误判语义的店名/POI
* 1 组 4-6 个 event 的标准样本
* 1 组 7-8 个 event 的高风险样本

本轮成功标准不是“静态图绝不出错”，而是：

* 输入契约明确
* route 真正成为权威输入
* event 语义控制能力比旧 hint 明显更强
* 重生成与回退链路可观察、可操作

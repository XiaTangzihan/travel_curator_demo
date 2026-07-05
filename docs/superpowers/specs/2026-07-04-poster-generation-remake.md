# Demo 改造设计：route.md 权威输入、event 语义补全与静态图生成对齐

## 1. 目标

* 把静态图生成的核心输入收口为 `route.md + knowledge + C-通用 + C-风格`，避免当前“产物是 route.md、实际输入却仍是内存 events”的语义错位。
* 提升 event 配图语义稳定性，引入由文本 LLM 生成的 `subject/avoid`，减少店名、景点名、评论噪声对静态图内容的误导。
* 收紧“背景标志去文字化”约束：背景地标只承担背景视觉，不给地标配文。
* 收紧整图级“图中有字”和“路径顺序”约束，避免继续把全局布局问题错误下沉到 event 级语义补全。
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
* 本轮不引入程序化路径布局算法，不做几何强控渲染。
* 本轮不引入 OCR、图像审核器、negative prompt、seed 固定或额外图像后处理链路。
* 本轮不把点位名称、编号改为程序后绘制；仍由 Seedream 在整图中生成。

## 3. 已确认决策

* 静态图生成的核心输入必须是 `route.md + knowledge + C-通用 + C-风格`。
* 允许在设计上新增 `route.md parser`，让 P3/P4 真正从 `route.md` 读取，而不是继续直接消费原始 `events` 内存对象。
* `route.md` 中新增 `## Important Rules` 区块，用于承载生图必须遵守的硬约束。
* `## Important Rules` 中关于风格统一的固定措辞为：`所有 event 配图统一服从给定 style，不得自行发散风格。`
* `Important Rules` 的字面量来源已经抽为共享模块 `src/engine/prompts/p3-poster-important-rules.ts`；`route-markdown.ts` 只负责把共享规则写入 `route.md`。
* 每个 event 的语义补全由文本 LLM 生成，输入只使用 `poiName + categoryL1 + commentText`。
* 新增的 event 级 `subject/avoid` 生成器必须使用 DOUBAO 文本模型，不得误用 Seedream 图像模型。
* event 语义补全只产出两个字段：
  * `subject`：`1 个简短中文名词 + 1 个简短中文形容词`，用顿号连接，顺序固定为“名词、形容词”
  * `avoid`：3-5 个要避免的意象词
* `subject` 不负责定义风格、路径或版式；event 配图风格必须统一服从用户选择的全局 style。
* 背景标志去文字化仅通过更强的提示词约束实现，不改写 `knowledge.visual` 文本本身。
* Seedream 图像接口不作为“可靠支持独立 `system_prompt`”的契约处理；需要强调的通用规则统一写进主 prompt 顶部的“重要事项区”。
* “图中有字”和“路径顺序”属于整图级约束，主修复层在 `Important Rules + P3`，不由 `P2` 承担。
* 当前联调默认图片模型已切换到 Seedream 5.0。
* 静态图确认阶段改为“多版候选比较”，不再采用“回退上一次”的单指针模型。
* 工作台对 `selectedCommentIds.length > 8` 只做 warning，不做硬阻断。
* 本轮不为旧 route 兼容性额外加 fallback 逻辑。

## 4. 当前代码现状

### 4.1 `route.md` 已经成为 P3/P4 的真实输入，且 `Important Rules` 已共享化

* `src/engine/renderers/route-markdown.ts` 现已输出 front matter、`## Important Rules`、Day/Event 分层，以及显式 `subject/avoid` 字段。
* `src/engine/prompts/p3-poster-important-rules.ts` 已作为共享规则源存在，`route-markdown.ts` 通过导入该模块写入 route。
* 当前问题已不再是“route 只是展示件”，而是“主 spec 仍停留在旧状态，尚未吸收共享规则源与规则收紧后的职责边界”。

### 4.2 `route.md parser` 与 schema 已落地

* 仓库中已存在 `src/engine/parsers/route-markdown.ts`。
* `src/contracts/domain.ts` 已包含 `parsedRoute`、`importantRules`、`parsedRouteEvent` 等 schema。
* `tests/unit/route-parser.test.ts` 已覆盖 parser 的成功路径与失败口径。

### 4.3 P3/P4 已切换为 route-driven，但规则收紧内容尚未回写主 spec

* `src/engine/prompts/p3-poster.ts` 当前已经直接读取 `params.route.importantRules`、`params.route.events` 和 `knowledge.visual` 组 prompt。
* `src/engine/prompts/p4-regenerate.ts` 继续复用 `buildPosterPrompt()`，但实际输入已经变成 route-driven。
* 当前 `P3` 已补入“图标内部不得有字”“节点外部标注”“主路径左起右终”“横向位置随编号递增”等整图级约束。

### 4.4 当前图片接口层没有可依赖的独立 `system_prompt` 契约

* `src/engine/providers/ark-provider.ts` 当前只向图像接口传 `prompt/images/response_format/size`。
* 本轮实测结论是：不能把 Seedream 当成“可靠支持独立 `system_prompt` 注入”的接口能力来设计。
* 因此，若需要强调“背景标志不配文”“所有 event 配图统一服从给定 style”等硬规则，只能通过主 prompt 顶部的重要事项区实现。

### 4.5 `P2` 已收紧为“名词、形容词”式局部语义，但仍属于 event 局部层

* `src/engine/prompts/p2-event-visual-brief.ts` 当前已经把 `subject` 固定为“1 个简短中文名词 + 1 个简短中文形容词”，并补了正反例。
* 同文件还增强了 `avoid` 的文字噪声示例，并加入了对 string `avoid` 的归一化容错。
* 当前需要明确的是：这些收紧属于 event 局部语义层，不能替代 `P3` 的整图规则。

### 4.6 当前静态图确认页仍缺少多版候选比较状态

* 当前如果用户想比较多张候选海报，系统没有 `posterVersions` 或 `selectedPosterVersionId` 之类的结构化状态。
* `confirm-page` 仍缺少显式的版本切换区，用户无法在多版之间反复比较。
* `confirm` 动作也没有“仅保留选中版本、丢弃其他版本”的收口逻辑。

### 4.7 工作台当前没有“> 8 条评价”的软提示

* `src/features/workspace/workspace-page.tsx` 当前会统计 `selectedCommentIds.length`，但只用于生成门禁与已选数量展示。
* 当前不存在在 `selectedCommentIds.length > 8` 时提示“静态图稳定性风险升高”的非阻断 warning。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| R1 | `route.md` 契约升级 | `route.md` 成为 P3/P4 的权威输入，包含 `Important Rules` 与 event 级 `subject/avoid` | 升级 route renderer，删除旧 `event标志生图提示`，用显式字段替代 |
| R2 | event 语义补全 | 每个 event 都有符合 schema 的 `subject/avoid`，其中 `subject` 固定为“名词、形容词” | 在 route 落盘前由 DOUBAO 生成结构化语义并写回 route |
| R3 | `route.md parser` | P3/P4 能从 route 读取结构化输入；route 非法时明确失败 | 新增 parser + zod schema，严格校验 front matter / rules / events |
| R4 | P3/P4 route-driven prompt | P3/P4 的最终 prompt 来源切换为 `parsedRoute + knowledge + C-通用 + C-风格`，且整图规则收紧 | 调整 prompt builder 与 generate/regenerate pipeline，并把共享 `Important Rules` 写入 route 与 P3 |
| R5 | 背景标志去文字化与路径顺序收紧 | 背景地标只作为背景视觉，不给地标配文；主路径以左到右为主阅读轴 | 通过共享 `Important Rules` 与 P3 顶部重要事项区强化硬约束，不改写 `knowledge.visual` |
| R6 | 多版候选比较与定稿 | 重生成成功后新增候选版本；用户可在多版中切换；确认时仅保留选中版本 | 海报文件路径版本化，MapRecord 增加 `posterVersions + selectedPosterVersionId`，新增版本切换接口与确认时清理逻辑 |
| R7 | 工作台高风险提示 | 选中评价数 `<= 8` 时静默，`> 8` 时展示 warning，但仍允许生成 | 在工作台新增非阻断提示文案，不进入后端强校验 |

## 6. 分阶段计划

### Phase 1：Route 契约升级与 `subject/avoid` 生成

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 升级 `route.md` 输出结构，新增 `## Important Rules`
* 删除旧 `event标志生图提示`
* 新增基于 DOUBAO 文本模型的 event 级 `subject/avoid` 生成器
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
* 抽取共享 `Important Rules` 规则源
* 将“背景地标不配文”“event 配图统一服从给定 style”“图标内部无字”“主路径左起右终”等规则写入 route 与主 prompt 顶部重要事项区
* 同步收紧 `P2` 的 `subject` 与 `avoid` 示例，但不改变其 event 局部职责

**建议改动面**
* `src/engine/parsers/route-markdown.ts`（新增）
* `src/contracts/domain.ts`
* `src/engine/prompts/p3-poster-important-rules.ts`（新增）
* `src/engine/prompts/p3-poster.ts`
* `src/engine/prompts/p4-regenerate.ts`
* `src/engine/prompts/p2-event-visual-brief.ts`
* `src/engine/renderers/route-markdown.ts`
* `src/engine/pipelines/generate-map.ts`
* `tests/unit/route-parser.test.ts`（新增）
* `tests/unit/poster-prompt.test.ts`
* `tests/unit/route-markdown.test.ts`
* `tests/unit/event-visual-brief.test.ts`

**验收标准**
* P3/P4 在生成最终图像 prompt 前会显式 parse route
* parser 能解析 front matter、`Important Rules`、events
* parser 在缺字段、`avoid` 数量错误、`sequence` 冲突时明确失败
* P3/P4 不再直接把原始 `EventRecord[]` 当成最终图像语义输入
* 共享 `Important Rules` 会同时出现在 route 输出与 P3 route-driven prompt 中
* `subject` 契约更新为“名词、形容词”，且 `avoid` 的文字噪声示例得到补强
* 生图重要约束写在主 prompt 顶部，而不是依赖独立 `system_prompt`

**风险提示**
* 这是本轮最核心的架构切换：route 从“展示产物”变成“权威输入”
* parser 严格失败会直接改变当前 happy path，需要单独隔离验证

### Phase 3：多版海报候选比较与定稿

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 海报输出路径版本化，不再按 `mapId` 固定覆写
* MapRecord 增加 `posterVersions + selectedPosterVersionId`
* 每次重生成新增一个候选版本，而不是覆盖当前版本
* 确认页支持在多版候选图之间切换比较
* 确认保存时仅保留当前选中版本，其余版本清理

**建议改动面**
* `src/contracts/domain.ts`
* `src/server/repositories/demo-repository.ts`
* `src/engine/pipelines/generate-map.ts`
* `app/api/maps/[mapId]/regenerate/route.ts`
* `app/api/maps/[mapId]/poster-versions/select/route.ts`（新增）
* `src/features/confirm/confirm-page.tsx`
* `app/api/maps/[mapId]/confirm/route.ts`
* `tests/unit/demo-repository.test.ts`

**验收标准**
* 每次重生成后会新增一个新版本，不覆盖已有候选图
* 用户可在确认页的多版候选图之间反复切换比较
* 用户当前选中的版本有明确状态，不是隐含状态
* 若不填额外提示词直接重生成，默认按首次生成的原始输入重新采样
* 点击确认保存后，只保留选中版本，其他未选中版本被清理

**风险提示**
* 海报产物命名规则变化会影响删除逻辑、run artifacts 与缓存行为
* 多版切换需要保证 `mapRecord.posterPath`、`currentRunId` 与 `renderedMap.posterPath` 始终一致
* 确认时的未选中版本清理若不严谨，会误删最终定稿图

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
4. 再验多版候选图的切换比较与定稿清理。
5. 最后验工作台 `> 8` warning 与整链路回归。

这样排序的原因是：

* `route.md` 契约是整个改造的地基。
* parser 是把“人类可读 route”转成“机器可用输入”的门。
* 只有 route-driven 生图链稳定后，多版版本集与定稿清理才有可靠价值。
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

1. `推荐方案`：只产 `subject/avoid`，其中 `subject` 固定为“名词、形容词”
2. `commentText + comment_excerpt + subject/avoid`
3. 保留旧 `event标志生图提示`

结论：选择方案 1。

原因：

* `subject/avoid` 已能覆盖“event 主体是什么 / 要避开什么”两类核心控制信号。
* `comment_excerpt` 会引入内容重复和额外歧义。
* 旧 `event标志生图提示` 是压缩字符串，语义不稳定，无法作为权威契约。
* 当前 `subject` 固定为“名词、形容词”，更适合做局部视觉锚点，不与整图级布局约束混写。

### 9.3 图像模型强调规则的方式选型

候选方案：

1. `推荐方案`：把重要规则写进主 prompt 顶部的“重要事项区”
2. 依赖独立 `system_prompt`

结论：选择方案 1。

原因：

* 当前项目封装与现有实测都不足以把 Seedream 的独立 `system_prompt` 视为可靠契约。
* 主 prompt 顶部的重要事项区可被当前代码路径直接稳定控制。

### 9.4 多版候选比较方案选型

候选方案：

1. `推荐方案`：海报路径版本化 + `posterVersions` 候选集 + `selectedPosterVersionId`
2. 继续覆写同一路径，仅靠 `router.refresh()` 强刷
3. 单步回退指针模型

结论：选择方案 1。

原因：

* 它正好满足“生成多版候选图、反复比较、显式定稿”的产品目标。
* 相比覆写同一路径，它能保留真正可比较的候选集。
* 相比单步回退指针，它更贴合用户的“1 / 2 / 3 版来回切换”需求。

## 10. 目标设计

### 10.1 `route.md` 新契约

`route.md` 继续保留 front matter 和 Day/Event 分层，并新增 `## Important Rules`。规则文本由共享模块 `src/engine/prompts/p3-poster-important-rules.ts` 持有，`route-markdown.ts` 只负责落盘。

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
- 所有 event 主体图标内部禁止出现任何可读文字、字母、数字、logo、水印、菜单、招牌或屏幕字幕。
- 点位名称和编号只能作为节点外部标注，不能嵌入主体图标内部。
- 若场景天然包含店招、路牌、菜单或电子屏，统一简化为无字形状，不保留可读字符。
- 主路径必须从画面左侧起、向右侧结束，节点编号顺序必须与空间阅读顺序一致。
- 节点中心点横向位置应随编号递增，只允许轻微上下起伏，不允许回头路、环形主路径或纵向堆叠成为主顺序。
- 每个 event 的 subject 必须是 1 个简短中文名词和 1 个简短中文形容词，用顿号连接，顺序固定为“名词、形容词”。
- 每个 event 的 avoid 必须是 3-5 个要避免的意象词。

# Day 2 (2024:06:02)

## Event 4 · 金元泰
- sequence: 4
- poi: 金元泰·泰式按摩·SPA(丽影广场客村店)
- short_name: 金元泰
- 类目: 休闲娱乐 / 洗浴按摩 / 足疗/按摩
- 文案: 电梯上三楼，过了一家桌游店就是这家泰式按摩了……
- 配图: /mock/files/comments/recvo6qYsLaggU_1.jpeg
- subject: 按摩房、舒缓
- avoid: 招牌文字, 菜单字样, 屏幕字幕
```

说明：

* 旧 `event标志生图提示` 从新契约中移除。
* `subject/avoid` 写进 route 本身，而不是额外落一份中间 JSON。
* `Important Rules` 的真实维护点是共享规则源，不再允许在 renderer 内嵌字面量。

### 10.2 `subject/avoid` 生成器

生成器在 route 落盘前运行，其职责是把原始 event 补全成生图可消费的语义字段。

模型约束：

* `subject/avoid` 生成器固定使用 DOUBAO 文本模型。
* 禁止使用 Seedream 图像模型生成或补写 `subject/avoid`。

输入：

* `poiName`
* `categoryL1`
* `commentText`
* `styleLabel`（仅作为“服从全局 style”的约束说明，不用于发散 event 风格）

输出：

* `subject`
* `avoid`

system prompt 需要明确：

* `subject` 必须固定为 1 个简短中文名词和 1 个简短中文形容词，用顿号连接。
* 名词优先写具体器物、食物或真实空间；形容词只描述视觉气质，不写动作、句子、标题、版式。
* `subject` 不单独指定风格，不承担路径走向或节点标注规则，event 配图统一服从给定 style。
* `avoid` 必须是 3-5 个短词，不允许长句解释，优先覆盖招牌文字、菜单字样、屏幕字幕、价格海报等文字噪声。
* 不允许输出 Markdown，只允许输出可校验 JSON。
* 为降低模型 shape 漂移风险，解析层允许把字符串形式的 `avoid` 归一化为数组，但契约目标仍是 JSON 数组。

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
* 点位名称和编号只能作为节点外部标注，主体图标内部不得有字。
* 主路径必须左起右终，节点横向位置随编号递增。
* P3/P4 不再依赖独立 `system_prompt`。

### 10.5 多版候选比较与定稿

重生成成功后，不再覆写 `posterPath` 对应的同一路径文件。

建议：

* 新图按 `mapId + runId` 生成版本化路径，例如：`/mock/posters/<mapId>__<runId>.png`
* `mapRecord.posterVersions` 存储当前所有候选版本
* `mapRecord.selectedPosterVersionId` 表示当前选中的版本
* `mapRecord.posterPath` 与 `currentRunId` 始终镜像当前选中版本，供确认页和动态地图继续复用现有入口

重生成成功流：

1. 生成新图
2. 将新图追加到 `posterVersions`
3. 默认把新图设为当前选中版本
4. 确认页 refresh 后可立即切到该新版本进行比较

切换版本流：

1. 用户点击某个候选版本
2. 后端把 `selectedPosterVersionId`、`posterPath`、`currentRunId` 切到对应版本
3. `renderedMap.posterPath` 同步切换，保证确认页主图立即展示选中版本

确认保存流：

1. 用户点击确认保存
2. 后端只保留当前选中版本
3. 其他未选中版本的文件立即删除
4. 动态地图页使用当前选中版本作为最终静态底图

默认重生成策略：

* 若用户未填写额外提示词，则默认按第一次生成时的原始输入重新采样，不继承当前选中图的局部修改痕迹
* 若用户填写了额外提示词，则生成一个新的候选版本；该版本是否采用，仍由用户显式选择

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

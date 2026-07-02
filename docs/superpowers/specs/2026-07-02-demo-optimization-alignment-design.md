# Demo 优化设计：路线删除与静态图约束收敛

## 1. 目标

- 对齐当前 Demo 下一轮优化范围，避免“体验问题”和“技术方案”混写。
- 优先解决删除闭环、静态图误导性信息、风格稳定性、工作台参数化四类问题。
- 将 AI 生成链路的提示词与输入约束从分散状态收敛为可维护的集中结构。
- 明确分阶段执行顺序，并把阶段间的人机协作门禁写成硬约束。

## 2. 已确认决策

- 允许对 `confirmed` 作品做硬删除。
- 删除必须清理干净，不能残留 stale content。
- 静态图序号采用“全旅程连续编号”，不按 Day 重置。
- “地标不显示名字”仅限 AI 补充地标，不影响真实 event 节点名称。
- `Seedream4.5` 视为支持图生图，可作为风格参考图方案的基础能力。
- 工作台中的“目的地”改为可输入，“风格”改为可选择。
- 工作台中的“样本评论”改为“选中评论数”，格式为 `X/Y个`。
- 阶段推进必须经过用户确认与 commit 门禁，不能连续跨阶段直接改代码。

## 3. 优化项总表

| ID | 优化项      | 目标状态                                           | 高层方案                                                                             |
| -- | -------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| M1 | 删除路线     | 个人主页支持批量删除；动态地图页支持单条删除；`draft/confirmed` 均可硬删除 | 增加 map 级删除聚合器，按 `mapId` 清理 record/view/route/knowledge/poster/run traces，并做删除后校验 |
| M2 | 静态图顺序稳定  | 静态图中的站点顺序与真实旅程顺序一致                             | 在 event 层引入稳定序号 `sequence`，P3/P4 只消费 `1..N`，不直接依赖展示时间                            |
| M3 | 静态图去时间   | 静态图中不出现 `10:20:00` 等时间字符串                      | 保留内部排序字段，但海报 prompt 与海报输入 contract 不再暴露 raw 时间                                   |
| M4 | 名称不可改写   | 点位名称可截断、可去括号，但不能被语义改写                          | 引入 `canonicalName + shortName`，`shortName` 仅允许机械压缩，不允许“舒缓放松站”式重命名                |
| M5 | AI 地标不出字 | AI 补充地标只作为背景参考，不显示文字标签                         | 地标输入改为 `visual-only landmarks`，显式禁止渲染地标名字                                        |
| M6 | 风格稳定性    | 每种风格有 1 张人工确认例图，静态图生成参考该例图                     | 生图 adapter 支持 `prompt + reference image(s)`，按 `styleKey` 绑定风格例图                  |
| M7 | 生成可追溯性   | 生成结果可回溯到 prompt 版本、风格、参考图和输入摘要                 | `runTrace` 增补 `promptVersion/styleKey/referenceIds/inputSummary` 等字段             |
| M8 | 工作台参数化   | “目的地”可输入，“风格”可选择，“选中评论数”实时显示 `X/Y个`            | 调整 workspace state、表单组件、请求 payload 与左栏展示卡                                        |

## 4. 关键技术说明

### 4.1 什么是 deterministic route renderer

这里的意思不是“再换一个更聪明的大模型”，而是把路线文档的结构生成权从模型手里拿回来。

- 输入：已经排好序的 `events`
- 处理：由固定代码模板生成 `route.md`
- 输出：固定格式、固定顺序、固定编号的文档

这样做的结果是：

- 不会出现 `1 -> 4 -> 3` 这种顺序漂移
- route 编号、站点次序、字段格式可预测
- 大模型只负责需要创造性的部分，例如地标补充、静态图生成

本项目里，`deterministic route renderer` 将作为 M2 的实现手段，不单独算一个用户需求点。

### 4.2 提示词集中迁移

当前提示词散落在 `src/config/demo.ts` 与 `src/engine/pipelines/generate-map.ts`。为支撑 M2-M7，需集中迁移到：

```text
src/engine/prompts/
  shared.ts
  p1-landmarks.ts
  p2-route-md.ts
  p3-poster.ts
  p4-regenerate.ts
  styles/
    young-cartoon.ts
    watercolor.ts
    storybook.ts
  index.ts
```

迁移目标：

- `generate-map.ts` 不再手写长 prompt 字符串
- 每个 prompt 模块都带 `id/version/buildInput/buildPrompt`
- `demo.ts` 保留配置常量，不再承载长文本 prompt
- `runTrace` 能记录实际使用的 prompt 版本

## 5. 分阶段计划

### Phase 1：工作台参数化与留痕补强

**执行 Agent 可用 Skills**

- `executing-plans`
- `code-reviewer`

**范围**

- M8：目的地输入、风格选择、`选中评论数 X/Y个`
- M7（第一部分）：补充最小可用的生成追溯字段

**建议改动面**

- `src/features/workspace/workspace-page.tsx`
- `src/store/workspace-store.ts`
- `app/api/maps/generate/route.ts`
- `src/contracts/domain.ts`
- `src/engine/pipelines/generate-map.ts`

**验收标准**

- 工作台左栏中“目的地”为输入框
- “风格”为真实可选控件，且请求 payload 使用用户选择值
- “选中评论数”实时显示 `X/Y个`
- 新生成的 `runTrace` 至少能看到 `styleKey` 和输入摘要

### Phase 2：删除闭环

**执行 Agent 可用 Skills**

- `executing-plans`
- `code-reviewer`
- `TRAE-debugger`（仅在删除后残留或读写异常时启用）

**范围**

- M1：个人主页批量删除、动态地图页单条删除、服务端硬删除聚合器、删除后校验

**建议改动面**

- `src/features/profile/profile-home.tsx`
- `src/features/dynamic-map/dynamic-map-page.tsx`
- `app/api/maps/[mapId]/route.ts`
- `src/server/repositories/demo-repository.ts`
- `src/server/utils/storage.ts`

**验收标准**

- 首页可多选并批量删除地图
- 动态地图页可删除当前地图
- 删除后刷新首页、地图页、确认页都不再能读取该地图
- `public/mock/` 中对应 map 相关产物被清理干净
- 删除不会误删共享 `raw/events` 数据

### Phase 3：静态图输入约束收紧

**执行 Agent 可用 Skills**

- `executing-plans`
- `code-reviewer`
- `TRAE-debugger`

**范围**

- M2：顺序稳定
- M3：去时间
- M4：名称不可改写
- M5：AI 地标不出字
- 提示词集中迁移的主体部分

**建议改动面**

- `src/contracts/domain.ts`
- `src/engine/preprocess/part1.ts`
- `src/engine/renderers/route-markdown.ts`
- `src/engine/pipelines/generate-map.ts`
- `src/config/demo.ts`
- `src/engine/prompts/**`

**验收标准**

- event 数据具备稳定 `sequence`
- route 文档由固定模板生成，顺序与 `sequence` 一致
- 海报 prompt 不再包含 raw 时间
- 点位短名仅做机械压缩，不做语义改写
- AI 补充地标只作为背景视觉提示，不输出文字地标名

### Phase 4：风格参考图与图生图接入

**执行 Agent 可用 Skills**

- `executing-plans`
- `code-reviewer`
- `TRAE-debugger`

**范围**

- M6：风格例图接入生图链路
- M7（第二部分）：记录参考图与 prompt 版本闭环

**建议改动面**

- `src/engine/providers/ark-provider.ts`
- `src/engine/pipelines/generate-map.ts`
- `src/engine/prompts/styles/**`
- `src/contracts/domain.ts`
- `public/ui-static/styles/**` 或新的风格参考图目录

**验收标准**

- 每个风格都能绑定 1 张参考图
- 生成与重生成都能把参考图传入生图 adapter
- `runTrace` 可回溯到 `referenceIds/promptVersion/styleKey`
- 在相同风格下，多次生成的画风波动明显收敛

## 6. 阶段执行门禁

以下门禁是强制规则，不允许跳过。

### 6.1 阶段开始前

执行 Agent 在开始任一阶段的代码修改前（也就是用户允许Agent开始下一段时），必须先做以下动作：

1. `refresh memory`：重新读取 `context://memory/user_profile.md`、`project_memory.md` 以及最新 topic
2. 向用户报告：
   - 本阶段目标
   - 计划修改文件
   - 验收方式
   - 风险点
3. 明确向用户发起“是否开始当前阶段”的确认
4. 只有在用户明确批准后，才允许开始本阶段代码修改

### 6.2 阶段完成后

执行 Agent 在完成一个阶段后，必须先停下，不得直接进入下一阶段。必须执行：

1. 完成本阶段验证
2. 运行 `git status` 与 `git diff --stat`
3. 基于本阶段实际改动，向用户推荐 commit message
4. 向用户汇报本阶段结果并请求确认
5. 只有在用户批准并且完成 commit 之后，才允许推进到下一阶段

### 6.3 下一阶段开始前

在下一阶段真正开始改代码前，执行 Agent 必须再次执行：

1. `refresh memory`
2. 重新向用户确认下一阶段是否开始

禁止行为：

- 一个会话里连续跨两个阶段直接改代码
- 阶段 A 完成后，未确认、未 commit 就进入阶段 B
- 带着旧上下文直接开新阶段，不做 memory refresh

## 7. 非目标

- 本轮不处理飞书 Base/Drive 后端切换
- 不扩展到多城市数据源切换闭环
- 不在本轮引入新的正式数据库
- 不为追求视觉效果而伪造不存在的业务数据

## 8. 总体验收顺序

建议严格按以下顺序执行：

1. Phase 1：先把工作台输入和留痕做实
2. Phase 2：再做删除闭环，形成可逆操作的清理能力
3. Phase 3：收紧静态图生成输入 contract，解决误导性问题
4. Phase 4：最后接入参考图，优化风格稳定性

这个顺序的原因是：

- 前两阶段更独立、实现更轻、结果更易验证
- 第三阶段开始涉及 AI 生成 contract，修改面更大
- 第四阶段依赖前面链路稳定，否则难以判断风格问题来自哪里


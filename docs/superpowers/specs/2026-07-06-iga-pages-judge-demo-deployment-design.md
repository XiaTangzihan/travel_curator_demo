# IGA Pages 评委版上线设计：共享工作台、一次性收藏预装与代码发布解耦

## 1. 目标

* 将当前本地 Next.js Demo 改造成可部署到 IGA Pages 的评委版线上演示环境，并保留“共享工作台”体验。
* 在不引入账号体系与会话隔离的前提下，消除当前“运行时写本地文件”“请求返回后后台继续跑”“运行时产物依赖 `public/mock/**`”带来的上线风险。
* 首次上线时保留当前本地处于收藏状态的 5 个地图作为线上预装地图，用于评委直接浏览优质测试结果，节省实时生成消耗。
* 建立可落地的发布闭环：本地改动 -> 发布上线 -> 线上回测 -> 归因定位 -> 本地修复 -> 重新发布 -> 再次回测。
* 明确“代码发布”和“地图数据导入”是两条不同链路，避免普通 CI/CD 把本地运行态地图误同步到线上。

## 2. 非目标

* 本轮不引入评委账号、登录态、会话隔离或多租户数据空间。
* 本轮不把“本地收藏状态”作为长期 CI/CD 的数据同步机制；收藏扫描只用于首次预装操作。
* 本轮不要求所有预装收藏地图都具备视频文件；允许“有地图无视频”的预装结果存在。
* 本轮不在线同步 BAM / 飞书原始数据，不把 `lark-cli`、本机脚本链路搬到 IGA Pages 运行时。
* 本轮不构建专用 GitHub Actions 发布系统；代码发布优先依赖 IGA Pages 自身的 GitHub 集成能力。
* 本轮不扩大到高并发、抢占式队列、多评委强隔离或复杂运维告警体系。
* 本轮不额外重构业务契约 `route.md`、P1-P4 语义链条本身，除非持久化与部署稳定性要求必须触达。
* 本轮不把“后续手动上传地图”自动化成收藏扫描、视频筛选或批量同步规则；后续导图仅接受显式指定 `mapId`。

## 3. 已确认决策

* 线上评委版采用“共享工作台”模式：评委后续新生成的地图彼此可见。
* 本地开发阶段遗留的历史地图默认不进入线上首发环境。
* 首次上线时，执行一次性预装操作：动态扫描当前本地 `isFavorite=true` 的地图，将其导入线上作为首批预装地图。
* 当前本地收藏地图数量为 5；其中 3 个已有视频文件，2 个没有视频文件。该口径已被接受：允许“5 图中仅 3 图带视频”。
* 首次预装之后，线上数据与本地收藏状态脱钩；后续普通 CI/CD 不再扫描收藏状态。
* 后续若需要把本地地图上传到线上，由用户显式指定要导入的 `mapId`；与是否收藏、是否有视频没有必然关系。
* IGA Pages 是目标部署平台；第 0 步 `iga-pages` skill 已安装到 `C:\Users\Admin\.trae-cn\skills\iga-pages`。
* 当前本机尚未安装 `iga` CLI；执行部署前需安装 `@iga-pages/cli@latest`。
* 首次 IGA 账号登录与 GitHub 仓库授权都需要用户参与浏览器确认，不能假设 Agent 可完全静默完成。
* 发布主链采用“双轨并行”：
  * 首发与热修优先使用本地 `iga pages deploy`
  * 稳定后常规代码发布走 GitHub 集成的自动构建部署
* 普通 CI/CD 只负责发布代码、配置与环境变量，不负责同步本地地图数据，也不主动清空线上 shared runtime。
* 风险改造遵循最小化原则：保留 `demo-repository` 作为单一数据边界，优先替换存储与任务执行方式，而不是大规模重写业务层。

## 4. 当前代码现状

### 4.1 运行时地图、海报、路由、run 与视频产物仍写入本地 `public/mock/**`

* `src/server/utils/storage.ts` 当前将 `mockDir` 固定为 `process.cwd()/public/mock`，并通过 `writeJsonFile`、`writeTextFile`、`writeBinaryFile` 写入本地文件。
* 当前这套设计适合本地单机调试，但上线到托管运行时后，无法假设本地文件系统具备持久性、共享性与实例间一致性。
* `public/mock/**` 同时承担了“只读样本素材”和“运行态产物”两类职责，尚未完成 seed/runtime 拆分。

### 4.2 `demo-repository` 已是数据单一入口，但还没有存储分层

* `src/server/repositories/demo-repository.ts` 当前集中管理 `mapRecord`、`renderedMap`、`runTrace`、`route.md`、`knowledge`、`poster` 等读写。
* 首页 `app/page.tsx` 通过 `listMapRecords()` 直接读取全部地图记录，当前没有“本地开发历史”和“线上可见数据”之间的边界。
* 这为后续改造成“外部 runtime store + 本地 seed store”提供了良好切入点，但现阶段还未完成抽象。

### 4.3 首轮生成依赖 `setTimeout` 触发后台任务，重生成依赖单个长请求同步执行

* `src/engine/pipelines/generate-map.ts` 中，`startGenerateMapRun()` 先创建 run，再通过 `setTimeout(..., 0)` 异步触发 `executeGenerateMapRun()`。
* 同文件中的 `regenerateMapDraft()` 仍在一次请求中执行完整重生成流程。
* 这种模式在本地 Node 服务中通常可运行，但对 IGA Pages 这类托管环境而言，存在“响应返回后后台任务未必继续执行”“长请求超时或中断”的风险。

### 4.4 当前首页、收藏与视频筛选都直接读取地图记录字段

* `src/contracts/domain.ts` 中，`mapRecordSchema` 与 `mapViewModelSchema` 已包含 `isFavorite`、`videoPath`、`currentVideoRunId`、`videoDurationSeconds` 等字段。
* `app/page.tsx` 会读取 `listMapRecords()` 后的所有地图，并通过 `favorite`、`hasVideo` 等筛选条件控制展示。
* `src/features/profile/profile-home.tsx` 与 `src/features/dynamic-map/dynamic-map-page.tsx` 已支持收藏操作，说明“收藏”已是真实状态字段，不是纯前端展示状态。

### 4.5 当前本地数据中，“收藏地图”与“视频文件”并不完全对齐

* `public/mock/maps` 目录下共有 44 个文件，对应 22 组地图数据（每组至少包含 `<mapId>.json` 与 `<mapId>.view.json`）。
* 当前 `isFavorite=true` 的地图共有 5 组。
* `public/mock/videos` 目录下当前只有 3 个视频文件，与 5 个收藏地图并不一一对应。
* 这意味着“收藏扫描用于首发预装”必须允许“地图导入成功，但视频资源缺失”的结果。

### 4.6 当前前端对“无视频地图”已有基础容错，但发布链路还未显式承认这种数据形态

* `src/features/dynamic-map/dynamic-map-page.tsx` 通过 `Boolean(props.map.videoPath)` 判断是否已有视频。
* 当前前端更接近“视频可选能力”，而不是“地图必须配套视频”。
* 但部署设计与数据导入策略目前还没有把这一点写成显式规则。

### 4.7 IGA Pages 侧准备度仍停留在“Skill 已就绪、CLI 未安装、认证未完成”

* 本机 `Node` 与 `npm` 版本满足 IGA CLI 的最低要求。
* 仓库已有 GitHub remote：`origin https://github.com/XiaTangzihan/travel-curator-demo.git`。
* 但当前会话执行 `iga --version` / `iga whoami` 仍报 `command not found`，说明 CLI 尚未安装，且认证尚未建立。
* 因此，第 2 步“部署到 IGA Pages”虽然具备可行性，但仍需一个发布前 preflight 阶段来补齐 CLI、登录、link、env 等准备工作。

### 4.8 当前工作区存在其它进行中的本地改动与运行产物

* 当前 `git status` 显示存在未提交代码改动与新增运行产物。
* 这意味着执行部署改造与首发上线前，必须明确采用独立分支或清晰的提交边界，避免把无关本地改动混入评委版发布链路。

## 5. 本轮范围总表

| ID | 优化项 | 目标状态 | 高层方案 |
| --- | --- | --- | --- |
| DEP-1 | Seed / Runtime 存储拆分 | 共享素材继续本地只读；运行态地图、海报、route、run、视频迁至外部 runtime store | 保留 `demo-repository` 边界，新增存储适配层与 runtime namespace |
| DEP-2 | 生成 / 重生成 durable 化 | 不再依赖 `setTimeout` 后台任务和单个长请求；run 可恢复、可轮询、可推进 | 引入 `run state machine + drive API` |
| DEP-3 | 首发预装操作 | 首发前可一次性扫描当前本地收藏地图并导入线上；允许缺视频 | 新增手动执行的 bootstrap 脚本，默认 dry-run，显式 apply |
| DEP-4 | 后续手动导图 | 之后若需上传本地地图，只接受显式 `mapId` 列表 | 新增手动 import 脚本，与 `favorite` / `hasVideo` 解耦 |
| DEP-5 | IGA 发布预检与上线 | 能完成 CLI 安装、账号登录、Pages 项目 link、env 注入与首发发布 | 使用 `iga-pages` Skill / CLI 执行 preflight + deploy |
| DEP-6 | 代码发布与数据导入解耦 | 普通 CI/CD 只发代码；不自动覆盖线上地图数据 | 以 GitHub 集成做代码发布，以手动运维脚本做数据导入 |
| DEP-7 | 线上回测与归因闭环 | 发布后可快速判断是代码、环境还是数据问题，并形成重发路径 | 固化 smoke checklist、部署记录采集与热修回路 |

## 6. 分阶段计划

### Phase 1：Seed / Runtime 存储拆分

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 将 `public/mock/**` 中的职责拆分为：
  * 本地只读 seed：`raw / events / files/comments`
  * 线上共享 runtime：`maps / routes / runs / posters / videos / knowledge`
* 为 runtime 产物新增外部存储适配层，禁止继续把运行态写入本地 `public/mock/**`
* 保留 `demo-repository` 作为唯一数据访问入口，避免业务层直接感知底层存储差异

**建议改动面**
* `src/server/utils/storage.ts`
* `src/server/repositories/demo-repository.ts`
* `src/contracts/domain.ts`
* `src/engine/pipelines/generate-map.ts`
* 新增 `src/server/runtime-storage/*` 或等价目录
* `tests/unit/demo-repository.test.ts`

**验收标准**
* `getRawDataset()`、`getEventsDataset()`、评论图片等共享素材仍可继续本地读取
* `mapRecord`、`renderedMap`、`runTrace`、`route.md`、`knowledge`、`poster`、`video` 不再依赖本地 `public/mock/**` 持久化
* 首页与地图详情页仍通过 `demo-repository` 读数据，不引入第二套绕开仓储层的访问口径

**风险提示**
* 这是部署改造的地基阶段，影响所有运行态产物路径
* 若不先完成该阶段，后续 IGA 首发与 shared runtime 都无法稳定成立

### Phase 2：Generate / Regenerate 的 Durable Run 状态机

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`
* `TRAE-debugger`

**范围**
* 将首轮生成从“返回后后台跑”改成“创建 run 后由 drive API 显式推进”
* 将重生成从“单次长请求同步完成”改成与首轮生成共享同一套 run 生命周期
* 为 run 增加最小必要的 lease / progressing 标记，避免重复推进
* 生成页与重生成后的等待页统一走“轮询 run + 驱动推进”模型

**建议改动面**
* `src/engine/pipelines/generate-map.ts`
* `app/api/maps/generate/route.ts`
* `app/api/maps/[mapId]/regenerate/route.ts`
* `app/api/runs/[runId]/route.ts`
* 新增 `app/api/runs/[runId]/drive/route.ts`
* `src/features/generating/generating-page.tsx`
* `src/features/confirm/confirm-page.tsx`
* `tests/unit/*run*`

**验收标准**
* 首轮生成不再使用 `setTimeout(..., 0)` 触发后台执行
* 重生成不再依赖单个长请求完整跑完
* 页面刷新后，run 仍可继续查询与推进，不因单次请求结束而丢状态
* 生成与重生成共享一致的 `run.status / stage / progressStep` 语义

**风险提示**
* 该阶段直接影响主链路 happy path，是本轮最需要单独隔离验证的改动之一
* 若 drive 机制与 lease 设计不严谨，可能出现 run 重复执行或状态错位

### Phase 3：首发预装与后续手动导图工具

**执行 Agent 可用 Skills**
* `executing-plans`
* `code-reviewer`

**范围**
* 实现一次性 bootstrap 脚本：动态扫描当前本地 `isFavorite=true` 的地图，并导入首发预装集
* 实现后续手动导图脚本：只根据显式输入的 `mapId` 列表导入地图
* 两条脚本链路都允许“视频缺失则跳过视频导入，不影响地图导入”
* 输出导入报告，便于用户在实际写入前确认导入集

**建议改动面**
* 新增 `scripts/bootstrap-favorite-preload.ts`
* 新增 `scripts/import-curated-maps.ts`
* `src/server/repositories/demo-repository.ts`
* `src/contracts/domain.ts`
* 如需 UI 容错补强，则触达：
  * `src/features/profile/profile-home.tsx`
  * `src/features/dynamic-map/dynamic-map-page.tsx`

**验收标准**
* `bootstrap-favorite-preload` 在 dry-run 模式下能准确列出本地 5 个收藏地图
* 其中缺失视频的地图不会导致整个预装操作失败
* `import-curated-maps` 只导入用户显式指定的 `mapId`
* 两个脚本都不会默认删除线上已有 shared runtime 数据
* 首发预装与后续手动导图都不要求依赖 `favorite` 或 `hasVideo` 作为长期规则

**风险提示**
* 该阶段涉及真实数据导入，必须默认 dry-run，防止误传或漏传
* 不能把一次性收藏扫描误做成长期自动同步机制，否则会污染后续 CI/CD 认知边界

### Phase 4：IGA Pages 发布预检与首发上线

**执行 Agent 可用 Skills**
* `iga-pages`
* `executing-plans`

**范围**
* 安装并验证 `@iga-pages/cli@latest`
* 通过 `iga whoami` 检查认证状态，必要时由用户完成浏览器登录
* 对当前仓库执行 `iga pages link`
* 通过 `iga pages env add/update` 配置评委版所需环境变量
* 首发发布走本地 `iga pages deploy`
* 首发前执行一次 `bootstrap-favorite-preload --apply`

**建议改动面**
* 发布流程主要触达 CLI 与运维脚本
* 如需补充发布说明文档，可新增：
  * `docs/superpowers/specs/release-notes/*`
  * 或 `docs/operations/*`

**验收标准**
* `iga --version` 可用且版本满足 Skill 要求
* `iga whoami` 能返回有效身份，或在用户登录后恢复可用
* 项目目录已成功 `link` 到 IGA Pages 项目
* 首发部署成功返回可访问的线上地址
* 首发后的首页只出现：
  * 一次性预装的 5 个收藏地图
  * 以及之后线上共享工作台新生成的地图
* 本地其它开发历史地图不会出现在首发线上环境中

**风险提示**
* 该阶段有人机协作依赖：首次登录与 GitHub 授权无法完全静默完成
* 若首发前未完成数据裁剪 / 预装边界确认，可能把本地历史运行态一并暴露到线上

### Phase 5：代码发布、线上回测与热修闭环

**执行 Agent 可用 Skills**
* `iga-pages`
* `executing-plans`
* `code-reviewer`

**范围**
* 建立“双轨并行”的发布闭环：
  * 首发 / 热修：本地 `iga pages deploy`
  * 稳定后常规代码发布：GitHub push -> IGA Pages 自动构建部署
* 建立线上 smoke checklist
* 固化“线上回退归因 -> 本地修复 -> 重新发布 -> 再回测”的操作顺序

**建议改动面**
* `README` / 运维文档 / 发布说明
* 如需脚本化 smoke，可新增：
  * `scripts/smoke-judge-demo.ts`

**验收标准**
* 普通代码发布不再自动上传本地地图数据
* 线上问题出现时，可明确定位到：
  * 代码回退
  * 环境变量缺失
  * 运行态存储异常
  * 首发预装或手动导图操作异常
* 发布后至少完成以下 smoke：
  * 首页打开正常
  * 预装 5 图可见
  * 缺视频地图不报错
  * 新生成地图可进入 shared runtime
  * 生成 -> 重生成 -> 切版本 -> 确认链路无能力回退

**风险提示**
* 若把“代码发布”和“数据导入”重新混成一条链路，会直接破坏本轮已经确认的数据策略
* 若缺少 smoke 与部署记录留痕，线上回退将很难判断是代码问题还是数据问题

## 7. 阶段执行门禁

### 7.1 阶段开始前

1. refresh memory，重新读取项目约束、近期 topic 与本 Spec。
2. 向用户汇报：
   * 当前 Phase 的目标
   * 计划改动文件
   * 验收方式
   * 风险点
3. 请求用户确认是否开始本阶段。
4. 未得到明确批准前，不进入编码或真实发布操作。

### 7.2 阶段完成后

1. 完成本阶段验证，不得跳过。
2. 运行 `git status` 与 `git diff --stat`，输出改动概览。
3. 推荐 commit message，遵循“首部英文 + 主体中文”格式。
4. 向用户汇报阶段结果与风险余项，请求确认。
5. 未得到确认前，不直接进入下一阶段。

### 7.3 下一阶段开始前

1. 再次 refresh memory，避免沿用过期假设。
2. 汇报下一阶段与上一阶段的依赖关系。
3. 请求是否继续。
4. 只有在用户明确批准后，才允许继续下一阶段。

## 8. 总体验收顺序

1. **先验存储，再验任务**  
   只有先完成 seed/runtime 拆分，后续 run durable 化与线上 shared runtime 才有稳定存储基础。

2. **先验生成链路，再验首发预装**  
   若生成主链本身不稳，首发预装只是把本地旧数据搬上去，无法证明线上演示链路成立。

3. **先验首发预装，再验 IGA 首发**  
   首发线上环境必须先确定“带哪些历史地图、不带哪些地图”，否则一旦部署成功，错误数据已对评委可见。

4. **先验本地直推，再验 GitHub 代码发布**  
   本地 `iga pages deploy` 更利于首发排障；待线上链路跑通，再切换到 GitHub 集成承担日常代码发布。

5. **最后验回测与归因闭环**  
   只有完成一轮“线上发现问题 -> 本地修复 -> 重新发布 -> 再回测”，这套部署体系才算真正可用。

## 9. 方案选型

### 方案 A：继续沿用 `public/mock/**`，首发时整体带上本地地图目录

**结论**
* 不选。

**原因**
* 会直接暴露本地开发历史地图，违背当前已确认的数据边界。
* 运行态仍依赖本地文件系统，无法解决 IGA Pages 上的持久化与共享风险。
* 普通代码发布与地图数据发布继续耦合，后续会反复污染线上 shared runtime。

### 方案 B：Seed / Runtime 拆分 + 一次性收藏预装 + 后续手动导图 + 代码发布解耦

**结论**
* 选用此方案。

**原因**
* 与当前用户认知完全一致：
  * 首发时“线下收藏 == 线上预装”
  * 后续普通 CI/CD 不处理地图数据
  * 之后若要上传本地地图，由用户显式点名
* 改动集中在存储边界、任务 durable 化和少量运维脚本，符合最小化原则。
* 能同时满足“评委可直接看优质样例”和“线上 shared runtime 后续继续演化”两个目标。

### 方案 C：上线即引入评委隔离 / 会话空间 / 多租户工作台

**结论**
* 不选。

**原因**
* 复杂度明显超出本轮 Demo 上线目标。
* 会引入用户态、权限、数据隔离、前端路由与运维复杂度，破坏“共享工作台”的已确认产品结论。
* 对“先稳定给评委演示”的边际收益过低。

## 10. 目标设计

### 10.1 数据平面拆分

本轮明确区分三类数据：

1. **Seed Shared Readonly**
   * 含 `raw`、`events`、评论图片等共享样本
   * 由仓库携带，可在本地和线上作为只读素材使用

2. **Runtime Shared Writable**
   * 含地图记录、视图模型、run、route、knowledge、海报、视频等运行态产物
   * 线上为共享工作台数据面，评委新生成的地图进入此空间
   * 不得继续依赖本地 `public/mock/**`

3. **Bootstrap / Manual Import Input**
   * 首发预装：动态扫描当前本地收藏地图
   * 后续导图：显式输入的 `mapId` 列表
   * 这两类输入都只是“导入来源”，不是长期运行态规则

### 10.2 运行态存储边界

* `demo-repository` 继续作为唯一读写边界。
* Repository 内部根据数据类型路由到：
  * 本地只读 seed
  * 外部共享 runtime
* `posterPath`、`videoPath` 等面向前端的字段，不再假设是 `/mock/...` 这种本地静态路径，而应允许为远程对象 URL 或运行态可访问地址。
* 地图详情、首页、确认页、run 查询页都只消费 Repository 返回的数据，不直接拼本地路径。

### 10.3 Generate / Regenerate / Confirm 的线上执行方式

* `POST /api/maps/generate`
  * 只负责创建 run 记录并返回 waitPath / runId
* `POST /api/runs/[runId]/drive`
  * 负责推进 run 状态机
  * 每次只推进一个安全阶段，写回持久化状态
* `GET /api/runs/[runId]`
  * 负责查询当前 run 状态
* `POST /api/maps/[mapId]/regenerate`
  * 与首轮生成共享同样的 run 模型，而不是单个长请求直接完成
* `POST /api/maps/[mapId]/confirm`
  * 继续保留当前多版本定稿逻辑，但定稿后的产物写入 runtime store

这样设计后，托管环境只需要保证“请求可重复驱动 run”，而不需要保证“请求返回后后台任务继续存在”。

### 10.4 首发预装操作

首发预装是一个单独、一次性的人工运维操作：

1. 在本地扫描所有 `mapRecord.isFavorite === true` 的地图。
2. 生成 dry-run 报告：
   * 将导入哪些 `mapId`
   * 每个地图是否有 `poster`
   * 是否有 `video`
   * 是否存在缺失的 route / knowledge / view / run 产物
3. 用户确认报告后，执行 `--apply`。
4. 将这批地图导入到线上 runtime store，作为首发预装地图。

该操作的成立边界：

* 只在首发前执行一次
* 只对当前本地收藏状态负责
* 不写入长期 CI/CD 规则
* 视频缺失不阻断地图导入

### 10.5 后续手动导图

后续如需补传本地地图，采用另一条独立链路：

* 输入是用户显式指定的 `mapId[]`
* 脚本只尝试导入这些地图及其关联产物
* 是否收藏、是否有视频不参与筛选
* 不会自动删除线上已有地图
* 导入前仍应提供 dry-run 报告

这保证了未来你对线上展示内容拥有“点名式控制”，而不是再次被本地收藏状态绑架。

### 10.6 IGA 发布模式

发布模式拆为两条：

1. **首发 / 热修**
   * 本地使用 `iga pages deploy`
   * 适合快速定位线上能力回退

2. **日常代码发布**
   * 通过 GitHub remote 与 IGA Pages 建立代码集成
   * push 后触发自动构建部署
   * 只发布代码、配置、环境变量
   * 不自动携带本地地图数据

部署前置动作固定为：

1. 安装 CLI
2. `iga whoami`
3. 如失败则登录
4. `iga pages link`
5. 配置 env
6. 执行部署

### 10.7 线上回测与归因闭环

每次发布后至少执行以下 smoke：

* 首页打开正常
* 预装 5 图可见
* 2 个无视频预装地图不会报错
* 3 个已有视频的预装地图可正常播放或下载
* 新建地图可完成 generate -> regenerate -> 切版本 -> confirm
* 新生成地图会进入 shared runtime，其他评委可见

若线上能力回退，按以下顺序归因：

1. 先看 IGA 部署记录，定位是哪次发布引入问题
2. 再区分是：
   * 代码问题
   * 环境变量问题
   * runtime 存储问题
   * 首发预装 / 手动导图问题
3. 本地修复后：
   * 热修场景继续本地直推
   * 常规场景走 GitHub 代码发布
4. 发布后再次执行同一套 smoke checklist

### 10.8 数据安全与失败处理

* 普通代码发布默认不删除线上 shared runtime 数据。
* 首发预装与后续手动导图都必须默认 dry-run。
* 视频缺失只记录 warning，不升级为整体失败。
* 若地图核心产物缺失（如缺 `mapRecord` 或 `poster`），则该 `mapId` 导入失败并出现在报告中，不得静默跳过。
* 任何真实写入前，都要给出导入摘要，确保用户知道“本次会上传哪些地图，不会上传哪些地图”。

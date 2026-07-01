# 规则：Commit 自动建议

## 触发时机
每当智能体已经完成以下任意操作时触发：（代码变化后触发）
- 代码文件的新增、修改、删除
- 文档文件（README、API文档、设计文档等）的新增、修改、删除
- 配置文件（.env、config、package.json等）的修改
- 任何导致 `git status` 出现未暂存更改的操作

## 执行流程
1. 首先执行 `git status` 和 `git diff --stat` 获取更改概览
然后评估更改内容的类型、范围和影响程度，结合现在对话的上下文判断本轮任务属于（告一段落/任务进行中/微调/测试/文档升级/其他），然后评估是否需要commit。加入评估结果为“需要”，则继续执行以下步骤。否则，中止commit自动建议。
2. 分析更改内容，按以下维度分类：
   - **type**: feat(新功能) | fix(修复) | docs(文档) | style(格式) | refactor(重构) | test(测试) | chore(构建/工具)
   - **scope**: 受影响的模块或文件范围
   - **impact**: 变更影响程度 (low | medium | high)
3. 生成 commit message，格式遵循：
   ```
   <type>(<scope>): <简短描述>

   - 详细说明变更内容
   - 说明变更理由/动机
   - 如有破坏性变更，明确标注 BREAKING CHANGE
   ```
4. 向用户展示建议的 commit message 和理由
5. 询问用户是否执行 commit，或提供修改建议

## 禁止行为
- 不要在包含 `console.log`、`debugger`、临时注释的代码上建议 commit
- 不要建议包含敏感信息（API Key、密码、token）的 commit
- 不要在测试未通过时建议 commit（如项目有测试套件）
- 所有建议必须以用户确认后执行，不得擅自运行 git commit 命令

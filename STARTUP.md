# 本地启动说明

## 适用项目

- 框架：Next.js 16
- 包管理：npm
- 固定访问地址：`http://localhost:3001`

## 启动前检查

1. 确认已安装 Node.js 与 npm。
2. 确认项目根目录存在 `.env.local`。
3. 如首次启动或依赖缺失，先执行：

```bash
npm install
```

## 固定启动命令

本项目本地开发服务器统一使用以下命令，地址写死为 `localhost:3001`：

```bash
npm run dev -- --hostname localhost --port 3001
```

启动成功后，应访问：

```text
http://localhost:3001
```

## 启动成功标志

终端出现 `Ready`、`Local: http://localhost:3001` 或等价提示，即表示启动成功。

## 失败时自检顺序

1. 检查 `.env.local` 是否存在且已填写项目所需环境变量。
2. 检查 `node_modules` 是否完整；如不完整，重新执行 `npm install`。
3. 检查 `3001` 端口是否被其他进程占用。此项目本地启动地址固定为 `localhost:3001`，不要改用其他端口。
4. 检查启动命令是否仍为：

```bash
npm run dev -- --hostname localhost --port 3001
```

5. 若以上均正确但仍失败，再检查项目配置与代码问题。

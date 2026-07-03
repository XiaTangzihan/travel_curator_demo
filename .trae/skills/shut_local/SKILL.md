---
name: "shut_local"
description: "Stops running localhost development servers. Invoke when the user asks to close localhost, stop local testing, or shut down local dev servers; if multiple servers exist, inspect and ask before stopping."
---

# Shut Local

用于关闭本地正在运行的 localhost 开发服务器，是 `start_local` 的反向技能。

## 触发条件

当用户提到以下意图时使用：

- 关闭 localhost
- 停止本地测试
- 关闭本地运行项目
- 关闭本地开发服务器
- 停掉本地端口 / 停掉本地服务

## 核心原则

1. 先检测，再关闭。
2. 如果只检测到一个 localhost Web 服务，直接关闭，不再二次确认。
3. 如果检测到多个 localhost Web 服务，必须先向人汇报：
   - URL
   - 端口
   - PID / 进程名
   - 该 URL 的页面内容概括
4. 多实例场景下，必须等用户明确批准后，才关闭指定实例或全部实例。
5. 关闭后必须复检，确认端口不再监听。

## 执行流程

### 第一步：优先读取 `STARTUP.md`

如果项目根目录存在 `STARTUP.md`，先读取其中声明的固定 localhost 地址或端口，把这些地址作为第一优先级探测目标。

目标：

- 与 `start_local` 的约定保持对称
- 优先命中当前项目真正的开发服务器

### 第二步：检测 localhost Web 服务

在 Windows PowerShell 中，优先使用本地 TCP 监听信息找候选端口，再用 HTTP 探测确认是否真的是 Web 服务。

参考命令：

```powershell
$listeners = Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalAddress -in @('127.0.0.1', '::1', '0.0.0.0', '::') } |
  Select-Object LocalAddress, LocalPort, OwningProcess -Unique
```

为每个候选端口补充进程信息：

```powershell
$candidates = $listeners | ForEach-Object {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" | Select-Object -First 1
  [pscustomobject]@{
    Port = $_.LocalPort
    Pid = $_.OwningProcess
    ProcessName = $proc.Name
    CommandLine = $proc.CommandLine
    Url = "http://localhost:$($_.LocalPort)"
  }
}
```

然后逐个探测：

```powershell
try {
  $resp = Invoke-WebRequest -Uri $url -TimeoutSec 2
} catch {
  $resp = $null
}
```

只把能成功返回 HTTP 内容的目标视为“可关闭的 localhost Web 服务”。

说明：

- 仅监听端口但无法作为网页访问的进程，不纳入本技能的关闭列表。
- 如果 `STARTUP.md` 提供了固定 URL，即使扫描结果很多，也优先把该 URL 放在结果顶部。

### 第三步：区分单实例与多实例

#### 情况 A：没有检测到任何 localhost Web 服务

直接汇报：

```text
未检测到正在运行的 localhost Web 服务，无需关闭。
```

#### 情况 B：只检测到一个 localhost Web 服务

直接关闭其对应进程：

```powershell
Stop-Process -Id <PID> -Force
```

关闭后复检：

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.OwningProcess -eq <PID> -or $_.LocalPort -eq <PORT> }
```

如果复检无结果，则汇报关闭成功。

#### 情况 C：检测到多个 localhost Web 服务

必须先整理结果并汇报给用户，不得直接关闭。

每个 URL 下方都要给出页面概括，格式建议如下：

```text
检测到多个 localhost 服务：

1. http://localhost:3001
   - Port: 3001
   - PID: 12345 (node.exe)
   - 内容概括：旅行策展人 demo 首页，主要是地图工作台和运行结果入口。

2. http://localhost:5173
   - Port: 5173
   - PID: 45678 (node.exe)
   - 内容概括：Vite 开发页，包含默认欢迎信息或当前前端调试页面。
```

随后询问用户：

- 关闭指定编号
- 关闭全部
- 暂不关闭

只有得到明确批准后，才能执行关闭。

## 页面概括规则

优先级从高到低：

1. 如果有浏览器工具，可打开 URL 并根据页面可见内容概括。
2. 如果没有浏览器工具，使用 `Invoke-WebRequest` 返回的 HTML 提取：
   - `<title>`
   - 第一个 `<h1>`
   - 首屏正文前 80-120 个字符
3. 如果页面内容无法可靠提取，退化为：
   - 进程命令行
   - 框架特征（如 Next.js / Vite）
   - “无法自动提取页面正文”

概括要求：

- 1 句话即可
- 以“这个页面大概是什么”作为目标
- 不要原样粘贴大段 HTML

## 多 URL 共用同一 PID 的处理

如果多个 URL 实际属于同一个 PID，必须在汇报中明确提示：

```text
注意：编号 1 和 2 由同一个 PID 提供服务。关闭其中任意一个，实际都会一起停止。
```

在这种情况下，用户选择关闭某一个 URL，等价于关闭该 PID 对应的全部 URL。

## 输出格式

### 单实例自动关闭成功

```text
已关闭 localhost 服务
- URL: http://localhost:3001
- Port: 3001
- PID: 12345 (node.exe)
- 结果: 端口已释放
```

### 多实例待确认

```text
检测到多个 localhost 服务，暂未执行关闭：

1. http://localhost:3001
   - Port: 3001
   - PID: 12345 (node.exe)
   - 内容概括：旅行策展人 demo 首页，包含地图生成和结果查看入口。

2. http://localhost:5173
   - Port: 5173
   - PID: 45678 (node.exe)
   - 内容概括：前端开发调试页。

请指定要关闭的编号，或回复“全部关闭”。
```

### 关闭后复检失败

```text
已执行关闭命令，但复检发现端口仍在监听：
- URL: http://localhost:3001
- Port: 3001
- PID: 12345

需要进一步检查是否存在子进程拉起、守护进程重启或端口复用。
```

## 注意事项

1. 本技能默认只处理 localhost Web 服务，不处理数据库、缓存、队列等非网页本地端口。
2. 多实例场景必须先汇报后关闭，不能跳过人工确认。
3. 关闭动作使用命令行完成，不要求关闭浏览器标签页。
4. 如果当前仓库的 `STARTUP.md` 指定了固定端口，应优先识别并展示该端口对应的服务。

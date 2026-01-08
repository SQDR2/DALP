# Dual-Agent Loop Protocol (DALP) 工具链

这是一个基于 Node.js、Fastify 和 SSE (Server-Sent Events) 的双 Agent 协作协议工具链。它旨在协调两个独立的 IDEA 实例（Agent A 和 Agent B）进行高效的协作开发。

## 核心功能

- **状态管理**: 维护全局的 `turn` (轮次) 和 `context` (上下文)。
- **高效通信**: 使用 SSE 实现长连接，避免轮询。
- **工具集**: 提供 `await_my_turn` 和 `handover_work` 两个核心 MCP 工具。
- **启动器**: 自动化启动两个 IDEA 实例并注入配置。

## 快速开始

### 1. 环境准备

- Node.js v20+
- IntelliJ IDEA (或其他 JetBrains IDE)
- MCP 兼容的插件 (如 Cline, Codeium 等)

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动，SSE 端点为 `http://localhost:3000/sse`。

### 5. 打包与独立运行 (可选)

如果你希望在没有 Node.js 环境的机器上运行，可以将项目打包为独立可执行文件。

**构建可执行文件**:

```bash
npm run package
```

构建完成后，`bin/` 目录下会生成适用于 Linux 和 Windows 的可执行文件：

- `bin/dual-agent-mcp-linux`
- `bin/dual-agent-mcp-win.exe`

**运行**:

直接运行生成的可执行文件即可启动服务器，无需安装任何依赖。

### 6. 启动 Agent (可选)

你可以使用内置的启动脚本来启动两个 IDEA 实例。请先配置环境变量或修改 `src/launcher.ts` 中的路径。

```bash
# 设置环境变量 (示例)
export IDEA_A_PATH="/usr/bin/idea"
export PROJECT_A_PATH="/path/to/project_a"
export IDEA_B_PATH="/usr/bin/idea"
export PROJECT_B_PATH="/path/to/project_b"

# 运行启动器
npx tsx src/launcher.ts
```

## Agent 配置与使用指南

本系统依赖两个 Agent 协同工作：**Agent A (Leader)** 和 **Agent B (Worker)**。你需要分别在两个 IDE 窗口中配置它们。

### Agent A (领导者/发起人)

**角色定义**:
Agent A 是系统的领导者。它负责接收用户需求，进行高层设计，将具体任务分配给 Agent B，并验收 Agent B 的工作成果。

**初始化步骤**:

1. 打开 Agent A 的 IDE 窗口。
2. 在 MCP Client (如 Cline) 中输入以下 **Prompt Template** 进行初始化。

**Prompt Template (Agent A)**:

```markdown
# 角色：Agent A (领导者/发起人)

你是 Agent A，双 Agent 循环协议 (DALP) 系统中的 **领导者 (Leader)**。
你的目标是发起任务，执行高层设计或初步实现，然后将工作移交给 Agent B (执行者)。

## 工具

你可以使用以下 MCP 工具：

1. `await_my_turn(agent_id="A")`: 调用此工具以等待轮到你。
2. `handover_work(current_agent_id="A", work_summary="...", next_instruction="...", is_task_complete=boolean)`: 调用此工具将控制权移交给 Agent B。

## 工作流程

1. **开始**: 当你收到用户需求时，进行分析。
2. **工作**: 执行必要的操作（编码、规划等）。
3. **移交**: 当你需要 Agent B 协助（例如：实现细节、编写测试、审查代码）时，调用 `handover_work`。
   - 提供清晰的 `work_summary`（工作总结），说明你做了什么。
   - 提供具体的 `next_instruction`（下一步指令）给 Agent B。
4. **等待**: 移交后，立即调用 `await_my_turn("A")` 等待 Agent B 的响应。
5. **恢复**: 当 `await_my_turn` 返回时，检查 `previous_context` 以了解 Agent B 做了什么。
6. **结束**: 如果任务已完全完成，调用 `handover_work` 并设置 `is_task_complete=true`。

## 初始提示词

"我是 Agent A。我已准备就绪。我将等待用户输入或开始循环。"
```

### Agent B (执行者/跟随者)

**角色定义**:
Agent B 是系统的执行者。它负责等待 Agent A 的指令，执行具体的编码、测试任务，并将结果反馈给 Agent A。

**初始化步骤**:

1. 打开 Agent B 的 IDE 窗口。
2. 在 MCP Client (如 Cline) 中输入以下 **Prompt Template** 进行初始化。

**Prompt Template (Agent B)**:

```markdown
# 角色：Agent B (执行者/跟随者)

你是 Agent B，双 Agent 循环协议 (DALP) 系统中的 **执行者 (Worker)**。
你的目标是协助 Agent A，执行特定任务、实现细节、编写测试或审查代码。

## 工具

你可以使用以下 MCP 工具：

1. `await_my_turn(agent_id="B")`: 调用此工具以等待轮到你。
2. `handover_work(current_agent_id="B", work_summary="...", next_instruction="...", is_task_complete=boolean)`: 调用此工具将控制权交回给 Agent A。

## 工作流程

1. **开始**: 你从等待状态开始。立即调用 `await_my_turn("B")`。
2. **恢复**: 当 `await_my_turn` 返回时，读取 `previous_context` 以了解 Agent A 希望你做什么。
3. **工作**: 执行请求的任务。
4. **移交**: 完成后，调用 `handover_work`。
   - 提供 `work_summary`（工作总结），说明你做了什么。
   - 提供 `next_instruction`（下一步指令）给 Agent A（通常是“请审查我的工作”或“继续下一步”）。
5. **循环**: 立即再次调用 `await_my_turn("B")` 等待下一条指令。
6. **停止**: 如果 `await_my_turn` 返回 `is_finished=true`，则停止工作。

## 初始提示词

"我是 Agent B。我正在初始化，并将立即调用 `await_my_turn` 等待 Agent A。"
```

## 协作流程示例

以下是一个典型的协作场景：**用户要求实现一个“用户登录”功能**。

### 1. 用户输入 (给 Agent A)

用户在 Agent A 的窗口输入：

> "请帮我实现一个用户登录接口，包含用户名和密码验证。"

### 2. Agent A 规划与分配

Agent A 分析需求，决定先定义接口规范，然后让 Agent B 实现具体逻辑。
Agent A 调用 `handover_work`:

- `work_summary`: "我已经创建了 `LoginRequest` 和 `LoginResponse` 的 DTO 定义。"
- `next_instruction`: "请在 `UserService` 中实现 `login` 方法，验证用户名密码（暂时使用硬编码 mock），并编写单元测试。"

### 3. Agent B 执行

Agent B (原本在 `await_my_turn` 阻塞中) 收到唤醒。
Agent B 读取指令，编写代码和测试。
Agent B 完成后调用 `handover_work`:

- `work_summary`: "已实现 `UserService.login` 并添加了 `UserServiceTest`，测试通过。"
- `next_instruction`: "请审查代码并决定下一步。"

### 4. Agent A 验收

Agent A (收到唤醒) 审查代码。
如果满意，Agent A 可以结束任务或继续下一步（如集成数据库）。
Agent A 调用 `handover_work` (结束任务):

- `is_task_complete`: `true`
- `work_summary`: "登录功能已实现并验证通过。"

## MCP Client 配置指南

为了让两个 Agent 共享状态，**必须**使用 SSE (Server-Sent Events) 模式连接到同一个服务器实例。

### 1. 启动服务器

在终端中执行以下命令：

```bash
# 1. 安装依赖
npm install

# 2. 编译 TypeScript 代码
npm run build

# 3. 启动 MCP Server (保持此终端开启)
npm start
```

- Server 将运行在 `http://localhost:3000`
- SSE 端点为 `http://localhost:3000/sse`

### 2. 配置 MCP Client (以 Cline 为例)

**注意：Agent A (Planner) 和 Agent B (Executor) 使用完全相同的 MCP 配置。**

你需要确保两个 Agent (通常是两个独立的 IDE 窗口) 都连接到同一个 MCP Server。

1.  在 VS Code 中打开 MCP 配置文件 (通常位于 `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/mcpSettings.json` 或通过插件界面打开)。
2.  添加 `dalp-sse` 配置：

```json
{
  "mcpServers": {
    "dalp-sse": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

> **重要**: 请勿使用 `command` (stdio) 模式启动 server，因为那样会创建独立的进程，导致 Agent A 和 Agent B 无法共享状态。

### 3. 区分 Agent A 和 Agent B

虽然 MCP 配置相同，但你需要通过**提示词 (Prompt)** 来区分两个 Agent 的角色：

- **Agent A (Planner)**: 在初始化时，使用 [Agent A Prompt Template](#agent-a-领导者发起人) 告知它是 Agent A。
- **Agent B (Executor)**: 在初始化时，使用 [Agent B Prompt Template](#agent-b-执行者跟随者) 告知它是 Agent B。

### 4. 验证连接

1.  确保服务器已启动 (`npm start`)。
2.  在 MCP Client 中刷新或重连。
3.  如果连接成功，你应该能在 `http://localhost:3000` 的 Dashboard 中看到连接日志，或者在终端看到 "New SSE connection request"。

### 3. 查看协作对话 (监控)

Agent A 和 Agent B 之间的“对话”实际上是通过 Server 进行的状态传递。你可以通过以下三种方式查看：

1.  **Web Dashboard (推荐)**:

    - 访问 **`http://localhost:3000`**。
    - 这是一个实时的 Web 界面，会自动刷新并展示所有的交互记录。

2.  **Server 终端日志**:

    - 在运行 `npm start` 的终端中，你会看到实时的日志输出。

3.  **Agent 聊天界面**:
    - 工具的输出结果中会包含对方的 `work_summary` 和 `next_instruction`。

## 目录结构

```text
dual-agent-mcp/
├── src/
│   ├── index.ts          # 服务器入口 (Fastify + SSE + API)
│   ├── state.ts          # 状态机逻辑 (含历史记录)
│   ├── tools.ts          # MCP 工具定义
│   └── launcher.ts       # 启动脚本
├── public/
│   └── index.html        # Web Dashboard 前端页面
├── prompts/              # Agent 提示词模板 (已合并至 README)
├── package.json
└── tsconfig.json
```

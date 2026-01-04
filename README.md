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

### 5. 启动 Agent (可选)

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

## Agent 配置指南

在两个 IDEA 实例中，你需要配置 MCP Client 连接到本服务器。

- **Server URL**: `http://localhost:3000/sse`

### Agent A (发起者)

**注意**: `prompts/agent_a_prompt.md` 只是一个**提示词模板文件**。

1.  打开该文件，**复制全部内容**。
2.  在 Agent A 的聊天窗口（或 System Prompt 设置）中**粘贴**并发送。

**职责**:

- 接收用户需求。
- 进行初步规划和设计。
- 将具体任务移交给 Agent B。
- 验收 Agent B 的工作。

### Agent B (协作者)

**注意**: `prompts/agent_b_prompt.md` 只是一个**提示词模板文件**。

1.  打开该文件，**复制全部内容**。
2.  在 Agent B 的聊天窗口（或 System Prompt 设置）中**粘贴**并发送。

**职责**:

- 等待 Agent A 的指令。
- 执行具体编码任务。
- 编写测试。
- 将结果反馈给 Agent A。

## 开发与调试

- **开发模式**: `npm run dev` (使用 `tsx watch` 自动重启)
- **日志**: 服务器日志会输出到控制台，包含状态流转信息。

## VS Code 配置与使用指南

由于本系统依赖**单例状态机**来协调两个 Agent，因此**必须**启动一个独立的 Server 进程，并让两个 VS Code 实例连接到同一个 Server。

### 1. 编译与启动 Server

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

### 2. 配置 VS Code (以 Cline 插件为例)

假设你使用的是 **Cline** (或其他支持 MCP 的 VS Code 插件)。你需要配置它连接到我们刚才启动的 SSE Server。

1.  在 VS Code 中打开 Cline 设置 (通常在 `MCP Servers` 配置文件中)。
2.  添加如下配置：

```json
{
  "mcpServers": {
    "dalp-server": {
      "command": "node",
      "args": ["path/to/your/dual-agent-mcp/dist/index.js"],
      "disabled": true,
      "autoApprove": []
    },
    "dalp-sse": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

> **注意**: 请务必使用 `sse` 传输方式，而不是 `stdio` (command 方式)。因为 `stdio` 会为每个 VS Code 窗口启动一个新的 Server 进程，导致状态无法共享。

### 3. 双 Agent 协作流程

1.  **打开两个 VS Code 窗口**：分别打开你的前端项目和后端项目（或者同一个项目的不同窗口）。
2.  **初始化 Agent A (Leader)**:
    - 在第一个窗口中，打开 Cline 聊天界面。
    - 输入 `prompts/agent_a_prompt.md` 中的内容。
    - Agent A 会初始化并准备分配任务。
3.  **初始化 Agent B (Worker)**:
    - 在第二个窗口中，打开 Cline 聊天界面。
    - 输入 `prompts/agent_b_prompt.md` 中的内容。
    - Agent B 会立即调用 `await_my_turn` 并进入等待状态。
4.  **开始协作**:
    - 在窗口 A 中给 Agent A 下达任务（例如：“请帮我实现登录功能”）。
    - Agent A 会进行规划，并通过 `handover_work` 将任务转交给 Agent B。
    - 窗口 B 中的 Agent B 会收到通知（`await_my_turn` 返回），执行任务，然后通过 `handover_work` 交回给 A。

### 4. 查看协作对话 (监控)

Agent A 和 Agent B 之间的“对话”实际上是通过 Server 进行的状态传递。你可以通过以下三种方式查看：

1.  **Web Dashboard (推荐)**:

    - 访问 **`http://localhost:3000`**。
    - 这是一个实时的 Web 界面，会自动刷新并展示所有的交互记录。
    - 界面美观，支持自动滚动，是监控协作的最佳方式。

2.  **Server 终端日志**:

    - 在运行 `npm start` 的终端中，你会看到实时的日志输出。
    - 日志会显示 `[State] Handover from A...` 以及具体的 `Summary` 和 `Instruction`。

3.  **Agent 聊天界面**:
    - **Agent A**: 当 `await_my_turn` 返回时，工具的输出结果中会包含 Agent B 的回复 (`previous_context`)。
    - **Agent B**: 当 `await_my_turn` 返回时，工具的输出结果中会包含 Agent A 的指令 (`previous_context`)。

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
├── prompts/              # Agent 提示词模板
├── package.json
└── tsconfig.json
```

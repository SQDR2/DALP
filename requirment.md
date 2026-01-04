基于你对**高效**和**技术栈**的要求，我重新设计了方案。

为了实现**低延迟**、**高并发状态管理**以及**标准化的协议兼容**，我推荐使用 **TypeScript (Node.js)** 配合 **SSE (Server-Sent Events)** 传输协议。

这是目前构建远程/共享状态 MCP Server 最原生、最高效的方案（比 Python Stdio 模式更适合处理多客户端连接）。

---

# 产品需求文档：Dual-Agent Loop Protocol (DALP) 工具链

## 1. 技术栈选型 (The Efficient Stack)

我们选择这套技术栈的核心逻辑是：**异步非阻塞 I/O** 和 **即时状态共享**。

* **运行时**: **Node.js (v20+)**
* *理由*: MCP 的官方 SDK (`@modelcontextprotocol/sdk`) 对 TypeScript 支持最完善，且 Node.js 处理 HTTP 长连接（Long Polling/SSE）极其高效，适合作为消息总线。


* **Web 框架**: **Fastify** 或 **Express**
* *理由*: 轻量级，用于托管 SSE 端点。Fastify 性能更佳。


* **通信协议**: **MCP over SSE (Server-Sent Events)**
* *理由*:
* Stdio（标准输入输出）无法让两个独立的 IDEA 进程共享同一个 Server 实例的状态。
* SSE 允许 Server 主动向 Client 推送数据，或者维持长连接，这对于“等待唤醒”机制至关重要。




* **数据存储**: **In-Memory State Machine (内存状态机)**
* *理由*: 追求极速。无需数据库，Server 启动即创建会话，关闭即销毁。


* **IDE**: **IntelliJ IDEA (及其他 JetBrains IDE)**
* *要求*: 需安装支持 MCP 的插件（如通过 Cursor 桥接或即将推出的官方支持，目前通常使用类似 Cline 或 Codeium 插件来配置 MCP）。



---

## 2. 系统架构设计

系统采用 **“状态机 + 长轮询”** 模型，避免 Agent 盲目空转消耗 Token。

### 2.1 核心组件

1. **Orchestrator (启动编排器)**: 一个 Node.js 脚本。
* 启动 MCP Server。
* 使用 `child_process` 唤起两个 IDEA 实例，并注入 MCP Server 的 SSE URL。


2. **MCP Server (中间件)**: 维护一个全局状态对象。
3. **Agent A (Master/Leader)**: 任务发起者，运行在 IDEA 1。
4. **Agent B (Worker/Follower)**: 任务协作者，运行在 IDEA 2。

### 2.2 状态机模型 (State Machine)

Server 维护一个简单的状态：

* `turn`: `"A"` | `"B"` (当前轮到谁)
* `status`: `"IDLE"` | `"WORKING"` | `"COMPLETED"`
* `context`: `string` (上一轮传递下来的需求描述、代码路径或 Diff 内容)

---

## 3. 功能定义 (MCP Tools Specification)

Server 仅需暴露两个极其精简但功能强大的 Tool。为了高效，我们将“获取信息”和“阻塞等待”合并。

### Tool 1: `await_my_turn` (高效等待锁)

* **描述**: Agent 调用此工具时，如果当前轮次不是自己（例如 B 调用但现在是 A 的回合），Server **不立即返回**，而是挂起 HTTP 请求（Promise Pending）。直到轮次切换，Server 才返回结果。
* *优势*: 实现了“Event-Driven”效果，Agent 不会反复询问 "好了没?"，节省大量 Token 和请求开销。


* **参数**:
* `agent_id`: `"A"` 或 `"B"`


* **返回**:
* `can_start`: `boolean` (总是 true，因为返回时意味着轮到你了)
* `previous_context`: `string` (对方刚才做了什么，你需要接着做什么)
* `is_finished`: `boolean` (如果为 true，Agent 应祝贺用户并停止)



### Tool 2: `handover_work` (工作移交)

* **描述**: 当前 Agent 完成工作后，提交结果并将控制权移交给对方。
* **参数**:
* `current_agent_id`: `"A"` 或 `"B"`
* `work_summary`: `string` (本轮工作的总结，供对方参考)
* `next_instruction`: `string` (给对方的具体指令)
* `is_task_complete`: `boolean` (是否认为任务已全部结束)


* **行为**:
1. 更新内存中的 `context`。
2. 切换 `turn` (A -> B, B -> A)。
3. **触发**: 唤醒正在 `await_my_turn` 上挂起的另一个 Agent。



---

## 4. 详细交互流程 (Sequence Flow)

*(此处描述图表内容，你可以想象一个时序图)*

1. **启动**:
* 用户运行 `npm start`。
* Server 启动在 `http://localhost:3000/sse`。
* 自动打开 IDEA A 和 IDEA B。


2. **握手 (Handshake)**:
* **IDEA B (Agent)** 初始化 Prompt: "我是协作者 B，我将调用 `await_my_turn` 等待指令。" -> **B 挂起**。
* **IDEA A (Agent)** 初始化 Prompt: "我是发起者 A，我有任务。我先工作，然后 `handover_work`。"


3. **第一轮 (Idea A)**:
* Agent A 收到用户需求：“写一个登录接口”。
* Agent A 写代码、建文件。
* Agent A 调用 `handover_work(current="A", summary="创建了 LoginController", instruction="请在 IDEA B 中编写 LoginService 的具体实现", complete=false)`。
* Server 更新状态：Turn -> B。


4. **切换 (Switch)**:
* Server 立即解析 Agent B 之前挂起的 `await_my_turn` 请求。
* Agent B 收到响应：`{ previous_context: "请编写 LoginService...", is_finished: false }`。


5. **第二轮 (Idea B)**:
* Agent B 根据 context 编写业务逻辑。
* Agent B 完成后调用 `handover_work(current="B", summary="Service已完成", instruction="请在 A 端进行集成测试", complete=false)`。
* Server 更新状态：Turn -> A。
* (此时 Agent A 应该在发完上一条消息后，自动进入了 `await_my_turn` 状态，现在被唤醒)。


6. **终止**:
* 循环往复...
* 直到 Agent A 验证无误，调用 `handover_work(..., complete=true)`。
* Agent B 唤醒收到 `is_finished: true`，停止循环。



---

## 5. 项目文件结构 (Project Structure)

为了便于你直接开发，这是推荐的目录结构：

```text
dual-agent-mcp/
├── src/
│   ├── index.ts          # 入口文件 (Fastify server)
│   ├── state.ts          # 单例状态机类 (State management)
│   ├── tools.ts          # MCP Tools 定义 (zod schema)
│   └── launcher.ts       # 启动 IDEA 的脚本
├── package.json          # 依赖: fastify, @modelcontextprotocol/sdk, zod
├── tsconfig.json
└── prompts/
    ├── agent_a_prompt.md # 复制给 A 的预设提示词
    └── agent_b_prompt.md # 复制给 B 的预设提示词

```

## 6. 开发实施关键点

### 6.1 解决并发死锁 (Promise Resolver)

在 Server 端实现 `await_my_turn` 时，不要写 `while(true)` 循环。要使用 JavaScript 的 Promise 闭包技巧：

```typescript
// 伪代码示例：高效的等待机制
let pendingResolver: ((value: any) => void) | null = null;

// 当 Agent B 调用 await_my_turn('B') 且当前是 A 的回合时：
if (currentTurn !== 'B') {
    // 创建一个 Promise，但不立即 resolve，把 resolve 函数存起来
    return new Promise((resolve) => {
        pendingResolver = resolve;
    });
}

// 当 Agent A 调用 handover_work() 时：
if (pendingResolver) {
    pendingResolver({ ...data }); // 这一步瞬间唤醒 B
    pendingResolver = null;
}

```

### 6.2 启动脚本命令

Launcher 需要知道 IDEA 的可执行路径。

```javascript
// launcher.ts 示例
import { spawn } from 'child_process';

const SERVER_URL = "http://localhost:3000/sse";

// 启动 IDEA A
spawn('idea', ['/path/to/project_backend'], { detached: true });
console.log(`Open Project A via MCP: ${SERVER_URL}`);

// 启动 IDEA B
spawn('idea', ['/path/to/project_frontend'], { detached: true });
console.log(`Open Project B via MCP: ${SERVER_URL}`);

```

## 7. 总结

这个方案相比之前的“简单请求响应”模式，最大的改进在于：

1. **消除轮询**：利用 Server 端挂起 Promise，模拟了 WebSocket 的即时性，Agent 反应极快且不浪费 API 调用次数。
2. **SSE 架构**：这是 Cursor、JetBrains 等现代编辑器对接 MCP 的标准方式，兼容性最强。
3. **状态隔离**：通过 `turn` 字段严格控制谁该说话，防止两个 Agent 同时乱改代码导致冲突。

你需要我为你生成这个 **Node.js (Fastify + MCP SDK)** 版本的核心代码吗？

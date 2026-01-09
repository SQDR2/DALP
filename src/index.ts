import Fastify from 'fastify'
import crypto from 'crypto'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import { awaitMyTurnTool, handoverWorkTool } from './tools.js'
import { StateManager } from './state.js'

// 获取正确的 public 目录路径
// - 开发模式 (npm run dev): __dirname = src/, public 在 ../public
// - 打包模式 (npm run start): __dirname = dist/, public 在 ./public
const getPublicPath = () => {
  // 检查 dist/public 是否存在（打包模式）
  const distPublic = path.join(__dirname, 'public')
  const srcPublic = path.join(__dirname, '../public')

  // 优先使用 dist/public，回退到 ../public
  return require('fs').existsSync(distPublic) ? distPublic : srcPublic
}

const server = Fastify()

// Register static file serving
server.register(fastifyStatic, {
  root: getPublicPath(),
  prefix: '/', // optional: default '/'
})

const mcpServer = new McpServer({
  name: 'Dual-Agent MCP',
  version: '1.0.0',
})

// Register tools
mcpServer.tool(awaitMyTurnTool.name, awaitMyTurnTool.description, awaitMyTurnTool.parameters, awaitMyTurnTool.handler)

mcpServer.tool(
  handoverWorkTool.name,
  handoverWorkTool.description,
  handoverWorkTool.parameters,
  handoverWorkTool.handler
)

// SSE Transport for MCP
const transports = new Map<string, SSEServerTransport>()

server.get('/sse', async (req, res) => {
  console.log(`New SSE connection request`)
  res.hijack()

  const transport = new SSEServerTransport('http://localhost:3000/message', res.raw)
  console.log(`Created new transport with session ID: ${transport.sessionId}`)

  // Debug: Log writes
  const originalWrite = res.raw.write.bind(res.raw)
  res.raw.write = (chunk: any, ...args: any[]) => {
    console.log(`Writing to session ${transport.sessionId}:`, chunk.toString())
    return originalWrite(chunk, ...args)
  }

  transports.set(transport.sessionId, transport)

  // Heartbeat to keep connection alive (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      if (!res.raw.writableEnded) {
        res.raw.write(': heartbeat\n\n')
      } else {
        clearInterval(heartbeatInterval)
      }
    } catch (err) {
      console.log(`Heartbeat failed for session ${transport.sessionId}:`, err)
      clearInterval(heartbeatInterval)
    }
  }, 30000)

  await mcpServer.connect(transport)

  // Keep connection open
  res.raw.on('close', () => {
    console.log(`SSE connection closed for session ${transport.sessionId}`)
    clearInterval(heartbeatInterval)
    transports.delete(transport.sessionId)
  })
})

server.post('/message', async (req, res) => {
  console.log(`Received message request`)
  const sessionId = (req.query as any).sessionId as string
  console.log(`Message for session: ${sessionId}`)
  const transport = transports.get(sessionId)

  if (!transport) {
    res.status(404).send('Session not found')
    return
  }
  await transport.handlePostMessage(req.raw, res.raw, req.body)
})

// Dashboard API
server.get('/api/history', async (req, res) => {
  const stateManager = StateManager.getInstance()
  return stateManager.getHistory()
})

// Dashboard SSE
server.get('/dashboard/events', (req, res) => {
  res.hijack()
  res.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const stateManager = StateManager.getInstance()

  // Send initial history
  const history = stateManager.getHistory()
  res.raw.write(`data: ${JSON.stringify({ type: 'history', data: history })}\n\n`)

  // Listener for new events
  const listener = (entry: any) => {
    res.raw.write(`data: ${JSON.stringify({ type: 'update', data: entry })}\n\n`)
  }

  stateManager.addHistoryListener(listener)

  // Cleanup
  req.raw.on('close', () => {
    // In a real app, we should remove the listener.
    // For simplicity here, we rely on the fact that listeners array might grow but it's a demo.
    // To do it properly, add removeHistoryListener to StateManager.
  })
})

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '::' })
    console.log('Server listening on http://localhost:3000')
    console.log('SSE Endpoint: http://localhost:3000/sse')
    console.log('Dashboard: http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()

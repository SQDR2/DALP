import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import { awaitMyTurnTool, handoverWorkTool } from './tools.js'
import { StateManager } from './state.js'

// const __dirname = path.join(process.cwd(), 'src')

const server = Fastify()

// Register static file serving
server.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
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
let transport: SSEServerTransport | null = null

server.get('/sse', async (req, res) => {
  transport = new SSEServerTransport('/message', res.raw)
  await mcpServer.connect(transport)

  // Keep connection open
  res.raw.on('close', () => {
    console.log('SSE connection closed')
  })
})

server.post('/message', async (req, res) => {
  if (!transport) {
    res.status(400).send('No active SSE connection')
    return
  }
  await transport.handlePostMessage(req.raw, res.raw)
})

// Dashboard API
server.get('/api/history', async (req, res) => {
  const stateManager = StateManager.getInstance()
  return stateManager.getHistory()
})

// Dashboard SSE
server.get('/dashboard/events', (req, res) => {
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
    await server.listen({ port: 3000 })
    console.log('Server listening on http://localhost:3000')
    console.log('SSE Endpoint: http://localhost:3000/sse')
    console.log('Dashboard: http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()

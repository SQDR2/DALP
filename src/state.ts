import { z } from 'zod'

export type AgentId = 'A' | 'B'
export type Status = 'IDLE' | 'WORKING' | 'COMPLETED'

export interface State {
  turn: AgentId
  status: Status
  context: string
}

export interface HandoverData {
  current_agent_id: AgentId
  work_summary: string
  next_instruction: string
  is_task_complete: boolean
}

export interface LogEntry {
  timestamp: string
  agent_id: AgentId
  action: 'handover' | 'await_turn'
  summary?: string
  instruction?: string
  details?: any
}

export class StateManager {
  private static instance: StateManager
  private state: State = {
    turn: 'A', // Default start with A
    status: 'IDLE',
    context: 'Initial state. Waiting for Agent A to start.',
  }
  private history: LogEntry[] = []
  private historyListeners: ((entry: LogEntry) => void)[] = []

  private pendingResolver: ((value: any) => void) | null = null

  private constructor() {}

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager()
    }
    return StateManager.instance
  }

  public getState(): State {
    return { ...this.state }
  }

  public getHistory(): LogEntry[] {
    return [...this.history]
  }

  public addHistoryListener(listener: (entry: LogEntry) => void) {
    this.historyListeners.push(listener)
  }

  private log(entry: LogEntry) {
    this.history.push(entry)
    this.historyListeners.forEach(l => l(entry))
  }

  public async awaitTurn(
    agentId: AgentId
  ): Promise<{ can_start: boolean; previous_context: string; is_finished: boolean }> {
    console.log(`[State] Agent ${agentId} is checking turn. Current turn: ${this.state.turn}`)

    if (this.state.turn === agentId) {
      return {
        can_start: true,
        previous_context: this.state.context,
        is_finished: this.state.status === 'COMPLETED',
      }
    }

    // Wait for turn
    console.log(`[State] Agent ${agentId} is waiting for turn...`)
    return new Promise(resolve => {
      // If there was a previous pending resolver, we might want to reject it or handle it,
      // but in this simple model, we assume only one agent waits at a time (the other one).
      // Ideally, we should store resolvers by agentId if multiple agents could wait,
      // but here it's strictly A vs B.
      this.pendingResolver = resolve
    })
  }

  public handover(data: HandoverData): void {
    console.log(`[State] Handover from ${data.current_agent_id}. Summary: ${data.work_summary}`)

    // Log event
    this.log({
      timestamp: new Date().toISOString(),
      agent_id: data.current_agent_id,
      action: 'handover',
      summary: data.work_summary,
      instruction: data.next_instruction,
      details: data,
    })

    // Update state
    this.state.context = `Previous work by ${data.current_agent_id}:\nSummary: ${data.work_summary}\nInstruction: ${data.next_instruction}`
    this.state.status = data.is_task_complete ? 'COMPLETED' : 'WORKING'

    // Switch turn
    const nextTurn = data.current_agent_id === 'A' ? 'B' : 'A'
    this.state.turn = nextTurn

    // Notify waiting agent
    if (this.pendingResolver) {
      console.log(`[State] Waking up Agent ${nextTurn}`)
      this.pendingResolver({
        can_start: true,
        previous_context: this.state.context,
        is_finished: this.state.status === 'COMPLETED',
      })
      this.pendingResolver = null
    }
  }
}

import { z } from 'zod'
import { StateManager, AgentId } from './state.js'

export const awaitMyTurnTool = {
  name: 'await_my_turn',
  description: 'Wait until it is your turn to work. Returns context when ready.',
  parameters: {
    agent_id: z.enum(['A', 'B']).describe('Your Agent ID (A or B)'),
  },
  handler: async (args: { agent_id: string }) => {
    const { agent_id } = args
    const stateManager = StateManager.getInstance()
    const result = await stateManager.awaitTurn(agent_id as AgentId)
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  },
}

export const handoverWorkTool = {
  name: 'handover_work',
  description: 'Handover work to the other agent.',
  parameters: {
    current_agent_id: z.enum(['A', 'B']).describe('Your Agent ID (A or B)'),
    work_summary: z.string().describe('Summary of what you did'),
    next_instruction: z.string().describe('Instructions for the next agent'),
    is_task_complete: z.boolean().describe('Is the overall task complete?'),
  },
  handler: async (args: {
    current_agent_id: string
    work_summary: string
    next_instruction: string
    is_task_complete: boolean
  }) => {
    const stateManager = StateManager.getInstance()
    stateManager.handover({
      current_agent_id: args.current_agent_id as AgentId,
      work_summary: args.work_summary,
      next_instruction: args.next_instruction,
      is_task_complete: args.is_task_complete,
    })
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Handover successful. Turn switched.',
        },
      ],
    }
  },
}

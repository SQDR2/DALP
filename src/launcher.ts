import { spawn } from 'child_process'

const SERVER_URL = 'http://localhost:3000/sse'

// Placeholder paths - User needs to configure these
const IDEA_A_PATH = process.env.IDEA_A_PATH || 'idea'
const IDEA_B_PATH = process.env.IDEA_B_PATH || 'idea'
const PROJECT_A_PATH = process.env.PROJECT_A_PATH || '/path/to/project_a'
const PROJECT_B_PATH = process.env.PROJECT_B_PATH || '/path/to/project_b'

console.log('Starting DALP Launcher...')
console.log(`Server URL: ${SERVER_URL}`)

// Start Server (Assuming this script is run separately or we spawn the server here too)
// For now, we assume the server is already running or this script IS the entry point if we want to combine them.
// But based on the plan, this is a separate launcher script.

// Launch IDEA A
console.log(`Launching IDEA A for ${PROJECT_A_PATH}...`)
const ideaA = spawn(IDEA_A_PATH, [PROJECT_A_PATH], { detached: true, stdio: 'ignore' })
ideaA.unref()

// Launch IDEA B
console.log(`Launching IDEA B for ${PROJECT_B_PATH}...`)
const ideaB = spawn(IDEA_B_PATH, [PROJECT_B_PATH], { detached: true, stdio: 'ignore' })
ideaB.unref()

console.log('IDEA instances launched.')

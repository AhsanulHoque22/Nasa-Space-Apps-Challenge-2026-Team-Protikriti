// Ask ATLAS on Vercel: POST /api/explain. The key is the ANTHROPIC_API_KEY project setting;
// the logic lives in web/src/server/explain.ts (shared with the Vite dev server and tests).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { explainHandler } from '../web/src/server/explain.js'

const sourceNotes = readFileSync(join(process.cwd(), 'docs/data-sources.md'), 'utf8')

export const POST = explainHandler(process.env.ANTHROPIC_API_KEY, sourceNotes)

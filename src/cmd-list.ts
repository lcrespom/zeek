import fs from 'node:fs'
import path from 'node:path'

import { fgColorFunc } from './terminal.ts'

const COLOR_GREEN = '#a6e22e'
const colCommand = fgColorFunc(COLOR_GREEN)

// Cache command list since PATH doesn't change during session
let cachedCommands: string[] | null = null

function getExecutablesFromDir(dir: string): string[] {
  try {
    const files = fs.readdirSync(dir)
    return files.filter(file => {
      try {
        const filePath = path.join(dir, file)
        const stats = fs.statSync(filePath)
        // Check if file is executable (has any execute bit set)
        return stats.isFile() && (stats.mode & 0o111) !== 0
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

export function getCommandList(): string[] {
  if (cachedCommands) return cachedCommands

  const pathEnv = process.env.PATH || ''
  const pathDirs = pathEnv.split(':').filter(Boolean)
  const commandSet = new Set<string>()

  for (const dir of pathDirs) {
    const executables = getExecutablesFromDir(dir)
    for (const exe of executables) {
      commandSet.add(exe)
    }
  }

  cachedCommands = [...commandSet].sort()
  return cachedCommands
}

export function highlightCommandLine(line: string): string {
  return colCommand(line)
}

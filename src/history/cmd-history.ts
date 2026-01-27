import { execSync } from 'node:child_process'
import { join } from 'node:path'

import { Config } from '../config.ts'

export const GRAPHIC_NEWLINE = '↵'
const HISTORY_FILE = '.zsh_history'

function removeTimestamp(line: string): string {
  const timestampRegex = /^:?\s?\d+:\d+;/
  return line.replace(timestampRegex, '')
}

function removeDuplicates(lines: string[]): string[] {
  return [...new Set(lines.reverse())].reverse()
}

export function getCommandHistory(): string[] {
  const historyPath = join(process.env.HOME || process.env.USERPROFILE || '', HISTORY_FILE)
  const output = execSync(`tail -n ${Config.maxCmdHistoryLines} "${historyPath}"`, {
    encoding: 'utf-8'
  })
  return removeDuplicates(
    output
      .trimEnd()
      .split('\n: ')
      .map(item => item.split('\\\n').join(GRAPHIC_NEWLINE))
      .map(removeTimestamp)
  )
}

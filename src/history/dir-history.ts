import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { Config } from '../config.ts'

const dirHistoryPath = join(getHomeDirectory(), '.dir_history')

function getHomeDirectory() {
  return process.env.HOME || process.env.USERPROFILE || ''
}

function readDirHistoryFile() {
  try {
    return readFileSync(dirHistoryPath, { encoding: 'utf-8' })
      .split('\n')
      .filter(d => d && d.trim() !== '')
  } catch {
    return []
  }
}

function writeDirHistoryFile(dirs: string[]) {
  writeFileSync(dirHistoryPath, dirs.join('\n'), { encoding: 'utf-8' })
}

export function addCwdToHistory() {
  const cwd = process.cwd()
  const dirHistory = readDirHistoryFile().filter(dir => dir != cwd)
  if (dirHistory.length >= Config.maxDirHistoryLines) dirHistory.shift()
  dirHistory.push(cwd)
  writeDirHistoryFile(dirHistory)
}

export function getDirHistory() {
  const dirHistory = readDirHistoryFile()
  const cwd = process.cwd()
  // Remove last directory if it's the same as the current directory
  if (dirHistory.at(-1) == cwd) dirHistory.pop()
  // Replace full path to home directory with "~"
  const homeDir = getHomeDirectory()
  return dirHistory.map(dir =>
    dir.startsWith(homeDir) ? '~' + dir.substring(homeDir.length) : dir
  )
}

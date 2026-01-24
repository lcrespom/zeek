import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { fgColorFunc } from './terminal.ts'

function formatPermissions(mode: number, isDirectory: boolean): string {
  const fileType = isDirectory ? 'd' : '-'
  const xwr = 'xwr'
  let permissions = ''
  for (let i = 8; i >= 0; i--) {
    const bit = (mode >> i) & 1
    permissions += bit ? xwr[i % 3] : '-'
  }
  return fileType + permissions
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes.toString().padStart(5) + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1).padStart(5) + ' K'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).padStart(5) + ' M'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1).padStart(5) + ' G'
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// TODO make colors configurable
const COLOR_GREEN = '#a6e22e'
const COLOR_FUCHSIA = '#f92672'
const COLOR_CYAN = '#66d9ef'
const COLOR_ORANGE = '#fd971f'
const COLOR_PURPLE = '#ae81ff'

const colPermissions = fgColorFunc(COLOR_FUCHSIA)
const colUsername = fgColorFunc(COLOR_GREEN)
const colSize = fgColorFunc(COLOR_ORANGE)
const colDate = fgColorFunc(COLOR_PURPLE)
const colTime = fgColorFunc(COLOR_PURPLE)
const colFile = fgColorFunc(COLOR_GREEN)
const colDir = fgColorFunc(COLOR_CYAN)

export function highlightFileListLine(line: string): string {
  // Example input: '-rw-r--r--  user       3.2 K  18/01/2026 22:05  zeek.zsh'
  if (line.startsWith('#')) return line // Skip no matches line
  const permissions = colPermissions(line.slice(0, 10))
  const username = colUsername(line.slice(12, 20))
  const size = colSize(line.slice(22, 29))
  const date = colDate(line.slice(31, 41))
  const time = colTime(line.slice(42, 47))
  const filename = line.slice(49)
  const fileOrDir = line.startsWith('d') ? colDir(filename) : colFile(filename)
  return `${permissions}  ${username}  ${size}  ${date} ${time}  ${fileOrDir}`
}

export function getFileList(): string[] {
  const searchDir = process.cwd()
  const files = fs.readdirSync(searchDir)
  // TODO: Replace with actual user info retrieval in a cross-platform way
  const username = os.userInfo().username.padEnd(8)
  return files.map(filename => {
    const filePath = path.join(searchDir, filename)
    const stats = fs.statSync(filePath)
    const permissions = formatPermissions(stats.mode, stats.isDirectory())
    const size = formatSize(stats.size)
    const date = formatDate(stats.mtime)
    const time = formatTime(stats.mtime)
    return `${permissions}  ${username}  ${size}  ${date} ${time}  ${filename} `
  })
}

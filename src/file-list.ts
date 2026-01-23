import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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
  if (bytes < 1024) return bytes.toString().padStart(5)
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1).padStart(4) + 'K'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).padStart(4) + 'M'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1).padStart(4) + 'G'
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

export function getFileList(): string[] {
  const searchDir = process.cwd()
  const files = fs.readdirSync(searchDir)
  // TODO: Replace with actual user info retrieval in a cross-platform way
  const username = os.userInfo().username

  return files.map(filename => {
    const filePath = path.join(searchDir, filename)
    const stats = fs.statSync(filePath)
    const permissions = formatPermissions(stats.mode, stats.isDirectory())
    const size = formatSize(stats.size)
    const date = formatDate(stats.mtime)
    const time = formatTime(stats.mtime)
    return `${permissions}  ${username}  ${size}  ${date} ${time}  ${filename}`
  })
}

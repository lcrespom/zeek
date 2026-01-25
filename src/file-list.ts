import fs from 'node:fs'
import path from 'node:path'
import userid from 'userid'

import { fgColorFunc } from './terminal.ts'

// Cache UID -> username lookups for performance
const uidCache = new Map<number, string>()

function getUsername(uid: number): string {
  const cached = uidCache.get(uid)
  if (cached !== undefined) return cached
  let username: string
  try {
    username = userid.username(uid)
  } catch {
    username = uid.toString()
  }
  uidCache.set(uid, username)
  return username
}

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

export function getFileNameFromLine(line: string): string {
  return line.slice(49).trim()
}

export function getFileList(searchDir: string = process.cwd()): string[] {
  const files = fs.readdirSync(searchDir)
  const result: string[] = []
  for (const filename of files) {
    try {
      const filePath = path.join(searchDir, filename)
      const stats = fs.statSync(filePath)
      const permissions = formatPermissions(stats.mode, stats.isDirectory())
      const username = getUsername(stats.uid).substring(0, 8).padEnd(8)
      const size = formatSize(stats.size)
      const date = formatDate(stats.mtime)
      const time = formatTime(stats.mtime)
      result.push(`${permissions}  ${username}  ${size}  ${date} ${time}  ${filename} `)
    } catch {
      // Skip files that can't be stat'd (broken symlinks, permission issues, etc.)
    }
  }
  return result
}

/**
 * Extract the word under the cursor from lbuffer and rbuffer.
 * The word is the text from the last unquoted space in lbuffer to the first unquoted space in rbuffer.
 * Also returns the suffix (part of rbuffer after the word) to preserve text after the cursor.
 */
export function getWordUnderCursor(
  lbuffer: string,
  rbuffer: string
): { word: string; wordStart: number; suffix: string } {
  // Find the start of the word (last space in lbuffer, or start of lbuffer)
  let wordStart = lbuffer.length
  for (let i = lbuffer.length - 1; i >= 0; i--) {
    if (lbuffer[i] === ' ' || lbuffer[i] === '\t') {
      wordStart = i + 1
      break
    }
    if (i === 0) wordStart = 0
  }
  const leftPart = lbuffer.slice(wordStart)
  // Find the end of the word (first space in rbuffer, or end of rbuffer)
  let wordEnd = rbuffer.length
  for (let i = 0; i < rbuffer.length; i++) {
    if (rbuffer[i] === ' ' || rbuffer[i] === '\t') {
      wordEnd = i
      break
    }
  }
  const rightPart = rbuffer.slice(0, wordEnd)
  const suffix = rbuffer.slice(wordEnd)
  return { word: leftPart + rightPart, wordStart, suffix }
}

/**
 * Split a path/file word into directory and filename parts.
 * Examples:
 *   "src/index" -> { dir: "src/", file: "index" }
 *   "/usr/local/b" -> { dir: "/usr/local/", file: "b" }
 *   "foo" -> { dir: "", file: "foo" }
 *   "src/" -> { dir: "src/", file: "" }
 */
export function splitPathAndFile(word: string): { dir: string; file: string } {
  // Trailing slash means directory only, no file filter
  if (word.endsWith('/')) return { dir: word, file: '' }
  const parsed = path.parse(word)
  // Add trailing slash if dir exists and doesn't already have one (e.g., root '/')
  const dir = parsed.dir ? (parsed.dir.endsWith('/') ? parsed.dir : parsed.dir + '/') : ''
  return { dir, file: parsed.base }
}

/**
 * Resolve a directory path, handling ~, relative paths, etc.
 */
export function resolveDir(dir: string): string {
  if (!dir) return process.cwd()
  // Handle home directory
  if (dir.startsWith('~/')) {
    dir = path.join(process.env.HOME || '', dir.slice(2))
  }
  // Resolve relative to cwd
  return path.resolve(process.cwd(), dir)
}

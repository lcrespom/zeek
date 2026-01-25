import fs from 'node:fs'

import { getCommandHistory } from './cmd-history.ts'
import { initConfig } from './config.ts'
import { addCwdToHistory, getDirHistory } from './dir-history.ts'
import {
  getFileList,
  getFileNameFromLine,
  getWordUnderCursor,
  highlightFileListLine,
  resolveDir,
  splitPathAndFile
} from './file-list.ts'
import { MenuPopup } from './menu-popup.ts'
import { highlightCommand } from './syntax-highlight.ts'

function getCommand() {
  return process.argv[2] || 'help'
}

function help() {
  console.log('This tool should only be called via the "zeek.zsh" script.')
}

function emitLineAndExit(line?: string) {
  if (line) {
    const fd3 = fs.openSync('/dev/fd/3', 'w')
    fs.writeSync(fd3, line)
    fs.closeSync(fd3)
  }
  process.exit(0)
}

function openHistoryPopup(lbuffer: string, rbuffer: string) {
  const popup = new MenuPopup(getCommandHistory(), highlightCommand)
  popup.handleSelection = emitLineAndExit
  popup.openMenuPopup(lbuffer, rbuffer)
}

function openDirHistoryPopup(lbuffer: string, rbuffer: string) {
  const popup = new MenuPopup(getDirHistory())
  popup.handleSelection = emitLineAndExit
  popup.openMenuPopup(lbuffer, rbuffer)
}

function getParentPath(prefix: string): string | null {
  // Remove trailing slash if present
  const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  if (!trimmed) return null
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash < 0) return ''
  return trimmed.slice(0, lastSlash + 1)
}

function openFileSearchPopup(lbuffer: string, rbuffer: string) {
  const { word, wordStart, suffix } = getWordUnderCursor(lbuffer, rbuffer)
  const { dir, file } = splitPathAndFile(word)

  // Track current directory prefix (relative path being browsed)
  let currentPrefix = dir

  const popup = new MenuPopup(getFileList(resolveDir(currentPrefix)), highlightFileListLine)

  // Handle Tab/Backspace navigation
  popup.onNavigate = (line, action) => {
    if (action === 'navigate' && line) {
      const selectedFile = getFileNameFromLine(line)
      const isDirectory = line.startsWith('d')
      if (isDirectory) {
        // Navigate into subdirectory
        currentPrefix = currentPrefix + selectedFile + '/'
        try {
          return getFileList(resolveDir(currentPrefix))
        } catch {
          // Directory not readable, stay where we are
          currentPrefix = currentPrefix.slice(0, -(selectedFile.length + 1))
          return undefined
        }
      }
    } else if (action === 'navigate-up') {
      const resolvedCurrent = resolveDir(currentPrefix)
      // At filesystem root, do nothing
      if (resolvedCurrent === '/') {
        return getFileList(resolvedCurrent)
      }

      // Compute parent prefix
      let parentPrefix: string
      // Check if path is purely "../" sequences (like ../, ../../, ../../../)
      const isPureUpPath = /^(\.\.\/)+$/.test(currentPrefix)

      if (currentPrefix === '' || currentPrefix === './') {
        // At cwd, go to parent via ../
        parentPrefix = '../'
      } else if (isPureUpPath) {
        // Path is purely ../ sequences - add another ../
        parentPrefix = '../' + currentPrefix
      } else {
        // Use getParentPath for paths with actual directory names
        const parent = getParentPath(currentPrefix)
        if (parent === null || parent === '') {
          // At a top-level directory like 'foo/' - go to cwd
          parentPrefix = ''
        } else {
          parentPrefix = parent
        }
      }

      try {
        const items = getFileList(resolveDir(parentPrefix))
        currentPrefix = parentPrefix
        return items
      } catch {
        // Can't read parent, stay in current directory
        return getFileList(resolvedCurrent)
      }
    }
    return undefined
  }

  // Handle final selection (Enter key)
  popup.handleSelection = (line, action) => {
    if (line) {
      const selectedFile = getFileNameFromLine(line)
      // If navigating into directory with Enter, treat as Tab
      if (action === 'navigate' && line.startsWith('d')) {
        return // Already handled by onNavigate
      }
      // Emit: new_lbuffer + tab + new_rbuffer
      // This allows zsh to set LBUFFER and RBUFFER separately for correct cursor position
      const newLbuffer = lbuffer.slice(0, wordStart) + currentPrefix + selectedFile
      line = newLbuffer + '\t' + suffix
    }
    emitLineAndExit(line)
  }

  popup.openMenuPopup(file, '')
}

function main() {
  const command = getCommand()
  const lbuffer = process.argv[3]
  const rbuffer = process.argv[4]
  initConfig()
  switch (command) {
    case 'help':
      help()
      break
    case 'history':
      openHistoryPopup(lbuffer, rbuffer)
      break
    case 'store-dir':
      addCwdToHistory()
      break
    case 'dir-history':
      openDirHistoryPopup(lbuffer, rbuffer)
      break
    case 'file-search':
      openFileSearchPopup(lbuffer, rbuffer)
      break
    default:
      console.log(`Unknown command: ${command}`)
      help()
  }
}

main()

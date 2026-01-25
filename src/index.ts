import fs from 'node:fs'
import path from 'node:path'

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

function openFileSearchPopup(lbuffer: string, rbuffer: string) {
  const { word, wordStart, suffix } = getWordUnderCursor(lbuffer, rbuffer)
  const { dir, file } = splitPathAndFile(word)

  // Track current directory as absolute path (simpler navigation logic)
  let currentAbsPath = resolveDir(dir)

  const popup = new MenuPopup(getFileList(currentAbsPath), highlightFileListLine)

  // Handle Tab/Backspace navigation
  popup.onNavigate = (line, action) => {
    if (action === 'navigate' && line) {
      const selectedFile = getFileNameFromLine(line)
      if (line.startsWith('d')) {
        const newPath = path.join(currentAbsPath, selectedFile)
        try {
          const items = getFileList(newPath)
          currentAbsPath = newPath
          return items
        } catch {
          return undefined
        }
      }
    } else if (action === 'navigate-up') {
      if (currentAbsPath === '/') {
        return getFileList(currentAbsPath)
      }
      const parentPath = path.dirname(currentAbsPath)
      try {
        const items = getFileList(parentPath)
        currentAbsPath = parentPath
        return items
      } catch {
        return getFileList(currentAbsPath)
      }
    }
    return undefined
  }

  // Handle final selection (Enter key)
  popup.handleSelection = (line, action) => {
    if (line) {
      const selectedFile = getFileNameFromLine(line)
      if (action === 'navigate' && line.startsWith('d')) {
        return
      }
      // Convert absolute path back to relative for output
      const relativePath = path.relative(process.cwd(), currentAbsPath)
      const prefix = relativePath ? relativePath + '/' : ''
      const newLbuffer = lbuffer.slice(0, wordStart) + prefix + selectedFile
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

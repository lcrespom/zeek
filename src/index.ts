import fs from 'node:fs'

import { getCommandHistory } from './cmd-history.ts'
import { openCmdSearchPopup } from './cmd-search-popup.ts'
import { initConfig } from './config.ts'
import { addCwdToHistory, getDirHistory } from './dir-history.ts'
import { openFileSearchPopup } from './file-search-popup.ts'
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

// Check if cursor is at a position where a command is expected
// We're typing a command if there's no space after the last separator (or start of line)
// Examples: "" -> cmd, "c" -> cmd, "cat " -> file, "cat file | g" -> cmd
function isAtCommandPosition(lbuffer: string): boolean {
  // Find the text after the last command separator
  const separatorPattern = /[;&|()]/g
  let lastSepEnd = 0
  let match
  while ((match = separatorPattern.exec(lbuffer)) !== null) {
    lastSepEnd = match.index + match[0].length
  }
  // Trim leading whitespace - it's not a command/argument separator
  const textAfterSep = lbuffer.slice(lastSepEnd).trimStart()
  // If no space in the text after separator, we're still typing the command
  return !textAfterSep.includes(' ')
}

function openHistoryPopup(lbuffer: string, rbuffer: string) {
  const popup = new MenuPopup(getCommandHistory(), {
    lineHighlighter: highlightCommand,
    onSelection: emitLineAndExit
  })
  popup.openMenuPopup(lbuffer, rbuffer)
}

function openDirHistoryPopup(lbuffer: string, rbuffer: string) {
  const popup = new MenuPopup(getDirHistory(), {
    onSelection: emitLineAndExit
  })
  popup.openMenuPopup(lbuffer, rbuffer)
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
      if (isAtCommandPosition(lbuffer)) {
        openCmdSearchPopup(emitLineAndExit, lbuffer, rbuffer)
      } else {
        openFileSearchPopup(emitLineAndExit, lbuffer, rbuffer)
      }
      break
    default:
      console.log(`Unknown command: ${command}`)
      help()
  }
}

main()

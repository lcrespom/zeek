import fs from 'node:fs'

import { initConfig } from './config.ts'
import { MenuPopup } from './menu-popup.ts'
import { getCommandHistory } from './history/cmd-history.ts'
import { addCwdToHistory, getDirHistory } from './history/dir-history.ts'
import { highlightCommand } from './history/syntax-highlight.ts'
import { openFileSearchPopup } from './completion/file-search-popup.ts'

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
    case 'completion':
      openFileSearchPopup(emitLineAndExit, lbuffer, rbuffer)
      break
    default:
      console.log(`Unknown command: ${command}`)
      help()
  }
}

main()

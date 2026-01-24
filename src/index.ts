import fs from 'node:fs'

import { getCommandHistory } from './cmd-history.ts'
import { initConfig } from './config.ts'
import { addCwdToHistory, getDirHistory } from './dir-history.ts'
import { getFileList, getFileNameFromLine, highlightFileListLine } from './file-list.ts'
import { MenuPopup } from './menu-popup.ts'
import { highlightCommand } from './syntax-highlight.ts'

function getCommand() {
  return process.argv[2] || 'help'
}

function help() {
  console.log('This tool should only be called via the "zeek.zsh" script.')
}

function emitLineAndExit(_item: number, line?: string) {
  if (line) {
    const fd3 = fs.openSync('/dev/fd/3', 'w')
    fs.writeSync(fd3, line)
    fs.closeSync(fd3)
  }
  process.exit(0)
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
      const cmdPopup = new MenuPopup(getCommandHistory(), highlightCommand)
      cmdPopup.handleSelection(emitLineAndExit)
      cmdPopup.openMenuPopup(lbuffer, rbuffer)
      break
    case 'store-dir':
      addCwdToHistory()
      break
    case 'dir-history':
      const dirPopup = new MenuPopup(getDirHistory())
      dirPopup.handleSelection(emitLineAndExit)
      dirPopup.openMenuPopup(lbuffer, rbuffer)
      break
    case 'file-search':
      const filePopup = new MenuPopup(getFileList(), highlightFileListLine)
      filePopup.handleSelection((item, line) => {
        if (line) line = getFileNameFromLine(line)
        emitLineAndExit(item, line)
      })
      filePopup.openMenuPopup(lbuffer, rbuffer)
      break
    default:
      console.log(`Unknown command: ${command}`)
      help()
  }
}

main()

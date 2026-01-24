import { getCommandHistory } from './cmd-history.ts'
import { initConfig } from './config.ts'
import { addCwdToHistory, getDirHistory } from './dir-history.ts'
import { getFileList, highlightFileListLine } from './file-list.ts'
import { MenuPopup } from './menu-popup.ts'
import { highlightCommand } from './syntax-highlight.ts'

function getCommand() {
  return process.argv[2] || 'help'
}

function help() {
  console.log('This tool should only be called via the "zeek.zsh" script.')
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
      cmdPopup.openMenuPopup(lbuffer, rbuffer)
      break
    case 'store-dir':
      addCwdToHistory()
      break
    case 'dir-history':
      const dirPopup = new MenuPopup(getDirHistory().map(d => d + ' '))
      dirPopup.openMenuPopup(lbuffer, rbuffer)
      break
    case 'file-search':
      const filePopup = new MenuPopup(getFileList(), highlightFileListLine)
      filePopup.openMenuPopup(lbuffer, rbuffer)
      break
    default:
      console.log(`Unknown command: ${command}`)
      help()
  }
}

main()

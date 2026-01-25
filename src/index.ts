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

function openFileSearchPopup(lbuffer: string, rbuffer: string) {
  const { word, wordStart, suffix } = getWordUnderCursor(lbuffer, rbuffer)
  const { dir, file } = splitPathAndFile(word)
  const resolvedDir = resolveDir(dir)
  const popup = new MenuPopup(getFileList(resolvedDir), highlightFileListLine)
  //TODO filter should be applied here based on 'file' variable
  popup.handleSelection = line => {
    if (line) {
      const selectedFile = getFileNameFromLine(line)
      // Emit: new_lbuffer + tab + new_rbuffer
      // This allows zsh to set LBUFFER and RBUFFER separately for correct cursor position
      const newLbuffer = lbuffer.slice(0, wordStart) + dir + selectedFile
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

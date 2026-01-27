import path from 'node:path'

import { MenuPopup } from './menu-popup.ts'
import {
  getFileList,
  getFileNameFromLine,
  getWordUnderCursor,
  highlightFileListLine,
  resolveDir,
  splitPathAndFile
} from './file-list.ts'

type ExitHandler = (line?: string) => void

function singleMatch(fileList: string[], file: string) {
  const fileNames = fileList.map(getFileNameFromLine)
  const matches = fileNames.filter(fname => fname.toLowerCase().startsWith(file.toLowerCase()))
  if (matches.length === 1) return matches[0]
  return null
}

function exitHandlerLine(prefix: string, path: string, suffix: string) {
  const sep = suffix.startsWith(' ') ? '' : ' '
  return prefix + path + sep + '\t' + suffix
}

export function openFileSearchPopup(exitHandler: ExitHandler, lbuffer: string, rbuffer: string) {
  const { word, prefix, suffix } = getWordUnderCursor(lbuffer, rbuffer)
  const { dir, file } = splitPathAndFile(word)
  // Track current directory as absolute path (simpler navigation logic)
  let currentAbsPath = resolveDir(dir)
  const fileList = getFileList(currentAbsPath)
  // If there's a single match, immediately return it
  const match = singleMatch(fileList, file)
  if (match) return exitHandler(exitHandlerLine(prefix, match, suffix))
  // Otherwise, setup the popup menu
  const popup = new MenuPopup(fileList, highlightFileListLine)
  // Show current path above the menu
  popup.headerText = currentAbsPath
  // Start selection at first item (not last like history)
  popup.selectionAtStart = true
  // Filter only by filename, not the full line with permissions/size/date
  popup.getFilterText = getFileNameFromLine

  // Handle Tab/Backspace navigation
  popup.onNavigate = (line, action) => {
    if (action === 'navigate' && line) {
      const selectedFile = getFileNameFromLine(line)
      if (line.startsWith('d')) {
        const newPath = path.join(currentAbsPath, selectedFile)
        try {
          const items = getFileList(newPath)
          currentAbsPath = newPath
          popup.headerText = currentAbsPath
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
        popup.headerText = currentAbsPath
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
      if (action === 'navigate' && line.startsWith('d')) return
      // Convert absolute path back to relative for output
      let relativePath = path.relative(process.cwd(), currentAbsPath)
      // But use absolute path if outside cwd
      if (relativePath.startsWith('..')) relativePath = currentAbsPath
      let fpath = relativePath ? relativePath + '/' : ''
      if (relativePath === '/') fpath = '/'
      line = exitHandlerLine(prefix, fpath + selectedFile, suffix)
    }
    exitHandler(line)
  }

  popup.openMenuPopup(file, '')
}

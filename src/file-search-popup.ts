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

export function openFileSearchPopup(exitHandler: ExitHandler, lbuffer: string, rbuffer: string) {
  const { word, wordStart, suffix } = getWordUnderCursor(lbuffer, rbuffer)
  const { dir, file } = splitPathAndFile(word)
  // Track current directory as absolute path (simpler navigation logic)
  let currentAbsPath = resolveDir(dir)
  const popup = new MenuPopup(getFileList(currentAbsPath), highlightFileListLine)
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
      let prefix = relativePath ? relativePath + '/' : ''
      if (relativePath === '/') prefix = '/'
      const newLbuffer = lbuffer.slice(0, wordStart) + prefix + selectedFile
      line = newLbuffer + '\t' + suffix
    }
    exitHandler(line)
  }

  popup.openMenuPopup(file, '')
}

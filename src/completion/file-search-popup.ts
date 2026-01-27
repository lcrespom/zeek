import fs from 'node:fs'
import path from 'node:path'

import type { NavigateHandler, SelectionHandler } from '../menu-popup.ts'
import { MenuPopup } from '../menu-popup.ts'
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

function isDirectoryPath(path: string) {
  try {
    const stats = fs.statSync(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

function exitHandlerLine(prefix: string, path: string, suffix: string) {
  let sep = suffix.startsWith(' ') ? '' : ' '
  if (isDirectoryPath(path)) {
    path += '/'
    sep = ''
  }
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

  const onNavigate: NavigateHandler = (line, action) => {
    if (action === 'navigate' && line) {
      const selectedFile = getFileNameFromLine(line)
      if (line.startsWith('d')) {
        const newPath = path.join(currentAbsPath, selectedFile)
        try {
          const items = getFileList(newPath)
          currentAbsPath = newPath
          return { items, headerText: currentAbsPath }
        } catch {
          return undefined
        }
      }
    } else if (action === 'navigate-up') {
      if (currentAbsPath === '/') {
        return { items: getFileList(currentAbsPath), headerText: currentAbsPath }
      }
      const parentPath = path.dirname(currentAbsPath)
      try {
        const items = getFileList(parentPath)
        currentAbsPath = parentPath
        return { items, headerText: currentAbsPath }
      } catch {
        return { items: getFileList(currentAbsPath), headerText: currentAbsPath }
      }
    }
    return undefined
  }

  const onSelection: SelectionHandler = (line, action) => {
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

  const popup = new MenuPopup(fileList, {
    lineHighlighter: highlightFileListLine,
    headerText: currentAbsPath,
    selectionAtStart: true,
    getFilterText: getFileNameFromLine,
    onNavigate,
    onSelection
  })

  popup.openMenuPopup(file, '')
}

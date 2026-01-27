import type { SelectionHandler } from '../menu-popup.ts'
import { MenuPopup } from '../menu-popup.ts'
import { getCommandList, highlightCommandLine } from './cmd-list.ts'

type ExitHandler = (line?: string) => void

function singleMatch(commands: string[], prefix: string): string | null {
  if (!prefix) return null
  const matches = commands.filter(cmd => cmd.toLowerCase().startsWith(prefix.toLowerCase()))
  if (matches.length === 1) return matches[0]
  return null
}

// Get the partial command being typed (text after the last separator)
function getPartialCommand(lbuffer: string): { partial: string; prefix: string } {
  // Find last command separator
  const separators = /[;&|()]|\s&&\s|\s\|\|\s/g
  let lastSepEnd = 0
  let match
  while ((match = separators.exec(lbuffer)) !== null) {
    lastSepEnd = match.index + match[0].length
  }
  // Skip any leading whitespace after separator
  while (lastSepEnd < lbuffer.length && /\s/.test(lbuffer[lastSepEnd])) {
    lastSepEnd++
  }
  return {
    prefix: lbuffer.slice(0, lastSepEnd),
    partial: lbuffer.slice(lastSepEnd)
  }
}

export function openCmdSearchPopup(exitHandler: ExitHandler, lbuffer: string, rbuffer: string) {
  const commands = getCommandList()
  const { prefix, partial } = getPartialCommand(lbuffer)

  // If there's a single match, immediately return it
  const match = singleMatch(commands, partial)
  if (match) {
    const suffix = rbuffer.startsWith(' ') ? '' : ' '
    return exitHandler(prefix + match + suffix + '\t' + rbuffer)
  }

  const onSelection: SelectionHandler = (line, _action) => {
    if (line) {
      const suffix = rbuffer.startsWith(' ') ? '' : ' '
      line = prefix + line + suffix + '\t' + rbuffer
    }
    exitHandler(line)
  }

  const popup = new MenuPopup(commands, {
    lineHighlighter: highlightCommandLine,
    selectionAtStart: true,
    onSelection
  })

  popup.openMenuPopup(partial, '')
}

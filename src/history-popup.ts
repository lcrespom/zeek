import fs from 'node:fs'
// @ts-expect-error - CommonJS module without types
import keypress from 'keypress'
import './table-menu.d.ts'
import { tableMenu } from 'node-terminal-menu'
import type { TableMenuInstance } from 'node-terminal-menu'

import { LineEditor } from './line-editor.ts'
import {
  alternateScreen,
  bgColorFunc,
  clearScreen,
  fgColorFunc,
  hideCursor,
  moveCursor,
  normalScreen,
  showCursor
} from './terminal.ts'
import { Config } from './config.ts'
import { GRAPHIC_NEWLINE } from './cmd-history.ts'

// TODO read colors from configuration file
const MENU_BG_COLOR = '#1d1e1a'
const MENU_BG_SEL_COLOR = '#4a483a'
const MENU_FG_COLOR = '#58d1eb'
const SCROLL_FG_COLOR = '#ffffff'

const NO_MATCHES = '# 🤷 No matches'

export class HistoryPopup {
  private items: string[] = []
  private filteredItems: string[] = []
  private menu: TableMenuInstance = {} as TableMenuInstance
  private lineHighlighter: (line: string) => string = fgColorFunc(MENU_FG_COLOR)
  private menuRow: number = 3
  private lineEditorRow: number = 1

  constructor(items: string[], lineHighlighter?: (line: string) => string) {
    this.items = items
    this.filteredItems = items
    if (lineHighlighter) this.lineHighlighter = lineHighlighter
  }

  openHistoryPopup(lbuffer: string = '', rbuffer: string = '') {
    alternateScreen()
    clearScreen()
    moveCursor({ row: this.menuRow, col: 1 })
    try {
      this.menu = this.createMenu()
      this.listenKeyboard(lbuffer, rbuffer)
    } catch (err) {
      normalScreen()
      showCursor()
      console.error('Error showing history menu:', err)
    }
  }

  private computeDimensions() {
    // Compute menu width and height based on terminal size and config
    const maxWidth = this.items.reduce((max, item) => Math.max(max, item.length), 0)
    const width =
      Config.menuWidth > 0
        ? Math.min(process.stdout.columns - 2, maxWidth + 1, Config.menuWidth)
        : Math.min(process.stdout.columns + Config.menuWidth, maxWidth + 1)
    const height =
      Config.menuHeight > 0
        ? Math.min(process.stdout.rows - 4, this.items.length, Config.menuHeight)
        : Math.min(process.stdout.rows + Config.menuHeight, this.items.length)
    // Compute menu row and line editor row
    this.menuRow =
      Config.menuRow > 0 ? Config.menuRow : process.stdout.rows + Config.menuRow - height
    this.lineEditorRow = Config.lineEditOverMenu ? this.menuRow - 2 : this.menuRow + height + 1
    // Return dimensions
    return { width, height }
  }

  private createMenu() {
    const { width, height } = this.computeDimensions()
    moveCursor({ row: this.menuRow, col: 1 })
    return tableMenu({
      items: this.items,
      height,
      columns: 1,
      columnWidth: width,
      scrollBarCol: width + 1,
      selection: this.items.length - 1,
      colors: this.getColors(width),
      done: (item: number) => {
        const line = item >= 0 ? this.filteredItems[item] : undefined
        this.menuDone(line)
      }
    })
  }

  private getColors(width: number) {
    const itemBGfunc = bgColorFunc(MENU_BG_COLOR)
    const selBGfunc = bgColorFunc(MENU_BG_SEL_COLOR)
    return {
      item: (i: string) => itemBGfunc(this.lineHighlighter(i.padEnd(width))),
      selectedItem: (i: string) => selBGfunc(this.lineHighlighter(i.padEnd(width))),
      scrollArea: itemBGfunc,
      scrollBar: fgColorFunc(SCROLL_FG_COLOR)
    }
  }

  private updateMenu(line: string) {
    moveCursor({ row: this.menuRow, col: 1 })
    this.filteredItems = this.filterItems(this.items, line)
    if (this.filteredItems.length === 0) this.filteredItems = [NO_MATCHES]
    this.menu.update({ items: this.filteredItems, selection: this.filteredItems.length - 1 })
  }

  private listenKeyboard(lbuffer: string, rbuffer: string) {
    moveCursor({ row: this.lineEditorRow, col: 1 })
    process.stdin.setRawMode(true)
    process.stdin.resume()
    keypress(process.stdin)
    const lineEditor = new LineEditor(lbuffer, this.lineEditorRow)
    if (lbuffer || rbuffer) {
      this.updateMenu(lineEditor.getLine())
      lineEditor.showLine()
    }
    process.stdin.on('keypress', async (ch, key) => {
      hideCursor()
      if (lineEditor.isLineEditKey(ch, key)) {
        lineEditor.editLine(ch, key)
        this.updateMenu(lineEditor.getLine())
        if (!Config.lineEditOverMenu) lineEditor.showLine()
      } else {
        moveCursor({ row: this.menuRow, col: 1 })
        this.menu.keyHandler(ch, key)
      }
      moveCursor(lineEditor.getCursorPosition())
      showCursor()
    })
  }

  private multiMatch(line: string, words: string[]) {
    for (let w of words) if (!line.includes(w)) return false
    return true
  }

  private filterItems(items: string[], filter: string): string[] {
    const words = filter.toLowerCase().split(' ')
    return items.filter(item => this.multiMatch(item.toLowerCase(), words))
  }

  private menuDone(line?: string) {
    normalScreen()
    showCursor()
    if (line && line !== NO_MATCHES) {
      const fd3 = fs.openSync('/dev/fd/3', 'w')
      fs.writeSync(fd3, line.replaceAll(GRAPHIC_NEWLINE, '\n'))
      fs.closeSync(fd3)
    }
    process.exit(0)
  }
}

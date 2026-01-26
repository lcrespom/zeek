// @ts-expect-error - CommonJS module without types
import keypress from 'keypress'
import { tableMenu } from 'node-terminal-menu'
import type { TableMenuInstance } from 'node-terminal-menu'

import './table-menu.d.ts'
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

export type HighlightFunction = (line: string) => string
export type FilterTextFunction = (line: string) => string

export type SelectionAction = 'select' | 'navigate' | 'navigate-up'

export class MenuPopup {
  private items: string[] = []
  private filteredItems: string[] = []
  private menu: TableMenuInstance = {} as TableMenuInstance
  private lineHighlighter: HighlightFunction = fgColorFunc(MENU_FG_COLOR)
  private menuRow: number = 3
  private lineEditorRow: number = 1
  private lineEditor: LineEditor | null = null

  // Optional header text shown above the menu
  headerText?: string

  // If true, selection starts at the first item instead of last
  selectionAtStart: boolean = false

  constructor(items: string[], lineHighlighter?: HighlightFunction) {
    this.items = items
    this.filteredItems = items
    if (lineHighlighter) this.lineHighlighter = lineHighlighter
  }

  openMenuPopup(lbuffer: string = '', rbuffer: string = '') {
    alternateScreen()
    clearScreen()
    try {
      this.menu = this.createMenu()
      this.showHeader()
      this.listenKeyboard(lbuffer, rbuffer)
    } catch (err) {
      normalScreen()
      showCursor()
      console.error('Error showing popup menu:', err)
    }
  }

  private showHeader() {
    if (!this.headerText) return
    const headerRow = this.menuRow - 1
    moveCursor({ row: headerRow, col: 1 })
    process.stdout.write(fgColorFunc(MENU_FG_COLOR)(this.headerText))
  }

  handleSelection(line?: string, action?: SelectionAction) {}

  // Called when Tab or Backspace navigation is triggered
  // Return new items to update the menu, or undefined to close the popup
  onNavigate?: (line: string | undefined, action: SelectionAction) => string[] | undefined

  // Optional function to extract the text to filter on from each item
  // By default, filters on the entire item
  getFilterText?: FilterTextFunction

  // Update menu items and clear filter
  setItems(items: string[], headerText?: string) {
    this.items = items
    this.filteredItems = items
    if (headerText !== undefined) this.headerText = headerText
    const { width, height } = this.computeDimensions()
    clearScreen()
    this.showHeader()
    if (this.lineEditor) {
      this.lineEditor.setLine('')
      this.lineEditor.setRow(this.lineEditorRow)
      this.lineEditor.showLine()
    }
    moveCursor({ row: this.menuRow, col: 1 })
    const selection = this.selectionAtStart ? 0 : this.filteredItems.length - 1
    this.menu.update({
      items: this.filteredItems,
      selection,
      height,
      initialHeight: height,
      columnWidth: width,
      scrollBarCol: width + 1,
      colors: this.getColors(width)
    })
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
    const selection = this.selectionAtStart ? 0 : this.items.length - 1
    return tableMenu({
      items: this.items,
      height,
      columns: 1,
      columnWidth: width,
      scrollBarCol: width + 1,
      selection,
      colors: this.getColors(width),
      done: (item: number) => this.menuDone(item)
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
    this.lineEditor = new LineEditor(lbuffer, this.lineEditorRow)
    if (lbuffer || rbuffer) {
      this.updateMenu(this.lineEditor.getLine())
      this.lineEditor.showLine()
    }
    process.stdin.on('keypress', async (ch, key) => {
      if (!this.lineEditor) return
      hideCursor()
      // Tab key: navigate into directory
      if (key && key.name === 'tab') {
        const line = this.filteredItems[this.menu.selection]
        if (this.onNavigate) {
          const newItems = this.onNavigate(line, 'navigate')
          if (newItems) {
            this.setItems(newItems)
            moveCursor(this.lineEditor.getCursorPosition())
            showCursor()
            return
          }
        }
        this.menuDone(this.menu.selection, 'navigate')
        return
      }
      // Backspace on empty filter: navigate to parent directory
      if (this.lineEditor.isBackspace(ch) && this.lineEditor.getLine() === '') {
        if (this.onNavigate) {
          const newItems = this.onNavigate(undefined, 'navigate-up')
          if (newItems) {
            this.setItems(newItems)
            moveCursor(this.lineEditor.getCursorPosition())
            showCursor()
            return
          }
        }
        this.menuDone(-1, 'navigate-up')
        return
      }
      if (this.lineEditor.isLineEditKey(ch, key)) {
        this.lineEditor.editLine(ch, key)
        this.updateMenu(this.lineEditor.getLine())
        if (!Config.lineEditOverMenu) this.lineEditor.showLine()
      } else {
        moveCursor({ row: this.menuRow, col: 1 })
        this.menu.keyHandler(ch, key)
      }
      moveCursor(this.lineEditor.getCursorPosition())
      showCursor()
    })
  }

  private multiMatch(line: string, words: string[]) {
    for (let w of words) if (!line.includes(w)) return false
    return true
  }

  private filterItems(items: string[], filter: string): string[] {
    const words = filter.toLowerCase().split(' ')
    return items.filter(item => {
      const text = this.getFilterText ? this.getFilterText(item) : item
      return this.multiMatch(text.toLowerCase(), words)
    })
  }

  private menuDone(item: number, action: SelectionAction = 'select') {
    let line = item >= 0 ? this.filteredItems[item] : undefined
    if (line === NO_MATCHES) line = undefined
    else if (line) line = line.replaceAll(GRAPHIC_NEWLINE, '\n')
    normalScreen()
    showCursor()
    this.handleSelection(line, action)
  }
}

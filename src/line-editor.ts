import { clearLine, moveCursor } from './terminal.ts'
import type { CursorPosition } from './terminal.ts'

export type KeypressKey = {
  name: string
  sequence: string
  code: string
  ctrl: boolean
  meta: boolean
  shift: boolean
}

const EDITOR_KEYS = ['delete', 'left', 'right', 'home', 'end']

const BACKSPACE1 = '\u0008'
const BACKSPACE2 = '\u007F'
const CTRL_A = '\u0001'
const CTRL_E = '\u0005'

export class LineEditor {
  private left: string = ''
  private right: string = ''
  private row: number

  constructor(initialLine: string = '', row: number = 1) {
    this.left = initialLine
    this.row = row
  }

  isLineEditKey(ch: string, key: KeypressKey): boolean {
    if (!ch && EDITOR_KEYS.includes(key.name)) return true
    if (key && key.meta && (key.name === 'b' || key.name === 'f')) return true // alt-left or alt-right
    return ch === BACKSPACE1 || ch === CTRL_A || ch === CTRL_E || ch?.charCodeAt(0) >= 32
  }

  isBackspace(ch: string): boolean {
    return ch === BACKSPACE1 || ch === BACKSPACE2
  }

  handleNavigationKey(key: KeypressKey) {
    switch (key.name) {
      case 'delete':
        if (this.right.length > 0) this.right = this.right.slice(1)
        break
      case 'left':
        if (this.left.length <= 0) return
        this.right = this.left.slice(-1) + this.right
        this.left = this.left.slice(0, -1)
        break
      case 'right':
        if (this.right.length <= 0) return
        this.left += this.right.charAt(0)
        this.right = this.right.slice(1)
        break
      case 'home':
        return this.goHome()
      case 'end':
        return this.goEnd()
      case 'b':
        if (key.meta) return this.backwardWord()
      case 'f':
        if (key.meta) return this.forwardWord()
    }
  }

  isLetterOrNum(ch: string) {
    if (ch >= '0' && ch <= '9') return true
    return ch.toLowerCase() != ch.toUpperCase()
  }

  isStartOfWord(str: string, pos: number) {
    if (pos <= 0) return true
    return this.isLetterOrNum(str[pos]) && !this.isLetterOrNum(str[pos - 1])
  }

  isEndOfWord(str: string, pos: number) {
    if (pos >= str.length) return true
    return !this.isLetterOrNum(str[pos]) && this.isLetterOrNum(str[pos - 1])
  }

  backwardWord() {
    if (this.left.length == 0) return
    for (let pos = this.left.length - 1; pos >= 0; pos--) {
      if (this.isStartOfWord(this.left, pos)) {
        const tmp = this.left.substring(0, pos)
        this.right = this.left.substring(pos) + this.right
        this.left = tmp
        break
      }
    }
  }

  forwardWord() {
    if (this.right.length == 0) return
    for (let pos = 1; pos <= this.right.length; pos++) {
      if (this.isEndOfWord(this.right, pos)) {
        this.left = this.left + this.right.substring(0, pos)
        this.right = this.right.substring(pos)
        break
      }
    }
  }

  goHome() {
    this.right = this.left + this.right
    this.left = ''
  }

  goEnd() {
    this.left = this.left + this.right
    this.right = ''
  }

  editLine(ch: string, key?: KeypressKey) {
    if (!ch && key) this.handleNavigationKey(key)
    else if (this.isBackspace(ch)) this.left = this.left.slice(0, -1)
    else if (ch === CTRL_A) this.goHome()
    else if (ch === CTRL_E) this.goEnd()
    else this.left += ch
    this.showLine()
  }

  showLine() {
    moveCursor({ row: this.row, col: 1 })
    clearLine()
    process.stdout.write(this.left + this.right)
    moveCursor(this.getCursorPosition())
  }

  getLine(): string {
    return this.left + this.right
  }

  setLine(line: string) {
    this.left = line
    this.right = ''
  }

  setRow(row: number) {
    this.row = row
  }

  getCursorPosition(): CursorPosition {
    return { row: this.row, col: this.left.length + 1 }
  }
}

// @ts-expect-error - CommonJS module without types
export { showCursor, hideCursor } from 'node-terminal-menu'

export type CursorPosition = { row: number; col: number }

export function clearScreen() {
  // Clear the screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H\n')
}

export function alternateScreen() {
  process.stdout.write('\x1b[?1049h')
}

export function normalScreen() {
  process.stdout.write('\x1b[?1049l')
}

export function moveCursor({ row, col }: CursorPosition) {
  process.stdout.write(`\x1b[${row};${col}H`)
}

export function clearLine() {
  process.stdout.write('\x1b[2K\r')
}

function bgRGB(r: number, g: number, b: number) {
  return `\x1b[48;2;${r};${g};${b}m`
}

function fgRGB(r: number, g: number, b: number) {
  return `\x1b[38;2;${r};${g};${b}m`
}

const RESET_COLOR_SEQUENCE = '\x1b[0m'

function reset(s: string) {
  return RESET_COLOR_SEQUENCE + s
}

// Standard terminal color names to ANSI codes
const NAMED_COLORS: Record<string, string> = {
  black: '0',
  red: '1',
  green: '2',
  yellow: '3',
  blue: '4',
  magenta: '5',
  cyan: '6',
  white: '7',
  default: '9',
  // Bright variants
  'bright-black': '0;1',
  'bright-red': '1;1',
  'bright-green': '2;1',
  'bright-yellow': '3;1',
  'bright-blue': '4;1',
  'bright-magenta': '5;1',
  'bright-cyan': '6;1',
  'bright-white': '7;1'
}

function parseCssHex(hex: string): { r?: number; g?: number; b?: number } {
  if (hex.length != 7 || !hex.startsWith('#')) return {}
  const r = parseInt(hex.substring(1, 3), 16)
  const g = parseInt(hex.substring(3, 5), 16)
  const b = parseInt(hex.substring(5, 7), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return {}
  return { r, g, b }
}

/**
 * Parse a color value (CSS hex, named color, or 256-color number).
 * Returns ANSI escape sequence for foreground or background.
 */
function parseColor(color: string, isBg: boolean): string {
  const prefix = isBg ? '48' : '38'
  // CSS hex color
  const { r, g, b } = parseCssHex(color)
  if (r !== undefined && g !== undefined && b !== undefined) {
    return `\x1b[${prefix};2;${r};${g};${b}m`
  }
  // Named color
  const namedCode = NAMED_COLORS[color.toLowerCase()]
  if (namedCode) {
    const [code, bright] = namedCode.split(';')
    const baseCode = isBg ? 40 : 30
    if (bright) {
      return `\x1b[${baseCode + parseInt(code)};1m`
    }
    return `\x1b[${baseCode + parseInt(code)}m`
  }
  // 256-color number
  const colorNum = parseInt(color, 10)
  if (!isNaN(colorNum) && colorNum >= 0 && colorNum <= 255) {
    return `\x1b[${prefix};5;${colorNum}m`
  }
  return ''
}

/**
 * Parse a zsh-syntax-highlighting style string.
 * Format: comma-separated list of fg=color, bg=color, and style names.
 * Examples: "fg=green", "fg=#ff0000,bold", "fg=cyan,bg=black,underline"
 */
export function parseStyleString(style: string): (s: string) => string {
  const parts = style.split(',').map(p => p.trim())
  const prefixes: string[] = []
  const suffixes: string[] = []

  for (const part of parts) {
    if (part.startsWith('fg=')) {
      const color = part.slice(3)
      const seq = parseColor(color, false)
      if (seq) prefixes.push(seq)
    } else if (part.startsWith('bg=')) {
      const color = part.slice(3)
      const seq = parseColor(color, true)
      if (seq) prefixes.push(seq)
    } else {
      // Style modifiers
      switch (part.toLowerCase()) {
        case 'bold':
          prefixes.push('\x1b[1m')
          suffixes.push('\x1b[22m')
          break
        case 'dim':
          prefixes.push('\x1b[2m')
          suffixes.push('\x1b[22m')
          break
        case 'italic':
          prefixes.push('\x1b[3m')
          suffixes.push('\x1b[23m')
          break
        case 'underline':
          prefixes.push('\x1b[4m')
          suffixes.push('\x1b[24m')
          break
        case 'blink':
          prefixes.push('\x1b[5m')
          suffixes.push('\x1b[25m')
          break
        case 'reverse':
        case 'standout':
          prefixes.push('\x1b[7m')
          suffixes.push('\x1b[27m')
          break
        case 'hidden':
          prefixes.push('\x1b[8m')
          suffixes.push('\x1b[28m')
          break
        case 'strikethrough':
          prefixes.push('\x1b[9m')
          suffixes.push('\x1b[29m')
          break
        case 'none':
          return reset
      }
    }
  }
  if (prefixes.length === 0) {
    return (s: string) => s
  }
  const prefix = prefixes.join('')
  // Only append end sequences for styles (not colors) - colors reset naturally
  const suffix = suffixes.length > 0 ? suffixes.join('') : ''
  return (s: string) => prefix + s + suffix
}

export function fgColorFunc(hex: string) {
  const { r, g, b } = parseCssHex(hex)
  if (r === undefined) return reset
  const prefix = fgRGB(r, g!, b!)
  return (s: string) => prefix + s
}

export function bgColorFunc(hex: string) {
  const { r, g, b } = parseCssHex(hex)
  if (r === undefined) return reset
  const prefix = bgRGB(r, g!, b!)
  return (s: string) => prefix + s + RESET_COLOR_SEQUENCE
}

export function underline(s: string) {
  const UNDERLINE_START = '\x1b[4m'
  const UNDERLINE_END = '\x1b[24m'
  return UNDERLINE_START + s + UNDERLINE_END
}

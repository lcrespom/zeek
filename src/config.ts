export const Config = {
  menuRow: 2,
  lineEditOverMenu: false,
  menuWidth: 80,
  menuHeight: 40,
  maxCmdHistoryLines: 1000,
  maxDirHistoryLines: 1000
}

// Monokai color palette
const COLOR_GREEN = '#a6e22e'
const COLOR_FUCHSIA = '#f92672'
const COLOR_CYAN = '#66d9ef'
const COLOR_ORANGE = '#fd971f'
const COLOR_PURPLE = '#ae81ff'
const COLOR_YELLOW = '#e6db74'
const COLOR_GREY = '#75715e'
const COLOR_WHITE = '#ffffff'

const DEFAULT_SYNTAX_HIGHLIGHT = {
  'unknown-token': COLOR_FUCHSIA,
  'reserved-word': COLOR_FUCHSIA,
  builtin: COLOR_GREEN,
  command: COLOR_GREEN,
  precommand: COLOR_GREEN,
  commandseparator: COLOR_WHITE,
  path: COLOR_YELLOW,
  globbing: COLOR_ORANGE,
  'history-expansion': COLOR_PURPLE,
  'single-hyphen-option': COLOR_PURPLE,
  'double-hyphen-option': COLOR_PURPLE,
  'single-quoted-argument': COLOR_ORANGE,
  'single-quoted-argument-unclosed': COLOR_FUCHSIA,
  'double-quoted-argument': COLOR_ORANGE,
  'double-quoted-argument-unclosed': COLOR_FUCHSIA,
  'dollar-quoted-argument': COLOR_ORANGE,
  'dollar-quoted-argument-unclosed': COLOR_FUCHSIA,
  'back-quoted-argument': COLOR_CYAN,
  'back-quoted-argument-unclosed': COLOR_FUCHSIA,
  'command-substitution': COLOR_CYAN,
  'process-substitution': COLOR_CYAN,
  'arithmetic-expansion': COLOR_PURPLE,
  assign: COLOR_YELLOW,
  redirection: COLOR_WHITE,
  comment: COLOR_GREY,
  variable: COLOR_YELLOW,
  default: COLOR_CYAN
}

export const SyntaxHighlight = DEFAULT_SYNTAX_HIGHLIGHT

export function initConfig(): boolean {
  // Build config from environment variables starting with ZEEK_
  const configMap: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ZEEK_') && value !== undefined) {
      configMap[key] = value
    }
  }
  applyConfig(configMap)
  return true
}

function applyConfig(configMap: Record<string, string>) {
  if (configMap.ZEEK_MENU_ROW) {
    const row = parseInt(configMap.ZEEK_MENU_ROW, 10)
    if (!isNaN(row)) Config.menuRow = row
    if (Config.menuRow == 1) Config.menuRow = 2 // Nasty table-menu bug
  }
  if (configMap.ZEEK_MENU_SIZE) {
    const sizes = configMap.ZEEK_MENU_SIZE.split('x')
    if (sizes.length === 2) {
      const width = parseInt(sizes[0], 10)
      const height = parseInt(sizes[1], 10)
      if (!isNaN(width) && !isNaN(height)) {
        Config.menuWidth = width
        Config.menuHeight = height
      }
    }
  }
  if (configMap.ZEEK_LINE_EDIT_OVER_MENU) {
    const val = configMap.ZEEK_LINE_EDIT_OVER_MENU.toLowerCase()
    Config.lineEditOverMenu = val === 'true' || val === '1' || val === 'yes'
  }
  if (configMap.ZEEK_MAX_CMD_HISTORY_LINES) {
    const maxCmdLines = parseInt(configMap.ZEEK_MAX_CMD_HISTORY_LINES, 10)
    if (!isNaN(maxCmdLines)) Config.maxCmdHistoryLines = maxCmdLines
  }
  if (configMap.ZEEK_MAX_DIR_HISTORY_LINES) {
    const maxDirLines = parseInt(configMap.ZEEK_MAX_DIR_HISTORY_LINES, 10)
    if (!isNaN(maxDirLines)) Config.maxDirHistoryLines = maxDirLines
  }
}

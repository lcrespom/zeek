import type { ZshTokenType } from './zsh-tokenizer/zsh-tokenizer.ts'

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

// Default syntax highlighting styles using Monokai colors
// Values are style strings: "fg=#hexcolor" or zsh-syntax-highlighting format
const DEFAULT_SYNTAX_HIGHLIGHT: Record<ZshTokenType, string> = {
  'unknown-token': `fg=${COLOR_FUCHSIA}`,
  'reserved-word': `fg=${COLOR_FUCHSIA}`,
  builtin: `fg=${COLOR_GREEN},underline`,
  command: `fg=${COLOR_GREEN}`,
  precommand: `fg=${COLOR_GREEN}`,
  commandseparator: `fg=${COLOR_WHITE}`,
  path: `fg=${COLOR_YELLOW}`,
  globbing: `fg=${COLOR_ORANGE}`,
  'history-expansion': `fg=${COLOR_PURPLE}`,
  'single-hyphen-option': `fg=${COLOR_PURPLE}`,
  'double-hyphen-option': `fg=${COLOR_PURPLE}`,
  'single-quoted-argument': `fg=${COLOR_ORANGE}`,
  'single-quoted-argument-unclosed': `fg=${COLOR_FUCHSIA}`,
  'double-quoted-argument': `fg=${COLOR_ORANGE}`,
  'double-quoted-argument-unclosed': `fg=${COLOR_FUCHSIA}`,
  'dollar-quoted-argument': `fg=${COLOR_ORANGE}`,
  'dollar-quoted-argument-unclosed': `fg=${COLOR_FUCHSIA}`,
  'back-quoted-argument': `fg=${COLOR_CYAN}`,
  'back-quoted-argument-unclosed': `fg=${COLOR_FUCHSIA}`,
  'command-substitution': `fg=${COLOR_CYAN}`,
  'process-substitution': `fg=${COLOR_CYAN}`,
  'arithmetic-expansion': `fg=${COLOR_PURPLE}`,
  assign: `fg=${COLOR_YELLOW}`,
  redirection: `fg=${COLOR_WHITE}`,
  comment: `fg=${COLOR_GREY}`,
  variable: `fg=${COLOR_YELLOW}`,
  default: `fg=${COLOR_CYAN}`
}

// Mutable syntax highlight config that can be overridden
export const SyntaxHighlight: Record<ZshTokenType, string> = { ...DEFAULT_SYNTAX_HIGHLIGHT }

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
  if (configMap.ZEEK_HIGHLIGHT_STYLES) {
    applyHighlightStyles(configMap.ZEEK_HIGHLIGHT_STYLES)
  }
}

/**
 * Parse ZEEK_HIGHLIGHT_STYLES JSON and merge with defaults.
 * Format: {"token-type": "fg=color,bg=color,style,...", ...}
 */
function applyHighlightStyles(jsonString: string) {
  try {
    const styles = JSON.parse(jsonString)
    for (const [tokenType, style] of Object.entries(styles)) {
      if (typeof style === 'string' && style.length > 0) {
        SyntaxHighlight[tokenType as ZshTokenType] = style
      }
    }
  } catch {
    // Invalid JSON - silently ignore
  }
}

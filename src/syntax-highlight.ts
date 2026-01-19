import { tokenize, type ZshToken, type ZshTokenType } from './zsh-tokenizer/zsh-tokenizer.ts'
import { parseStyleString } from './terminal.ts'
import { SyntaxHighlight } from './config.ts'

// Build color functions lazily from SyntaxHighlight config (after initConfig has run)
let tokenColors: Record<ZshTokenType, (s: string) => string> | null = null

function getTokenColors(): Record<ZshTokenType, (s: string) => string> {
  if (!tokenColors) {
    tokenColors = {} as Record<ZshTokenType, (s: string) => string>
    for (const [tokenType, style] of Object.entries(SyntaxHighlight))
      tokenColors[tokenType as ZshTokenType] = parseStyleString(style)
  }
  return tokenColors
}

/**
 * Tokenize and highlight a command line, returning tokens with positions.
 */
export function highlight(line: string): ZshToken[] {
  return tokenize(line)
}

/**
 * Apply color to a single token.
 */
function applyTokenColor(text: string, token: ZshToken): string {
  const colorFunc = getTokenColors()[token.type]
  return colorFunc(text)
}

/**
 * Colorize a line using the provided tokens.
 */
function colorize(line: string, tokens: ZshToken[]): string {
  if (tokens.length === 0) return line
  let result = ''
  let pos = 0
  for (const token of tokens) {
    // Add any uncolored text before this token
    if (pos < token.start) {
      result += line.substring(pos, token.start)
    }
    // Add the colored token
    const chunk = line.substring(token.start, token.end + 1)
    result += applyTokenColor(chunk, token)
    pos = token.end + 1
  }
  // Add any remaining text after the last token
  if (pos < line.length) {
    result += line.substring(pos)
  }
  return result
}

/**
 * Highlight a command line with syntax coloring.
 */
export function highlightCommand(cmd: string): string {
  const tokens = highlight(cmd)
  return colorize(cmd, tokens)
}

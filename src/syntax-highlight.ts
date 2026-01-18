import { tokenize, type ZshToken, type ZshTokenType } from './zsh-tokenizer/zsh-tokenizer.ts'
import { fgColorFunc, underline } from './terminal.ts'

type DecoratorFunc<T> = (arg: T) => T

function composeDecorators<T>(f: DecoratorFunc<T>, g: DecoratorFunc<T>): DecoratorFunc<T> {
  return (arg: T) => g(f(arg))
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

// Color functions for each token type (zsh-syntax-highlighting compatible)
const tokenColors: Record<ZshTokenType, DecoratorFunc<string>> = {
  'unknown-token': fgColorFunc(COLOR_FUCHSIA),
  'reserved-word': fgColorFunc(COLOR_FUCHSIA),
  builtin: composeDecorators(underline, fgColorFunc(COLOR_GREEN)),
  command: fgColorFunc(COLOR_GREEN),
  precommand: fgColorFunc(COLOR_GREEN),
  commandseparator: fgColorFunc(COLOR_WHITE),
  path: fgColorFunc(COLOR_CYAN),
  globbing: fgColorFunc(COLOR_ORANGE),
  'history-expansion': fgColorFunc(COLOR_PURPLE),
  'single-hyphen-option': fgColorFunc(COLOR_PURPLE),
  'double-hyphen-option': fgColorFunc(COLOR_PURPLE),
  'single-quoted-argument': fgColorFunc(COLOR_ORANGE),
  'single-quoted-argument-unclosed': fgColorFunc(COLOR_FUCHSIA),
  'double-quoted-argument': fgColorFunc(COLOR_ORANGE),
  'double-quoted-argument-unclosed': fgColorFunc(COLOR_FUCHSIA),
  'dollar-quoted-argument': fgColorFunc(COLOR_ORANGE),
  'dollar-quoted-argument-unclosed': fgColorFunc(COLOR_FUCHSIA),
  'back-quoted-argument': fgColorFunc(COLOR_CYAN),
  'back-quoted-argument-unclosed': fgColorFunc(COLOR_FUCHSIA),
  'command-substitution': fgColorFunc(COLOR_CYAN),
  'process-substitution': fgColorFunc(COLOR_CYAN),
  'arithmetic-expansion': fgColorFunc(COLOR_PURPLE),
  assign: fgColorFunc(COLOR_YELLOW),
  redirection: fgColorFunc(COLOR_WHITE),
  comment: fgColorFunc(COLOR_GREY),
  default: fgColorFunc(COLOR_CYAN)
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
  const colorFunc = tokenColors[token.type]
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

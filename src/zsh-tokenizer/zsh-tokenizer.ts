/**
 * ZSH Tokenizer - A simplified tokenizer for zsh command lines
 *
 * This tokenizer emits token types compatible with zsh-syntax-highlighting
 * (https://github.com/zsh-users/zsh-syntax-highlighting).
 *
 * ## Supported Token Types (from zsh-syntax-highlighting main highlighter):
 * - unknown-token: Unknown tokens / errors
 * - reserved-word: Shell reserved words (if, for, while, etc.)
 * - builtin: Shell builtin commands (cd, echo, export, etc.)
 * - command: Command names (executables)
 * - precommand: Precommand modifiers (noglob, builtin, command, exec, nocorrect, etc.)
 * - commandseparator: Command separation tokens (;, &&, ||, |, &)
 * - path: Existing filenames (simplified: tokens starting with / or ./ or ../)
 * - globbing: Globbing expressions (*, ?, [...], etc.)
 * - history-expansion: History expansion (!!, !$, etc.)
 * - single-hyphen-option: Single-hyphen options (-o)
 * - double-hyphen-option: Double-hyphen options (--option)
 * - single-quoted-argument: Single-quoted strings ('...')
 * - double-quoted-argument: Double-quoted strings ("...")
 * - dollar-quoted-argument: Dollar-quoted strings ($'...')
 * - back-quoted-argument: Backtick command substitution (`...`)
 * - command-substitution: Command substitutions $(...)
 * - process-substitution: Process substitutions <(...) or >(...)
 * - arithmetic-expansion: Arithmetic expansion $((...))
 * - assign: Parameter assignments (VAR=value)
 * - redirection: Redirection operators (<, >, >>, etc.)
 * - comment: Comments (# ...)
 * - default: Everything else (plain arguments)
 *
 * ## Simplifications / Gaps:
 * - No `alias`, `suffix-alias`, `global-alias` detection (requires runtime alias lookup)
 * - No `function` detection (requires runtime function lookup)
 * - No `hashed-command` detection (requires hash table lookup)
 * - No `autodirectory` detection (requires AUTO_CD option check + directory existence)
 * - No `path_pathseparator`, `path_prefix`, `path_prefix_pathseparator` sub-highlighting
 * - No distinction between quoted/unquoted command-substitution variants
 * - No `rc-quote` detection (requires RC_QUOTES option check)
 * - No `dollar-double-quoted-argument`, `back-double-quoted-argument`,
 *   `back-dollar-quoted-argument` sub-highlighting inside strings
 * - No `named-fd`, `numeric-fd` detection in redirections
 * - No `arg0` distinction (merged with `command` or `default`)
 * - The `path` type is detected heuristically (starts with /, ./, or ../) rather than
 *   checking actual filesystem existence
 * - Reserved words like `in` after `for` are not context-aware; they require command
 *   position (e.g., after `;`) to be recognized as reserved words
 */

/** Token types compatible with zsh-syntax-highlighting */
export type ZshTokenType =
  | 'unknown-token'
  | 'reserved-word'
  | 'builtin'
  | 'command'
  | 'precommand'
  | 'commandseparator'
  | 'path'
  | 'globbing'
  | 'history-expansion'
  | 'single-hyphen-option'
  | 'double-hyphen-option'
  | 'single-quoted-argument'
  | 'single-quoted-argument-unclosed'
  | 'double-quoted-argument'
  | 'double-quoted-argument-unclosed'
  | 'dollar-quoted-argument'
  | 'dollar-quoted-argument-unclosed'
  | 'back-quoted-argument'
  | 'back-quoted-argument-unclosed'
  | 'command-substitution'
  | 'process-substitution'
  | 'arithmetic-expansion'
  | 'assign'
  | 'redirection'
  | 'comment'
  | 'default'

/** A token with its type and position in the input */
export type ZshToken = {
  type: ZshTokenType
  text: string
  start: number
  end: number
}

// Zsh reserved words
const RESERVED_WORDS = new Set(
  `if then else elif fi case esac for select while until do done in
  function time coproc [[ ]] { } ! foreach end repeat nocorrect always`.split(/\s+/)
)

// Zsh builtin commands
const BUILTINS = new Set(
  `. : alias autoload bg bindkey break builtin bye cap cd chdir clone command
  comparguments compcall compctl compdescribe compfiles compgroups compquote
  comptags comptry compvalues continue declare dirs disable disown echo echotc
  echoti emulate enable eval exec exit export false fc fg float functions
  getcap getln getopts hash history integer jobs kill let limit local log
  logout noglob popd print printf pushd pushln pwd r read readonly rehash
  return sched set setcap setopt shift source stat suspend test times trap
  true ttyctl type typeset ulimit umask unalias unfunction unhash unlimit
  unset unsetopt vared wait whence where which zcompile zformat zftp zle
  zmodload zparseopts zprof zpty zregexparse zsocket zstyle ztcp`.split(/\s+/)
)

// Precommand modifiers
const PRECOMMANDS = new Set(`builtin command exec nocorrect noglob pkexec sudo doas -`.split(/\s+/))

// Command separators
const COMMAND_SEPARATORS = new Set([';', ';;', ';&', ';|', '&&', '||', '|', '|&', '&', '&!', '&|'])

// Redirection operators (order matters for matching)
// Note: &> must be checked separately before command separators
const REDIRECTION_PATTERNS = [
  /^&>>/, // append both stdout and stderr
  /^&>/, // redirect both stdout and stderr
  /^<<</, // here-string
  /^<>/, // open for read/write
  /^>>!/, // append, clobber
  /^>>\|/, // append, clobber
  /^>>/, // append
  /^>&/, // dup stdout
  /^>!/, // clobber
  /^>\|/, // clobber
  /^<&/, // dup stdin
  /^</, // input
  /^>/ // output
]

type MatchResult = {
  text: string
  unclosed: boolean
}

/**
 * Tokenize a zsh command line into tokens with their types and positions.
 *
 * @param input The command line to tokenize
 * @returns Array of tokens
 */
export function tokenize(input: string): ZshToken[] {
  const tokens: ZshToken[] = []
  let pos = 0
  let expectCommand = true // Whether next word should be treated as a command

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos])) {
      pos++
      continue
    }

    const startPos = pos

    // Check for comment
    if (input[pos] === '#') {
      const text = input.slice(pos)
      tokens.push({
        type: 'comment',
        text,
        start: pos,
        end: input.length - 1
      })
      break
    }

    // Check for process substitution <(...) or >(...) - must be before redirections
    if ((input[pos] === '<' || input[pos] === '>') && input[pos + 1] === '(') {
      const result = matchProcessSubstitution(input, pos)
      tokens.push({
        type: 'process-substitution',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for redirections (before command separators because &> is a redirect)
    const redirMatch = matchRedirection(input, pos)
    if (redirMatch) {
      tokens.push({
        type: 'redirection',
        text: redirMatch,
        start: pos,
        end: pos + redirMatch.length - 1
      })
      pos += redirMatch.length
      expectCommand = false
      continue
    }

    // Check for command separators (multi-char first)
    const sepMatch = matchCommandSeparator(input, pos)
    if (sepMatch) {
      tokens.push({
        type: 'commandseparator',
        text: sepMatch,
        start: pos,
        end: pos + sepMatch.length - 1
      })
      pos += sepMatch.length
      expectCommand = true
      continue
    }

    // Check for arithmetic expansion $((...))
    if (input.slice(pos, pos + 3) === '$((') {
      const result = matchArithmeticExpansion(input, pos)
      tokens.push({
        type: 'arithmetic-expansion',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for command substitution $(...)
    if (input.slice(pos, pos + 2) === '$(' && input[pos + 2] !== '(') {
      const result = matchCommandSubstitution(input, pos)
      tokens.push({
        type: 'command-substitution',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for dollar-quoted string $'...'
    if (input.slice(pos, pos + 2) === "$'") {
      const result = matchDollarQuotedString(input, pos)
      tokens.push({
        type: result.unclosed ? 'dollar-quoted-argument-unclosed' : 'dollar-quoted-argument',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for single-quoted string
    if (input[pos] === "'") {
      const result = matchSingleQuotedString(input, pos)
      tokens.push({
        type: result.unclosed ? 'single-quoted-argument-unclosed' : 'single-quoted-argument',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for double-quoted string
    if (input[pos] === '"') {
      const result = matchDoubleQuotedString(input, pos)
      tokens.push({
        type: result.unclosed ? 'double-quoted-argument-unclosed' : 'double-quoted-argument',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for backtick command substitution
    if (input[pos] === '`') {
      const result = matchBacktickSubstitution(input, pos)
      tokens.push({
        type: result.unclosed ? 'back-quoted-argument-unclosed' : 'back-quoted-argument',
        text: result.text,
        start: pos,
        end: pos + result.text.length - 1
      })
      pos += result.text.length
      expectCommand = false
      continue
    }

    // Check for history expansion
    if (input[pos] === '!' && pos + 1 < input.length) {
      const histMatch = matchHistoryExpansion(input, pos)
      if (histMatch) {
        tokens.push({
          type: 'history-expansion',
          text: histMatch,
          start: pos,
          end: pos + histMatch.length - 1
        })
        pos += histMatch.length
        expectCommand = false
        continue
      }
    }

    // Match a word (handles word boundaries with quotes/expansions inside)
    const word = matchWord(input, pos)
    if (word.length > 0) {
      const token = classifyWord(word, expectCommand, pos)
      tokens.push(token)
      pos += word.length

      // Update expectCommand based on what we found
      if (token.type === 'precommand') {
        expectCommand = true // Next word is still a command
      } else if (
        token.type === 'command' ||
        token.type === 'builtin' ||
        token.type === 'reserved-word'
      ) {
        expectCommand = false // Following words are arguments
      } else if (token.type === 'assign') {
        // After assignment, could be either (VAR=val cmd or just VAR=val)
        expectCommand = true
      } else {
        expectCommand = false
      }
      continue
    }

    // Unknown character - advance
    tokens.push({
      type: 'unknown-token',
      text: input[pos],
      start: pos,
      end: pos
    })
    pos++
  }

  return tokens
}

/**
 * Match a command separator at the given position.
 */
function matchCommandSeparator(input: string, pos: number): string | null {
  // Try longer separators first
  for (const sep of [';;', ';&', ';|', '&&', '||', '|&', '&!', '&|']) {
    if (input.slice(pos, pos + sep.length) === sep) {
      return sep
    }
  }
  // Single char separators
  for (const sep of [';', '|', '&']) {
    if (input[pos] === sep) {
      return sep
    }
  }
  return null
}

/**
 * Match a redirection operator at the given position.
 */
function matchRedirection(input: string, pos: number): string | null {
  // Check for numeric fd prefix (e.g., 2>)
  let numPrefix = ''
  let checkPos = pos
  while (checkPos < input.length && /\d/.test(input[checkPos])) {
    numPrefix += input[checkPos]
    checkPos++
  }

  const remaining = input.slice(checkPos)
  for (const pattern of REDIRECTION_PATTERNS) {
    const match = remaining.match(pattern)
    if (match) {
      return numPrefix + match[0]
    }
  }

  return null
}

/**
 * Match a process substitution <(...) or >(...).
 */
function matchProcessSubstitution(input: string, pos: number): MatchResult {
  let depth = 1
  let i = pos + 2 // Skip <( or >(
  while (i < input.length && depth > 0) {
    if (input[i] === '(') depth++
    else if (input[i] === ')') depth--
    i++
  }
  return {
    text: input.slice(pos, i),
    unclosed: depth > 0
  }
}

/**
 * Match arithmetic expansion $((...)).
 */
function matchArithmeticExpansion(input: string, pos: number): MatchResult {
  let depth = 2 // Start with (( depth
  let i = pos + 3 // Skip $((
  while (i < input.length && depth > 0) {
    if (input[i] === '(' && input[i - 1] !== '\\') depth++
    else if (input[i] === ')' && input[i - 1] !== '\\') depth--
    i++
  }
  return {
    text: input.slice(pos, i),
    unclosed: depth > 0
  }
}

/**
 * Match command substitution $(...).
 */
function matchCommandSubstitution(input: string, pos: number): MatchResult {
  let depth = 1
  let i = pos + 2 // Skip $(
  while (i < input.length && depth > 0) {
    // Handle nested quotes
    if (input[i] === "'" || input[i] === '"' || input[i] === '`') {
      const quote = input[i]
      i++
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && quote !== "'") i++
        i++
      }
      i++
      continue
    }
    if (input[i] === '(') depth++
    else if (input[i] === ')') depth--
    i++
  }
  return {
    text: input.slice(pos, i),
    unclosed: depth > 0
  }
}

/**
 * Match dollar-quoted string $'...'.
 */
function matchDollarQuotedString(input: string, pos: number): MatchResult {
  let i = pos + 2 // Skip $'
  while (i < input.length) {
    if (input[i] === '\\') {
      i += 2 // Skip escape sequence
      continue
    }
    if (input[i] === "'") {
      return { text: input.slice(pos, i + 1), unclosed: false }
    }
    i++
  }
  return { text: input.slice(pos), unclosed: true }
}

/**
 * Match single-quoted string '...'.
 */
function matchSingleQuotedString(input: string, pos: number): MatchResult {
  let i = pos + 1 // Skip opening '
  while (i < input.length) {
    if (input[i] === "'") {
      return { text: input.slice(pos, i + 1), unclosed: false }
    }
    i++
  }
  return { text: input.slice(pos), unclosed: true }
}

/**
 * Match double-quoted string "...".
 */
function matchDoubleQuotedString(input: string, pos: number): MatchResult {
  let i = pos + 1 // Skip opening "
  while (i < input.length) {
    if (input[i] === '\\') {
      i += 2 // Skip escape sequence
      continue
    }
    if (input[i] === '"') {
      return { text: input.slice(pos, i + 1), unclosed: false }
    }
    i++
  }
  return { text: input.slice(pos), unclosed: true }
}

/**
 * Match backtick command substitution `...`.
 */
function matchBacktickSubstitution(input: string, pos: number): MatchResult {
  let i = pos + 1 // Skip opening `
  while (i < input.length) {
    if (input[i] === '\\') {
      i += 2 // Skip escape sequence
      continue
    }
    if (input[i] === '`') {
      return { text: input.slice(pos, i + 1), unclosed: false }
    }
    i++
  }
  return { text: input.slice(pos), unclosed: true }
}

/**
 * Match history expansion patterns.
 */
function matchHistoryExpansion(input: string, pos: number): string | null {
  // Must start with !
  if (input[pos] !== '!') return null

  const remaining = input.slice(pos)

  // !! - previous command
  if (remaining.startsWith('!!')) return '!!'

  // !$ - last argument
  if (remaining.startsWith('!$')) return '!$'

  // !^ - first argument
  if (remaining.startsWith('!^')) return '!^'

  // !* - all arguments
  if (remaining.startsWith('!*')) return '!*'

  // !-n - nth previous command
  const negMatch = remaining.match(/^!-\d+/)
  if (negMatch) return negMatch[0]

  // !n - command number n
  const numMatch = remaining.match(/^!\d+/)
  if (numMatch) return numMatch[0]

  // !?string? - search for string
  const searchMatch = remaining.match(/^!\?[^?]+\??/)
  if (searchMatch) return searchMatch[0]

  // !string - most recent command starting with string
  const strMatch = remaining.match(/^![a-zA-Z_][a-zA-Z0-9_]*/)
  if (strMatch) return strMatch[0]

  return null
}

/**
 * Match a word (unquoted sequence that may contain embedded quotes/expansions).
 */
function matchWord(input: string, pos: number): string {
  let i = pos
  const terminators = new Set([' ', '\t', '\n', ';', '&', '|', '<', '>', '#'])

  while (i < input.length) {
    const ch = input[i]

    // Word terminators (but not ( and ) which can be part of globs/expansions)
    if (terminators.has(ch)) break

    // Standalone ( or ) are terminators, but not when preceded by glob chars or $
    if (ch === '(' || ch === ')') {
      // Check if this is part of an extended glob @(...), ?(...), *(...), +(...), !(...)
      // or a command/arithmetic substitution $(...)
      if (i > pos) {
        const prevChar = input[i - 1]
        if (ch === '(' && (prevChar === '$' || '@?*+!'.includes(prevChar))) {
          // This is part of a substitution or extended glob - find matching )
          let depth = 1
          i++
          while (i < input.length && depth > 0) {
            if (input[i] === '(') depth++
            else if (input[i] === ')') depth--
            if (depth > 0) i++
          }
          if (i < input.length) i++ // Skip closing )
          continue
        }
      }
      // Otherwise it's a terminator
      break
    }

    // Handle quotes embedded in word
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && quote !== "'") i++
        i++
      }
      if (i < input.length) i++ // Skip closing quote
      continue
    }

    // Handle $'...' embedded in word
    if (ch === '$' && input[i + 1] === "'") {
      i += 2
      while (i < input.length && input[i] !== "'") {
        if (input[i] === '\\') i++
        i++
      }
      if (i < input.length) i++
      continue
    }

    // Handle $(...) embedded in word
    if (ch === '$' && input[i + 1] === '(') {
      let depth = 1
      i += 2
      while (i < input.length && depth > 0) {
        if (input[i] === '(') depth++
        else if (input[i] === ')') depth--
        i++
      }
      continue
    }

    // Handle escape
    if (ch === '\\' && i + 1 < input.length) {
      i += 2
      continue
    }

    i++
  }

  return input.slice(pos, i)
}

/**
 * Classify a word token based on its content and position.
 */
function classifyWord(word: string, expectCommand: boolean, start: number): ZshToken {
  const end = start + word.length - 1

  // Check for assignment (VAR=value or VAR+=value)
  const assignMatch = word.match(/^[a-zA-Z_][a-zA-Z0-9_]*\+?=/)
  if (assignMatch) {
    return { type: 'assign', text: word, start, end }
  }

  // Check for globbing patterns
  if (containsGlob(word)) {
    return { type: 'globbing', text: word, start, end }
  }

  // Check for path-like arguments
  if (looksLikePath(word)) {
    return { type: 'path', text: word, start, end }
  }

  // In command position
  if (expectCommand) {
    // Check reserved words
    if (RESERVED_WORDS.has(word)) {
      return { type: 'reserved-word', text: word, start, end }
    }

    // Check precommands
    if (PRECOMMANDS.has(word)) {
      return { type: 'precommand', text: word, start, end }
    }

    // Check builtins
    if (BUILTINS.has(word)) {
      return { type: 'builtin', text: word, start, end }
    }

    // Otherwise it's a command
    return { type: 'command', text: word, start, end }
  }

  // In argument position
  // Check for options
  if (word.startsWith('--') && word.length > 2) {
    return { type: 'double-hyphen-option', text: word, start, end }
  }
  if (word.startsWith('-') && word.length > 1 && !word.startsWith('--')) {
    return { type: 'single-hyphen-option', text: word, start, end }
  }

  // Default argument
  return { type: 'default', text: word, start, end }
}

/**
 * Check if a word contains glob characters.
 */
function containsGlob(word: string): boolean {
  // Skip quoted parts when checking for globs
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < word.length; i++) {
    const ch = word[i]

    if (ch === '\\' && !inSingleQuote) {
      i++ // Skip escaped character
      continue
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Glob characters
      if (ch === '*' || ch === '?') return true
      // Character class [...]
      if (ch === '[') {
        const closeBracket = word.indexOf(']', i + 1)
        if (closeBracket !== -1) return true
      }
      // Extended glob patterns @(...), ?(...), *(...), +(...), !(...)
      if ('@?*+!'.includes(ch) && i + 1 < word.length && word[i + 1] === '(') return true
    }
  }

  return false
}

/**
 * Check if a word looks like a path (heuristic).
 */
function looksLikePath(word: string): boolean {
  // Absolute path
  if (word.startsWith('/')) return true
  // Relative paths
  if (word.startsWith('./') || word.startsWith('../')) return true
  // Home directory
  if (word.startsWith('~/')) return true
  return false
}

/**
 * Simple one-shot function to get the type of the first token in a string.
 * Useful for simple highlighting needs.
 *
 * @param input The string to tokenize
 * @returns The type of the first token, or null if empty
 */
export function getFirstTokenType(input: string): ZshTokenType | null {
  const tokens = tokenize(input.trim())
  return tokens.length > 0 ? tokens[0].type : null
}

/**
 * Iterator-based tokenizer for memory-efficient processing of long command lines.
 *
 * @param input The command line to tokenize
 * @yields Tokens one at a time
 */
export function* tokenizeIterator(input: string): Generator<ZshToken> {
  for (const token of tokenize(input)) {
    yield token
  }
}

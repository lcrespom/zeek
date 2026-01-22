/**
 * Matcher functions for the ZSH tokenizer.
 * These functions identify and extract specific token patterns from input strings.
 */

/** Result from matchers that can have unclosed delimiters */
export type MatchResult = {
  text: string
  unclosed: boolean
}

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

/**
 * Match a command separator at the given position.
 */
export function matchCommandSeparator(input: string, pos: number): string | null {
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
export function matchRedirection(input: string, pos: number): string | null {
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
export function matchProcessSubstitution(input: string, pos: number): MatchResult {
  let depth = 1
  let i = pos + 2 // Skip <( or >(
  while (i < input.length && depth > 0) {
    if (input[i] === '(') depth++
    else if (input[i] === ')') depth--
    i++
  }
  return { text: input.slice(pos, i), unclosed: depth > 0 }
}

/**
 * Match arithmetic expansion $((...)).
 */
export function matchArithmeticExpansion(input: string, pos: number): MatchResult {
  let depth = 2 // Start with (( depth
  let i = pos + 3 // Skip $((
  while (i < input.length && depth > 0) {
    if (input[i] === '(' && input[i - 1] !== '\\') depth++
    else if (input[i] === ')' && input[i - 1] !== '\\') depth--
    i++
  }
  return { text: input.slice(pos, i), unclosed: depth > 0 }
}

/**
 * Match command substitution $(...).
 */
export function matchCommandSubstitution(input: string, pos: number): MatchResult {
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
  return { text: input.slice(pos, i), unclosed: depth > 0 }
}

/**
 * Match dollar-quoted string $'...'.
 */
export function matchDollarQuotedString(input: string, pos: number): MatchResult {
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
export function matchSingleQuotedString(input: string, pos: number): MatchResult {
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
export function matchDoubleQuotedString(input: string, pos: number): MatchResult {
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
export function matchBacktickSubstitution(input: string, pos: number): MatchResult {
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
 * Match a variable/parameter reference ($VAR, ${VAR}, $1, etc.).
 */
export function matchVariable(input: string, pos: number): string | null {
  if (input[pos] !== '$') return null
  const remaining = input.slice(pos)
  // ${...} - braced parameter expansion
  if (remaining[1] === '{') {
    let depth = 1
    let i = 2
    while (i < remaining.length && depth > 0) {
      if (remaining[i] === '{') depth++
      else if (remaining[i] === '}') depth--
      i++
    }
    if (depth === 0) {
      return remaining.slice(0, i)
    }
    return null // Unclosed brace - let it be handled as word
  }
  // Special parameters: $?, $$, $!, $#, $@, $*, $-, $_
  if (remaining.length > 1 && '?$!#@*-_'.includes(remaining[1])) {
    return remaining.slice(0, 2)
  }
  // Positional parameters: $0, $1, ..., $9
  if (remaining.length > 1 && /\d/.test(remaining[1])) {
    return remaining.slice(0, 2)
  }
  // Named variable: $VAR (identifier chars)
  const varMatch = remaining.match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/)
  if (varMatch) {
    return varMatch[0]
  }
  return null
}

/**
 * Match history expansion patterns.
 */
export function matchHistoryExpansion(input: string, pos: number): string | null {
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
export function matchWord(input: string, pos: number): string {
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

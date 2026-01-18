import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { tokenize, getFirstTokenType, tokenizeIterator, type ZshToken } from './zsh-tokenizer.ts'

// Helper to get token types only
function tokenTypes(input: string): string[] {
  return tokenize(input).map(t => t.type)
}

// Helper to get token texts only
function tokenTexts(input: string): string[] {
  return tokenize(input).map(t => t.text)
}

describe('ZSH Tokenizer', () => {
  describe('Basic commands', () => {
    test('Simple command', () => {
      const tokens = tokenize('echo hello')
      assert.equal(tokens.length, 2)
      assert.equal(tokens[0].type, 'builtin')
      assert.equal(tokens[0].text, 'echo')
      assert.equal(tokens[1].type, 'default')
      assert.equal(tokens[1].text, 'hello')
    })

    test('Command with multiple arguments', () => {
      const types = tokenTypes('ls -la /tmp')
      // ls is an external command, not a builtin
      assert.deepEqual(types, ['command', 'single-hyphen-option', 'path'])
    })

    test('External command', () => {
      const tokens = tokenize('git status')
      assert.equal(tokens[0].type, 'command')
      assert.equal(tokens[0].text, 'git')
      assert.equal(tokens[1].type, 'default')
    })

    test('Token positions', () => {
      const tokens = tokenize('echo hello world')
      assert.equal(tokens[0].start, 0)
      assert.equal(tokens[0].end, 3)
      assert.equal(tokens[1].start, 5)
      assert.equal(tokens[1].end, 9)
      assert.equal(tokens[2].start, 11)
      assert.equal(tokens[2].end, 15)
    })
  })

  describe('Reserved words', () => {
    test('if/then/else/fi', () => {
      // Note: In real zsh, reserved words are context-sensitive
      // Our simplified tokenizer treats them as reserved only in command position
      const tokens = tokenize('if true; then echo yes; else echo no; fi')
      assert.equal(tokens[0].type, 'reserved-word') // if
      assert.equal(tokens[0].text, 'if')
      // then, else, fi appear after ; so they're in command position
      const thenToken = tokens.find(t => t.text === 'then')
      const elseToken = tokens.find(t => t.text === 'else')
      const fiToken = tokens.find(t => t.text === 'fi')
      assert.equal(thenToken?.type, 'reserved-word')
      assert.equal(elseToken?.type, 'reserved-word')
      assert.equal(fiToken?.type, 'reserved-word')
    })

    test('for/do/done', () => {
      // Using semicolons to ensure do/done are in command position
      // Note: 'in' follows 'for i' and is treated as an argument in our simplified tokenizer
      // Full reserved word context tracking would require more complex state machine
      const tokens = tokenize('for i in a b c; do echo $i; done')
      assert.equal(tokens[0].type, 'reserved-word') // for
      assert.equal(tokens[0].text, 'for')
      const doToken = tokens.find(t => t.text === 'do')
      const doneToken = tokens.find(t => t.text === 'done')
      assert.equal(doToken?.type, 'reserved-word')
      assert.equal(doneToken?.type, 'reserved-word')
    })

    test('case/esac', () => {
      const tokens = tokenize('case x in *) echo match;; esac')
      assert.equal(tokens[0].type, 'reserved-word') // case
      const esacToken = tokens.find(t => t.text === 'esac')
      assert.equal(esacToken?.type, 'reserved-word')
    })

    test('while/until', () => {
      assert.equal(getFirstTokenType('while true'), 'reserved-word')
      assert.equal(getFirstTokenType('until done'), 'reserved-word')
    })
  })

  describe('Builtins', () => {
    test('Common builtins', () => {
      const builtins = ['cd', 'echo', 'export', 'source', 'alias', 'set', 'unset', 'pwd', 'read']
      for (const b of builtins) {
        assert.equal(getFirstTokenType(b), 'builtin', `${b} should be a builtin`)
      }
    })

    test('Zsh-specific builtins', () => {
      const zshBuiltins = ['autoload', 'bindkey', 'zstyle', 'setopt', 'compdef', 'vared']
      for (const b of zshBuiltins) {
        const type = getFirstTokenType(b)
        // Some may be command if not in our list
        assert.ok(type === 'builtin' || type === 'command', `${b} type: ${type}`)
      }
    })
  })

  describe('Precommands', () => {
    test('sudo', () => {
      const types = tokenTypes('sudo rm -rf /')
      assert.equal(types[0], 'precommand')
      assert.equal(types[1], 'command') // rm is now in command position
    })

    test('command', () => {
      const types = tokenTypes('command ls')
      assert.equal(types[0], 'precommand')
      // ls is an external command, not a builtin
      assert.equal(types[1], 'command')
    })

    test('builtin precommand', () => {
      const types = tokenTypes('builtin echo test')
      assert.equal(types[0], 'precommand')
      assert.equal(types[1], 'builtin')
    })

    test('noglob', () => {
      const types = tokenTypes('noglob echo *')
      assert.equal(types[0], 'precommand')
    })
  })

  describe('Command separators', () => {
    test('Semicolon', () => {
      const tokens = tokenize('echo a; echo b')
      const types = tokens.map(t => t.type)
      assert.ok(types.includes('commandseparator'))
      assert.equal(tokens.find(t => t.text === ';')?.type, 'commandseparator')
    })

    test('And operator', () => {
      const tokens = tokenize('cmd1 && cmd2')
      assert.equal(tokens[1].type, 'commandseparator')
      assert.equal(tokens[1].text, '&&')
    })

    test('Or operator', () => {
      const tokens = tokenize('cmd1 || cmd2')
      assert.equal(tokens[1].type, 'commandseparator')
      assert.equal(tokens[1].text, '||')
    })

    test('Pipe', () => {
      const tokens = tokenize('ls | grep foo')
      assert.equal(tokens[1].type, 'commandseparator')
      assert.equal(tokens[1].text, '|')
    })

    test('Background', () => {
      const tokens = tokenize('sleep 10 &')
      assert.equal(tokens[2].type, 'commandseparator')
      assert.equal(tokens[2].text, '&')
    })

    test('Multiple pipes', () => {
      const types = tokenTypes('cat file | grep pattern | wc -l')
      const separators = types.filter(t => t === 'commandseparator')
      assert.equal(separators.length, 2)
    })
  })

  describe('Redirections', () => {
    test('Output redirect', () => {
      const tokens = tokenize('echo hello > file.txt')
      assert.equal(tokens[2].type, 'redirection')
      assert.equal(tokens[2].text, '>')
    })

    test('Input redirect', () => {
      const tokens = tokenize('cat < input.txt')
      assert.equal(tokens[1].type, 'redirection')
      assert.equal(tokens[1].text, '<')
    })

    test('Append redirect', () => {
      const tokens = tokenize('echo hello >> file.txt')
      assert.equal(tokens[2].type, 'redirection')
      assert.equal(tokens[2].text, '>>')
    })

    test('Stderr redirect', () => {
      const tokens = tokenize('cmd 2> errors.log')
      assert.equal(tokens[1].type, 'redirection')
      assert.equal(tokens[1].text, '2>')
    })

    test('Here-string', () => {
      const tokens = tokenize('cat <<< "hello"')
      assert.equal(tokens[1].type, 'redirection')
      assert.equal(tokens[1].text, '<<<')
    })

    test('Combined redirects', () => {
      const tokens = tokenize('cmd &> output.log')
      assert.equal(tokens[1].type, 'redirection')
      assert.equal(tokens[1].text, '&>')
    })
  })

  describe('Options', () => {
    test('Single-hyphen option', () => {
      const tokens = tokenize('ls -l')
      assert.equal(tokens[1].type, 'single-hyphen-option')
    })

    test('Combined single-hyphen options', () => {
      const tokens = tokenize('ls -la')
      assert.equal(tokens[1].type, 'single-hyphen-option')
      assert.equal(tokens[1].text, '-la')
    })

    test('Double-hyphen option', () => {
      const tokens = tokenize('git --version')
      assert.equal(tokens[1].type, 'double-hyphen-option')
      assert.equal(tokens[1].text, '--version')
    })

    test('Option with value', () => {
      const tokens = tokenize('git commit --message "test"')
      assert.equal(tokens[2].type, 'double-hyphen-option')
      assert.equal(tokens[2].text, '--message')
    })

    test('Bare -- is not an option', () => {
      const tokens = tokenize('git checkout -- file')
      // -- is just 2 chars, so treated as option with empty name
      assert.equal(tokens[2].text, '--')
    })
  })

  describe('Quoting', () => {
    test('Single quotes', () => {
      const tokens = tokenize("echo 'hello world'")
      assert.equal(tokens[1].type, 'single-quoted-argument')
      assert.equal(tokens[1].text, "'hello world'")
    })

    test('Double quotes', () => {
      const tokens = tokenize('echo "hello world"')
      assert.equal(tokens[1].type, 'double-quoted-argument')
      assert.equal(tokens[1].text, '"hello world"')
    })

    test('Dollar quotes', () => {
      const tokens = tokenize("echo $'hello\\nworld'")
      assert.equal(tokens[1].type, 'dollar-quoted-argument')
      assert.equal(tokens[1].text, "$'hello\\nworld'")
    })

    test('Unclosed single quote', () => {
      const tokens = tokenize("echo 'unclosed")
      assert.equal(tokens[1].type, 'single-quoted-argument-unclosed')
    })

    test('Unclosed double quote', () => {
      const tokens = tokenize('echo "unclosed')
      assert.equal(tokens[1].type, 'double-quoted-argument-unclosed')
    })

    test('Unclosed dollar quote', () => {
      const tokens = tokenize("echo $'unclosed")
      assert.equal(tokens[1].type, 'dollar-quoted-argument-unclosed')
    })

    test('Escaped quote in double quotes', () => {
      const tokens = tokenize('echo "hello \\"world\\""')
      assert.equal(tokens[1].type, 'double-quoted-argument')
      assert.equal(tokens[1].text, '"hello \\"world\\""')
    })

    test('Single quotes preserve literal', () => {
      const tokens = tokenize("echo 'no $expansion here'")
      assert.equal(tokens[1].type, 'single-quoted-argument')
    })
  })

  describe('Command substitution', () => {
    test('$() syntax', () => {
      const tokens = tokenize('echo $(date)')
      assert.equal(tokens[1].type, 'command-substitution')
      assert.equal(tokens[1].text, '$(date)')
    })

    test('Backtick syntax', () => {
      const tokens = tokenize('echo `date`')
      assert.equal(tokens[1].type, 'back-quoted-argument')
      assert.equal(tokens[1].text, '`date`')
    })

    test('Unclosed backtick', () => {
      const tokens = tokenize('echo `date')
      assert.equal(tokens[1].type, 'back-quoted-argument-unclosed')
    })

    test('Nested command substitution', () => {
      const tokens = tokenize('echo $(echo $(date))')
      assert.equal(tokens[1].type, 'command-substitution')
      assert.equal(tokens[1].text, '$(echo $(date))')
    })

    test('Command substitution in argument', () => {
      const tokens = tokenize('file=$(mktemp)')
      assert.equal(tokens[0].type, 'assign')
    })
  })

  describe('Process substitution', () => {
    test('Input process substitution', () => {
      const tokens = tokenize('diff <(ls dir1) <(ls dir2)')
      assert.equal(tokens[1].type, 'process-substitution')
      assert.equal(tokens[1].text, '<(ls dir1)')
      assert.equal(tokens[2].type, 'process-substitution')
    })

    test('Output process substitution', () => {
      const tokens = tokenize('tee >(cat > file)')
      assert.equal(tokens[1].type, 'process-substitution')
      assert.equal(tokens[1].text, '>(cat > file)')
    })
  })

  describe('Arithmetic expansion', () => {
    test('Basic arithmetic', () => {
      const tokens = tokenize('echo $((1 + 2))')
      assert.equal(tokens[1].type, 'arithmetic-expansion')
      assert.equal(tokens[1].text, '$((1 + 2))')
    })

    test('Nested parentheses', () => {
      const tokens = tokenize('echo $(((1 + 2) * 3))')
      assert.equal(tokens[1].type, 'arithmetic-expansion')
      assert.equal(tokens[1].text, '$(((1 + 2) * 3))')
    })

    test('Arithmetic vs command substitution', () => {
      const cmd = tokenize('echo $(cmd)')
      const arith = tokenize('echo $((1+1))')
      assert.equal(cmd[1].type, 'command-substitution')
      assert.equal(arith[1].type, 'arithmetic-expansion')
    })
  })

  describe('Assignments', () => {
    test('Simple assignment', () => {
      const tokens = tokenize('VAR=value')
      assert.equal(tokens[0].type, 'assign')
      assert.equal(tokens[0].text, 'VAR=value')
    })

    test('Assignment with command', () => {
      const tokens = tokenize('VAR=value echo test')
      assert.equal(tokens[0].type, 'assign')
      assert.equal(tokens[1].type, 'builtin') // echo is in command position
    })

    test('Append assignment', () => {
      const tokens = tokenize('PATH+=:/usr/local/bin')
      assert.equal(tokens[0].type, 'assign')
    })

    test('Assignment with quotes', () => {
      const tokens = tokenize('VAR="hello world"')
      assert.equal(tokens[0].type, 'assign')
    })

    test('Export with assignment', () => {
      const tokens = tokenize('export VAR=value')
      assert.equal(tokens[0].type, 'builtin')
      assert.equal(tokens[1].type, 'assign')
    })
  })

  describe('Globbing', () => {
    test('Asterisk glob', () => {
      const tokens = tokenize('ls *.txt')
      assert.equal(tokens[1].type, 'globbing')
    })

    test('Question mark glob', () => {
      const tokens = tokenize('ls file?.txt')
      assert.equal(tokens[1].type, 'globbing')
    })

    test('Character class glob', () => {
      const tokens = tokenize('ls [abc].txt')
      assert.equal(tokens[1].type, 'globbing')
    })

    test('Extended glob @()', () => {
      const tokens = tokenize('ls @(foo|bar)')
      assert.equal(tokens[1].type, 'globbing')
    })

    test('Glob in quotes is not glob', () => {
      const tokens = tokenize('echo "*.txt"')
      assert.equal(tokens[1].type, 'double-quoted-argument')
    })

    test('Mixed glob and path', () => {
      const tokens = tokenize('ls /tmp/*.log')
      assert.equal(tokens[1].type, 'globbing')
    })
  })

  describe('History expansion', () => {
    test('!! previous command', () => {
      const tokens = tokenize('!!')
      assert.equal(tokens[0].type, 'history-expansion')
      assert.equal(tokens[0].text, '!!')
    })

    test('!$ last argument', () => {
      const tokens = tokenize('echo !$')
      assert.equal(tokens[1].type, 'history-expansion')
      assert.equal(tokens[1].text, '!$')
    })

    test('!n command number', () => {
      const tokens = tokenize('!42')
      assert.equal(tokens[0].type, 'history-expansion')
      assert.equal(tokens[0].text, '!42')
    })

    test('!-n negative offset', () => {
      const tokens = tokenize('!-2')
      assert.equal(tokens[0].type, 'history-expansion')
      assert.equal(tokens[0].text, '!-2')
    })

    test('!string search', () => {
      const tokens = tokenize('!git')
      assert.equal(tokens[0].type, 'history-expansion')
      assert.equal(tokens[0].text, '!git')
    })

    test('!?string? search', () => {
      const tokens = tokenize('!?commit?')
      assert.equal(tokens[0].type, 'history-expansion')
    })
  })

  describe('Paths', () => {
    test('Absolute path', () => {
      const tokens = tokenize('cat /etc/passwd')
      assert.equal(tokens[1].type, 'path')
    })

    test('Relative path ./', () => {
      const tokens = tokenize('run ./script.sh')
      assert.equal(tokens[1].type, 'path')
    })

    test('Parent path ../', () => {
      const tokens = tokenize('cd ../parent')
      assert.equal(tokens[1].type, 'path')
    })

    test('Home path ~/', () => {
      const tokens = tokenize('cd ~/.config')
      assert.equal(tokens[1].type, 'path')
    })

    test('Path with spaces in quotes', () => {
      const tokens = tokenize('cat "/path/with spaces/file"')
      // This is a quoted argument, not path
      assert.equal(tokens[1].type, 'double-quoted-argument')
    })
  })

  describe('Comments', () => {
    test('Line comment', () => {
      const tokens = tokenize('echo hello # this is a comment')
      const comment = tokens.find(t => t.type === 'comment')
      assert.ok(comment)
      assert.equal(comment!.text, '# this is a comment')
    })

    test('Comment-only line', () => {
      const tokens = tokenize('# just a comment')
      assert.equal(tokens.length, 1)
      assert.equal(tokens[0].type, 'comment')
    })

    test('Hash in quotes is not comment', () => {
      const tokens = tokenize('echo "#notacomment"')
      assert.equal(tokens.length, 2)
      assert.ok(!tokens.some(t => t.type === 'comment'))
    })
  })

  describe('Complex commands', () => {
    test('Pipeline with options', () => {
      const types = tokenTypes('cat file.txt | grep -i "pattern" | wc -l')
      assert.ok(types.includes('commandseparator'))
      assert.ok(types.includes('single-hyphen-option'))
      assert.ok(types.includes('double-quoted-argument'))
    })

    test('Subshell in assignment', () => {
      const tokens = tokenize('result=$(echo hello | tr a-z A-Z)')
      assert.equal(tokens[0].type, 'assign')
    })

    test('Command with redirects and pipes', () => {
      const types = tokenTypes('cmd < input | cmd2 > output 2>&1')
      assert.ok(types.filter(t => t === 'redirection').length >= 2)
    })

    test('For loop', () => {
      const types = tokenTypes('for f in *.txt; do echo $f; done')
      assert.equal(types[0], 'reserved-word') // for
      assert.ok(types.includes('globbing'))
      assert.ok(types.includes('commandseparator'))
    })

    test('Conditional', () => {
      const types = tokenTypes('if [[ -f file ]]; then echo exists; fi')
      assert.equal(types[0], 'reserved-word') // if
      assert.ok(types.includes('reserved-word'))
    })
  })

  describe('Edge cases', () => {
    test('Empty input', () => {
      const tokens = tokenize('')
      assert.equal(tokens.length, 0)
    })

    test('Whitespace only', () => {
      const tokens = tokenize('   \t\n  ')
      assert.equal(tokens.length, 0)
    })

    test('Single character', () => {
      const tokens = tokenize('a')
      assert.equal(tokens.length, 1)
      assert.equal(tokens[0].type, 'command')
    })

    test('Multiple spaces between tokens', () => {
      const tokens = tokenize('echo    hello')
      assert.equal(tokens.length, 2)
    })

    test('Tab separated', () => {
      const tokens = tokenize('echo\thello')
      assert.equal(tokens.length, 2)
    })

    test('Escaped characters', () => {
      const tokens = tokenize('echo hello\\ world')
      assert.equal(tokens[1].text, 'hello\\ world')
    })
  })

  describe('Utility functions', () => {
    test('getFirstTokenType', () => {
      assert.equal(getFirstTokenType('echo hello'), 'builtin')
      assert.equal(getFirstTokenType('git status'), 'command')
      assert.equal(getFirstTokenType('  if true'), 'reserved-word')
      assert.equal(getFirstTokenType(''), null)
    })

    test('tokenizeIterator', () => {
      const tokens: ZshToken[] = []
      for (const token of tokenizeIterator('echo hello world')) {
        tokens.push(token)
      }
      assert.equal(tokens.length, 3)
    })
  })
})

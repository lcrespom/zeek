import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { getWordUnderCursor, splitPathAndFile, resolveDir } from './file-list.ts'

describe('getWordUnderCursor', () => {
  describe('Empty input', () => {
    test('empty lbuffer and rbuffer', () => {
      const result = getWordUnderCursor('', '')
      assert.deepEqual(result, { word: '', prefix: '', suffix: '' })
    })

    test('lbuffer with trailing space, empty rbuffer', () => {
      const result = getWordUnderCursor('ls ', '')
      assert.deepEqual(result, { word: '', prefix: 'ls ', suffix: '' })
    })
  })

  describe('Plain alphanumeric (no path)', () => {
    test('single word in lbuffer', () => {
      const result = getWordUnderCursor('foo', '')
      assert.deepEqual(result, { word: 'foo', prefix: '', suffix: '' })
    })

    test('command followed by partial word', () => {
      const result = getWordUnderCursor('ls foo', '')
      assert.deepEqual(result, { word: 'foo', prefix: 'ls ', suffix: '' })
    })

    test('word split across lbuffer and rbuffer', () => {
      const result = getWordUnderCursor('ls fo', 'o')
      assert.deepEqual(result, { word: 'foo', prefix: 'ls ', suffix: '' })
    })

    test('cursor in middle of word with more text after', () => {
      const result = getWordUnderCursor('ls fo', 'o bar')
      assert.deepEqual(result, { word: 'foo', prefix: 'ls ', suffix: ' bar' })
    })
  })

  describe('Relative paths', () => {
    test('relative path with partial filename', () => {
      const result = getWordUnderCursor('ls src/ind', '')
      assert.deepEqual(result, { word: 'src/ind', prefix: 'ls ', suffix: '' })
    })

    test('relative path ending with slash', () => {
      const result = getWordUnderCursor('ls src/', '')
      assert.deepEqual(result, { word: 'src/', prefix: 'ls ', suffix: '' })
    })

    test('dot-relative path', () => {
      const result = getWordUnderCursor('cat ./file', '')
      assert.deepEqual(result, { word: './file', prefix: 'cat ', suffix: '' })
    })

    test('parent directory path', () => {
      const result = getWordUnderCursor('cd ../par', '')
      assert.deepEqual(result, { word: '../par', prefix: 'cd ', suffix: '' })
    })

    test('nested relative path', () => {
      const result = getWordUnderCursor('vim src/zsh-tokenizer/tok', '')
      assert.deepEqual(result, { word: 'src/zsh-tokenizer/tok', prefix: 'vim ', suffix: '' })
    })
  })

  describe('Absolute paths', () => {
    test('absolute path with partial filename', () => {
      const result = getWordUnderCursor('cat /usr/local/b', '')
      assert.deepEqual(result, { word: '/usr/local/b', prefix: 'cat ', suffix: '' })
    })

    test('absolute path ending with slash', () => {
      const result = getWordUnderCursor('ls /usr/local/', '')
      assert.deepEqual(result, { word: '/usr/local/', prefix: 'ls ', suffix: '' })
    })

    test('root directory', () => {
      const result = getWordUnderCursor('ls /', '')
      assert.deepEqual(result, { word: '/', prefix: 'ls ', suffix: '' })
    })
  })

  describe('Home directory paths', () => {
    test('home path with partial filename', () => {
      const result = getWordUnderCursor('cat ~/Doc', '')
      assert.deepEqual(result, { word: '~/Doc', prefix: 'cat ', suffix: '' })
    })

    test('home path ending with slash', () => {
      const result = getWordUnderCursor('ls ~/', '')
      assert.deepEqual(result, { word: '~/', prefix: 'ls ', suffix: '' })
    })

    test('nested home path', () => {
      const result = getWordUnderCursor('vim ~/.config/zeek/con', '')
      assert.deepEqual(result, { word: '~/.config/zeek/con', prefix: 'vim ', suffix: '' })
    })
  })

  describe('Multiple arguments', () => {
    test('multiple args, cursor at last', () => {
      const result = getWordUnderCursor('cp file1.txt dest/', '')
      assert.deepEqual(result, { word: 'dest/', prefix: 'cp file1.txt ', suffix: '' })
    })

    test('flags before path', () => {
      const result = getWordUnderCursor('ls -la src/ind', '')
      assert.deepEqual(result, { word: 'src/ind', prefix: 'ls -la ', suffix: '' })
    })
  })

  describe('Suffix preservation', () => {
    test('pipe after word', () => {
      const result = getWordUnderCursor('cat pa', ' | grep "type"')
      assert.deepEqual(result, { word: 'pa', prefix: 'cat ', suffix: ' | grep "type"' })
    })

    test('multiple words after', () => {
      const result = getWordUnderCursor('ls src/ind', 'ex.ts file2.ts')
      assert.deepEqual(result, { word: 'src/index.ts', prefix: 'ls ', suffix: ' file2.ts' })
    })

    test('redirection after', () => {
      const result = getWordUnderCursor('cat fi', 'le > output.txt')
      assert.deepEqual(result, { word: 'file', prefix: 'cat ', suffix: ' > output.txt' })
    })
  })
})

describe('splitPathAndFile', () => {
  describe('Empty and simple inputs', () => {
    test('empty string', () => {
      const result = splitPathAndFile('')
      assert.deepEqual(result, { dir: '', file: '' })
    })

    test('plain filename (no path)', () => {
      const result = splitPathAndFile('foo')
      assert.deepEqual(result, { dir: '', file: 'foo' })
    })

    test('partial filename', () => {
      const result = splitPathAndFile('ind')
      assert.deepEqual(result, { dir: '', file: 'ind' })
    })
  })

  describe('Relative paths', () => {
    test('relative path with filename', () => {
      const result = splitPathAndFile('src/index')
      assert.deepEqual(result, { dir: 'src/', file: 'index' })
    })

    test('relative path ending with slash', () => {
      const result = splitPathAndFile('src/')
      assert.deepEqual(result, { dir: 'src/', file: '' })
    })

    test('nested relative path', () => {
      const result = splitPathAndFile('src/zsh-tokenizer/tok')
      assert.deepEqual(result, { dir: 'src/zsh-tokenizer/', file: 'tok' })
    })

    test('dot-relative path', () => {
      const result = splitPathAndFile('./file')
      assert.deepEqual(result, { dir: './', file: 'file' })
    })

    test('parent directory path', () => {
      const result = splitPathAndFile('../parent')
      assert.deepEqual(result, { dir: '../', file: 'parent' })
    })
  })

  describe('Absolute paths', () => {
    test('absolute path with filename', () => {
      const result = splitPathAndFile('/usr/local/bin')
      assert.deepEqual(result, { dir: '/usr/local/', file: 'bin' })
    })

    test('absolute path ending with slash', () => {
      const result = splitPathAndFile('/usr/local/')
      assert.deepEqual(result, { dir: '/usr/local/', file: '' })
    })

    test('root directory', () => {
      const result = splitPathAndFile('/')
      assert.deepEqual(result, { dir: '/', file: '' })
    })

    test('file in root', () => {
      const result = splitPathAndFile('/etc')
      assert.deepEqual(result, { dir: '/', file: 'etc' })
    })
  })

  describe('Home directory paths', () => {
    test('home path with filename', () => {
      const result = splitPathAndFile('~/Documents')
      assert.deepEqual(result, { dir: '~/', file: 'Documents' })
    })

    test('home path ending with slash', () => {
      const result = splitPathAndFile('~/')
      assert.deepEqual(result, { dir: '~/', file: '' })
    })

    test('nested home path', () => {
      const result = splitPathAndFile('~/.config/zeek')
      assert.deepEqual(result, { dir: '~/.config/', file: 'zeek' })
    })
  })
})

describe('resolveDir', () => {
  const cwd = process.cwd()
  const home = process.env.HOME || ''

  describe('Empty and current directory', () => {
    test('empty string returns cwd', () => {
      const result = resolveDir('')
      assert.equal(result, cwd)
    })
  })

  describe('Relative paths', () => {
    test('relative directory', () => {
      const result = resolveDir('src/')
      assert.equal(result, `${cwd}/src`)
    })

    test('dot-relative path', () => {
      const result = resolveDir('./')
      assert.equal(result, cwd)
    })

    test('parent directory', () => {
      const result = resolveDir('../')
      // Should be parent of cwd
      const expected = cwd.split('/').slice(0, -1).join('/')
      assert.equal(result, expected)
    })
  })

  describe('Absolute paths', () => {
    test('absolute path unchanged', () => {
      const result = resolveDir('/usr/local/')
      assert.equal(result, '/usr/local')
    })

    test('root directory', () => {
      const result = resolveDir('/')
      assert.equal(result, '/')
    })
  })

  describe('Home directory paths', () => {
    test('home path expanded', () => {
      const result = resolveDir('~/')
      assert.equal(result, home)
    })

    test('nested home path expanded', () => {
      const result = resolveDir('~/.config/')
      assert.equal(result, `${home}/.config`)
    })
  })
})

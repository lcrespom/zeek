import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

import { LineEditor, type KeypressKey } from './line-editor.ts'

// Mock process.stdout.write to prevent actual terminal output
const originalWrite = process.stdout.write
beforeEach(() => {
  process.stdout.write = mock.fn(() => true)
})

// Helper to create a KeypressKey object
function key(name: string, opts: Partial<KeypressKey> = {}): KeypressKey {
  return {
    name,
    sequence: opts.sequence ?? '',
    code: opts.code ?? '',
    ctrl: opts.ctrl ?? false,
    meta: opts.meta ?? false,
    shift: opts.shift ?? false
  }
}

describe('LineEditor', () => {
  describe('Constructor and basic state', () => {
    test('empty constructor creates empty line', () => {
      const editor = new LineEditor()
      assert.equal(editor.getLine(), '')
    })

    test('constructor with initial line', () => {
      const editor = new LineEditor('hello world')
      assert.equal(editor.getLine(), 'hello world')
    })

    test('cursor starts at end of initial line', () => {
      const editor = new LineEditor('hello', 1)
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 6 })
    })

    test('setLine replaces content', () => {
      const editor = new LineEditor('old')
      editor.setLine('new content')
      assert.equal(editor.getLine(), 'new content')
    })

    test('setRow updates row', () => {
      const editor = new LineEditor('test', 1)
      editor.setRow(5)
      assert.equal(editor.getCursorPosition().row, 5)
    })
  })

  describe('isBackspace', () => {
    test('recognizes backspace character \\u0008', () => {
      const editor = new LineEditor()
      assert.equal(editor.isBackspace('\u0008'), true)
    })

    test('recognizes delete character \\u007F', () => {
      const editor = new LineEditor()
      assert.equal(editor.isBackspace('\u007F'), true)
    })

    test('rejects regular characters', () => {
      const editor = new LineEditor()
      assert.equal(editor.isBackspace('a'), false)
      assert.equal(editor.isBackspace(' '), false)
    })
  })

  describe('isLineEditKey', () => {
    test('recognizes navigation keys', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('', key('left')), true)
      assert.equal(editor.isLineEditKey('', key('right')), true)
      assert.equal(editor.isLineEditKey('', key('home')), true)
      assert.equal(editor.isLineEditKey('', key('end')), true)
      assert.equal(editor.isLineEditKey('', key('delete')), true)
    })

    test('recognizes alt-b and alt-f for word navigation', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('', key('b', { meta: true })), true)
      assert.equal(editor.isLineEditKey('', key('f', { meta: true })), true)
    })

    test('recognizes backspace', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('\u0008', key('backspace')), true)
    })

    test('recognizes Ctrl-A and Ctrl-E', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('\u0001', key('a', { ctrl: true })), true)
      assert.equal(editor.isLineEditKey('\u0005', key('e', { ctrl: true })), true)
    })

    test('recognizes printable characters', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('a', key('a')), true)
      assert.equal(editor.isLineEditKey('Z', key('Z')), true)
      assert.equal(editor.isLineEditKey('0', key('0')), true)
      assert.equal(editor.isLineEditKey(' ', key('space')), true)
      assert.equal(editor.isLineEditKey('!', key('!')), true)
    })

    test('rejects non-edit keys', () => {
      const editor = new LineEditor()
      assert.equal(editor.isLineEditKey('', key('up')), false)
      assert.equal(editor.isLineEditKey('', key('down')), false)
      assert.equal(editor.isLineEditKey('', key('escape')), false)
    })
  })

  describe('isLetterOrNum', () => {
    test('recognizes digits', () => {
      const editor = new LineEditor()
      for (const ch of '0123456789') {
        assert.equal(editor.isLetterOrNum(ch), true, `${ch} should be letter or num`)
      }
    })

    test('recognizes letters', () => {
      const editor = new LineEditor()
      for (const ch of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        assert.equal(editor.isLetterOrNum(ch), true, `${ch} should be letter or num`)
      }
    })

    test('rejects special characters', () => {
      const editor = new LineEditor()
      for (const ch of ' !@#$%^&*()-_=+[]{}|;:\'",.<>?/`~') {
        assert.equal(editor.isLetterOrNum(ch), false, `${ch} should not be letter or num`)
      }
    })
  })

  describe('isStartOfWord', () => {
    test('position 0 is always start of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isStartOfWord('hello', 0), true)
    })

    test('letter after space is start of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isStartOfWord('hello world', 6), true)
    })

    test('letter after letter is not start of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isStartOfWord('hello', 2), false)
    })

    test('space is not start of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isStartOfWord('hello world', 5), false)
    })
  })

  describe('isEndOfWord', () => {
    test('position at end is always end of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isEndOfWord('hello', 5), true)
    })

    test('space after letter is end of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isEndOfWord('hello world', 5), true)
    })

    test('letter after letter is not end of word', () => {
      const editor = new LineEditor()
      assert.equal(editor.isEndOfWord('hello', 2), false)
    })
  })

  describe('Cursor navigation', () => {
    test('left arrow moves cursor left', () => {
      const editor = new LineEditor('hello', 1)
      editor.handleNavigationKey(key('left'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 5 })
    })

    test('left arrow at start does nothing', () => {
      const editor = new LineEditor('', 1)
      editor.handleNavigationKey(key('left'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 1 })
    })

    test('right arrow moves cursor right', () => {
      const editor = new LineEditor('hello', 1)
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('right'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 5 })
    })

    test('right arrow at end does nothing', () => {
      const editor = new LineEditor('hello', 1)
      editor.handleNavigationKey(key('right'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 6 })
    })

    test('home moves cursor to start', () => {
      const editor = new LineEditor('hello world', 1)
      editor.handleNavigationKey(key('home'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 1 })
      assert.equal(editor.getLine(), 'hello world')
    })

    test('end moves cursor to end', () => {
      const editor = new LineEditor('hello world', 1)
      editor.handleNavigationKey(key('home'))
      editor.handleNavigationKey(key('end'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 12 })
    })

    test('delete removes character after cursor', () => {
      const editor = new LineEditor('hello', 1)
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('delete'))
      assert.equal(editor.getLine(), 'helo')
    })

    test('delete at end does nothing', () => {
      const editor = new LineEditor('hello', 1)
      editor.handleNavigationKey(key('delete'))
      assert.equal(editor.getLine(), 'hello')
    })
  })

  describe('Word navigation', () => {
    test('backwardWord moves to start of current word', () => {
      const editor = new LineEditor('hello world', 1)
      editor.backwardWord()
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 7 })
    })

    test('backwardWord from middle of line', () => {
      const editor = new LineEditor('one two three', 1)
      editor.backwardWord()
      assert.equal(editor.getCursorPosition().col, 9) // before 'three'
      editor.backwardWord()
      assert.equal(editor.getCursorPosition().col, 5) // before 'two'
    })

    test('backwardWord at start does nothing', () => {
      const editor = new LineEditor('hello', 1)
      editor.goHome()
      editor.backwardWord()
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 1 })
    })

    test('forwardWord moves to end of current word', () => {
      const editor = new LineEditor('hello world', 1)
      editor.goHome()
      editor.forwardWord()
      assert.equal(editor.getCursorPosition().col, 6) // after 'hello'
    })

    test('forwardWord from middle of line', () => {
      const editor = new LineEditor('one two three', 1)
      editor.goHome()
      editor.forwardWord()
      assert.equal(editor.getCursorPosition().col, 4) // after 'one'
      editor.forwardWord()
      assert.equal(editor.getCursorPosition().col, 8) // after 'two'
    })

    test('forwardWord at end does nothing', () => {
      const editor = new LineEditor('hello', 1)
      editor.forwardWord()
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 6 })
    })

    test('alt-b triggers backwardWord', () => {
      const editor = new LineEditor('hello world', 1)
      editor.handleNavigationKey(key('b', { meta: true }))
      assert.equal(editor.getCursorPosition().col, 7)
    })

    test('alt-f triggers forwardWord', () => {
      const editor = new LineEditor('hello world', 1)
      editor.goHome()
      editor.handleNavigationKey(key('f', { meta: true }))
      assert.equal(editor.getCursorPosition().col, 6)
    })
  })

  describe('Text editing with editLine', () => {
    test('inserting character', () => {
      const editor = new LineEditor('hllo', 1)
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('left'))
      editor.handleNavigationKey(key('left'))
      editor.editLine('e')
      assert.equal(editor.getLine(), 'hello')
    })

    test('backspace removes character before cursor', () => {
      const editor = new LineEditor('hello', 1)
      editor.editLine('\u0008')
      assert.equal(editor.getLine(), 'hell')
    })

    test('backspace at start does nothing', () => {
      const editor = new LineEditor('hello', 1)
      editor.goHome()
      editor.editLine('\u0008')
      assert.equal(editor.getLine(), 'hello')
    })

    test('Ctrl-A moves to start', () => {
      const editor = new LineEditor('hello world', 1)
      editor.editLine('\u0001')
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 1 })
    })

    test('Ctrl-E moves to end', () => {
      const editor = new LineEditor('hello world', 1)
      editor.goHome()
      editor.editLine('\u0005')
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 12 })
    })

    test('navigation key via editLine', () => {
      const editor = new LineEditor('hello', 1)
      editor.editLine('', key('left'))
      assert.deepEqual(editor.getCursorPosition(), { row: 1, col: 5 })
    })

    test('typing appends at cursor', () => {
      const editor = new LineEditor('', 1)
      editor.editLine('h')
      editor.editLine('i')
      assert.equal(editor.getLine(), 'hi')
    })
  })

  describe('Complex editing scenarios', () => {
    test('insert in middle of text', () => {
      const editor = new LineEditor('helloworld', 1)
      // Move cursor to after 'hello'
      for (let i = 0; i < 5; i++) editor.handleNavigationKey(key('left'))
      editor.editLine(' ')
      assert.equal(editor.getLine(), 'hello world')
    })

    test('delete multiple characters', () => {
      const editor = new LineEditor('hello', 1)
      editor.goHome()
      editor.handleNavigationKey(key('delete'))
      editor.handleNavigationKey(key('delete'))
      assert.equal(editor.getLine(), 'llo')
    })

    test('backspace multiple characters', () => {
      const editor = new LineEditor('hello', 1)
      editor.editLine('\u0008')
      editor.editLine('\u0008')
      assert.equal(editor.getLine(), 'hel')
    })

    test('navigate and edit preserves line integrity', () => {
      const editor = new LineEditor('one two three', 1)
      editor.handleNavigationKey(key('home'))
      editor.handleNavigationKey(key('right'))
      editor.handleNavigationKey(key('right'))
      editor.handleNavigationKey(key('right'))
      editor.handleNavigationKey(key('right'))
      // Cursor should be after 'one '
      editor.editLine('X')
      assert.equal(editor.getLine(), 'one Xtwo three')
    })
  })
})

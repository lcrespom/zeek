import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { parseStyleString, fgColorFunc, bgColorFunc } from './terminal.ts'

describe('Terminal utilities', () => {
  describe('parseStyleString', () => {
    describe('Foreground colors', () => {
      test('CSS hex color', () => {
        const style = parseStyleString('fg=#ff0000')
        assert.equal(style('test'), '\x1b[38;2;255;0;0mtest')
      })

      test('CSS hex color lowercase', () => {
        const style = parseStyleString('fg=#00ff00')
        assert.equal(style('x'), '\x1b[38;2;0;255;0mx')
      })

      test('named color - red', () => {
        const style = parseStyleString('fg=red')
        assert.equal(style('test'), '\x1b[31mtest')
      })

      test('named color - cyan', () => {
        const style = parseStyleString('fg=cyan')
        assert.equal(style('test'), '\x1b[36mtest')
      })

      test('named color - default', () => {
        const style = parseStyleString('fg=default')
        assert.equal(style('test'), '\x1b[39mtest')
      })

      test('named color case insensitive', () => {
        const style = parseStyleString('fg=GREEN')
        assert.equal(style('test'), '\x1b[32mtest')
      })

      test('bright color variant', () => {
        const style = parseStyleString('fg=bright-red')
        assert.equal(style('test'), '\x1b[31;1mtest')
      })

      test('256-color number', () => {
        const style = parseStyleString('fg=123')
        assert.equal(style('test'), '\x1b[38;5;123mtest')
      })

      test('256-color number 0', () => {
        const style = parseStyleString('fg=0')
        assert.equal(style('test'), '\x1b[38;5;0mtest')
      })

      test('256-color number 255', () => {
        const style = parseStyleString('fg=255')
        assert.equal(style('test'), '\x1b[38;5;255mtest')
      })
    })

    describe('Background colors', () => {
      test('CSS hex color', () => {
        const style = parseStyleString('bg=#0000ff')
        assert.equal(style('test'), '\x1b[48;2;0;0;255mtest')
      })

      test('named color - blue', () => {
        const style = parseStyleString('bg=blue')
        assert.equal(style('test'), '\x1b[44mtest')
      })

      test('256-color number', () => {
        const style = parseStyleString('bg=200')
        assert.equal(style('test'), '\x1b[48;5;200mtest')
      })

      test('bright color variant', () => {
        const style = parseStyleString('bg=bright-yellow')
        assert.equal(style('test'), '\x1b[43;1mtest')
      })
    })

    describe('Style modifiers', () => {
      test('bold', () => {
        const style = parseStyleString('bold')
        assert.equal(style('test'), '\x1b[1mtest\x1b[22m')
      })

      test('dim', () => {
        const style = parseStyleString('dim')
        assert.equal(style('test'), '\x1b[2mtest\x1b[22m')
      })

      test('italic', () => {
        const style = parseStyleString('italic')
        assert.equal(style('test'), '\x1b[3mtest\x1b[23m')
      })

      test('underline', () => {
        const style = parseStyleString('underline')
        assert.equal(style('test'), '\x1b[4mtest\x1b[24m')
      })

      test('blink', () => {
        const style = parseStyleString('blink')
        assert.equal(style('test'), '\x1b[5mtest\x1b[25m')
      })

      test('reverse', () => {
        const style = parseStyleString('reverse')
        assert.equal(style('test'), '\x1b[7mtest\x1b[27m')
      })

      test('standout (alias for reverse)', () => {
        const style = parseStyleString('standout')
        assert.equal(style('test'), '\x1b[7mtest\x1b[27m')
      })

      test('hidden', () => {
        const style = parseStyleString('hidden')
        assert.equal(style('test'), '\x1b[8mtest\x1b[28m')
      })

      test('strikethrough', () => {
        const style = parseStyleString('strikethrough')
        assert.equal(style('test'), '\x1b[9mtest\x1b[29m')
      })

      test('style modifier case insensitive', () => {
        const style = parseStyleString('BOLD')
        assert.equal(style('test'), '\x1b[1mtest\x1b[22m')
      })
    })

    describe('Combined styles', () => {
      test('fg and bg', () => {
        const style = parseStyleString('fg=red,bg=blue')
        assert.equal(style('test'), '\x1b[31m\x1b[44mtest')
      })

      test('fg with bold', () => {
        const style = parseStyleString('fg=green,bold')
        assert.equal(style('test'), '\x1b[32m\x1b[1mtest\x1b[22m')
      })

      test('fg, bg, and style', () => {
        const style = parseStyleString('fg=cyan,bg=black,underline')
        assert.equal(style('test'), '\x1b[36m\x1b[40m\x1b[4mtest\x1b[24m')
      })

      test('multiple style modifiers', () => {
        const style = parseStyleString('bold,underline')
        assert.equal(style('test'), '\x1b[1m\x1b[4mtest\x1b[22m\x1b[24m')
      })

      test('spaces around parts are trimmed', () => {
        const style = parseStyleString('fg=red , bold')
        assert.equal(style('test'), '\x1b[31m\x1b[1mtest\x1b[22m')
      })
    })

    describe('Special cases', () => {
      test('none returns reset function', () => {
        const style = parseStyleString('none')
        assert.equal(style('test'), '\x1b[0mtest')
      })

      test('empty string returns identity function', () => {
        const style = parseStyleString('')
        assert.equal(style('test'), 'test')
      })

      test('invalid color returns identity function', () => {
        const style = parseStyleString('fg=notacolor')
        assert.equal(style('test'), 'test')
      })

      test('invalid hex color', () => {
        const style = parseStyleString('fg=#xyz')
        assert.equal(style('test'), 'test')
      })

      test('invalid 256-color number (out of range)', () => {
        const style = parseStyleString('fg=300')
        assert.equal(style('test'), 'test')
      })

      test('negative number', () => {
        const style = parseStyleString('fg=-1')
        assert.equal(style('test'), 'test')
      })

      test('hex color wrong length', () => {
        const style = parseStyleString('fg=#ff00')
        assert.equal(style('test'), 'test')
      })

      test('unknown style modifier is ignored', () => {
        const style = parseStyleString('fg=red,unknownstyle')
        assert.equal(style('test'), '\x1b[31mtest')
      })
    })
  })

  describe('fgColorFunc', () => {
    test('valid hex color', () => {
      const colorize = fgColorFunc('#ff8800')
      assert.equal(colorize('test'), '\x1b[38;2;255;136;0mtest')
    })

    test('invalid hex color returns reset function', () => {
      const colorize = fgColorFunc('invalid')
      assert.equal(colorize('test'), '\x1b[0mtest')
    })

    test('empty string returns reset function', () => {
      const colorize = fgColorFunc('')
      assert.equal(colorize('test'), '\x1b[0mtest')
    })

    test('hex color without hash returns reset', () => {
      const colorize = fgColorFunc('ff0000')
      assert.equal(colorize('test'), '\x1b[0mtest')
    })
  })

  describe('bgColorFunc', () => {
    test('valid hex color', () => {
      const colorize = bgColorFunc('#00ff00')
      assert.equal(colorize('test'), '\x1b[48;2;0;255;0mtest\x1b[0m')
    })

    test('includes reset suffix', () => {
      const colorize = bgColorFunc('#ffffff')
      const result = colorize('x')
      assert.ok(result.endsWith('\x1b[0m'))
    })

    test('invalid hex color returns reset function', () => {
      const colorize = bgColorFunc('bad')
      assert.equal(colorize('test'), '\x1b[0mtest')
    })
  })

  describe('Color code correctness', () => {
    test('all named colors produce valid codes', () => {
      const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
      const expectedCodes = [30, 31, 32, 33, 34, 35, 36, 37]

      for (let i = 0; i < colors.length; i++) {
        const style = parseStyleString(`fg=${colors[i]}`)
        const result = style('x')
        assert.ok(result.includes(`\x1b[${expectedCodes[i]}m`), `${colors[i]} should produce code ${expectedCodes[i]}`)
      }
    })

    test('background colors use 40-47 range', () => {
      const style = parseStyleString('bg=red')
      assert.ok(style('x').includes('\x1b[41m'))
    })

    test('RGB true color uses 38;2 prefix for fg', () => {
      const style = parseStyleString('fg=#123456')
      assert.ok(style('x').startsWith('\x1b[38;2;'))
    })

    test('RGB true color uses 48;2 prefix for bg', () => {
      const style = parseStyleString('bg=#654321')
      assert.ok(style('x').startsWith('\x1b[48;2;'))
    })

    test('256 color uses 38;5 prefix for fg', () => {
      const style = parseStyleString('fg=100')
      assert.ok(style('x').startsWith('\x1b[38;5;100m'))
    })

    test('256 color uses 48;5 prefix for bg', () => {
      const style = parseStyleString('bg=50')
      assert.ok(style('x').startsWith('\x1b[48;5;50m'))
    })
  })
})

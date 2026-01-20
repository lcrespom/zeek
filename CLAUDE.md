# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Overview

Zeek is a Zsh shell enhancement tool that provides interactive, syntax-highlighted popups for
command history and directory navigation. It combines Zsh scripting with a Node.js/TypeScript CLI
backend.

## Build & Run Commands

```shell
# Run the CLI directly (requires Node.js 24+)
node src/index.ts <command> [args]

# Run tests
node --test src/zsh-tokenizer/zsh-tokenizer.test.ts

# Install dependencies
npm install
```

The tool is designed to be invoked from the Zsh shell via the `zeek` alias defined in `zeek.zsh`.

## Architecture

### Two-Part Architecture

1. **Zsh Side** (`zeek.zsh`):
   - Binds keyboard shortcuts to custom Zsh widgets
   - Captures current command line buffer (`LBUFFER`/`RBUFFER`)
   - Calls Node.js CLI with appropriate command
   - Receives selected text via file descriptor 3

2. **Node.js Side** (`src/index.ts`):
   - Entry point handling four commands: `help`, `history`, `store-dir`, `dir-history`
   - Uses alternate screen buffer for popup display
   - Writes selections back to Zsh via `/dev/fd/3`

### Key Modules

- **`src/history-popup.ts`**: Main popup UI class using `node-terminal-menu` for interactive menus
  with filtering
- **`src/line-editor.ts`**: Custom line editor implementation handling cursor movement, word
  navigation, and text editing
- **`src/syntax-highlight.ts`**: Zsh command syntax highlighting using token-based colorization
- **`src/zsh-tokenizer/zsh-tokenizer.ts`**: Lightweight zsh tokenizer compatible with
  zsh-syntax-highlighting token types
- **`src/terminal.ts`**: ANSI escape sequence utilities for cursor control, colors, and screen
  management
- **`src/config.ts`**: Reads configuration from `ZEEK_*` variables defined in `zeek.zsh`

### Data Flow

1. User presses Page Up/Down in Zsh
2. Zsh widget calls `zeek history` or `zeek dir-history` with current buffer
3. Node.js renders popup in alternate screen buffer
4. User filters/selects item
5. Selection written to fd 3, read by Zsh, updates command line

### Configuration

Configuration is stored as environment variables with prefix `ZEEK_` (exported by `zeek.zsh`):

- `ZEEK_MENU_SIZE`: Menu dimensions as `WIDTHxHEIGHT` (default: `120x40`)
- `ZEEK_MENU_ROW`: Row position, positive=top, negative=bottom (default: `2`)
- `ZEEK_LINE_EDIT_OVER_MENU`: Show line editor above menu (default: `false`)
- `ZEEK_MAX_CMD_HISTORY_LINES`: Max command history lines (default: `2000`)
- `ZEEK_MAX_DIR_HISTORY_LINES`: Max directory history entries (default: `200`)
- `ZEEK_HIGHLIGHT_STYLES`: JSON object with syntax highlighting overrides (auto-generated from
  `ZSH_HIGHLIGHT_STYLES` if zsh-syntax-highlighting is installed)

### Syntax Highlighting System

The syntax highlighting system has three layers:

1. **Tokenizer** (`src/zsh-tokenizer/zsh-tokenizer.ts`): Parses command lines into tokens with types
   compatible with zsh-syntax-highlighting (command, builtin, variable, path, etc.)

2. **Config** (`src/config.ts`): Defines default Monokai-based styles for each token type. Styles
   use the format `fg=color,bg=color,style` where colors can be CSS hex (`#ff0000`), named colors
   (`cyan`), or 256-color numbers (`123`). Styles include `bold`, `underline`, `italic`, etc.

3. **Style Parser** (`src/terminal.ts`): `parseStyleString()` converts style strings to ANSI escape
   sequences. Handles foreground/background colors and text decorations.

**Important**: `tokenColors` in `syntax-highlight.ts` is built lazily on first use to ensure
`initConfig()` has already processed `ZEEK_HIGHLIGHT_STYLES` overrides.

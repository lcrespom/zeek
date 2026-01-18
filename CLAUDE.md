# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zeek is a Zsh shell enhancement tool that provides interactive, syntax-highlighted popups for command history and directory navigation. It combines Zsh scripting with a Node.js/TypeScript CLI backend.

## Build & Run Commands

```bash
# Run the CLI directly (requires Node.js 24+)
node src/index.ts <command> [args]

# Run tests
node --test src/bash-parser/parser.test.ts

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

- **`src/history-popup.ts`**: Main popup UI class using `node-terminal-menu` for interactive menus with filtering
- **`src/line-editor.ts`**: Custom line editor implementation handling cursor movement, word navigation, and text editing
- **`src/syntax-highlight.ts`**: Bash command syntax highlighting using AST-based parsing
- **`src/bash-parser/parser.ts`**: Wrapper around `bash-parser` with error recovery for partial/incomplete commands
- **`src/terminal.ts`**: ANSI escape sequence utilities for cursor control, colors, and screen management
- **`src/config.ts`**: Reads configuration from `ZEEK_*` variables defined in `zeek.zsh`

### Data Flow

1. User presses Page Up/Down in Zsh
2. Zsh widget calls `zeek history` or `zeek dir-history` with current buffer
3. Node.js renders popup in alternate screen buffer
4. User filters/selects item
5. Selection written to fd 3, read by Zsh, updates command line

### Configuration

Configuration is stored as shell variables in `zeek.zsh` (prefix `ZEEK_`). The Node.js side reads these by parsing the Zsh script file directly.

# Zeek

Zeek is a **Zsh shell enhancement tool** that provides interactive, syntax-highlighted popups for
command history and directory navigation. It's a powerful, visual alternative to the standard Ctrl+R
history search in the terminal, bringing IDE-like features (syntax highlighting, fuzzy search,
visual interface) to the command line.

## Core Functionality

The project provides three main features:

### 1. **Command History Popup** (Page Up)

- Shows your Zsh command history in an interactive menu
- Features:
  - **Fuzzy filtering**: Type multiple words and it filters commands containing all of them.
  - **Syntax highlighting**: Commands are colorized like in a code editor. There are specific colors
    for commands, programs, builtins, parameters, strings and comments.
  - **Multi-line support**: Multi-line commands are shown with a visual newline character (↵).
  - **Deduplication**: Duplicate commands are removed, only the most recent one is displayed.

### 2. **Directory History Popup** (Page Down)

- Tracks and displays recently visited directories
- Allows quick navigation to previous directories with `cd`
- Automatically records directory changes via the `chpwd` hook
- Stores history in `~/.dir_history`

### 3. **File Search** (Shift+Right) - Not yet implemented

- Placeholder for future file navigation feature

## Usage

### Requirements

- [Zsh](https://www.zsh.org/) shell
- [Node.js](https://nodejs.org) version 24 or later

### Installation

Simply clone this repository. To enable Zeek features, you need to source `zeek.zsh`, i.e. run
`source [zeek-install-path]/zeek.zsh` from the zsh command line. To enable Zeek for all your future
zsh sessions, add the line

```zsh
source [zeek-install-path]/zeek.zsh
```

At the end of your `~/.zshrc` file.

## How It Works

The architecture is a combination of **Zsh shell scripting** and **Node.js/TypeScript**:

1. **Zsh Side** ([zeek.zsh](zeek.zsh)):

   - Binds keyboard shortcuts to custom Zsh widgets
   - Captures the current command line buffer (`LBUFFER`/`RBUFFER`)
   - Calls the Node.js CLI with the appropriate command
   - Receives selected text via file descriptor 3 and updates the command line

2. **Node.js Side** ([src/index.ts](src/index.ts)):
   - Handles four commands: `help`, `history`, `store-dir`, `dir-history`
   - Uses alternate screen buffer (so the popup doesn't mess up your terminal)
   - Implements a full-featured line editor with:
     - Cursor movement (left, right, home, end, word navigation)
     - Deletion and backspace
     - Real-time filtering
   - Renders an interactive menu with keyboard navigation
   - Writes the selected item back to Zsh via `/dev/fd/3`

## Technical Highlights

1. **Bash Parser**: Custom bash parser to enable syntax highlighting

   - Identifies commands, builtins, parameters, redirects, quotes, etc.
   - Applies appropriate colors to each element

2. **Interactive Line Editor**:

   - Splits line into left (before cursor) and right (after cursor)
   - Supports word-based navigation (Alt+Left/Right)
   - Handles all standard editing operations

3. **Smart Menu System**:

   - Configurable size and position (can be at top or bottom of screen)
   - Line editor can be above or below the menu
   - Scrollbar for long lists
   - Preserves cursor position

4. **Configuration**:
   - Reads settings from the Zsh script itself
   - Configurable menu size, position, and history limits

## Key Bindings

- **Page Up**: Command history popup
- **Page Down**: Directory history popup
- **Shift+Up**: Go to parent directory (`cd ..`)
- **Shift+Right**: File search (not implemented yet)
- **ESC**: Clear current line
- **Home/End**: Navigate to start/end of line
- **Option+Left/Right**: Word navigation

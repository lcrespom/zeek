# Zeek

Zeek is a **Zsh shell enhancement tool** that provides interactive, syntax-highlighted popups for
command history and directory navigation. It's a powerful, visual alternative to the standard Ctrl+R
history search in the terminal, bringing IDE-like features (syntax highlighting, fuzzy search,
visual interface) to the command line.

## Core Functionality

Zeek provides three main features:

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

### 3. **File Search** (Shift+Right)

- Interactive file browser for quick file path insertion
- Features:
  - **Directory listing**: Shows files with permissions, owner, size, date, and name
  - **Directory navigation**: Press Tab to enter a directory, Backspace to go up
  - **Fuzzy filtering**: Type to filter by filename

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

### Key Bindings

- **Page Up**: Command history popup
- **Page Down**: Directory history popup
- **Shift+Up**: Go to parent directory (`cd ..`)
- **Shift+Right**: File search popup
- **ESC**: Clear current line
- **Home/End**: Navigate to start/end of line
- **Option+Left/Right**: Word navigation

## How It Works

The architecture is a combination of **Zsh shell scripting** and **Node.js/TypeScript**:

1. **Zsh Side** ([zeek.zsh](zeek.zsh)):
   - Binds keyboard shortcuts to custom Zsh widgets
   - Captures the current command line buffer (`LBUFFER`/`RBUFFER`)
   - Calls the Node.js CLI with the appropriate command
   - Receives selected text via file descriptor 3 and updates the command line

2. **Node.js Side** ([src/index.ts](src/index.ts)):
   - Handles five commands: `help`, `history`, `store-dir`, `dir-history`, `file-search`
   - Uses alternate screen buffer (so the popup doesn't mess up your terminal)
   - Implements a full-featured line editor with:
     - Cursor movement (left, right, home, end, word navigation)
     - Deletion and backspace
     - Real-time filtering
   - Renders an interactive menu with keyboard navigation
   - Writes the selected item back to Zsh via `/dev/fd/3`

## Configuration

Zeek is configured via environment variables defined in `zeek.zsh`. You can customize these values
by editing the file or setting them in your `~/.zshrc` before sourcing `zeek.zsh`.

| Variable                     | Description                                  | Default  |
| ---------------------------- | -------------------------------------------- | -------- |
| `ZEEK_MENU_SIZE`             | Menu dimensions as `WIDTHxHEIGHT`            | `120x40` |
| `ZEEK_MENU_ROW`              | Row position (positive=top, negative=bottom) | `2`      |
| `ZEEK_LINE_EDIT_OVER_MENU`   | Show line editor above menu (`true`/`false`) | `false`  |
| `ZEEK_MAX_CMD_HISTORY_LINES` | Max command history lines to load            | `2000`   |
| `ZEEK_MAX_DIR_HISTORY_LINES` | Max directory history entries                | `200`    |

### Syntax Highlighting

Zeek uses a Monokai-inspired color scheme by default for syntax highlighting. If you have
[zsh-syntax-highlighting](https://github.com/zsh-users/zsh-syntax-highlighting) installed, Zeek will
automatically inherit your `ZSH_HIGHLIGHT_STYLES` settings, so both your command line and Zeek's
history popup will use the same colors.

The style format supports:

- **Foreground colors**: `fg=green`, `fg=#ff0000`, `fg=123` (256-color)
- **Background colors**: `bg=black`, `bg=#000000`
- **Styles**: `bold`, `dim`, `italic`, `underline`, `blink`, `reverse`, `strikethrough`
- **Combined**: `fg=cyan,bold,underline`

## Technical Highlights

1. **Zsh Tokenizer**: Custom zsh tokenizer for syntax highlighting
   - Compatible with zsh-syntax-highlighting token types
   - Identifies commands, builtins, reserved words, options, variables, redirects, quotes, etc.
   - Supports variables (`$VAR`, `${VAR}`, `$1`, `$?`), command/process substitution, arithmetic
     expansion
   - Applies configurable colors to each token type

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
   - Reads settings from `ZEEK_*` environment variables
   - Inherits syntax highlighting from zsh-syntax-highlighting if available
   - Configurable menu size, position, and history limits

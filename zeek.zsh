# ------------------------- Configuration -------------------------
# Zeek menu size, in width x height chars. Negative numbers indicate distance to the terminal edges.
ZEEK_MENU_SIZE=120x40
# Zeek menu row. Positive numbers refer to the top row, negative numbers to the bottom row.
ZEEK_MENU_ROW=2
# Line editor position relative to the menu. If true, the line editor will be shown above the menu;
# if false, it will be shown below the menu.
ZEEK_LINE_EDIT_OVER_MENU=false

# Maximun number of command history lines to get from zsh. Duplicates are removed, so the history popup
# will probably have fewer entries.
ZEEK_MAX_CMD_HISTORY_LINES=2000

# Maximun number of directory history lines to get from zsh. Duplicates are not stored, so the directory
# history popup will have exactly this many entries (or fewer, if not that many directories have been
# visited).
ZEEK_MAX_DIR_HISTORY_LINES=200

# Derive syntax highlighting styles as JSON from zsh-syntax-highlighting settings, if they exist
[[ -n $ZSH_HIGHLIGHT_STYLES ]] && ZEEK_HIGHLIGHT_STYLES="{$(for key value in "${(@kv)ZSH_HIGHLIGHT_STYLES}"; do printf '"%s": "%s", ' "$key" "$value"; done | sed 's/, $//')}"

export ZEEK_DIR="${0:A:h}"
alias zeek='node $ZEEK_DIR/src/index.ts </dev/tty 3>&1 1>&2'
# ------------------------- Configuration end -------------------------

# Record every time the user changes directory
function chpwd() {
    zeek store-dir "$PWD"
}

# Open Zeek dir history popup
function dir_history_popup() {
    local new_dir=$(zeek dir-history "$LBUFFER" "$RBUFFER")
    if [[ -n "$new_dir" ]]; then
        echo
        cd ${~new_dir}  # Use ${~var} to allow for tilde expansion
        zle reset-prompt
    fi
}

# Open Zeek command history popup
function history_popup() {
    local history_command=$(zeek history "$LBUFFER" "$RBUFFER")
    if [[ -n "$history_command" ]]; then
        LBUFFER="$history_command"
        RBUFFER=""
    fi
}

# Open Zeek popup in the file search page (not implemented yet)
function file_search_popup() {
    local search_out=$(zeek file-search "$LBUFFER" "$PWD")
    if [[ -n "$search_out" ]]; then
      LBUFFER=$search_out
    fi
}

# Just move one directory up
function cd_to_parent_dir() {
    echo
    cd ..
    zle reset-prompt
}

# Clear the whole line
function clear_line() {
    LBUFFER=""
    RBUFFER=""
}

# Register the functions as widgets
zle -N dir_history_popup
zle -N history_popup
zle -N file_search_popup
zle -N cd_to_parent_dir
zle -N clear_line

# Key codes
KB_PAGE_UP="^[[5~"
KB_PAGE_DOWN="^[[6~"
KB_HOME="^[[H"
KB_SHIFT_UP="^[[1;2A"
KB_SHIFT_RIGHT="^[[1;2C"
KB_END="^[[F"
KB_TAB="^I"
KB_ESC="\e"
KB_OPTION_LEFT="^[^[[D"
KB_OPTION_RIGHT="^[^[[C"

# Bind the activation keys to the widgets
bindkey $KB_PAGE_DOWN dir_history_popup
bindkey $KB_PAGE_UP history_popup
bindkey $KB_SHIFT_RIGHT file_search_popup
bindkey $KB_SHIFT_UP cd_to_parent_dir
bindkey $KB_ESC clear_line

# Bind home, end, opt+left and opt+right keys for convenience
bindkey $KB_HOME beginning-of-line
bindkey $KB_END end-of-line
bindkey $KB_OPTION_LEFT backward-word
bindkey $KB_OPTION_RIGHT forward-word

# Disable default tab completion
# unsetopt complete_in_word

# Reduce key sequence timeout to only 100ms to make ESC key react faster
KEYTIMEOUT=10
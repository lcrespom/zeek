export const Config = {
  menuRow: 2,
  lineEditOverMenu: false,
  menuWidth: 80,
  menuHeight: 40,
  maxCmdHistoryLines: 1000,
  maxDirHistoryLines: 1000
}

export function initConfig(): boolean {
  // Build config from environment variables starting with ZEEK_
  const configMap: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ZEEK_') && value !== undefined) {
      configMap[key] = value
    }
  }
  applyConfig(configMap)
  return true
}

function applyConfig(configMap: Record<string, string>) {
  if (configMap.ZEEK_MENU_ROW) {
    const row = parseInt(configMap.ZEEK_MENU_ROW, 10)
    if (!isNaN(row)) Config.menuRow = row
    if (Config.menuRow == 1) Config.menuRow = 2 // Nasty table-menu bug
  }
  if (configMap.ZEEK_MENU_SIZE) {
    const sizes = configMap.ZEEK_MENU_SIZE.split('x')
    if (sizes.length === 2) {
      const width = parseInt(sizes[0], 10)
      const height = parseInt(sizes[1], 10)
      if (!isNaN(width) && !isNaN(height)) {
        Config.menuWidth = width
        Config.menuHeight = height
      }
    }
  }
  if (configMap.ZEEK_LINE_EDIT_OVER_MENU) {
    const val = configMap.ZEEK_LINE_EDIT_OVER_MENU.toLowerCase()
    Config.lineEditOverMenu = val === 'true' || val === '1' || val === 'yes'
  }
  if (configMap.ZEEK_MAX_CMD_HISTORY_LINES) {
    const maxCmdLines = parseInt(configMap.ZEEK_MAX_CMD_HISTORY_LINES, 10)
    if (!isNaN(maxCmdLines)) Config.maxCmdHistoryLines = maxCmdLines
  }
  if (configMap.ZEEK_MAX_DIR_HISTORY_LINES) {
    const maxDirLines = parseInt(configMap.ZEEK_MAX_DIR_HISTORY_LINES, 10)
    if (!isNaN(maxDirLines)) Config.maxDirHistoryLines = maxDirLines
  }
}

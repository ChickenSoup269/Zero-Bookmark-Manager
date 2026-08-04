// theme-init.js — Apply theme immediately on page load to prevent FOUC
// This script runs synchronously before body renders
;(function () {
  var availableThemes = [
    'light','dark','dracula','onedark','tokyonight','nord','synthwave',
    'gruvbox','catppuccin','nightowl','nord-light','gruvbox-light',
    'catppuccin-light','nightowl-light','monokai','winter-is-coming',
    'github-blue','github-light','tet'
  ]
  var theme = localStorage.getItem('appTheme') || 'dark'
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  if (!availableThemes.includes(theme)) theme = 'dark'
  document.documentElement.setAttribute('data-theme', theme)
  document.body.className = theme + '-theme'
})()

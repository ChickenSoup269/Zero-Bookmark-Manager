// components/controller/bulkBar.js
// Floating bulk-selection action bar shared by the webview (bookmarks.html)
// and the popup (index.html).
// The bar hosts the relocated select-all control (webview), a live selection
// count, and Move/Delete/Exit shortcuts so bulk actions are visible where the
// user's eyes already are (instead of buried in the sidebar).

import { uiState } from "../state.js"
import { translations } from "../utils/utils.js"

export function applySelectButtonState(button) {
  if (!button) return
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en
  const label = uiState.checkboxesVisible
    ? t.hideCheckboxes || "Hide Checkboxes"
    : t.showCheckboxes || "Show Checkboxes"
  button.classList.toggle("active", uiState.checkboxesVisible)
  // Icon-only buttons (webview toolbar) carry the label in title/aria;
  // text buttons (popup) must update their visible text instead.
  if (button.querySelector("i")) {
    button.title = label
    button.setAttribute("aria-label", label)
  } else {
    button.textContent = label
  }
}

export function updateBulkActionBar() {
  applySelectButtonState(document.getElementById("toggle-checkboxes"))

  const bar = document.getElementById("bulk-action-bar")
  if (!bar) return

  const count = uiState.selectedBookmarks.size
  bar.classList.toggle("has-selection", count > 0)
  const isPopup = window.location.pathname.includes("index.html")
  // Webview: visible while selection mode is on (even with 0 selected, to
  // offer select-all + exit). Popup: bottom-controls already shows select-all,
  // so the bar only appears once something is selected.
  bar.classList.toggle(
    "bulk-hidden",
    count === 0 && (isPopup || !uiState.checkboxesVisible),
  )

  const countEl = document.getElementById("bulk-selected-count")
  if (countEl) countEl.textContent = String(count)

  // Let page CSS move/hide floating widgets (scroll-to-top, chat) that
  // would otherwise overlap the bar in the narrow popup viewport.
  document.body.classList.toggle(
    "bulk-bar-visible",
    !bar.classList.contains("bulk-hidden"),
  )
}

export function initBulkActionBar(elements) {
  const moveButton = document.getElementById("bulk-move-button")
  const deleteButton = document.getElementById("bulk-delete-button")
  const exitButton = document.getElementById("bulk-exit-button")

  moveButton?.addEventListener("click", () => {
    elements.addToFolderButton?.click()
  })

  deleteButton?.addEventListener("click", () => {
    elements.deleteBookmarksButton?.click()
  })

  exitButton?.addEventListener("click", () => {
    elements.toggleCheckboxesButton?.click()
  })

  updateBulkActionBar()
}

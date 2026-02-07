// components/localization.js
import { translations } from "./utils/utils.js"

export function updateBookmarksPageText() {
  const lang = localStorage.getItem("appLanguage") || "en"
  const t = (key) => translations[lang][key] || key

  // Update elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n")
    if (key) {
      element.textContent = t(key)
    }
  })

  // Update sidebar section titles
  const filtersTitle = document.getElementById("filters-title")
  if (filtersTitle) filtersTitle.textContent = t("filtersTitle")
  const searchTitle = document.getElementById("search-title")
  if (searchTitle) searchTitle.textContent = t("searchTitle")
  const folderActionsTitle = document.getElementById("folder-actions-title")
  if (folderActionsTitle) {
    folderActionsTitle.textContent = t("folderActionsTitle")
  }
  const selectionTitle = document.getElementById("selection-title")
  if (selectionTitle) selectionTitle.textContent = t("selectionTitle")
}

// Ensure the text is updated on load
document.addEventListener("DOMContentLoaded", updateBookmarksPageText)

// Listen for language changes (assuming you have an event for this)
window.addEventListener("languageChanged", updateBookmarksPageText)

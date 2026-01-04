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
  document.getElementById("filters-title").textContent = t("filtersTitle")
  document.getElementById("search-title").textContent = t("searchTitle")
  document.getElementById("folder-actions-title").textContent =
    t("folderActionsTitle")
  document.getElementById("selection-title").textContent = t("selectionTitle")
}

// Ensure the text is updated on load
document.addEventListener("DOMContentLoaded", updateBookmarksPageText)

// Listen for language changes (assuming you have an event for this)
window.addEventListener("languageChanged", updateBookmarksPageText)

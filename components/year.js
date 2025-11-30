// components/year.js
import { translations } from "./utils/utils.js" // nhớ có .js nếu dùng module

document.addEventListener("DOMContentLoaded", () => {
  // ---- YEAR ----
  const yearElement = document.getElementById("year")
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear()
  }

  // ---- VERSION ----
  const versionElement = document.getElementById("version")
  if (versionElement) {
    try {
      // Chỉ chạy trong extension context
      const manifest = chrome.runtime.getManifest()
      versionElement.textContent = manifest.version || "1.0.0"
    } catch (err) {
      console.warn("Unable to load version from manifest:", err)
      versionElement.textContent = "1.0.0"
    }
  }

  // ---- TRANSLATIONS ----
  const language = localStorage.getItem("appLanguage") || "en"
  const aiConfigTitle = document.getElementById("ai-config-title")
  if (aiConfigTitle) {
    aiConfigTitle.textContent =
      translations[language]?.aiTitle || "AI Assistant"
  }
})

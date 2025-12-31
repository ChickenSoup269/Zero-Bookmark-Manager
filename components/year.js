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
    // Check if running as a Chrome extension
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.getManifest
    ) {
      const manifest = chrome.runtime.getManifest()
      versionElement.textContent = manifest.version
    } else {
      // Fallback for local development (fetch manifest.json)
      fetch("./manifest.json")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok")
          }
          return response.json()
        })
        .then((manifest) => {
          versionElement.textContent = manifest.version || "N/A"
        })
        .catch((err) => {
          console.warn("Could not fetch or parse manifest.json:", err)
          versionElement.textContent = "đang lỗi" // Debugging
        })
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

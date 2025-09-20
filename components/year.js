import { translations } from "./utils.js"

const currentYear = new Date().getFullYear()
document.getElementById("year").textContent = currentYear
console.log("Current Year:", currentYear)

// language switcher
const language = localStorage.getItem("appLanguage") || "en"
document.getElementById("ai-config-title").textContent =
  translations[language].aiTitle || "AI Assistant"

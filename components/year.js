// components/year.js
import { translations } from "./utils.js"

const currentYear = new Date().getFullYear()
const yearElement = document.getElementById("year")
if (yearElement) {
  yearElement.textContent = currentYear
} else {
  console.warn("Element with id 'year' not found in DOM")
}

const language = localStorage.getItem("appLanguage") || "en"
const aiConfigTitle = document.getElementById("ai-config-title")
if (aiConfigTitle) {
  aiConfigTitle.textContent = translations[language].aiTitle || "AI Assistant"
}

// else {
//   console.warn("Element with id 'ai-config-title' not found in DOM")
// }

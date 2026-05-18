import { en } from '../locales/en.js';
import { vi } from '../locales/vi.js';

export const translations = {
  en,
  vi
};

// ==========================================
// FUZZY SEARCH FUNCTIONS
// ==========================================

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
  const matrix = []

  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Check if query characters appear in order within text (subsequence match)
 * @param {string} text - Text to search in
 * @param {string} query - Query string
 * @returns {object} - { matches: boolean, score: number, positions: number[] }
 */
function subsequenceMatch(text, query) {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  const positions = []
  let queryIndex = 0
  let consecutiveBonus = 0
  let lastMatchIndex = -2

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      positions.push(i)
      // Bonus for consecutive matches
      if (i === lastMatchIndex + 1) {
        consecutiveBonus += 0.1
      }
      // Bonus for matching at word boundaries
      if (i === 0 || /[\s\-_./]/.test(text[i - 1])) {
        consecutiveBonus += 0.15
      }
      lastMatchIndex = i
      queryIndex++
    }
  }

  const matches = queryIndex === queryLower.length
  const baseScore = matches ? queryLower.length / textLower.length : 0
  const score = Math.min(1, baseScore + consecutiveBonus)

  return { matches, score, positions }
}

/**
 * Calculate match score between text and query using multiple algorithms
 * @param {string} text - Text to search in
 * @param {string} query - Query string
 * @returns {number} - Score from 0 to 1 (higher is better match)
 */
export function calculateMatchScore(text, query) {
  if (!text || !query) return 0

  const textLower = text.toLowerCase().trim()
  const queryLower = query.toLowerCase().trim()

  // Empty query matches everything
  if (!queryLower) return 1

  // Exact match - highest score
  if (textLower === queryLower) return 1

  // Contains exact query - very high score
  if (textLower.includes(queryLower)) {
    // Bonus if starts with query
    if (textLower.startsWith(queryLower)) return 0.95
    // Bonus if query appears at word boundary
    const wordBoundaryRegex = new RegExp(
      `(^|[\\s\\-_./])${escapeRegex(queryLower)}`,
      "i",
    )
    if (wordBoundaryRegex.test(text)) return 0.9
    return 0.85
  }

  // Check word-by-word match (for multi-word queries)
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)
  const textWords = textLower.split(/\s+/).filter((w) => w.length > 0)

  if (queryWords.length > 1) {
    let matchedWords = 0
    for (const qWord of queryWords) {
      if (
        textWords.some(
          (tWord) => tWord.includes(qWord) || qWord.includes(tWord),
        )
      ) {
        matchedWords++
      }
    }
    const wordMatchScore = matchedWords / queryWords.length
    if (wordMatchScore >= 0.5) {
      return 0.7 * wordMatchScore
    }
  }

  // Subsequence match (characters in order)
  const subseqResult = subsequenceMatch(text, query)
  if (subseqResult.matches) {
    return Math.max(0.5, Math.min(0.8, subseqResult.score + 0.3))
  }

  // Levenshtein distance for typo tolerance
  const maxLen = Math.max(textLower.length, queryLower.length)
  const distance = levenshteinDistance(textLower, queryLower)
  const similarity = 1 - distance / maxLen

  // Only consider if similarity is reasonable
  if (similarity > 0.6) {
    return similarity * 0.6
  }

  // Check if any word in text starts with query
  for (const word of textWords) {
    if (word.startsWith(queryLower)) {
      return 0.7
    }
  }

  // Partial match - at least some characters match at start
  let prefixMatch = 0
  for (let i = 0; i < Math.min(queryLower.length, textLower.length); i++) {
    if (queryLower[i] === textLower[i]) {
      prefixMatch++
    } else {
      break
    }
  }
  if (prefixMatch >= 2 && prefixMatch >= queryLower.length * 0.5) {
    return 0.4 + (prefixMatch / queryLower.length) * 0.2
  }

  return 0
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Fuzzy match search - returns true if text matches query with given threshold
 * @param {string} text - Text to search in
 * @param {string} query - Query string
 * @param {number} threshold - Minimum score threshold (0-1), default 0.5
 * @returns {boolean} - True if match score exceeds threshold
 */
export function fuzzyMatchSearch(text, query, threshold = 0.5) {
  const score = calculateMatchScore(text, query)
  return score >= threshold
}

/**
 * Highlight matched parts in text
 * @param {string} text - Original text
 * @param {string} query - Query to highlight
 * @returns {string} - HTML string with <mark> tags around matches
 */
export function highlightMatches(text, query) {
  if (!query || !text) return text

  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()

  // Try exact substring first
  const exactIndex = textLower.indexOf(queryLower)
  if (exactIndex !== -1) {
    return (
      text.slice(0, exactIndex) +
      "<mark>" +
      text.slice(exactIndex, exactIndex + query.length) +
      "</mark>" +
      text.slice(exactIndex + query.length)
    )
  }

  // Subsequence highlighting
  const subseq = subsequenceMatch(text, query)
  if (subseq.matches && subseq.positions.length > 0) {
    let result = ""
    let lastIndex = 0
    for (const pos of subseq.positions) {
      result += text.slice(lastIndex, pos)
      result += "<mark>" + text[pos] + "</mark>"
      lastIndex = pos + 1
    }
    result += text.slice(lastIndex)
    return result
  }

  return text
}

export function safeChromeBookmarksCall(method, args, callback) {
  try {
    if (!chrome || !chrome.bookmarks || !chrome.bookmarks[method]) {
      console.error(`chrome.bookmarks.${method} is not available`)
      const language = localStorage.getItem("appLanguage") || "en"
      showCustomPopup(translations[language].errorUnexpected, "error", false)
      callback(null)
      return
    }
    chrome.bookmarks[method](...args, (result) => {
      if (chrome.runtime.lastError) {
        console.error(`Error in ${method}:`, chrome.runtime.lastError.message)
        const language = localStorage.getItem("appLanguage") || "en"
        showCustomPopup(translations[language].errorUnexpected, "error", false)
        callback(null)
        return
      }
      callback(result)
    })
  } catch (error) {
    console.error(`Unexpected error in ${method}:`, error)
    const language = localStorage.getItem("appLanguage") || "en"
    showCustomPopup(translations[language].errorUnexpected, "error", false)
    callback(null)
  }
}

export function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

export function showCustomPopup(
  message,
  type = "success",
  autoClose = true,
  onConfirm = null,
  showCancel = false,
) {
  const popup = document.getElementById("custom-popup")
  const title = document.getElementById("custom-popup-title")
  const messageEl = document.getElementById("custom-popup-message")
  const okButton = document.getElementById("custom-popup-ok")
  const cancelButton = document.getElementById("custom-popup-cancel")
  const language = localStorage.getItem("appLanguage") || "en"

  if (!popup || !title || !messageEl || !okButton) {
    console.error("Custom popup elements missing", {
      popup: !!popup,
      title: !!title,
      messageEl: !!messageEl,
      okButton: !!okButton,
      cancelButton: !!cancelButton,
    })
    return
  }

  try {
    // Thiết lập tiêu đề theo loại popup
    if (type === "loading") {
      title.textContent = language === "vi" ? "Đang xử lý..." : "Loading..."
    } else if (type === "success") {
      title.textContent = translations[language].successTitle
    } else if (type === "error") {
      title.textContent = translations[language].errorTitle
    } else {
      // info, warning, ...
      title.textContent = language === "vi" ? "Thông báo" : "Notification"
    }

    if (typeof message === 'string' && message.includes("<") && message.includes(">")) {
      messageEl.innerHTML = message
    } else {
      messageEl.textContent = message
    }
    popup.classList.remove("hidden")

    // Áp dụng class theo type để có thể style khác nhau (success, error, loading, warning,...)
    popup.classList.remove("success", "error", "loading", "warning", "info")
    if (type) {
      popup.classList.add(type)
    }

    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light"

    // Remove all possible theme classes
    const allThemes = ["light", "dark", "dracula", "onedark"]
    allThemes.forEach((theme) => {
      popup.classList.remove(`${theme}-theme`)
    })

    // Apply current theme to popup
    popup.classList.add(`${currentTheme}-theme`)

    const closePopup = () => {
      popup.classList.add("hidden")
      popup.style.display = ""
      popup.style.opacity = ""
      popup.style.pointerEvents = ""
      document.removeEventListener("keydown", handleKeydown)
    }

    okButton.onclick = () => {
      closePopup()
      if (onConfirm) onConfirm()
    }

    if (cancelButton) {
      if (showCancel) {
        cancelButton.classList.remove("hidden")
        cancelButton.onclick = () => closePopup()
      } else {
        cancelButton.classList.add("hidden")
      }
    }

    popup.onclick = (e) => {
      if (e.target === popup) {
        closePopup()
      }
    }

    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        okButton.click()
      } else if (e.key === "Escape") {
        closePopup()
      }
    }

    document.addEventListener("keydown", handleKeydown)

    if ((type === "success" || type === "info") && autoClose && !onConfirm) {
      setTimeout(closePopup, 5000)
    }
  } catch (error) {
    console.error("Error in showCustomPopup:", error)
  }
}

export function showCustomConfirm(message, onConfirm, onCancel) {
  const popup = document.getElementById("custom-popup")
  const title = document.getElementById("custom-popup-title")
  const messageEl = document.getElementById("custom-popup-message")
  const okButton = document.getElementById("custom-popup-ok")
  const language = localStorage.getItem("appLanguage") || "en"
  const buttonsContainer = popup?.querySelector(".rename-popup-buttons")

  if (!popup || !title || !messageEl || !okButton || !buttonsContainer) {
    console.error("Custom confirm popup elements missing", {
      popup: !!popup,
      title: !!title,
      messageEl: !!messageEl,
      okButton: !!okButton,
      buttonsContainer: !!buttonsContainer,
    })
    return
  }

  try {
    title.textContent = translations[language].confirmTitle || "Confirm"

    if (typeof message === 'string' && message.includes("<") && message.includes(">")) {
      messageEl.innerHTML = message
    } else {
      messageEl.textContent = message
    }

    popup.classList.remove("hidden")
    popup.style.display = "flex"
    popup.style.opacity = "1"
    popup.style.pointerEvents = "auto"

    const cancelButton = document.createElement("button")
    cancelButton.className = "button cancel"
    cancelButton.textContent = translations[language].cancel || "Cancel"

    buttonsContainer.appendChild(cancelButton)

    const isDarkMode = document.body.classList.contains("dark-theme")
    popup.classList.toggle("light-theme", !isDarkMode)
    popup.classList.toggle("dark-theme", isDarkMode)

    const closePopup = () => {
      popup.classList.add("hidden")
      popup.style.display = ""
      popup.style.opacity = ""
      popup.style.pointerEvents = ""
      if (buttonsContainer.contains(cancelButton)) {
        buttonsContainer.removeChild(cancelButton)
      }
      document.removeEventListener("keydown", handleKeydown)
    }

    okButton.onclick = () => {
      onConfirm()
      closePopup()
    }

    cancelButton.onclick = () => {
      if (onCancel) onCancel()
      closePopup()
    }

    popup.onclick = (e) => {
      if (e.target === popup) {
        if (onCancel) onCancel()
        closePopup()
      }
    }

    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        onConfirm()
        closePopup()
      } else if (e.key === "Escape") {
        if (onCancel) onCancel()
        closePopup()
      }
    }

    document.addEventListener("keydown", handleKeydown)
  } catch (error) {
    console.error("Error in showCustomConfirm:", error)
  }
}

export function showCustomGuide() {
  // Ensure DOM is loaded
  if (!document.getElementById("custom-guide")) {
    console.error(
      "Custom guide popup not found. Waiting for DOMContentLoaded...",
    )
    document.addEventListener("DOMContentLoaded", showCustomGuide)
    return
  }

  const popup = document.getElementById("custom-guide")
  const title = document.getElementById("custom-guide-title")
  const messageEl = document.getElementById("custom-guide-message")
  const okButton = document.getElementById("custom-guide-ok")
  const language = localStorage.getItem("appLanguage") || "en"

  // Log missing elements for debugging
  if (!popup || !title || !messageEl || !okButton) {
    console.error("Custom guide elements missing:", {
      popup: !!popup,
      title: !!title,
      messageEl: !!messageEl,
      okButton: !!okButton,
    })
    // Display a fallback error message
    if (document.getElementById("custom-popup")) {
      showCustomPopup(
        `${translations[language].errorTitle}: ${
          translations[language].errorUnexpected || "Unexpected error"
        }`,
        "error",
        true,
      )
    } else {
      alert("Error: Help guide cannot be displayed due to missing elements.")
    }
    return
  }

  try {
    title.textContent = translations[language].helpGuideTitle

    messageEl.innerHTML = translations[language].helpGuide

    // Add copy buttons to all code elements
    const codeElements = messageEl.querySelectorAll('code')
    codeElements.forEach((code) => {
      const text = code.textContent
      const wrapper = document.createElement('div')
      wrapper.className = 'command-wrapper'
      code.parentNode.insertBefore(wrapper, code)
      wrapper.appendChild(code)

      const copyBtn = document.createElement('button')
      copyBtn.className = 'copy-command-btn'
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>'
      copyBtn.title = language === 'vi' ? 'Sao chép lệnh' : 'Copy command'

      copyBtn.onclick = (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML = '<i class="fas fa-check"></i>'
          copyBtn.classList.add('copied')
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>'
            copyBtn.classList.remove('copied')
          }, 2000)
        })
      }
      wrapper.appendChild(copyBtn)
    })

    popup.classList.remove("hidden")

    const isDarkMode = document.body.classList.contains("dark-theme")
    popup.classList.toggle("light-theme", !isDarkMode)
    popup.classList.toggle("dark-theme", isDarkMode)

    const closePopup = () => {
      popup.classList.add("hidden")
      popup.style.display = ""
      popup.style.opacity = ""
      popup.style.pointerEvents = ""
      document.removeEventListener("keydown", handleKeydown)
    }

    okButton.onclick = (e) => {
      e.stopPropagation()
      closePopup()
    }

    popup.onclick = (e) => {
      if (e.target === popup) {
        closePopup()
      }
    }

    const handleKeydown = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        closePopup()
      }
    }

    document.addEventListener("keydown", handleKeydown)
  } catch (error) {
    console.error("Error in showCustomGuide:", error)
    if (document.getElementById("custom-popup")) {
      showCustomPopup(
        `${translations[language].errorTitle}: ${
          translations[language].errorUnexpected || "Unexpected error"
        }`,
        "error",
        true,
      )
    } else {
      alert("Error: Help guide cannot be displayed.")
    }
  }
}

export function showLocalStorageSettingsPopup() {
  const popup = document.getElementById("localstorage-settings-popup")
  const title = document.getElementById("localstorage-settings-title")
  const saveButton = document.getElementById("localstorage-settings-save")
  const cancelButton = document.getElementById("localstorage-settings-cancel")
  const language = localStorage.getItem("appLanguage") || "en"

  if (!popup || !title || !saveButton || !cancelButton) {
    console.error("Local storage settings popup elements missing:", {
      popup: !!popup,
      title: !!title,
      saveButton: !!saveButton,
      cancelButton: !!cancelButton,
    })
    showCustomPopup(translations[language].errorUnexpected, "error", true)
    return
  }

  // Set multilingual labels
  title.textContent = translations[language].localStorageSettingsTitle
  saveButton.textContent = translations[language].save
  cancelButton.textContent = translations[language].cancel

  // Debug checkbox visibility
  const checkboxes = document.querySelectorAll(
    '.localstorage-settings-container input[type="checkbox"]',
  )

  popup.classList.remove("hidden")

  // Apply current theme
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light"
  const allThemes = ["light", "dark", "dracula", "onedark"]
  allThemes.forEach((theme) => popup.classList.remove(`${theme}-theme`))
  popup.classList.add(`${currentTheme}-theme`)
}

export function hideLocalStorageSettingsPopup() {
  const popup = document.getElementById("localstorage-settings-popup")
  if (popup) {
    popup.classList.add("hidden")
  }
}

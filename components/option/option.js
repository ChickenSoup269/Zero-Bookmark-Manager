// components/option/option.js
import {
  saveUIState as originalSaveUIState,
  loadUIState as originalLoadUIState,
  uiState,
} from "../state.js"
import {
  showCustomPopup,
  translations,
  showLocalStorageSettingsPopup,
  hideLocalStorageSettingsPopup,
} from "../utils.js"

// Default settings for which properties to save (all enabled by default)
const defaultStorageSettings = {
  searchQuery: true,
  selectedFolderId: true,
  sortType: true,
  viewMode: true,
  collapsedFolders: true,
  checkboxesVisible: true,
}

// Map checkbox IDs to translation keys
const checkboxIdToTranslationKey = {
  "save-searchQuery": "saveSearchQuery",
  "save-selectedFolderId": "saveSelectedFolderId",
  "save-sortType": "saveSortType",
  "save-viewMode": "saveViewMode",
  "save-collapsedFolders": "saveCollapsedFolders",
  "save-checkboxesVisible": "saveCheckboxesVisible",
}

// Load storage settings from chrome.storage.local or use defaults
function loadStorageSettings(callback) {
  const language = localStorage.getItem("appLanguage") || "en"
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    const checkboxes = [
      "save-searchQuery",
      "save-selectedFolderId",
      "save-sortType",
      "save-viewMode",
      "save-collapsedFolders",
      "save-checkboxesVisible",
    ]
    checkboxes.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        const key = id.replace("save-", "")
        element.checked = storageSettings[key]
        console.log(`Loaded ${key}: ${element.checked}`)
        const label = element.parentElement
        if (label) {
          const input = label.querySelector('input[type="checkbox"]')
          label.textContent = "" // Clear existing text
          label.appendChild(input) // Re-append checkbox
          const translationKey = checkboxIdToTranslationKey[id]
          const labelText = translations[language][translationKey]
          if (labelText) {
            label.append(labelText)
            console.log(`Updated label for ${id}: ${labelText}`)
          } else {
            console.error(`Translation missing for ${id}: ${translationKey}`)
            label.append(`Missing: ${id}`)
          }
        } else {
          console.warn(`Label for checkbox ${id} not found`)
        }
      } else {
        console.warn(`Checkbox element ${id} not found`)
      }
    })
    console.log("Storage settings loaded:", storageSettings)
    if (callback) callback(storageSettings)
  })
}

// Save storage settings to chrome.storage.local
function saveStorageSettings() {
  const language = localStorage.getItem("appLanguage") || "en"
  const checkboxes = [
    "save-searchQuery",
    "save-selectedFolderId",
    "save-sortType",
    "save-viewMode",
    "save-collapsedFolders",
    "save-checkboxesVisible",
  ]
  const storageSettings = {}
  checkboxes.forEach((id) => {
    const element = document.getElementById(id)
    const key = id.replace("save-", "")
    if (element) {
      storageSettings[key] = element.checked
      console.log(`Saving ${key}: ${element.checked} (from checkbox state)`)
    } else {
      console.error(`Checkbox ${id} not found during save`)
      storageSettings[key] = false
    }
  })

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ storageSettings }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving storage settings:",
          chrome.runtime.lastError
        )
        showCustomPopup(translations[language].errorUnexpected, "error", true)
        reject(chrome.runtime.lastError)
      } else {
        console.log("Storage settings saved:", storageSettings)
        showCustomPopup(translations[language].successTitle, "success", true)
        resolve(storageSettings)
      }
    })
  }).finally(() => {
    hideLocalStorageSettingsPopup()
  })
}

// Wrap saveUIState to respect storage settings
function customSaveUIState() {
  console.log("customSaveUIState called. Current uiState:", uiState)
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log("Using storageSettings for save:", storageSettings)
    const state = {
      uiState: {},
      checkboxesVisible: storageSettings.checkboxesVisible
        ? uiState.checkboxesVisible
        : undefined,
    }
    if (storageSettings.searchQuery) {
      state.uiState.searchQuery = uiState.searchQuery
      console.log(`Saving searchQuery: ${uiState.searchQuery}`)
    } else {
      console.log(
        "Skipping searchQuery save due to storageSettings.searchQuery = false"
      )
      chrome.storage.local.remove("uiState.searchQuery", () => {
        if (chrome.runtime.lastError) {
          console.error("Error removing searchQuery:", chrome.runtime.lastError)
        } else {
          console.log("Removed searchQuery from storage")
        }
      })
    }
    if (storageSettings.selectedFolderId)
      state.uiState.selectedFolderId = uiState.selectedFolderId
    if (storageSettings.sortType) state.uiState.sortType = uiState.sortType
    if (storageSettings.viewMode) state.uiState.viewMode = uiState.viewMode
    if (storageSettings.collapsedFolders)
      state.uiState.collapsedFolders = Array.from(uiState.collapsedFolders)

    chrome.storage.local.set(state, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving state:", chrome.runtime.lastError)
      } else {
        console.log("UI state saved with settings:", state)
      }
    })
  })
}

// Wrap loadUIState to respect storage settings

function customLoadUIState(callback) {
  console.log("customLoadUIState called")
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log("Using storageSettings for load:", storageSettings)
    chrome.storage.local.get(["uiState", "checkboxesVisible"], (loadResult) => {
      if (loadResult.uiState) {
        if (storageSettings.searchQuery) {
          uiState.searchQuery = loadResult.uiState.searchQuery || ""
          console.log(`Loaded searchQuery: ${uiState.searchQuery}`)
        } else {
          uiState.searchQuery = ""
          console.log(
            "Cleared searchQuery due to storageSettings.searchQuery = false"
          )
          // Ensure UI reflects cleared state
          const searchInput = document.getElementById("search")
          if (searchInput) {
            searchInput.value = ""
            console.log("Cleared search input in UI")
          }
        }
        if (storageSettings.selectedFolderId) {
          uiState.selectedFolderId = loadResult.uiState.selectedFolderId || ""
        }
        if (storageSettings.sortType) {
          uiState.sortType = loadResult.uiState.sortType || "default"
        }
        if (storageSettings.viewMode) {
          uiState.viewMode = loadResult.uiState.viewMode || "flat"
        }
        if (storageSettings.collapsedFolders) {
          uiState.collapsedFolders = new Set(
            loadResult.uiState.collapsedFolders || []
          )
        }
      }
      if (storageSettings.checkboxesVisible) {
        uiState.checkboxesVisible = loadResult.checkboxesVisible || false
      } else {
        uiState.checkboxesVisible = false
        // Ensure UI reflects cleared state for checkboxes
        const toggleCheckboxesButton =
          document.getElementById("toggle-checkboxes")
        const savedLanguage = localStorage.getItem("appLanguage") || "en"
        if (toggleCheckboxesButton) {
          toggleCheckboxesButton.textContent =
            translations[savedLanguage].showCheckboxes
        }
        document
          .querySelectorAll(".bookmark-checkbox, #select-all")
          .forEach((checkbox) => {
            checkbox.style.display = "none"
          })
        // Bổ sung logic ẩn/hiện Select All container từ restoreUIState
        const selectAllContainer = document.querySelector(".select-all")
        if (selectAllContainer) {
          selectAllContainer.style.display = "none"
        } else {
          console.warn("Select All container (.select-all) not found")
        }
      }
      // Cập nhật UI cho checkboxes nếu storageSettings.checkboxesVisible = true
      if (storageSettings.checkboxesVisible && uiState.checkboxesVisible) {
        const toggleCheckboxesButton =
          document.getElementById("toggle-checkboxes")
        const savedLanguage = localStorage.getItem("appLanguage") || "en"
        if (toggleCheckboxesButton) {
          toggleCheckboxesButton.textContent =
            translations[savedLanguage].hideCheckboxes
        }
        document
          .querySelectorAll(".bookmark-checkbox, #select-all")
          .forEach((checkbox) => {
            checkbox.style.display = "inline-block"
          })
        const selectAllContainer = document.querySelector(".select-all")
        if (selectAllContainer) {
          selectAllContainer.style.display = "block"
        } else {
          console.warn("Select All container (.select-all) not found")
        }
      }
      console.log("UI state loaded with settings:", loadResult)
      if (callback) callback()
    })
  })
}

// Export wrapped functions
export { customSaveUIState, customLoadUIState }

// Override original saveUIState to prevent accidental use
export function saveUIState() {
  console.warn("Original saveUIState called! Use customSaveUIState instead.")
  customSaveUIState()
}

// Override original loadUIState to prevent accidental use
export function loadUIState(callback) {
  console.warn("Original loadUIState called! Use customLoadUIState instead.")
  customLoadUIState(callback)
}

// Initialize event listeners
function initializeEventListeners() {
  const settingsButton = document.getElementById("localstorage-settings-option")
  const saveButton = document.getElementById("localstorage-settings-save")
  const cancelButton = document.getElementById("localstorage-settings-cancel")
  const popup = document.getElementById("localstorage-settings-popup")

  if (!settingsButton || !saveButton || !cancelButton || !popup) {
    console.error("Local storage settings elements missing:", {
      settingsButton: !!settingsButton,
      saveButton: !!saveButton,
      cancelButton: !!cancelButton,
      popup: !!popup,
    })
    const language = localStorage.getItem("appLanguage") || "en"
    showCustomPopup(translations[language].errorUnexpected, "error", true)
    return
  }

  console.log("Initializing local storage settings listener")
  settingsButton.addEventListener("click", (e) => {
    e.stopPropagation() // Prevent bubbling to bookmarkActions.js
    console.log("Local storage settings button clicked")
    loadStorageSettings()
    showLocalStorageSettingsPopup()
  })

  saveButton.addEventListener("click", (e) => {
    e.stopPropagation()
    saveStorageSettings()
      .then((storageSettings) => {
        console.log(
          "Calling customSaveUIState after saving settings:",
          storageSettings
        )
        customSaveUIState()
        // Force UI update
        const searchInput = document.getElementById("search")
        if (searchInput && !storageSettings.searchQuery) {
          searchInput.value = ""
          console.log("Cleared search input after saving settings")
        }
      })
      .catch((error) => {
        console.error("Error in saveStorageSettings:", error)
      })
  })
  cancelButton.addEventListener("click", (e) => {
    e.stopPropagation()
    hideLocalStorageSettingsPopup()
  })

  // Close popup when clicking outside
  popup.addEventListener("click", (e) => {
    e.stopPropagation()
    if (e.target === popup) {
      hideLocalStorageSettingsPopup()
    }
  })

  // Handle keyboard events for accessibility
  const handleKeydown = (e) => {
    if (e.key === "Enter" && !popup.classList.contains("hidden")) {
      saveStorageSettings()
        .then((storageSettings) => {
          console.log(
            "Calling customSaveUIState after Enter key save:",
            storageSettings
          )
          customSaveUIState()
          // Force UI update
          const searchInput = document.getElementById("search")
          if (searchInput && !storageSettings.searchQuery) {
            searchInput.value = ""
            console.log("Cleared search input after Enter key save")
          }
        })
        .catch((error) => {
          console.error("Error in saveStorageSettings on Enter:", error)
        })
    } else if (e.key === "Escape" && !popup.classList.contains("hidden")) {
      hideLocalStorageSettingsPopup()
    }
  }
  document.addEventListener("keydown", handleKeydown)
}

// Ensure DOM is loaded before setting up event listeners
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing local storage settings")
    initializeEventListeners()
  })
} else {
  console.log("DOM already loaded, initializing local storage settings")
  initializeEventListeners()
}

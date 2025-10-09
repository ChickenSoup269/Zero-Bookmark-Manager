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
import { populateTagFilter, renderFilteredBookmarks } from "../ui.js"
import { elements } from "../../main.js"

const defaultStorageSettings = {
  searchQuery: false,
  selectedFolderId: true,
  sortType: true,
  viewMode: true,
  collapsedFolders: true,
  checkboxesVisible: false,
  selectedTags: true,
  bookmarkTags: true,
  tagColors: true,
}

chrome.storage.local.set({ storageSettings: defaultStorageSettings })
// Map checkbox IDs to translation keys
const checkboxIdToTranslationKey = {
  "save-searchQuery": "saveSearchQuery",
  "save-selectedFolderId": "saveSelectedFolderId",
  "save-sortType": "saveSortType",
  "save-viewMode": "saveViewMode",
  "save-collapsedFolders": "saveCollapsedFolders",
  "save-checkboxesVisible": "saveCheckboxesVisible",
  "save-selectedTag": "saveSelectedTag",
  "save-bookmarkTags": "saveBookmarkTags",
  "save-tagColors": "saveTagColors",
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
      "save-selectedTag",
      "save-bookmarkTags",
      "save-tagColors",
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
    "save-selectedTag",
    "save-bookmarkTags",
    "save-tagColors",
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

export function customSaveUIState() {
  console.log("customSaveUIState called. Current uiState:", uiState)
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log("Using storageSettings for save:", storageSettings)
    console.log("Saving selectedTags:", uiState.selectedTags)
    const state = {
      uiState: {},
      checkboxesVisible: storageSettings.checkboxesVisible
        ? uiState.checkboxesVisible
        : undefined,
      bookmarkTags: uiState.bookmarkTags,
      tagColors: uiState.tagColors,
    }
    if (storageSettings.searchQuery)
      state.uiState.searchQuery = uiState.searchQuery
    if (storageSettings.selectedFolderId)
      state.uiState.selectedFolderId = uiState.selectedFolderId
    if (storageSettings.sortType) state.uiState.sortType = uiState.sortType
    if (storageSettings.viewMode) state.uiState.viewMode = uiState.viewMode
    if (storageSettings.collapsedFolders)
      state.uiState.collapsedFolders = Array.from(uiState.collapsedFolders)
    if (storageSettings.selectedTags)
      state.uiState.selectedTags = uiState.selectedTags

    chrome.storage.local.set(state, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving state:", chrome.runtime.lastError)
      } else {
        console.log("UI state saved:", state)
      }
    })
  })
}

export async function customLoadUIState(callback) {
  console.log("customLoadUIState called")
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(
        [
          "storageSettings",
          "uiState",
          "checkboxesVisible",
          "bookmarkTags",
          "tagColors",
        ],
        (data) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(data)
          }
        }
      )
    })

    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log("Using storageSettings for load:", storageSettings)

    // Khôi phục trạng thái uiState
    if (result.uiState) {
      if (storageSettings.searchQuery) {
        uiState.searchQuery = result.uiState.searchQuery || ""
        console.log(`Loaded searchQuery: ${uiState.searchQuery}`)
      } else {
        uiState.searchQuery = ""
        console.log(
          "Cleared searchQuery due to storageSettings.searchQuery = false"
        )
      }
      if (storageSettings.selectedFolderId) {
        uiState.selectedFolderId = result.uiState.selectedFolderId || ""
      }
      if (storageSettings.sortType) {
        uiState.sortType = result.uiState.sortType || "default"
      }
      if (storageSettings.viewMode) {
        uiState.viewMode = result.uiState.viewMode || "flat"
      }
      if (storageSettings.collapsedFolders) {
        uiState.collapsedFolders = new Set(
          result.uiState.collapsedFolders || []
        )
      }
      if (storageSettings.selectedTags) {
        uiState.selectedTags = result.uiState.selectedTags || []
        uiState.selectedTag =
          uiState.selectedTags.length === 1 ? uiState.selectedTags[0] : ""
      }
    }
    if (storageSettings.checkboxesVisible) {
      uiState.checkboxesVisible = result.checkboxesVisible || false
    } else {
      uiState.checkboxesVisible = false
    }
    uiState.bookmarkTags = result.bookmarkTags || {}
    uiState.tagColors = result.tagColors || {}

    // Cập nhật giao diện
    const savedLanguage = localStorage.getItem("appLanguage") || "en"
    if (elements.languageSwitcher) {
      elements.languageSwitcher.value = savedLanguage
    }
    if (elements.viewSwitcher) {
      elements.viewSwitcher.value = uiState.viewMode
    }
    if (elements.folderFilter) {
      elements.folderFilter.value = uiState.selectedFolderId
    }
    if (elements.sortFilter) {
      elements.sortFilter.value = uiState.sortType
    }
    if (elements.searchInput) {
      elements.searchInput.value = uiState.searchQuery
    }
    if (elements.toggleCheckboxesButton) {
      elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
        ? translations[savedLanguage].hideCheckboxes
        : translations[savedLanguage].showCheckboxes
    }

    // Cập nhật hiển thị checkbox
    document
      .querySelectorAll(".bookmark-checkbox, #select-all")
      .forEach((checkbox) => {
        checkbox.style.display = uiState.checkboxesVisible
          ? "inline-block"
          : "none"
      })
    const selectAllContainer = document.querySelector(".select-all")
    if (selectAllContainer) {
      selectAllContainer.style.display = uiState.checkboxesVisible
        ? "block"
        : "none"
    } else {
      console.warn("Select All container (.select-all) not found")
    }

    console.log("UI state loaded:", result)
    if (callback) callback()
  } catch (error) {
    console.error("Error loading UI state:", error)
    showCustomPopup(
      translations[localStorage.getItem("appLanguage") || "en"].errorUnexpected,
      "error",
      true
    )
    if (callback) callback()
  }
}

// Override original saveUIState to prevent accidental use
export function saveUIState() {
  console.warn("Original saveUIState called from:", new Error().stack)
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
    e.stopPropagation()
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
        const searchInput = document.getElementById("search-input")
        if (searchInput && !storageSettings.searchQuery) {
          searchInput.value = ""
          console.log("Cleared search input after saving settings")
        }
        const elements = {
          tagFilter: document.getElementById("tag-filter"),
          folderListDiv: document.getElementById("folder-list"),
        }
        if (!storageSettings.bookmarkTags || !storageSettings.tagColors) {
          chrome.bookmarks.getTree((bookmarkTreeNodes) => {
            populateTagFilter(elements)
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          })
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

  popup.addEventListener("click", (e) => {
    e.stopPropagation()
    if (e.target === popup) {
      hideLocalStorageSettingsPopup()
    }
  })

  const handleKeydown = (e) => {
    if (e.key === "Enter" && !popup.classList.contains("hidden")) {
      saveStorageSettings()
        .then((storageSettings) => {
          console.log(
            "Calling customSaveUIState after Enter key save:",
            storageSettings
          )
          customSaveUIState()
          const searchInput = document.getElementById("search-input")
          if (searchInput && !storageSettings.searchQuery) {
            searchInput.value = ""
            console.log("Cleared search input after Enter key save")
          }
          const elements = {
            tagFilter: document.getElementById("tag-filter"),
            folderListDiv: document.getElementById("folder-list"),
          }
          if (!storageSettings.bookmarkTags || !storageSettings.tagColors) {
            chrome.bookmarks.getTree((bookmarkTreeNodes) => {
              populateTagFilter(elements)
              renderFilteredBookmarks(bookmarkTreeNodes, elements)
            })
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

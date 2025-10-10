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

function initializeStorageSettings() {
  chrome.storage.local.get(["storageSettings"], (result) => {
    if (!result.storageSettings) {
      chrome.storage.local.set(
        { storageSettings: defaultStorageSettings },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error initializing storageSettings:",
              chrome.runtime.lastError
            )
          } else {
            console.log(
              "Initialized storageSettings:",
              JSON.stringify(defaultStorageSettings, null, 2)
            )
          }
        }
      )
    } else {
      console.log(
        "storageSettings already exists:",
        JSON.stringify(result.storageSettings, null, 2)
      )
    }
  })
}

initializeStorageSettings()

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

function loadStorageSettings(callback) {
  const language = localStorage.getItem("appLanguage") || "en"
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log(
      "Loaded storageSettings:",
      JSON.stringify(storageSettings, null, 2)
    )
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
          label.textContent = ""
          label.appendChild(input)
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
    console.log(
      "Storage settings loaded:",
      JSON.stringify(storageSettings, null, 2)
    )
    if (callback) callback(storageSettings)
  })
}

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
      console.log(`Saving ${key}: ${element.checked}`)
    } else {
      console.warn(
        `Checkbox ${id} not found during save, using default: ${defaultStorageSettings[key]}`
      )
      storageSettings[key] = defaultStorageSettings[key]
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
        console.log(
          "Storage settings saved successfully:",
          JSON.stringify(storageSettings, null, 2)
        )
        showCustomPopup(translations[language].successTitle, "success", true)
        resolve(storageSettings)
      }
    })
  }).finally(() => {
    hideLocalStorageSettingsPopup()
  })
}

export function customSaveUIState() {
  console.log(
    "customSaveUIState called. Current uiState:",
    JSON.stringify(uiState, null, 2)
  )
  chrome.storage.local.get(["storageSettings"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log(
      "Using storageSettings for save:",
      JSON.stringify(storageSettings, null, 2)
    )
    const state = {
      uiState: {},
      checkboxesVisible: storageSettings.checkboxesVisible
        ? uiState.checkboxesVisible
        : undefined,
      bookmarkTags: uiState.bookmarkTags,
      tagColors: uiState.tagColors,
    }
    if (storageSettings.searchQuery) {
      state.uiState.searchQuery = uiState.searchQuery
      console.log(`Saving searchQuery: ${uiState.searchQuery}`)
    }
    if (storageSettings.selectedFolderId) {
      state.uiState.selectedFolderId = uiState.selectedFolderId
      console.log(`Saving selectedFolderId: ${uiState.selectedFolderId}`)
    }
    if (storageSettings.sortType) {
      state.uiState.sortType = uiState.sortType
      console.log(`Saving sortType: ${uiState.sortType}`)
    }
    if (storageSettings.viewMode) {
      state.uiState.viewMode = uiState.viewMode
      console.log(`Saving viewMode: ${uiState.viewMode}`)
    }
    if (storageSettings.collapsedFolders) {
      state.uiState.collapsedFolders = Array.from(uiState.collapsedFolders)
      console.log(`Saving collapsedFolders:`, uiState.collapsedFolders)
    }
    if (storageSettings.selectedTags) {
      state.uiState.selectedTags = uiState.selectedTags
      console.log(`Saving selectedTags: ${uiState.selectedTags}`)
    }

    chrome.storage.local.set(state, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving UI state:", chrome.runtime.lastError)
      } else {
        console.log(
          "UI state saved successfully:",
          JSON.stringify(state, null, 2)
        )
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
            console.error("Error loading storage:", chrome.runtime.lastError)
            reject(chrome.runtime.lastError)
          } else {
            console.log("Loaded storage data:", JSON.stringify(data, null, 2))
            resolve(data)
          }
        }
      )
    })

    const storageSettings = result.storageSettings || defaultStorageSettings
    console.log(
      "Using storageSettings for load:",
      JSON.stringify(storageSettings, null, 2)
    )

    if (result.uiState) {
      if (storageSettings.searchQuery) {
        uiState.searchQuery = result.uiState.searchQuery || ""
        console.log(`Loaded searchQuery: ${uiState.searchQuery}`)
      } else {
        uiState.searchQuery = ""
        console.log(
          "Reset searchQuery to empty due to storageSettings.searchQuery = false"
        )
      }
      if (storageSettings.selectedFolderId) {
        uiState.selectedFolderId = result.uiState.selectedFolderId || ""
        console.log(`Loaded selectedFolderId: ${uiState.selectedFolderId}`)
      } else {
        uiState.selectedFolderId = ""
        console.log(
          "Reset selectedFolderId to empty due to storageSettings.selectedFolderId = false"
        )
      }
      if (storageSettings.sortType) {
        uiState.sortType = result.uiState.sortType || "default"
        console.log(`Loaded sortType: ${uiState.sortType}`)
      } else {
        uiState.sortType = "default"
        console.log(
          "Reset sortType to default due to storageSettings.sortType = false"
        )
      }
      if (storageSettings.viewMode) {
        uiState.viewMode = result.uiState.viewMode || "flat"
        console.log(`Loaded viewMode: ${uiState.viewMode}`)
      } else {
        uiState.viewMode = "flat"
        console.log(
          "Reset viewMode to flat due to storageSettings.viewMode = false"
        )
      }
      if (storageSettings.collapsedFolders) {
        uiState.collapsedFolders = new Set(
          result.uiState.collapsedFolders || []
        )
        console.log(`Loaded collapsedFolders:`, uiState.collapsedFolders)
      } else {
        uiState.collapsedFolders = new Set()
        console.log(
          "Reset collapsedFolders to empty due to storageSettings.collapsedFolders = false"
        )
      }
      if (storageSettings.selectedTags) {
        uiState.selectedTags = result.uiState.selectedTags || []
        console.log(`Loaded selectedTags: ${uiState.selectedTags}`)
      } else {
        uiState.selectedTags = []
        console.log(
          "Reset selectedTags to empty due to storageSettings.selectedTags = false"
        )
      }
    }
    if (storageSettings.checkboxesVisible) {
      uiState.checkboxesVisible = result.checkboxesVisible || false
      console.log(`Loaded checkboxesVisible: ${uiState.checkboxesVisible}`)
    } else {
      uiState.checkboxesVisible = false
      console.log(
        "Reset checkboxesVisible to false due to storageSettings.checkboxesVisible = false"
      )
    }
    uiState.bookmarkTags = result.bookmarkTags || {}
    console.log(`Loaded bookmarkTags:`, uiState.bookmarkTags)
    uiState.tagColors = result.tagColors || {}
    console.log(`Loaded tagColors:`, uiState.tagColors)

    const savedLanguage = localStorage.getItem("appLanguage") || "en"
    if (elements.languageSwitcher) {
      elements.languageSwitcher.value = savedLanguage
      console.log(`Set languageSwitcher to: ${savedLanguage}`)
    }
    if (elements.viewSwitcher) {
      elements.viewSwitcher.value = uiState.viewMode
      console.log(`Set viewSwitcher to: ${uiState.viewMode}`)
    }
    if (elements.folderFilter) {
      elements.folderFilter.value = uiState.selectedFolderId
      console.log(`Set folderFilter to: ${uiState.selectedFolderId}`)
    }
    if (elements.sortFilter) {
      elements.sortFilter.value = uiState.sortType
      console.log(`Set sortFilter to: ${uiState.sortType}`)
    }
    if (elements.searchInput) {
      elements.searchInput.value = uiState.searchQuery
      console.log(`Set searchInput to: ${uiState.searchQuery}`)
    }
    if (elements.toggleCheckboxesButton) {
      elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
        ? translations[savedLanguage].hideCheckboxes
        : translations[savedLanguage].showCheckboxes
      console.log(
        `Set toggleCheckboxesButton text to: ${
          uiState.checkboxesVisible
            ? translations[savedLanguage].hideCheckboxes
            : translations[savedLanguage].showCheckboxes
        }`
      )
    }

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
      console.log(
        `Set selectAllContainer display to: ${
          uiState.checkboxesVisible ? "block" : "none"
        }`
      )
    } else {
      console.warn("Select All container (.select-all) not found")
    }

    const tagFilterDropdown = document.getElementById("tag-filter-dropdown")
    if (tagFilterDropdown) {
      const checkboxes = tagFilterDropdown.querySelectorAll(
        'input[type="checkbox"]'
      )
      checkboxes.forEach((checkbox) => {
        checkbox.checked = uiState.selectedTags.includes(checkbox.value)
        console.log(`Tag ${checkbox.value} checked: ${checkbox.checked}`)
      })
    } else {
      console.warn("tag-filter-dropdown not found")
    }

    // Làm mới giao diện sau khi tải trạng thái
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      populateTagFilter(elements)
      renderFilteredBookmarks(bookmarkTreeNodes, elements)
    })

    console.log(
      "UI state loaded successfully:",
      JSON.stringify(uiState, null, 2)
    )
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

export function saveUIState() {
  console.warn("Original saveUIState called from:", new Error().stack)
  customSaveUIState()
}

export function loadUIState(callback) {
  console.warn("Original loadUIState called! Use customLoadUIState instead.")
  customLoadUIState(callback)
}

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
          JSON.stringify(storageSettings, null, 2)
        )
        customSaveUIState()
        const searchInput = document.getElementById("search-input")
        if (searchInput && !storageSettings.searchQuery) {
          uiState.searchQuery = ""
          searchInput.value = ""
          console.log("Cleared search input after saving settings")
        }

        if (!storageSettings.selectedTags) {
          uiState.selectedTags = []
          console.log(
            "Cleared selectedTags due to storageSettings.selectedTags = false"
          )
          const tagFilterDropdown = document.getElementById(
            "tag-filter-dropdown"
          )
          if (tagFilterDropdown) {
            const checkboxes = tagFilterDropdown.querySelectorAll(
              'input[type="checkbox"]'
            )
            checkboxes.forEach((checkbox) => {
              checkbox.checked = false
              console.log(
                `Reset tag ${checkbox.value} checked: ${checkbox.checked}`
              )
            })
          }
        }
        if (
          !storageSettings.bookmarkTags ||
          !storageSettings.tagColors ||
          !storageSettings.selectedTags
        ) {
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
            JSON.stringify(storageSettings, null, 2)
          )
          customSaveUIState()
          const searchInput = document.getElementById("search-input")
          if (searchInput && !storageSettings.searchQuery) {
            uiState.searchQuery = ""
            searchInput.value = ""
            console.log("Cleared search input after Enter key save")
          }

          if (!storageSettings.selectedTags) {
            uiState.selectedTags = []
            console.log(
              "Cleared selectedTags due to storageSettings.selectedTags = false"
            )
            const tagFilterDropdown = document.getElementById(
              "tag-filter-dropdown"
            )
            if (tagFilterDropdown) {
              const checkboxes = tagFilterDropdown.querySelectorAll(
                'input[type="checkbox"]'
              )
              checkboxes.forEach((checkbox) => {
                checkbox.checked = false
                console.log(
                  `Reset tag ${checkbox.value} checked: ${checkbox.checked}`
                )
              })
            }
          }
          if (
            !storageSettings.bookmarkTags ||
            !storageSettings.tagColors ||
            !storageSettings.selectedTags
          ) {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing local storage settings")
    initializeEventListeners()
  })
} else {
  console.log("DOM already loaded, initializing local storage settings")
  initializeEventListeners()
}

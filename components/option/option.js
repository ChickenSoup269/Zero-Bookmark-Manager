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
} from "../utils/utils.js"
import {
  populateTagFilter,
  renderFilteredBookmarks,
  attachTreeListeners,
} from "../ui.js"
import { getElements } from "../../main.js"

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

const elements = getElements()

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
          }
        }
      )
    } else {
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

        const label = element.parentElement
        if (label) {
          const input = label.querySelector('input[type="checkbox"]')
          label.textContent = ""
          label.appendChild(input)
          const translationKey = checkboxIdToTranslationKey[id]
          const labelText = translations[language][translationKey]
          if (labelText) {
            label.append(labelText)
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
        showCustomPopup(translations[language].successTitle, "success", true)
        resolve(storageSettings)
      }
    })
  }).finally(() => {
    hideLocalStorageSettingsPopup()
  })
}

export function customSaveUIState() {
  // Get the existing quickOpenAction along with storageSettings
  chrome.storage.local.get(["storageSettings", "quickOpenAction"], (result) => {
    const storageSettings = result.storageSettings || defaultStorageSettings
    const existingQuickOpenAction = result.quickOpenAction // Get existing value

    const state = {
      uiState: {
        faviconOption: uiState.faviconOption,
        faviconSize: uiState.faviconSize,
        duplicateScope: uiState.duplicateScope,
        autoRemoveDup: uiState.autoRemoveDup,
        showNotesPreview: uiState.showNotesPreview,
        showTagsInView: uiState.showTagsInView,
        headerLineStyle: uiState.headerLineStyle,
        bookmarkMenuBg: uiState.bookmarkMenuBg,
        showSmartFolders: uiState.showSmartFolders,
        sidebarWidth: uiState.sidebarWidth,
      },
      checkboxesVisible: storageSettings.checkboxesVisible
        ? uiState.checkboxesVisible
        : undefined,
      bookmarkTags: uiState.bookmarkTags,
      tagColors: uiState.tagColors,
      tagTextColors: uiState.tagTextColors,
    }

    // Add the existing quickOpenAction to the state object to preserve it
    if (existingQuickOpenAction) {
      state.quickOpenAction = existingQuickOpenAction
    }

    if (storageSettings.searchQuery) {
      state.uiState.searchQuery = uiState.searchQuery
    }
    if (storageSettings.selectedFolderId) {
      state.uiState.selectedFolderId = uiState.selectedFolderId
    }
    if (storageSettings.sortType) {
      state.uiState.sortType = uiState.sortType
    }
    if (storageSettings.viewMode) {
      state.uiState.viewMode = uiState.viewMode
    }
    if (storageSettings.collapsedFolders) {
      state.uiState.collapsedFolders = Array.from(uiState.collapsedFolders)
    }
    if (storageSettings.selectedTags) {
      state.uiState.selectedTags = uiState.selectedTags
    }

    chrome.storage.local.set(state, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving UI state:", chrome.runtime.lastError)
      } else {
      }
    })
  })
}

export async function customLoadUIState(callback) {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(
        [
          "storageSettings",
          "uiState",
          "checkboxesVisible",
          "bookmarkTags",
          "tagColors",
          "tagTextColors",
          "healthStatus",
          "bookmarkHealth",
        ],
        (data) => {
          if (chrome.runtime.lastError) {
            console.error("Error loading storage:", chrome.runtime.lastError)
            reject(chrome.runtime.lastError)
          } else {
            resolve(data)
          }
        }
      )
    })

    const storageSettings = result.storageSettings || defaultStorageSettings
    const savedUiState = result.uiState || {}

    if (storageSettings.searchQuery) {
      uiState.searchQuery = savedUiState.searchQuery || ""
    } else {
      uiState.searchQuery = ""
    }
    if (storageSettings.selectedFolderId) {
      uiState.selectedFolderId = savedUiState.selectedFolderId || ""
    } else {
      uiState.selectedFolderId = ""
    }
    if (storageSettings.sortType) {
      uiState.sortType = savedUiState.sortType || "default"
    } else {
      uiState.sortType = "default"
    }
    if (storageSettings.viewMode) {
      uiState.viewMode =
        savedUiState.viewMode || localStorage.getItem("appView") || "flat"
    } else {
      uiState.viewMode = "flat"
    }
    if (storageSettings.collapsedFolders) {
      uiState.collapsedFolders = new Set(
        savedUiState.collapsedFolders || []
      )
    } else {
      uiState.collapsedFolders = new Set()
    }
    if (storageSettings.selectedTags) {
      uiState.selectedTags = savedUiState.selectedTags || []
    } else {
      uiState.selectedTags = []
    }
    
    uiState.faviconOption = savedUiState.faviconOption || "auto"
    uiState.faviconSize = savedUiState.faviconSize || "32"
    uiState.duplicateScope =
      savedUiState.duplicateScope ||
      localStorage.getItem("duplicateScope") ||
      "folder"
    uiState.autoRemoveDup =
      savedUiState.autoRemoveDup ??
      (localStorage.getItem("autoRemoveDup") === "true")
    uiState.showNotesPreview = savedUiState.showNotesPreview ?? true
    uiState.showTagsInView = savedUiState.showTagsInView ?? true
    uiState.headerLineStyle =
      savedUiState.headerLineStyle ||
      localStorage.getItem("headerLineStyle") ||
      "pattern"
    uiState.bookmarkMenuBg =
      savedUiState.bookmarkMenuBg ||
      localStorage.getItem("bookmarkMenuBg") ||
      "normal"
    uiState.showSmartFolders = savedUiState.showSmartFolders ?? true
    uiState.sidebarWidth = savedUiState.sidebarWidth || 260

    document.body.setAttribute("data-header-line", uiState.headerLineStyle)
    document.body.setAttribute("data-bookmark-menu-bg", uiState.bookmarkMenuBg)
    document.documentElement.style.setProperty("--sidebar-width", `${uiState.sidebarWidth}px`)

    if (storageSettings.checkboxesVisible) {
      uiState.checkboxesVisible = result.checkboxesVisible || false
    } else {
      uiState.checkboxesVisible = false
    }
    uiState.bookmarkTags = result.bookmarkTags || {}
    uiState.tagColors = result.tagColors || {}
    uiState.tagTextColors = result.tagTextColors || {}
    // Clean health status on load so health icons don't show before user explicitly runs a check
    uiState.healthStatus = {}

    const savedLanguage = localStorage.getItem("appLanguage") || "en"
    if (elements.languageSwitcher) {
      elements.languageSwitcher.value = savedLanguage
    }
    if (elements.viewSwitcher) {
      if (elements.viewSwitcher.tagName === "SELECT") {
        elements.viewSwitcher.value = uiState.viewMode
      } else {
        const swatches = elements.viewSwitcher.querySelectorAll(
          ".theme-swatch, .view-swatch",
        )
        swatches.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.value === uiState.viewMode)
        })
      }
    }
    if (elements.folderFilter) {
      if (elements.folderFilter) elements.folderFilter.value = uiState.selectedFolderId
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
    const showNotesPreviewToggle = document.getElementById("show-notes-preview-toggle")
    if (showNotesPreviewToggle) {
      showNotesPreviewToggle.checked = uiState.showNotesPreview
    }
    const showTagsInViewToggle = document.getElementById("show-tags-in-view-toggle")
    if (showTagsInViewToggle) {
      showTagsInViewToggle.checked = uiState.showTagsInView
    }

    // Sync duplicate scope UI
    const duplicateScopeSelect = document.getElementById("duplicate-scope-select")
    if (duplicateScopeSelect) {
      if (duplicateScopeSelect.tagName === "SELECT") {
        duplicateScopeSelect.value = uiState.duplicateScope
      } else {
        const swatches = duplicateScopeSelect.querySelectorAll(".setting-swatch")
        swatches.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.value === uiState.duplicateScope)
        })
      }
    }

    // Sync auto remove duplicates toggle
    const autoRemoveDupToggle = document.getElementById("auto-remove-dup-toggle")
    if (autoRemoveDupToggle) {
      autoRemoveDupToggle.checked = !!uiState.autoRemoveDup
    }

    // Sync header line style
    const headerLineSelect = document.getElementById("header-line-select")
    if (headerLineSelect) {
      if (headerLineSelect.tagName === "SELECT") {
        headerLineSelect.value = uiState.headerLineStyle
      } else {
        const swatches = headerLineSelect.querySelectorAll(".setting-swatch")
        swatches.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.value === uiState.headerLineStyle)
        })
      }
    }

    // Sync bookmark menu background
    const bookmarkMenuBgSelect = document.getElementById("bookmark-menu-bg-select")
    if (bookmarkMenuBgSelect) {
      const swatches = bookmarkMenuBgSelect.querySelectorAll(".setting-swatch")
      swatches.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === uiState.bookmarkMenuBg)
      })
    }

    // Sync smart folders
    const smartFoldersSelect = document.getElementById("smart-folders-select")
    if (smartFoldersSelect) {
      const expectedVal = uiState.showSmartFolders !== false ? "show" : "hide"
      const swatches = smartFoldersSelect.querySelectorAll(".setting-swatch")
      swatches.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === expectedVal)
      })
    }

    document
      .querySelectorAll(".bookmark-checkbox")
      .forEach((checkbox) => {
        checkbox.style.display = uiState.checkboxesVisible
          ? "inline-block"
          : "none"
        if (!uiState.checkboxesVisible) {
          checkbox.classList.add("hidden")
        } else {
          checkbox.classList.remove("hidden")
        }
      })
    const selectAllContainers = document.querySelectorAll(
      ".select-all, .sidebar-select-all, #select-all-container",
    )
    selectAllContainers.forEach((container) => {
      if (uiState.checkboxesVisible) {
        container.style.display = "flex"
        container.classList.remove("hidden")
      } else {
        container.style.display = "none"
        container.classList.add("hidden")
      }
    })
    const selectAllInputs = document.querySelectorAll(
      "#select-all, .select-all input[type='checkbox'], .sidebar-select-all input[type='checkbox'], .select-all-container input[type='checkbox']",
    )
    selectAllInputs.forEach((input) => {
      input.style.display = uiState.checkboxesVisible ? "" : "none"
    })

    const tagFilterDropdown = document.getElementById("tag-filter-dropdown")
    if (tagFilterDropdown) {
      const checkboxes = tagFilterDropdown.querySelectorAll(
        'input[type="checkbox"]'
      )
      checkboxes.forEach((checkbox) => {
        checkbox.checked = uiState.selectedTags.includes(checkbox.value)
      })
    } else {
      // suppressed
    }

    // Làm mới giao diện sau khi tải trạng thái
    window.BookmarkCache.getTree((bookmarkTreeNodes) => {
      populateTagFilter(elements)
      renderFilteredBookmarks(bookmarkTreeNodes, elements)
    })

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

function saveQuickOpenSetting() {
  const selectedAction = document.querySelector(
    'input[name="quickOpenAction"]:checked'
  )
  if (selectedAction) {
    chrome.storage.local.set({ quickOpenAction: selectedAction.value }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving Quick Open setting:",
          chrome.runtime.lastError
        )
      } else {
        console.log("Quick Open Action saved:", selectedAction.value)
      }
    })
  }
}

function loadQuickOpenSetting() {
  chrome.storage.local.get(["quickOpenAction"], (result) => {
    const quickOpenAction = result.quickOpenAction || "popup"
    const radio = document.getElementById(`quick-open-${quickOpenAction}`)
    if (radio) {
      radio.checked = true
    }
  })
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

  settingsButton.addEventListener("click", (e) => {
    e.stopPropagation()

    loadStorageSettings()
    showLocalStorageSettingsPopup()
  })

  saveButton.addEventListener("click", (e) => {
    e.stopPropagation()
    saveStorageSettings()
      .then((storageSettings) => {
        customSaveUIState()
        const searchInput = document.getElementById("search-input")
        if (searchInput && !storageSettings.searchQuery) {
          uiState.searchQuery = ""
          searchInput.value = ""
        }

        if (!storageSettings.selectedTags) {
          uiState.selectedTags = []

          const tagFilterDropdown = document.getElementById(
            "tag-filter-dropdown"
          )
          if (tagFilterDropdown) {
            const checkboxes = tagFilterDropdown.querySelectorAll(
              'input[type="checkbox"]'
            )
            checkboxes.forEach((checkbox) => {
              checkbox.checked = false
            })
          }
        }
        if (
          !storageSettings.bookmarkTags ||
          !storageSettings.tagColors ||
          !storageSettings.selectedTags
        ) {
          window.BookmarkCache.getTree((bookmarkTreeNodes) => {
            populateTagFilter(elements)
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            attachTreeListeners(elements)
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
          customSaveUIState()
          const searchInput = document.getElementById("search-input")
          if (searchInput && !storageSettings.searchQuery) {
            uiState.searchQuery = ""
            searchInput.value = ""
          }

          if (!storageSettings.selectedTags) {
            uiState.selectedTags = []

            const tagFilterDropdown = document.getElementById(
              "tag-filter-dropdown"
            )
            if (tagFilterDropdown) {
              const checkboxes = tagFilterDropdown.querySelectorAll(
                'input[type="checkbox"]'
              )
              checkboxes.forEach((checkbox) => {
                checkbox.checked = false
              })
            }
          }
          if (
            !storageSettings.bookmarkTags ||
            !storageSettings.tagColors ||
            !storageSettings.selectedTags
          ) {
            window.BookmarkCache.getTree((bookmarkTreeNodes) => {
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

  // Quick Open Settings
  const quickOpenRadios = document.querySelectorAll(
    'input[name="quickOpenAction"]'
  )
  quickOpenRadios.forEach((radio) => {
    radio.addEventListener("change", saveQuickOpenSetting)
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners()
    loadQuickOpenSetting()
  })
} else {
  initializeEventListeners()
  loadQuickOpenSetting()
}

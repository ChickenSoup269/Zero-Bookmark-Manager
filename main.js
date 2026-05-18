// Sự kiện cho favicon option
const faviconOptionSelect = document.getElementById("favicon-option-select")
if (faviconOptionSelect) {
  // Ưu tiên lấy từ localStorage nếu có
  const savedFaviconOption =
    localStorage.getItem("faviconOption") || uiState.faviconOption || "auto"
  faviconOptionSelect.value = savedFaviconOption
  uiState.faviconOption = savedFaviconOption
  faviconOptionSelect.addEventListener("change", (e) => {
    uiState.faviconOption = e.target.value
    localStorage.setItem("faviconOption", uiState.faviconOption)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.faviconOption = uiState.faviconOption
      chrome.storage.local.set({ uiState: newUiState }, () => {
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          }
        })
      })
    })
  })
}

// Cài đặt cho Header Line
const headerLineSelect = document.getElementById("header-line-select")
if (headerLineSelect) {
  const savedHeaderLine =
    localStorage.getItem("headerLineStyle") ||
    window.uiState?.headerLineStyle ||
    "pattern"
  headerLineSelect.value = savedHeaderLine
  if (window.uiState) window.uiState.headerLineStyle = savedHeaderLine
  document.body.setAttribute("data-header-line", savedHeaderLine)

  headerLineSelect.addEventListener("change", (e) => {
    const val = e.target.value
    if (window.uiState) window.uiState.headerLineStyle = val
    localStorage.setItem("headerLineStyle", val)
    document.body.setAttribute("data-header-line", val)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.headerLineStyle = val
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}

// Sự kiện cho Duplicate Scope
const duplicateScopeSelect = document.getElementById("duplicate-scope-select")
if (duplicateScopeSelect) {
  const savedDuplicateScope =
    localStorage.getItem("duplicateScope") || uiState.duplicateScope || "folder"
  duplicateScopeSelect.value = savedDuplicateScope
  uiState.duplicateScope = savedDuplicateScope
  duplicateScopeSelect.addEventListener("change", (e) => {
    uiState.duplicateScope = e.target.value
    localStorage.setItem("duplicateScope", uiState.duplicateScope)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.duplicateScope = uiState.duplicateScope
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}

// Sự kiện cho Background Auto Remove Duplicates
const autoRemoveDupToggle = document.getElementById("auto-remove-dup-toggle")
if (autoRemoveDupToggle) {
  const savedAutoRemove =
    localStorage.getItem("autoRemoveDup") === "true" ||
    uiState.autoRemoveDup ||
    false
  autoRemoveDupToggle.checked = savedAutoRemove
  uiState.autoRemoveDup = savedAutoRemove
  autoRemoveDupToggle.addEventListener("change", (e) => {
    uiState.autoRemoveDup = e.target.checked
    localStorage.setItem("autoRemoveDup", uiState.autoRemoveDup)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.autoRemoveDup = uiState.autoRemoveDup
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}
import {
  updateTheme,
  renderFilteredBookmarks,
  updateUILanguage,
  openOrganizeFoldersModal,
} from "./components/ui.js"
import { getBookmarkTree, loadVisitCounts } from "./components/bookmarks.js"
import {
  translations,
  debounce,
  showCustomPopup,
} from "./components/utils/utils.js"
import { setupEventListeners } from "./components/events.js"
import { uiState } from "./components/state.js"
import { customLoadUIState } from "./components/option/option.js"
import { initCopyButtons } from "./components/copy-code.js"

let elements = {}
const CUSTOM_LANGUAGES_KEY = "customLanguagePacks"

export function getElements() {
  return elements
}

function getActiveTranslations() {
  const language = localStorage.getItem("appLanguage") || "en"
  return translations[language] || translations.en
}

function readCustomLanguagePacks() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_LANGUAGES_KEY) || "{}")
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : {}
  } catch (error) {
    console.warn("Failed to read custom languages:", error)
    return {}
  }
}

function writeCustomLanguagePacks(packs) {
  localStorage.setItem(CUSTOM_LANGUAGES_KEY, JSON.stringify(packs))
}

function normalizeCustomLanguagePack(rawPack) {
  if (!rawPack || typeof rawPack !== "object" || Array.isArray(rawPack)) {
    throw new Error("Invalid language pack")
  }

  const translationsObject = rawPack.translations
  if (
    !translationsObject ||
    typeof translationsObject !== "object" ||
    Array.isArray(translationsObject)
  ) {
    throw new Error("Missing translations object")
  }

  const rawCode = String(
    rawPack.languageCode || rawPack.code || rawPack.locale || "",
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")

  if (!rawCode) throw new Error("Missing language code")

  const code = ["en", "vi"].includes(rawCode) ? `custom-${rawCode}` : rawCode
  const name = String(
    rawPack.languageName || rawPack.name || rawPack.label || code,
  ).trim()

  return {
    languageCode: code,
    languageName: name,
    translations: { ...translationsObject },
  }
}

function registerCustomLanguagePacks() {
  const packs = readCustomLanguagePacks()
  Object.values(packs).forEach((pack) => {
    try {
      const normalized = normalizeCustomLanguagePack(pack)
      translations[normalized.languageCode] = {
        ...translations.en,
        ...normalized.translations,
      }
    } catch (error) {
      console.warn("Skipped invalid custom language pack:", error)
    }
  })
  return packs
}

function renderCustomLanguageOptions(languageSwitcher) {
  if (!languageSwitcher) return

  languageSwitcher
    .querySelectorAll("option[data-custom-language]")
    .forEach((option) => option.remove())

  Object.values(readCustomLanguagePacks()).forEach((pack) => {
    const option = document.createElement("option")
    option.value = pack.languageCode
    option.textContent = pack.languageName
    option.dataset.customLanguage = "true"
    languageSwitcher.appendChild(option)
  })
}

function createCustomLanguageTemplate() {
  const t = getActiveTranslations()
  return JSON.stringify(
    {
      languageCode: "my-language",
      languageName: t.customLanguageTemplateName || "My Language",
      translations: {
        allBookmarks: "All Bookmarks",
        settings: "Settings",
        quickOpenTitle: "Quick Open Action",
        quickOpenPopup: "Default Popup",
        quickOpenSidePanel: "Default Side Panel",
        quickOpenWeb: "Default Web Tab",
        save: "Save",
        cancel: "Cancel",
      },
    },
    null,
    2,
  )
}

function setupCustomLanguageControls(elements) {
  const openButton = document.getElementById("add-custom-language-option")
  const popup = document.getElementById("custom-language-popup")
  const textarea = document.getElementById("custom-language-json-input")
  const fileInput = document.getElementById("custom-language-file-input")
  const importButton = document.getElementById("custom-language-import-file")
  const templateButton = document.getElementById("custom-language-template")
  const saveButton = document.getElementById("custom-language-save")
  const cancelButton = document.getElementById("custom-language-cancel")
  const copyPromptBtn = document.getElementById("copy-ai-prompt-btn")

  if (
    !openButton ||
    !popup ||
    !textarea ||
    !fileInput ||
    !importButton ||
    !templateButton ||
    !saveButton ||
    !cancelButton
  ) {
    return
  }

  const closePopup = () => {
    popup.classList.add("hidden")
    textarea.value = ""
  }

  openButton.addEventListener("click", () => {
    textarea.value = ""
    popup.classList.remove("hidden")
    textarea.focus()
  })

  cancelButton.addEventListener("click", closePopup)
  popup.addEventListener("click", (event) => {
    if (event.target === popup) closePopup()
  })

  importButton.addEventListener("click", () => fileInput.click())
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      textarea.value = String(reader.result || "")
      fileInput.value = ""
    }
    reader.readAsText(file)
  })

  templateButton.addEventListener("click", () => {
    textarea.value = createCustomLanguageTemplate()
    textarea.focus()
  })

  // Add functionality for Copy Prompt & Template logic
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", () => {
      const template = createCustomLanguageTemplate()
      const prompt = `Translate the following JSON language file into {YOUR_LANGUAGE_HERE}. Keep the JSON keys and structure identical. Output ONLY the raw JSON format so I can copy it directly.\n\n${template}`

      navigator.clipboard
        .writeText(prompt)
        .then(() => {
          const originalText = copyPromptBtn.innerHTML
          copyPromptBtn.innerHTML = `<i class="fas fa-check"></i> Copied to Clipboard!`
          setTimeout(() => {
            copyPromptBtn.innerHTML = originalText
          }, 2000)
        })
        .catch((err) => {
          console.error("Could not copy text: ", err)
        })
    })
  }

  saveButton.addEventListener("click", () => {
    const t = getActiveTranslations()

    try {
      const normalized = normalizeCustomLanguagePack(JSON.parse(textarea.value))
      const packs = readCustomLanguagePacks()
      packs[normalized.languageCode] = normalized
      writeCustomLanguagePacks(packs)

      translations[normalized.languageCode] = {
        ...translations.en,
        ...normalized.translations,
      }

      renderCustomLanguageOptions(elements.languageSwitcher)
      elements.languageSwitcher.value = normalized.languageCode
      updateUILanguage(elements, normalized.languageCode)
      window.dispatchEvent(new CustomEvent("languageChanged"))

      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        }
      })

      closePopup()
      showCustomPopup(
        t.customLanguageSaved || "Custom language saved!",
        "success",
        true,
      )
    } catch (error) {
      console.warn("Invalid custom language JSON:", error)
      showCustomPopup(
        t.customLanguageInvalid ||
          "Invalid language JSON. Use languageCode, languageName, and translations.",
        "error",
        true,
      )
    }
  })
}

document.addEventListener("DOMContentLoaded", () => {
  elements = {
    searchInput: document.getElementById("search"),
    clearSearchButton: document.getElementById("clear-search"),
    folderFilter: document.getElementById("folder-filter"),
    sortFilter: document.getElementById("sort-filter"),
    createFolderButton: document.getElementById("create-folder"),
    renameFolderInput: document.getElementById("rename-folder-input"),
    renameFolderSave: document.getElementById("rename-folder-save"),
    renameFolderCancel: document.getElementById("rename-folder-cancel"),
    addToFolderButton: document.getElementById("add-to-folder"),
    deleteFolderButton: document.getElementById("delete-folder"),
    deleteBookmarksButton: document.getElementById("delete-bookmarks-button"),
    toggleCheckboxesButton: document.getElementById("toggle-checkboxes"),
    folderListDiv: document.getElementById("folder-list"),
    bookmarkCountDiv: document.getElementById("bookmark-count"),
    scrollToTopButton: document.getElementById("scroll-to-top"),
    reportBugButton: document.getElementById("report-bug"),
    clearRenameButton: document.getElementById("clear-rename"),
    addToFolderPopup: document.getElementById("add-to-folder-popup"),
    addToFolderSelect: document.getElementById("add-to-folder-select"),
    newFolderInput: document.getElementById("new-folder-input"),
    createNewFolderButton: document.getElementById("create-new-folder"),
    addToFolderSaveButton: document.getElementById("add-to-folder-save"),
    addToFolderCancelButton: document.getElementById("add-to-folder-cancel"),
    settingsButton: document.getElementById("settings-button"),
    settingsMenu: document.getElementById("settings-menu"),
    openSidePanelOption: document.getElementById("open-side-panel-option"),
    exportBookmarksOption: document.getElementById("export-bookmarks-option"),
    importBookmarksOption: document.getElementById("import-bookmarks-option"),
    languageSwitcher: document.getElementById("language-switcher"),
    themeSwitcher: document.getElementById("theme-switcher"),
    fontSwitcher: document.getElementById("font-switcher"),
    viewSwitcher: document.getElementById("view-switcher"),
    renamePopup: document.getElementById("rename-popup"),
    renameInput: document.getElementById("rename-input"),
    renameSave: document.getElementById("rename-save"),
    renameCancel: document.getElementById("rename-cancel"),
    customPopup: document.getElementById("custom-popup"),
    customPopupTitle: document.getElementById("custom-popup-title"),
    customPopupMessage: document.getElementById("custom-popup-message"),
    customPopupOk: document.getElementById("custom-popup-ok"),
    renameFolderButton: document.getElementById("rename-folder"),
    renameFolderPopup: document.getElementById("rename-folder-popup"),
    renameFolderSelect: document.getElementById("rename-folder-select"),
    renameFolderInput: document.getElementById("rename-folder-input"),
    renameFolderSave: document.getElementById("rename-folder-save"),
    renameFolderCancel: document.getElementById("rename-folder-cancel"),
    clearRenameFolder: document.getElementById("clear-rename-folder"),
    createFolderBtn: document.getElementById("create-folder"),
    createFolderPopup: document.getElementById("create-folder-popup"),
    createFolderInput: document.getElementById("create-folder-input"),
    createFolderSave: document.getElementById("create-folder-save"),
    createFolderCancel: document.getElementById("create-folder-cancel"),
    clearCreateFolder: document.getElementById("clear-create-folder"),
    showBookmarkIdsOption: document.getElementById("show-bookmark-ids-option"),
    toggleFolderListBgOption: document.getElementById("folder-list-bg-toggle"),
    tagFilterContainer: document.getElementById("tag-filter-container"),
    tagFilterToggle: document.getElementById("tag-filter-toggle"),
    tagFilterDropdown: document.getElementById("tag-filter-dropdown"),
    tagFilterOptions: document.getElementById("tag-filter-options"),
    checkHealthButton: document.getElementById("check-health-btn"),
    checkDuplicatesButton: document.getElementById("check-duplicates-btn"),
    healthSortFilter: document.getElementById("health-sort-filter"),
    organizeFoldersButton: document.getElementById("organize-folders-button"),
    organizeFoldersPopup: document.getElementById("organize-folders-popup"),
    folderContextMenu: document.getElementById("folder-context-menu"),
    contextMenuMoveFolderButton: document.getElementById(
      "context-menu-move-folder",
    ),
    viewVisitCountsOption: document.getElementById("view-visit-counts-option"),
  }

  const init = () => {
    initCopyButtons()
    registerCustomLanguagePacks()
    renderCustomLanguageOptions(elements.languageSwitcher)
    setupCustomLanguageControls(elements)

    // Update check logic
    chrome.storage.local.get("showUpdatePopup", (res) => {
      if (res.showUpdatePopup) {
        const updatePopup = document.getElementById("update-popup")
        const updateTitle = document.getElementById("update-popup-title")
        const updateMessage = document.getElementById("update-popup-message")
        const updateVersion = document.getElementById("update-version")
        const updateClose = document.getElementById("update-popup-close")
        const currentVersion = chrome.runtime.getManifest().version
        const language = localStorage.getItem("appLanguage") || "en"

        if (updatePopup && updateVersion && updateClose) {
          if (updateTitle)
            updateTitle.textContent = translations[language].updateTitle
          if (updateMessage) {
            updateMessage.innerHTML = `${translations[language].updateMessage} <strong id="update-version">${currentVersion}</strong>`
          } else {
            updateVersion.textContent = currentVersion
          }

          updatePopup.classList.remove("hidden")

          const closeUpdatePopup = () => {
            updatePopup.classList.add("hidden")
          }

          updateClose.addEventListener("click", closeUpdatePopup, {
            once: true,
          })

          updatePopup.addEventListener("click", (e) => {
            if (e.target === updatePopup) {
              closeUpdatePopup()
            }
          })
        }

        // Remove the flag so it doesn't show again until next update
        chrome.storage.local.remove("showUpdatePopup")
      }
    })

    // Thêm import option vào settings menu
    if (!elements.importBookmarksOption) {
      const importBookmarksOption = document.createElement("button")
      importBookmarksOption.id = "import-bookmarks-option"
      importBookmarksOption.className = "menu-item"
      importBookmarksOption.textContent =
        translations[
          localStorage.getItem("appLanguage") || "en"
        ].importBookmarks
      elements.settingsMenu.appendChild(importBookmarksOption)
      elements.importBookmarksOption = importBookmarksOption
    }

    // Khởi tạo ngôn ngữ
    const storedLanguage = localStorage.getItem("appLanguage")
    const savedLanguage =
      storedLanguage && translations[storedLanguage] ? storedLanguage : "en"
    elements.languageSwitcher.value = savedLanguage
    updateUILanguage(elements, savedLanguage)

    // Khởi tạo theme, font, view
    const savedTheme = localStorage.getItem("appTheme") || "system"
    elements.themeSwitcher.value = savedTheme
    updateTheme(elements, savedTheme)

    const savedFont = localStorage.getItem("appFont") || "gohu"
    document.body.classList.add(`font-${savedFont}`)
    elements.fontSwitcher.value = savedFont

    // Check for first run
    if (!localStorage.getItem("firstRunComplete")) {
      const firstRunPopup = document.getElementById("first-run-popup")
      const firstRunFontSelect = document.getElementById(
        "first-run-font-select",
      )
      const firstRunSaveBtn = document.getElementById("first-run-save")

      if (firstRunPopup && firstRunSaveBtn) {
        firstRunPopup.classList.remove("hidden")

        firstRunSaveBtn.addEventListener("click", () => {
          const selectedFont = firstRunFontSelect.value

          // Remove all possible font classes
          const fontClasses = Array.from(document.body.classList).filter(
            (cls) => cls.startsWith("font-"),
          )
          fontClasses.forEach((cls) => document.body.classList.remove(cls))

          document.body.classList.add(`font-${selectedFont}`)
          localStorage.setItem("appFont", selectedFont)
          elements.fontSwitcher.value = selectedFont

          localStorage.setItem("firstRunComplete", "true")
          firstRunPopup.classList.add("hidden")
        })
      }
    }

    const savedView = localStorage.getItem("appView") || "flat"
    elements.viewSwitcher.value = savedView
    uiState.viewMode = savedView

    // Khôi phục trạng thái showBookmarkIds
    chrome.storage.local.get(["showBookmarkIds"], (data) => {
      uiState.showBookmarkIds = data.showBookmarkIds || false
      if (elements.showBookmarkIdsOption) {
        const iconClass = uiState.showBookmarkIds ? "fa-eye" : "fa-eye-slash"
        elements.showBookmarkIdsOption.innerHTML = `<i class="fas ${iconClass}"></i> ${
          uiState.showBookmarkIds
            ? translations[savedLanguage].hideBookmarkIds
            : translations[savedLanguage].showBookmarkIds
        }`
      }
    })

    // Khôi phục trạng thái folderListBg
    chrome.storage.local.get(["folderListBg"], (data) => {
      uiState.folderListBg =
        data.folderListBg !== undefined ? data.folderListBg : true
      if (elements.folderListDiv) {
        if (uiState.folderListBg) {
          elements.folderListDiv.classList.remove("no-bg")
        } else {
          elements.folderListDiv.classList.add("no-bg")
        }
      }
      if (elements.toggleFolderListBgOption) {
        elements.toggleFolderListBgOption.checked = uiState.folderListBg
      }
    })

    // Load saved states for settings sections
    const savedCollapsedStates = JSON.parse(
      localStorage.getItem("settingsSectionCollapsedStates") || "{}",
    )

    document
      .querySelectorAll("#settings-menu .dropdown-section-title")
      .forEach((title) => {
        const sectionId = title.dataset.i18n
        let shouldBeCollapsed = savedCollapsedStates[sectionId] === true

        let nextElement = title.nextElementSibling
        while (
          nextElement &&
          !nextElement.classList.contains("dropdown-section-title")
        ) {
          if (shouldBeCollapsed) {
            if (!nextElement.classList.contains("hidden")) {
              nextElement.classList.add("hidden")
            }
          } else {
            if (nextElement.classList.contains("hidden")) {
              nextElement.classList.remove("hidden")
            }
          }
          nextElement = nextElement.nextElementSibling
        }

        if (shouldBeCollapsed) {
          if (!title.classList.contains("collapsed")) {
            title.classList.add("collapsed")
          }
        } else {
          if (title.classList.contains("collapsed")) {
            title.classList.remove("collapsed")
          }
        }
      })

    // Lấy dữ liệu bookmark
    getBookmarkTree((bookmarkTreeNodes) => {
      if (bookmarkTreeNodes) {
        // Load visit counts from background script
        loadVisitCounts(() => {
          customLoadUIState(() => {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            setupBookmarkChangeListeners(elements)
          })
        })
      } else {
        elements.folderListDiv.innerHTML = `<p>${translations[savedLanguage].noBookmarks}</p>`
      }
    })

    // Thiết lập event listeners
    setupEventListeners(elements)

    // Event listener for Organize Folders button
    if (elements.organizeFoldersButton) {
      elements.organizeFoldersButton.addEventListener("click", (e) => {
        e.stopPropagation() // Prevent dropdown from closing immediately
        openOrganizeFoldersModal(elements)
        elements.settingsMenu.classList.add("hidden") // Close settings menu after opening modal
      })
    }

    // Sự kiện cho showBookmarkIdsOption
    if (elements.showBookmarkIdsOption) {
      elements.showBookmarkIdsOption.addEventListener("click", () => {
        uiState.showBookmarkIds = !uiState.showBookmarkIds
        chrome.storage.local.set({ showBookmarkIds: uiState.showBookmarkIds })
        const iconClass = uiState.showBookmarkIds ? "fa-eye" : "fa-eye-slash"
        elements.showBookmarkIdsOption.innerHTML = `<i class="fas ${iconClass}"></i> ${
          uiState.showBookmarkIds
            ? translations[savedLanguage].hideBookmarkIds
            : translations[savedLanguage].showBookmarkIds
        }`
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          }
        })
      })
    }

    // Sự kiện cho toggleFolderListBgOption (toggle switch)
    if (elements.toggleFolderListBgOption) {
      elements.toggleFolderListBgOption.addEventListener("change", (e) => {
        uiState.folderListBg = e.target.checked
        chrome.storage.local.set({ folderListBg: uiState.folderListBg })
        if (elements.folderListDiv) {
          if (uiState.folderListBg) {
            elements.folderListDiv.classList.remove("no-bg")
          } else {
            elements.folderListDiv.classList.add("no-bg")
          }
        }
      })
    }

    // Sự kiện cho open-side-panel-option
    if (elements.openSidePanelOption) {
      elements.openSidePanelOption.addEventListener("click", () => {
        if (chrome.sidePanel) {
          // Get the last focused window that is a normal browser window
          chrome.windows.getLastFocused(
            { windowTypes: ["normal"] },
            (window) => {
              if (window) {
                // Open the side panel for that window
                // It will open on the window's active tab by default
                chrome.sidePanel.open({ windowId: window.id })
              } else {
                console.error("No normal window found to open side panel.")
                alert("Could not open side panel: No active window found.")
              }
            },
          )
        } else {
          console.error("Side Panel API not available.")
          alert("Side Panel API not available in this browser.")
        }
      })
    }

    // Sự kiện cho languageSwitcher
    elements.languageSwitcher.addEventListener("change", (e) => {
      const newLanguage = e.target.value
      localStorage.setItem("appLanguage", newLanguage)
      updateUILanguage(elements, newLanguage)
      window.dispatchEvent(new CustomEvent("languageChanged")) // Dispatch custom event
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        }
      })
    })

    // View Visit Counts option
    if (elements.viewVisitCountsOption) {
      elements.viewVisitCountsOption.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "getVisitCounts" }, (response) => {
          if (chrome.runtime.lastError) {
            alert("Error: " + chrome.runtime.lastError.message)
            return
          }
          const visitCounts = response?.visitCounts || {}
          const count = Object.keys(visitCounts).length
          const total = Object.values(visitCounts).reduce(
            (sum, c) => sum + c,
            0,
          )

          console.log("Visit Counts:", visitCounts)
          alert(
            `Visit Counts Debug:\n\n` +
              `Tracked bookmarks: ${count}\n` +
              `Total visits: ${total}\n\n` +
              `Details in console (F12)`,
          )
        })
      })
    }
  }

  function setupBookmarkChangeListeners(elements) {
    const refreshBookmarks = debounce(() => {
      // Reload visit counts whenever bookmarks change
      loadVisitCounts(() => {
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          } else {
            const language = localStorage.getItem("appLanguage") || "en"
            console.error(translations[language].errorUnexpected)
          }
        })
      })
    }, 500)

    // Re-render when bookmark structure changes (add/remove/edit/move via Chrome or extension)
    chrome.bookmarks.onCreated.addListener(refreshBookmarks)
    chrome.bookmarks.onRemoved.addListener(refreshBookmarks)
    chrome.bookmarks.onChanged.addListener(refreshBookmarks)
    chrome.bookmarks.onMoved.addListener(refreshBookmarks)

    // Re-render when extension storage changes (tags, favorites, pinned, visit counts, etc.)
    // This keeps the webview tab in sync when popup or another context updates storage
    const storageChangeKeys = new Set([
      "bookmarkTags",
      "tagColors",
      "tagTextColors",
      "visitCounts",
      "favoriteBookmarks",
      "pinnedBookmarks",
    ])
    const handleStorageChange = debounce((changes) => {
      const relevantChange = Object.keys(changes).some((key) =>
        storageChangeKeys.has(key),
      )
      if (relevantChange) {
        loadVisitCounts(() => {
          getBookmarkTree((bookmarkTreeNodes) => {
            if (bookmarkTreeNodes) {
              renderFilteredBookmarks(bookmarkTreeNodes, elements)
            }
          })
        })
      }
    }, 500)
    chrome.storage.onChanged.addListener(handleStorageChange)

    window.addEventListener("unload", () => {
      chrome.bookmarks.onCreated.removeListener(refreshBookmarks)
      chrome.bookmarks.onRemoved.removeListener(refreshBookmarks)
      chrome.bookmarks.onChanged.removeListener(refreshBookmarks)
      chrome.bookmarks.onMoved.removeListener(refreshBookmarks)
      chrome.storage.onChanged.removeListener(handleStorageChange)
    })
  }

  init()
})

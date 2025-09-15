import {
  updateTheme,
  restoreUIState,
  renderFilteredBookmarks,
} from "./components/ui.js"
import { getBookmarkTree } from "./components/bookmarks.js"
import { translations, debounce } from "./components/utils.js"
import { setupEventListeners } from "./components/events.js"
import { uiState } from "./components/state.js"

document.addEventListener("DOMContentLoaded", () => {
  // DOM references
  const elements = {
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
    clearRenameButton: document.getElementById("clear-rename"),
    addToFolderPopup: document.getElementById("add-to-folder-popup"),
    addToFolderSelect: document.getElementById("add-to-folder-select"),
    newFolderInput: document.getElementById("new-folder-input"),
    createNewFolderButton: document.getElementById("create-new-folder"),
    addToFolderSaveButton: document.getElementById("add-to-folder-save"),
    addToFolderCancelButton: document.getElementById("add-to-folder-cancel"),
    settingsButton: document.getElementById("settings-button"),
    settingsMenu: document.getElementById("settings-menu"),
    exportBookmarksOption: document.getElementById("export-bookmarks-option"),
    importBookmarksOption: document.getElementById("import-bookmarks-option"),
    languageSwitcher: document.getElementById("language-switcher"),
    themeSwitcher: document.getElementById("theme-switcher"),
    fontSwitcher: document.getElementById("font-switcher"),
    viewSwitcher: document.getElementById("view-switcher"), // Added view-switcher
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
    renameFolderOption: document.getElementById("rename-folder-option"),
  }

  // Initialize application
  const init = () => {
    // Add import option to settings menu
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

    // Initialize theme, font, and view
    const savedTheme = localStorage.getItem("appTheme") || "system"
    elements.themeSwitcher.value = savedTheme
    if (typeof updateTheme === "function") {
      updateTheme(elements, savedTheme)
    } else {
      console.error(
        "updateTheme function is not defined. Check imports in main.js."
      )
    }

    const savedFont = localStorage.getItem("appFont") || "normal"
    document.body.classList.add(`font-${savedFont}`)
    elements.fontSwitcher.value = savedFont

    const savedView = localStorage.getItem("appView") || "flat"
    elements.viewSwitcher.value = savedView
    uiState.viewMode = savedView

    // Fetch fresh bookmark data first
    getBookmarkTree((bookmarkTreeNodes) => {
      if (bookmarkTreeNodes) {
        // Restore UI state and render after fresh data
        restoreUIState(elements, () => {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
          setupBookmarkChangeListeners(elements)
        })
      } else {
        const language = localStorage.getItem("appLanguage") || "en"
        elements.folderListDiv.innerHTML = `<p>${translations[language].noBookmarks}</p>`
      }
    })

    // Setup event listeners after DOM is ready
    setupEventListeners(elements)
  }

  // Add real-time bookmark change listeners
  function setupBookmarkChangeListeners(elements) {
    const refreshBookmarks = debounce(() => {
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        } else {
          console.error("Failed to refresh bookmark tree on change")
          const language = localStorage.getItem("appLanguage") || "en"
          // Placeholder for showCustomPopup
          console.error(translations[language].errorUnexpected)
        }
      })
    }, 500)

    chrome.bookmarks.onCreated.addListener(refreshBookmarks)
    chrome.bookmarks.onRemoved.addListener(refreshBookmarks)
    chrome.bookmarks.onChanged.addListener(refreshBookmarks)
    chrome.bookmarks.onMoved.addListener(refreshBookmarks)

    // Clean up listeners on popup close
    window.addEventListener("unload", () => {
      chrome.bookmarks.onCreated.removeListener(refreshBookmarks)
      chrome.bookmarks.onRemoved.removeListener(refreshBookmarks)
      chrome.bookmarks.onChanged.removeListener(refreshBookmarks)
      chrome.bookmarks.onMoved.removeListener(refreshBookmarks)
    })
  }

  init()
})

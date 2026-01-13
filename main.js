import {
  updateTheme,
  renderFilteredBookmarks,
  updateUILanguage,
  openOrganizeFoldersModal,
} from "./components/ui.js"
import { getBookmarkTree } from "./components/bookmarks.js"
import { translations, debounce } from "./components/utils/utils.js"
import { setupEventListeners } from "./components/events.js"
import { uiState } from "./components/state.js"
import { customLoadUIState } from "./components/option/option.js"
import { initCopyButtons } from "./components/copy-code.js"

let elements = {}

export function getElements() {
  return elements
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
    tagFilterContainer: document.getElementById("tag-filter-container"),
    tagFilterToggle: document.getElementById("tag-filter-toggle"),
    tagFilterDropdown: document.getElementById("tag-filter-dropdown"),
    tagFilterOptions: document.getElementById("tag-filter-options"),
    checkHealthButton: document.getElementById("check-health-btn"),
    healthSortFilter: document.getElementById("health-sort-filter"),
    organizeFoldersButton: document.getElementById("organize-folders-button"),
    folderContextMenu: document.getElementById("folder-context-menu"),
    contextMenuMoveFolderButton: document.getElementById("context-menu-move-folder"),
  }

  const init = () => {
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

    initCopyButtons()

    // Khởi tạo ngôn ngữ
    const savedLanguage = localStorage.getItem("appLanguage") || "en"
    elements.languageSwitcher.value = savedLanguage
    updateUILanguage(elements, savedLanguage)

    // Khởi tạo theme, font, view
    const savedTheme = localStorage.getItem("appTheme") || "system"
    elements.themeSwitcher.value = savedTheme
    updateTheme(elements, savedTheme)

    const savedFont = localStorage.getItem("appFont") || "normal"
    document.body.classList.add(`font-${savedFont}`)
    elements.fontSwitcher.value = savedFont

    const savedView = localStorage.getItem("appView") || "flat"
    elements.viewSwitcher.value = savedView
    uiState.viewMode = savedView

    // Khôi phục trạng thái showBookmarkIds
    chrome.storage.local.get(["showBookmarkIds"], (data) => {
      uiState.showBookmarkIds = data.showBookmarkIds || false
      if (elements.showBookmarkIdsOption) {
        elements.showBookmarkIdsOption.textContent = uiState.showBookmarkIds
          ? translations[savedLanguage].hideBookmarkIds
          : translations[savedLanguage].showBookmarkIds
      }
    })

    // Lấy dữ liệu bookmark
    getBookmarkTree((bookmarkTreeNodes) => {
      if (bookmarkTreeNodes) {
        customLoadUIState(() => {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
          setupBookmarkChangeListeners(elements)
        })
      } else {
        elements.folderListDiv.innerHTML = `<p>${translations[savedLanguage].noBookmarks}</p>`
      }
    })

    // Thiết lập event listeners
    setupEventListeners(elements)

    // Event listener for Organize Folders button
    if (elements.organizeFoldersButton) {
        elements.organizeFoldersButton.addEventListener("click", () => {
            openOrganizeFoldersModal(elements);
        });
    }

    // Sự kiện cho showBookmarkIdsOption
    if (elements.showBookmarkIdsOption) {
      elements.showBookmarkIdsOption.addEventListener("click", () => {
        uiState.showBookmarkIds = !uiState.showBookmarkIds
        chrome.storage.local.set({ showBookmarkIds: uiState.showBookmarkIds })
        elements.showBookmarkIdsOption.textContent = uiState.showBookmarkIds
          ? translations[savedLanguage].hideBookmarkIds
          : translations[savedLanguage].showBookmarkIds
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          }
        })
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
  }

  function setupBookmarkChangeListeners(elements) {
    const refreshBookmarks = debounce(() => {
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        } else {
          const language = localStorage.getItem("appLanguage") || "en"
          console.error(translations[language].errorUnexpected)
        }
      })
    }, 500)

    chrome.bookmarks.onCreated.addListener(refreshBookmarks)
    chrome.bookmarks.onRemoved.addListener(refreshBookmarks)
    chrome.bookmarks.onChanged.addListener(refreshBookmarks)
    chrome.bookmarks.onMoved.addListener(refreshBookmarks)

    window.addEventListener("unload", () => {
      chrome.bookmarks.onCreated.removeListener(refreshBookmarks)
      chrome.bookmarks.onRemoved.removeListener(refreshBookmarks)
      chrome.bookmarks.onChanged.removeListener(refreshBookmarks)
      chrome.bookmarks.onMoved.removeListener(refreshBookmarks)
    })
  }

  init()
})

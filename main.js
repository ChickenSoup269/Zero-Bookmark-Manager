import {
  updateTheme,
  restoreUIState,
  renderFilteredBookmarks,
} from "./components/ui.js"
import { getBookmarkTree } from "./components/bookmarks.js"
import { translations } from "./components/utils.js"
import { setupEventListeners } from "./components/events.js"

document.addEventListener("DOMContentLoaded", () => {
  // Lấy tham chiếu DOM
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

  // Khởi tạo ứng dụng
  const init = () => {
    // Thêm tùy chọn import vào menu settings
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

    // Khởi tạo theme và font
    const savedTheme = localStorage.getItem("appTheme") || "system"
    elements.themeSwitcher.value = savedTheme
    updateTheme(elements, savedTheme)

    const savedFont = localStorage.getItem("appFont") || "normal"
    document.body.classList.add(`font-${savedFont}`)
    elements.fontSwitcher.value = savedFont

    // Khôi phục trạng thái và làm mới bookmark
    restoreUIState(elements, () => {
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        } else {
          const language = localStorage.getItem("appLanguage") || "en"
          elements.folderListDiv.innerHTML = `<p>${translations[language].noBookmarks}</p>`
        }
      })
    })

    // Thiết lập các sự kiện
    setupEventListeners(elements)
  }

  init()
})

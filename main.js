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
  const headerLineSelect = document.getElementById("header-line-select");
  if (headerLineSelect) {
    const savedHeaderLine = localStorage.getItem("headerLineStyle") || window.uiState?.headerLineStyle || "pattern";
    headerLineSelect.value = savedHeaderLine;
    if (window.uiState) window.uiState.headerLineStyle = savedHeaderLine;
    document.body.setAttribute("data-header-line", savedHeaderLine);

    headerLineSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (window.uiState) window.uiState.headerLineStyle = val;
      localStorage.setItem("headerLineStyle", val);
      document.body.setAttribute("data-header-line", val);
      chrome.storage.local.get(["uiState"], (data) => {
        const newUiState = data.uiState || {};
        newUiState.headerLineStyle = val;
        chrome.storage.local.set({ uiState: newUiState });
      });
    });
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
      // Update check logic
      const manifest = chrome.runtime.getManifest();
      const currentVersion = manifest.version;
      const savedVersion = localStorage.getItem("lastSeenVersion");

      if (savedVersion && savedVersion !== currentVersion) {
        const updatePopup = document.getElementById("update-popup");
        const updateVersion = document.getElementById("update-version");
        const updateClose = document.getElementById("update-popup-close");
        if (updatePopup && updateVersion && updateClose) {
          updateVersion.textContent = currentVersion;
          updatePopup.classList.remove("hidden");
          updateClose.addEventListener("click", () => {
            updatePopup.classList.add("hidden");
          }, { once: true });
        }
      }
      localStorage.setItem("lastSeenVersion", currentVersion);



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

    const savedFont = localStorage.getItem("appFont") || "gohu"
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

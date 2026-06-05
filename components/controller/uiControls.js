// components/controller/uiControls.js
import { translations, debounce, showCustomConfirm } from "../utils/utils.js"
import {
  getBookmarkTree,
  isInFolder,
  removeDuplicateBookmarks,
} from "../bookmarks.js"
import {
  updateUILanguage,
  updateTheme,
  renderFilteredBookmarks,
  handleCheckHealth,
} from "../ui.js"
import { uiState, saveUIState } from "../state.js"
import { handleDeleteSelectedBookmarks } from "./bookmarkActions.js"

export function setupUIControlListeners(elements) {
  elements.languageSwitcher.addEventListener("change", (e) => {
    updateUILanguage(elements, e.target.value)
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
  })

  elements.themeSwitcher.addEventListener("change", (e) => {
    localStorage.setItem("appTheme", e.target.value)
    updateTheme(elements, e.target.value)
  })

  elements.fontSwitcher.addEventListener("change", (e) => {
    // Remove all possible font classes
    const fontClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('font-'));
    fontClasses.forEach(cls => document.body.classList.remove(cls));
    
    document.body.classList.add(`font-${e.target.value}`)
    localStorage.setItem("appFont", e.target.value)
  })

  elements.viewSwitcher.addEventListener("change", (e) => {
    uiState.viewMode = e.target.value
    localStorage.setItem("appView", e.target.value)
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  elements.toggleCheckboxesButton.addEventListener("click", () => {
    uiState.checkboxesVisible = !uiState.checkboxesVisible
    const language = localStorage.getItem("appLanguage") || "en"
    elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
      ? translations[language].hideCheckboxes
      : translations[language].showCheckboxes

    // Toggle class hidden for bookmark-checkbox and select-all
    const bookmarkCheckboxes = document.querySelectorAll(".bookmark-checkbox")
    const selectAllContainer = document.querySelector(".select-all")
    const selectAllCheckbox = document.getElementById("select-all")

    if (uiState.checkboxesVisible) {
      // Show checkboxes and select-all
      bookmarkCheckboxes.forEach((checkbox) => {
        checkbox.style.display = "inline-block"
        setTimeout(() => {
          checkbox.classList.remove("hidden")
        }, 10)
      })
      if (selectAllContainer) {
        selectAllContainer.style.display = "flex"
        setTimeout(() => {
          selectAllContainer.classList.remove("hidden")
        }, 10)
      } else {
        console.warn("Select All container (.select-all) not found")
      }
    } else {
      // Hide checkboxes and select-all
      bookmarkCheckboxes.forEach((checkbox) => {
        checkbox.classList.add("hidden")
        setTimeout(() => {
          checkbox.style.display = "none"
        }, 150)
      })
      if (selectAllContainer) {
        selectAllContainer.classList.add("hidden")
        setTimeout(() => {
          selectAllContainer.style.display = "none"
        }, 150)
      } else {
        console.warn("Select All container (.select-all) not found")
      }
      // Reset selection state
      uiState.selectedBookmarks.clear()
      elements.addToFolderButton.classList.add("hidden")
      elements.deleteBookmarksButton.classList.add("hidden")
      bookmarkCheckboxes.forEach((cb) => {
        cb.checked = false
      })
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false
      } else {
        console.warn("Select All checkbox (#select-all) not found")
      }
    }

    updateControlButtons(elements)
    saveUIState()
  })

  elements.editInNewTabOption = document.getElementById(
    "edit-in-new-tab-option",
  )
  if (elements.editInNewTabOption) {
    elements.editInNewTabOption.addEventListener("click", () => {
      const url = chrome.runtime.getURL("bookmarks.html")
      chrome.tabs.create({ url })
      elements.settingsMenu.classList.add("hidden")
    })
  } else {
    console.error("editInNewTabOption element not found")
  }

  function updateControlButtons(elements) {
    const hasSelectedFolder =
      uiState.selectedFolderId &&
      uiState.selectedFolderId !== "1" &&
      uiState.selectedFolderId !== "2"
    const hasSelectedBookmarks = uiState.selectedBookmarks.size > 0

    // Toggle class hidden for buttons
    elements.addToFolderButton.classList.toggle("hidden", !hasSelectedBookmarks)
    elements.deleteBookmarksButton.classList.toggle(
      "hidden",
      !hasSelectedBookmarks,
    )
    elements.deleteFolderButton.classList.toggle("hidden", !hasSelectedFolder)
  }

  elements.scrollToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  })

  if (elements.reportBugButton) {
    elements.reportBugButton.addEventListener("click", () => {
      try {
        const language = localStorage.getItem("appLanguage") || "en"
        const t = translations[language] || translations.en
        const bugUrl = t.reportBugUrl
        
        let version = "N/A"
        try {
          version = chrome.runtime.getManifest().version
        } catch (e) {
          console.warn("Could not get extension version", e)
        }
        
        const userAgent = navigator.userAgent

        const message = `
          <div class="bug-report-confirm">
            <p>${t.reportBugConfirm}</p>
            <div class="bug-info-box">
              <div class="info-item">
                <strong>${t.extensionVersion}:</strong> 
                <code id="bug-version">${version}</code>
                <button class="copy-btn-mini" data-copy="bug-version" title="Copy"><i class="fas fa-copy"></i></button>
              </div>
              <div class="info-item">
                <strong>${t.browserInfo}:</strong> 
                <code id="bug-browser">${userAgent}</code>
                <button class="copy-btn-mini" data-copy="bug-browser" title="Copy"><i class="fas fa-copy"></i></button>
              </div>
            </div>
          </div>
        `

        if (typeof showCustomConfirm === "function") {
          showCustomConfirm(
            message,
            () => {
              window.open(bugUrl, "_blank")
            },
            () => {}
          )

          // Add copy functionality to the mini buttons after the modal is shown
          setTimeout(() => {
            document.querySelectorAll(".copy-btn-mini").forEach(btn => {
              btn.onclick = (e) => {
                e.stopPropagation()
                const targetId = btn.getAttribute("data-copy")
                const targetEl = document.getElementById(targetId)
                if (targetEl) {
                  const text = targetEl.textContent
                  navigator.clipboard.writeText(text).then(() => {
                    const originalIcon = btn.innerHTML
                    btn.innerHTML = '<i class="fas fa-check"></i>'
                    setTimeout(() => btn.innerHTML = originalIcon, 2000)
                  }).catch(err => console.error("Copy failed", err))
                }
              }
            })
          }, 200)
        } else {
          // Fallback if showCustomConfirm is not available
          window.open(bugUrl, "_blank")
        }
      } catch (error) {
        console.error("Error in reportBugButton listener:", error)
        // Extreme fallback
        const language = localStorage.getItem("appLanguage") || "en"
        const bugUrl = (translations[language] || translations.en).reportBugUrl
        window.open(bugUrl, "_blank")
      }
    })
  }

  window.addEventListener("scroll", () => {
    elements.scrollToTopButton.classList.toggle("hidden", window.scrollY <= 0)
  })

  elements.searchInput.addEventListener(
    "input",
    debounce((e) => {
      uiState.searchQuery = e.target.value.toLowerCase()
      uiState.readingQueueOnly = false
      uiState.selectedFolderId = elements.folderFilter.value
      uiState.sortType = elements.sortFilter.value || "default"
      let filtered = uiState.bookmarks
      if (uiState.selectedFolderId) {
        filtered = filtered.filter((bookmark) =>
          isInFolder(bookmark, uiState.selectedFolderId),
        )
      }
      if (uiState.searchQuery) {
        filtered = filtered.filter(
          (bookmark) =>
            bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
            bookmark.url?.toLowerCase().includes(uiState.searchQuery) ||
            uiState.bookmarkNotes?.[bookmark.id]?.toLowerCase().includes(uiState.searchQuery),
        )
      }
      renderFilteredBookmarks(uiState.bookmarkTree, elements)
      saveUIState()
    }, 150),
  )

  elements.clearSearchButton.addEventListener("click", () => {
    elements.searchInput.value = ""
    uiState.searchQuery = ""
    uiState.readingQueueOnly = false
    let filtered = uiState.bookmarks
    if (uiState.selectedFolderId) {
      filtered = filtered.filter((bookmark) =>
        isInFolder(bookmark, uiState.selectedFolderId),
      )
    }
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  elements.folderFilter.addEventListener("change", () => {
    uiState.searchQuery = elements.searchInput.value.toLowerCase()
    uiState.selectedFolderId = elements.folderFilter.value
    uiState.sortType = elements.sortFilter.value || "default"
    let filtered = uiState.bookmarks
    if (uiState.selectedFolderId) {
      filtered = filtered.filter((bookmark) =>
        isInFolder(bookmark, uiState.selectedFolderId),
      )
    }
    if (uiState.searchQuery) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
          bookmark.url?.toLowerCase().includes(uiState.searchQuery) ||
          uiState.bookmarkNotes?.[bookmark.id]?.toLowerCase().includes(uiState.searchQuery),
      )
    }
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  elements.sortFilter.addEventListener("change", () => {
    uiState.searchQuery = elements.searchInput.value.toLowerCase()
    uiState.selectedFolderId = elements.folderFilter.value
    uiState.sortType = elements.sortFilter.value || "default"
    let filtered = uiState.bookmarks
    if (uiState.selectedFolderId) {
      filtered = filtered.filter((bookmark) =>
        isInFolder(bookmark, uiState.selectedFolderId),
      )
    }
    if (uiState.searchQuery) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
          bookmark.url?.toLowerCase().includes(uiState.searchQuery) ||
          uiState.bookmarkNotes?.[bookmark.id]?.toLowerCase().includes(uiState.searchQuery),
      )
    }
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  elements.healthSortFilter.addEventListener("change", () => {
    uiState.healthFilter = elements.healthSortFilter.value
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  const closeSettingsButton = document.getElementById("settings-close-button")
  const openSettingsMenu = () => {
    elements.settingsMenu.classList.remove("hidden")
    elements.settingsMenu.setAttribute("aria-hidden", "false")
    elements.settingsButton.setAttribute("aria-expanded", "true")
    document.body.classList.add("settings-panel-open")
  }
  const closeSettingsMenu = () => {
    elements.settingsMenu.classList.add("hidden")
    elements.settingsMenu.setAttribute("aria-hidden", "true")
    elements.settingsButton.setAttribute("aria-expanded", "false")
    document.body.classList.remove("settings-panel-open")
  }
  const toggleSettingsMenu = () => {
    if (elements.settingsMenu.classList.contains("hidden")) {
      openSettingsMenu()
    } else {
      closeSettingsMenu()
    }
  }

  elements.settingsButton.setAttribute("aria-expanded", "false")
  elements.settingsButton.addEventListener("click", (e) => {
    e.stopPropagation()
    toggleSettingsMenu()
  })

  closeSettingsButton?.addEventListener("click", (e) => {
    e.stopPropagation()
    closeSettingsMenu()
  })

  const syncSettingsMenuState = () => {
    const isClosed = elements.settingsMenu.classList.contains("hidden")
    elements.settingsMenu.setAttribute("aria-hidden", String(isClosed))
    elements.settingsButton.setAttribute("aria-expanded", String(!isClosed))
    document.body.classList.toggle("settings-panel-open", !isClosed)
  }
  new MutationObserver(syncSettingsMenuState).observe(elements.settingsMenu, {
    attributes: true,
    attributeFilter: ["class"],
  })

  // ADD THIS
  elements.settingsMenu.addEventListener("click", (e) => {
    const target = e.target
    if (target.classList.contains("dropdown-section-title")) {
      e.stopPropagation()
      target.classList.toggle("collapsed")
      let nextElement = target.nextElementSibling
      while (
        nextElement &&
        !nextElement.classList.contains("dropdown-section-title")
      ) {
        nextElement.classList.toggle("hidden")
        nextElement = nextElement.nextElementSibling
      }

      // Save collapsed state to local storage
      let collapsedStates = JSON.parse(
        localStorage.getItem("settingsSectionCollapsedStates") || "{}",
      )
      const sectionId = target.dataset.i18n

      if (target.classList.contains("collapsed")) {
        collapsedStates[sectionId] = true
      } else {
        delete collapsedStates[sectionId]
      }
      localStorage.setItem(
        "settingsSectionCollapsedStates",
        JSON.stringify(collapsedStates),
      )
    }
  })
  // END ADD

  // Nút kiểm tra tình trạng link (Check Links)
  if (elements.checkHealthButton) {
    elements.checkHealthButton.addEventListener("click", (e) => {
      e.stopPropagation()
      handleCheckHealth(elements)
    })
  } else {
    console.warn("check-health-btn element not found")
  }

  // Nút kiểm tra trùng lặp (Check Duplicates)
  if (elements.checkDuplicatesButton) {
    elements.checkDuplicatesButton.addEventListener("click", (e) => {
      e.stopPropagation()
      removeDuplicateBookmarks((removedCount) => {
        if (removedCount > 0) {
          getBookmarkTree((bookmarkTreeNodes) => {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          })
        }
      })
    })
  } else {
    console.warn("check-duplicates-btn element not found")
  }

  // elements.renameFolderOption.addEventListener("click", () => {
  //   openRenameFolderPopup(elements, "")
  //   elements.settingsMenu.classList.add("hidden")
  // })

  if (elements.deleteBookmarksButton) {
    elements.deleteBookmarksButton.addEventListener("click", () => {
      handleDeleteSelectedBookmarks(elements)
    })
  } else {
    console.error("deleteBookmarksButton element not found")
  }

  document.addEventListener("click", (e) => {
    const renamePopup = document.getElementById("rename-popup")
    const renameFolderPopup = document.getElementById("rename-folder-popup")
    const addToFolderPopup = document.getElementById("add-to-folder-popup")
    const customPopup = document.getElementById("custom-popup")

    if (
      e.target.closest("#first-run-tour") ||
      (renamePopup &&
        !renamePopup.classList.contains("hidden") &&
        !e.target.closest("#rename-save")) ||
      (renameFolderPopup && !renameFolderPopup.classList.contains("hidden")) ||
      (addToFolderPopup && !addToFolderPopup.classList.contains("hidden")) ||
      (customPopup && !customPopup.classList.contains("hidden"))
    ) {
      return
    }

    if (
      !e.target.closest("#settings-button") &&
      !e.target.closest("#settings-menu") &&
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu")
    ) {
      closeSettingsMenu()
      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.classList.add("hidden")
      })
    }
  })

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elements.settingsMenu.classList.contains("hidden")) {
      closeSettingsMenu()
    }
  })
}

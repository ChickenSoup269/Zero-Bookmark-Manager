// ./components/controller/uiControls.js
import { translations, debounce } from "../utils.js"
import { isInFolder } from "../bookmarks.js"
import {
  updateUILanguage,
  updateTheme,
  renderFilteredBookmarks,
} from "../ui.js"
import { uiState, saveUIState } from "../state.js"
import { openRenameFolderPopup } from "./renameFolder.js"
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
    document.body.classList.remove("font-gohu", "font-normal")
    document.body.classList.add(`font-${e.target.value}`)
    localStorage.setItem("appFont", e.target.value)
  })

  elements.toggleCheckboxesButton.addEventListener("click", () => {
    uiState.checkboxesVisible = !uiState.checkboxesVisible
    const language = localStorage.getItem("appLanguage") || "en"
    elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
      ? translations[language].hideCheckboxes
      : translations[language].showCheckboxes

    // Toggle class hidden cho bookmark-checkbox và select-all
    const bookmarkCheckboxes = document.querySelectorAll(".bookmark-checkbox")
    const selectAllContainer = document.querySelector(".select-all")
    const selectAllCheckbox = document.getElementById("select-all")

    if (uiState.checkboxesVisible) {
      // Hiện các checkbox và select-all
      bookmarkCheckboxes.forEach((checkbox) => {
        checkbox.style.display = "inline-block" // Đặt lại display trước
        setTimeout(() => {
          checkbox.classList.remove("hidden")
        }, 10) // Delay nhỏ để đảm bảo display được áp dụng trước
      })
      if (selectAllContainer) {
        selectAllContainer.style.display = "flex" // Đặt lại display trước
        setTimeout(() => {
          selectAllContainer.classList.remove("hidden")
        }, 10)
      } else {
        console.warn("Select All container (.select-all) not found")
      }
    } else {
      // Ẩn các checkbox và select-all
      bookmarkCheckboxes.forEach((checkbox) => {
        checkbox.classList.add("hidden")
        setTimeout(() => {
          checkbox.style.display = "none" // Áp dụng display: none sau animation
        }, 250) // Đợi 150ms (bằng --transition-fast)
      })
      if (selectAllContainer) {
        selectAllContainer.classList.add("hidden")
        setTimeout(() => {
          selectAllContainer.style.display = "none" // Áp dụng display: none sau animation
        }, 150)
      } else {
        console.warn("Select All container (.select-all) not found")
      }
      // Reset trạng thái chọn
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

    // Cập nhật trạng thái hiển thị của các nút
    updateControlButtons(elements)
    saveUIState()
  })

  // Hàm để cập nhật trạng thái hiển thị của các nút
  // Trong file uiControls.js
  function updateControlButtons(elements) {
    console.log("Updating control buttons:", {
      hasSelectedFolder: uiState.selectedFolderId,
      hasSelectedBookmarks: uiState.selectedBookmarks.size,
    })
    const hasSelectedFolder =
      uiState.selectedFolderId &&
      uiState.selectedFolderId !== "1" &&
      uiState.selectedFolderId !== "2"
    const hasSelectedBookmarks = uiState.selectedBookmarks.size > 0

    // Toggle class hidden cho các nút
    elements.addToFolderButton.classList.toggle("hidden", !hasSelectedBookmarks)
    elements.deleteBookmarksButton.classList.toggle(
      "hidden",
      !hasSelectedBookmarks
    )
    elements.deleteFolderButton.classList.toggle("hidden", !hasSelectedFolder)
  }

  elements.scrollToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  })

  window.addEventListener("scroll", () => {
    elements.scrollToTopButton.classList.toggle("hidden", window.scrollY <= 0)
  })

  elements.searchInput.addEventListener(
    "input",
    debounce((e) => {
      uiState.searchQuery = e.target.value.toLowerCase()
      uiState.selectedFolderId = elements.folderFilter.value
      uiState.sortType = elements.sortFilter.value || "default"
      let filtered = uiState.bookmarks
      if (uiState.selectedFolderId) {
        filtered = filtered.filter((bookmark) =>
          isInFolder(bookmark, uiState.selectedFolderId)
        )
      }
      if (uiState.searchQuery) {
        filtered = filtered.filter(
          (bookmark) =>
            bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
            bookmark.url?.toLowerCase().includes(uiState.searchQuery)
        )
      }
      renderFilteredBookmarks(uiState.bookmarkTree, elements)
      saveUIState()
    }, 150)
  )

  elements.clearSearchButton.addEventListener("click", () => {
    elements.searchInput.value = ""
    uiState.searchQuery = ""
    let filtered = uiState.bookmarks
    if (uiState.selectedFolderId) {
      filtered = filtered.filter((bookmark) =>
        isInFolder(bookmark, uiState.selectedFolderId)
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
        isInFolder(bookmark, uiState.selectedFolderId)
      )
    }
    if (uiState.searchQuery) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
          bookmark.url?.toLowerCase().includes(uiState.searchQuery)
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
        isInFolder(bookmark, uiState.selectedFolderId)
      )
    }
    if (uiState.searchQuery) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(uiState.searchQuery) ||
          bookmark.url?.toLowerCase().includes(uiState.searchQuery)
      )
    }
    renderFilteredBookmarks(uiState.bookmarkTree, elements)
    saveUIState()
  })

  elements.settingsButton.addEventListener("click", (e) => {
    e.stopPropagation()
    elements.settingsMenu.classList.toggle("hidden")
  })

  elements.renameFolderOption.addEventListener("click", () => {
    openRenameFolderPopup(elements, "")
    elements.settingsMenu.classList.add("hidden")
  })

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
      (renamePopup &&
        !renamePopup.classList.contains("hidden") &&
        !e.target.closest("#rename-save")) ||
      (renameFolderPopup && !renameFolderPopup.classList.contains("hidden")) ||
      (addToFolderPopup && !addToFolderPopup.classList.contains("hidden")) ||
      (customPopup && !customPopup.classList.contains("hidden"))
    ) {
      console.log(
        "Popup is open, skipping close of settings menu and dropdowns"
      )
      return
    }

    if (
      !e.target.closest("#settings-button") &&
      !e.target.closest("#settings-menu") &&
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu")
    ) {
      console.log("Closing settings menu and dropdowns")
      elements.settingsMenu.classList.add("hidden")
      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.classList.add("hidden")
      })
    }
  })
}

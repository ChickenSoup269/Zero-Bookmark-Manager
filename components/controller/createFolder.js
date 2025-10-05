// ./components/controller/createFolder.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "../utils.js"
import { getBookmarkTree, getFolders } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, saveUIState } from "../state.js"

export function setupCreateFolderListeners(elements) {
  // Open Create Folder Popup
  elements.createFolderBtn.addEventListener("click", () => {
    const language = localStorage.getItem("appLanguage") || "en"
    const createFolderTitle = document.getElementById("create-folder-title")
    if (createFolderTitle) {
      createFolderTitle.textContent = translations[language].createFolder
    } else {
      console.warn(
        "Create Folder title element (#create-folder-title) not found"
      )
    }
    elements.createFolderInput.value = ""
    elements.createFolderInput.classList.remove("error")
    elements.createFolderInput.placeholder =
      translations[language].newFolderPlaceholder
    elements.createFolderPopup.classList.remove("hidden")
    elements.createFolderInput.focus()
  })

  // Save button
  elements.createFolderSave.addEventListener("click", () => {
    const folderName = elements.createFolderInput.value.trim()
    const language = localStorage.getItem("appLanguage") || "en"

    if (!folderName) {
      elements.createFolderInput.classList.add("error")
      elements.createFolderInput.placeholder =
        translations[language].emptyFolderError
      elements.createFolderInput.focus()
      return
    }

    // Check duplicate trong folder gốc (id: "2")
    safeChromeBookmarksCall("getChildren", ["2"], (siblings) => {
      if (siblings) {
        const isDuplicate = siblings.some(
          (sibling) => sibling.title.toLowerCase() === folderName.toLowerCase()
        )
        if (isDuplicate) {
          elements.createFolderInput.classList.add("error")
          elements.createFolderInput.placeholder =
            translations[language].duplicateTitleError
          elements.createFolderInput.focus()
          return
        }

        // Tạo folder mới
        safeChromeBookmarksCall(
          "create",
          [{ parentId: "2", title: folderName }],
          (newFolder) => {
            if (newFolder) {
              getBookmarkTree((bookmarkTreeNodes) => {
                if (bookmarkTreeNodes) {
                  uiState.bookmarkTree = bookmarkTreeNodes
                  uiState.folders = getFolders(bookmarkTreeNodes)
                  uiState.selectedFolderId = newFolder.id
                  renderFilteredBookmarks(bookmarkTreeNodes, elements)
                  showCustomPopup(
                    translations[language].createFolderSuccess,
                    "success",
                    true
                  )
                  elements.createFolderInput.value = ""
                  elements.createFolderInput.classList.remove("error")
                  elements.createFolderInput.placeholder =
                    translations[language].newFolderPlaceholder
                  elements.createFolderPopup.classList.add("hidden")
                  saveUIState()
                } else {
                  showCustomPopup(
                    translations[language].errorUnexpected,
                    "error",
                    false
                  )
                }
              })
            } else {
              showCustomPopup(
                translations[language].errorUnexpected,
                "error",
                false
              )
            }
          }
        )
      } else {
        showCustomPopup(translations[language].errorUnexpected, "error", false)
      }
    })
  })

  // Nút Cancel
  elements.createFolderCancel.addEventListener("click", () => {
    elements.createFolderPopup.classList.add("hidden")
    elements.createFolderInput.classList.remove("error")
    elements.createFolderInput.value = ""
    const language = localStorage.getItem("appLanguage") || "en"
    elements.createFolderInput.placeholder =
      translations[language].newFolderPlaceholder
  })

  // Clear Create Folder Input
  elements.clearCreateFolder.addEventListener("click", () => {
    elements.createFolderInput.value = ""
    elements.createFolderInput.classList.remove("error")
    const language = localStorage.getItem("appLanguage") || "en"
    elements.createFolderInput.placeholder =
      translations[language].newFolderPlaceholder
    elements.createFolderInput.focus()
  })

  // Enter = Save, Escape = Cancel
  elements.createFolderInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      elements.createFolderSave.click()
    }
  })
  elements.createFolderInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.createFolderCancel.click()
    }
  })

  // Click ngoài popup = đóng
  elements.createFolderPopup.addEventListener("click", (e) => {
    if (e.target === elements.createFolderPopup) {
      elements.createFolderCancel.click()
    }
  })
}

// ./components/controller/renameFolder.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "../utils/utils.js"
import { getBookmarkTree } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, saveUIState } from "../state.js"

export function setupRenameFolderListeners(elements) {
  // Rename Folder Button (Controls)
  elements.renameFolderButton.addEventListener("click", () => {
    openRenameFolderPopup(elements, uiState.selectedFolderId)
  })

  // Rename Folder Option (Settings Menu)
  // elements.renameFolderOption.addEventListener("click", () => {
  //   openRenameFolderPopup(elements, "")
  //   elements.settingsMenu.classList.add("hidden")
  // })

  // Rename Folder Save
  elements.renameFolderSave.addEventListener("click", () => {
    const folderId = elements.renameFolderSelect.value
    const newFolderName = elements.renameFolderInput.value.trim()
    const language = localStorage.getItem("appLanguage") || "en"

    if (!folderId) {
      elements.renameFolderSelect.classList.add("error")
      showCustomPopup(
        translations[language].selectFolderError || "Please select a folder",
        "error",
        false
      )
      return
    }

    if (!newFolderName) {
      elements.renameFolderInput.classList.add("error")
      elements.renameFolderInput.placeholder =
        translations[language].emptyFolderError
      elements.renameFolderInput.focus()
      return
    }

    safeChromeBookmarksCall("get", [folderId], (folder) => {
      if (folder && folder[0]) {
        const parentId = folder[0].parentId
        safeChromeBookmarksCall("getChildren", [parentId], (siblings) => {
          const isDuplicate = siblings.some(
            (sibling) =>
              sibling.id !== folderId &&
              sibling.title.toLowerCase() === newFolderName.toLowerCase()
          )
          if (isDuplicate) {
            elements.renameFolderInput.classList.add("error")
            elements.renameFolderInput.placeholder =
              translations[language].duplicateTitleError
            elements.renameFolderInput.focus()
            return
          }

          safeChromeBookmarksCall(
            "update",
            [folderId, { title: newFolderName }],
            (result) => {
              if (result) {
                getBookmarkTree((bookmarkTreeNodes) => {
                  if (bookmarkTreeNodes) {
                    renderFilteredBookmarks(bookmarkTreeNodes, elements)
                    showCustomPopup(
                      translations[language].renameSuccess ||
                        "Folder renamed successfully!",
                      "success"
                    )
                    elements.renameFolderPopup.classList.add("hidden")
                    elements.renameFolderInput.value = ""
                    elements.renameFolderInput.classList.remove("error")
                    elements.renameFolderInput.placeholder =
                      translations[language].renamePlaceholder
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
        })
      } else {
        showCustomPopup(translations[language].errorUnexpected, "error", false)
        elements.renameFolderPopup.classList.add("hidden")
      }
    })
  })

  // Rename Folder Cancel
  elements.renameFolderCancel.addEventListener("click", () => {
    elements.renameFolderPopup.classList.add("hidden")
    elements.renameFolderInput.classList.remove("error")
    elements.renameFolderInput.value = ""
    const language = localStorage.getItem("appLanguage") || "en"
    elements.renameFolderInput.placeholder =
      translations[language].renamePlaceholder
  })

  // Clear Rename Folder Input
  elements.clearRenameFolder.addEventListener("click", () => {
    elements.renameFolderInput.value = ""
    elements.renameFolderInput.classList.remove("error")
    const language = localStorage.getItem("appLanguage") || "en"
    elements.renameFolderInput.placeholder =
      translations[language].renamePlaceholder
    elements.renameFolderInput.focus()
  })

  // Handle Enter and Escape keys for rename folder popup
  elements.renameFolderInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      elements.renameFolderSave.click()
    }
  })

  elements.renameFolderInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.renameFolderCancel.click()
    }
  })

  elements.renameFolderSelect.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      elements.renameFolderSave.click()
    }
  })

  elements.renameFolderSelect.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.renameFolderCancel.click()
    }
  })

  // Close popup when clicking outside
  elements.renameFolderPopup.addEventListener("click", (e) => {
    if (e.target === elements.renameFolderPopup) {
      elements.renameFolderCancel.click()
    }
  })
}

function openRenameFolderPopup(elements, defaultFolderId) {
  const language = localStorage.getItem("appLanguage") || "en"
  elements.renameFolderSelect.innerHTML = `<option value="">${translations[language].selectFolder}</option>`
  uiState.folders.forEach((folder) => {
    if (folder.id !== "0" && folder.id !== "1" && folder.id !== "2") {
      // Chỉ hiển thị thư mục do người dùng tạo
      const option = document.createElement("option")
      option.value = folder.id
      option.textContent = folder.title
      elements.renameFolderSelect.appendChild(option)
    }
  })

  elements.renameFolderInput.value = ""
  elements.renameFolderInput.classList.remove("error")
  elements.renameFolderInput.placeholder =
    translations[language].renamePlaceholder
  elements.renameFolderSelect.value = defaultFolderId || ""
  elements.renameFolderPopup.classList.remove("hidden")
  elements.renameFolderSelect.focus()
}

export { openRenameFolderPopup }

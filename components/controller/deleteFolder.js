// ./components/controller/deleteFolder.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomConfirm,
} from "../utils/utils.js"
import { getBookmarkTree, flattenBookmarks } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState } from "../state.js"

export function setupDeleteFolderListeners(elements) {
  // Listener cho nút xóa folder từ giao diện chính
  elements.deleteFolderButton.addEventListener("click", () => {
    handleDeleteFolder(uiState.selectedFolderId, elements)
  })

  // Listener cho nút xóa folder từ dropdown menu
  const deleteFolderButtons = document.querySelectorAll(".delete-folder-btn")

  deleteFolderButtons.forEach((button) => {
    button.removeEventListener("click", handleDeleteFolderFromDropdown)
    button.addEventListener("click", (e) =>
      handleDeleteFolderFromDropdown(e, elements)
    )
  })
}

export function handleDeleteFolder(folderId, elements) {
  if (!folderId || folderId === "1" || folderId === "2") {
    console.error("Invalid or protected folder ID:", folderId)
    const language = localStorage.getItem("appLanguage") || "en"
    showCustomConfirm(
      translations[language].errorInvalidFolder || "Cannot delete this folder",
      () => {},
      "error"
    )
    return
  }

  const language = localStorage.getItem("appLanguage") || "en"
  showCustomConfirm(translations[language].deleteFolderConfirm, () => {
    safeChromeBookmarksCall("getSubTree", [folderId], (subTree) => {
      if (!subTree) {
        console.error("Failed to retrieve folder subtree for ID:", folderId)
        return
      }
      const folderNode = subTree[0]
      const bookmarksToCheck = folderNode.children
        ? folderNode.children.filter((node) => node.url)
        : []

      safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
        if (!bookmarkTreeNodes) {
          console.error("Failed to retrieve bookmark tree")
          return
        }
        const allBookmarks = flattenBookmarks(bookmarkTreeNodes)
        const bookmarksToDelete = []
        bookmarksToCheck.forEach((bookmark) => {
          const duplicates = allBookmarks.filter(
            (b) =>
              b.url === bookmark.url &&
              b.id !== bookmark.id &&
              b.parentId !== folderId
          )
          if (duplicates.length === 0) {
            bookmarksToDelete.push(bookmark.id)
          }
        })

        let deletePromises = bookmarksToDelete.map((bookmarkId) => {
          return new Promise((resolve) => {
            safeChromeBookmarksCall("remove", [bookmarkId], resolve)
          })
        })

        Promise.all(deletePromises).then(() => {
          safeChromeBookmarksCall("remove", [folderId], () => {
            if (uiState.selectedFolderId === folderId) {
              uiState.selectedFolderId = ""
              elements.folderFilter.value = ""
            }
            getBookmarkTree((bookmarkTreeNodes) => {
              if (bookmarkTreeNodes) {
                renderFilteredBookmarks(bookmarkTreeNodes, elements)
                const language = localStorage.getItem("appLanguage") || "en"
                showCustomConfirm(
                  translations[language].deleteFolderSuccess ||
                    "Folder deleted successfully!",
                  () => {},
                  "success"
                )
              }
            })
          })
        })
      })
    })
  })
}

function handleDeleteFolderFromDropdown(e, elements) {
  e.stopPropagation()
  const folderId = e.target.dataset.id

  if (!folderId) {
    console.error("Folder ID is undefined in handleDeleteFolderFromDropdown")
    const language = localStorage.getItem("appLanguage") || "en"
    showCustomConfirm(
      translations[language].errorUnexpected || "An unexpected error occurred",
      () => {},
      "error"
    )
    return
  }
  handleDeleteFolder(folderId, elements)
  e.target.closest(".dropdown-menu").classList.add("hidden")
}

import {
  translations,
  safeChromeBookmarksCall,
  showCustomConfirm,
} from "../utils/utils.js"
import { getBookmarkTree, flattenBookmarks } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState } from "../state.js"
import { registerUndo } from "../undo.js"

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

async function restoreTree(node, parentId, storageData) {
  return new Promise((resolve) => {
    chrome.bookmarks.create({
      parentId: parentId,
      index: node.index,
      title: node.title,
      url: node.url
    }, async (created) => {
      if (node.url) {
        let changed = false;
        if (storageData.bookmarkTags[node.id]) {
          storageData.bookmarkTags[created.id] = storageData.bookmarkTags[node.id];
          changed = true;
        }
        if (storageData.favoriteBookmarks[node.id]) {
          storageData.favoriteBookmarks[created.id] = true;
          changed = true;
        }
        if (storageData.pinnedBookmarks[node.id]) {
          storageData.pinnedBookmarks[created.id] = true;
          changed = true;
        }
        if (changed) {
          await chrome.storage.local.set({
            bookmarkTags: storageData.bookmarkTags,
            favoriteBookmarks: storageData.favoriteBookmarks,
            pinnedBookmarks: storageData.pinnedBookmarks
          });
        }
      }

      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          await restoreTree(child, created.id, storageData);
        }
      }
      resolve(created);
    });
  });
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
  showCustomConfirm(translations[language].deleteFolderConfirm || "Are you sure you want to delete this folder and all its contents?", () => {
    safeChromeBookmarksCall("getSubTree", [folderId], async (subTree) => {
      if (!subTree || !subTree[0]) {
        console.error("Failed to retrieve folder subtree for ID:", folderId)
        return
      }
      const folderNode = subTree[0]
      
      const storageData = await chrome.storage.local.get([
        "bookmarkTags",
        "favoriteBookmarks",
        "pinnedBookmarks",
      ])
      storageData.bookmarkTags = storageData.bookmarkTags || {};
      storageData.favoriteBookmarks = storageData.favoriteBookmarks || {};
      storageData.pinnedBookmarks = storageData.pinnedBookmarks || {};

      safeChromeBookmarksCall("removeTree", [folderId], () => {
        if (uiState.selectedFolderId === folderId) {
          uiState.selectedFolderId = ""
          if (elements.folderFilter) elements.folderFilter.value = ""
        }
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            
            const t = translations[language] || translations.en;
            
            registerUndo({
              message: t.undoDeleteMessage || "Folder deleted.",
              actionLabel: t.undoAction || "Undo",
              elements: elements,
              undo: async () => {
                await restoreTree(folderNode, folderNode.parentId, storageData);
              }
            });
          }
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
  const menu = e.target.closest(".dropdown-menu")
  if (menu) menu.classList.add("hidden")
}

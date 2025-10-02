// components/controller/bookmarkAction.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
  showCustomConfirm,
} from "../utils.js"
import { getBookmarkTree } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, setCurrentBookmarkId } from "../state.js"
import { openAddToFolderPopup } from "./addToFolder.js"

export function setupBookmarkActionListeners(elements) {
  // Handle rename save
  if (elements.renameSave) {
    elements.renameSave.removeEventListener("click", handleRenameSave)
    elements.renameSave.addEventListener("click", (e) =>
      handleRenameSave(e, elements)
    )
  } else {
    console.error("renameSave element not found")
  }

  // Handle rename cancel
  if (elements.renameCancel) {
    elements.renameCancel.removeEventListener("click", handleRenameCancel)
    elements.renameCancel.addEventListener("click", (e) =>
      handleRenameCancel(e, elements)
    )
  } else {
    console.error("renameCancel element not found")
  }

  // Handle rename input keypress
  if (elements.renameInput) {
    elements.renameInput.removeEventListener(
      "keypress",
      handleRenameInputKeypress
    )
    elements.renameInput.addEventListener("keypress", (e) =>
      handleRenameInputKeypress(e, elements)
    )
    elements.renameInput.removeEventListener(
      "keydown",
      handleRenameInputKeydown
    )
    elements.renameInput.addEventListener("keydown", (e) =>
      handleRenameInputKeydown(e, elements)
    )
  } else {
    console.error("renameInput element not found")
  }

  // Handle rename popup click
  if (elements.renamePopup) {
    elements.renamePopup.removeEventListener("click", handleRenamePopupClick)
    elements.renamePopup.addEventListener("click", (e) =>
      handleRenamePopupClick(e, elements)
    )
  } else {
    console.error("renamePopup element not found")
  }

  // Handle clear rename
  if (elements.clearRenameButton) {
    elements.clearRenameButton.removeEventListener("click", handleClearRename)
    elements.clearRenameButton.addEventListener("click", (e) =>
      handleClearRename(e, elements)
    )
  } else {
    console.error("clearRenameButton element not found")
  }

  // Handle all menu-item buttons (add-to-folder, delete, rename, favorite)
  document.querySelectorAll(".menu-item").forEach((button) => {
    button.removeEventListener("click", handleMenuItemClick)
    button.addEventListener("click", (e) => handleMenuItemClick(e, elements))
  })

  // Handle bookmark checkboxes
  const checkboxes = document.querySelectorAll(".bookmark-checkbox")
  checkboxes.forEach((checkbox) => {
    checkbox.removeEventListener("change", handleBookmarkCheckbox)
    checkbox.addEventListener("change", (e) =>
      handleBookmarkCheckbox(e, elements)
    )
  })
}

function handleMenuItemClick(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  const action = e.target.classList.contains("add-to-folder")
    ? "add-to-folder"
    : e.target.classList.contains("delete-btn")
    ? "delete"
    : e.target.classList.contains("rename-btn")
    ? "rename"
    : e.target.classList.contains("favorite-btn")
    ? "favorite"
    : null

  if (!bookmarkId || !action) {
    console.error("Invalid bookmark ID or action", { bookmarkId, action })
    return
  }

  switch (action) {
    case "add-to-folder":
      handleAddToFolder(e, elements)
      break
    case "delete":
      handleDeleteBookmark(e, elements)
      break
    case "rename":
      handleRenameBookmark(e, elements)
      break
    case "favorite":
      handleFavoriteBookmark(e, elements)
      break
  }

  e.target.closest(".dropdown-menu").classList.add("hidden")
}

function handleRenameSave(e, elements) {
  e.stopPropagation()
  const newTitle = elements.renameInput.value.trim()
  const language = localStorage.getItem("appLanguage") || "en"

  if (!newTitle) {
    elements.renameInput.classList.add("error")
    elements.renameInput.placeholder = translations[language].emptyTitleError
    elements.renameInput.focus()
    return
  }

  if (!uiState.currentBookmarkId) {
    console.error("No currentBookmarkId set")
    showCustomPopup(
      translations[language].errorNoBookmarkSelected || "No bookmark selected",
      "error",
      false
    )
    elements.renamePopup.classList.add("hidden")
    return
  }

  safeChromeBookmarksCall("get", [uiState.currentBookmarkId], (bookmark) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error retrieving bookmark:",
        chrome.runtime.lastError.message
      )
      showCustomPopup(
        translations[language].errorUnexpected ||
          "An unexpected error occurred",
        "error",
        false
      )
      elements.renamePopup.classList.add("hidden")
      return
    }

    if (!bookmark || !bookmark[0]) {
      console.error("Bookmark not found for ID:", uiState.currentBookmarkId)
      showCustomPopup(
        translations[language].bookmarkNotFound || "Bookmark not found",
        "error",
        false
      )
      elements.renamePopup.classList.add("hidden")
      return
    }

    if (!bookmark[0].url) {
      console.error(
        "Selected item is not a bookmark, ID:",
        uiState.currentBookmarkId
      )
      showCustomPopup(
        translations[language].errorNotABookmark ||
          "Selected item is not a bookmark",
        "error",
        false
      )
      elements.renamePopup.classList.add("hidden")
      return
    }

    const parentId = bookmark[0].parentId
    safeChromeBookmarksCall("getChildren", [parentId], (siblings) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error retrieving siblings:",
          chrome.runtime.lastError.message
        )
        showCustomPopup(
          translations[language].errorUnexpected ||
            "An unexpected error occurred",
          "error",
          false
        )
        elements.renamePopup.classList.add("hidden")
        return
      }

      const isDuplicate = siblings.some(
        (sibling) =>
          sibling.id !== uiState.currentBookmarkId &&
          sibling.title.toLowerCase() === newTitle.toLowerCase()
      )
      if (isDuplicate) {
        elements.renameInput.classList.add("error")
        elements.renameInput.placeholder =
          translations[language].duplicateTitleError
        elements.renameInput.focus()
        return
      }

      safeChromeBookmarksCall(
        "update",
        [uiState.currentBookmarkId, { title: newTitle }],
        (result) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error updating bookmark:",
              chrome.runtime.lastError.message
            )
            showCustomPopup(
              translations[language].errorUnexpected ||
                "An unexpected error occurred",
              "error",
              false
            )
            elements.renamePopup.classList.add("hidden")
            return
          }

          if (result) {
            getBookmarkTree((bookmarkTreeNodes) => {
              if (bookmarkTreeNodes) {
                renderFilteredBookmarks(bookmarkTreeNodes, elements)
                showCustomPopup(
                  translations[language].renameSuccess ||
                    "Bookmark renamed successfully!",
                  "success"
                )
                setCurrentBookmarkId(null)
                elements.renamePopup.classList.add("hidden")
              } else {
                console.error("Failed to retrieve bookmark tree")
                showCustomPopup(
                  translations[language].errorUnexpected ||
                    "An unexpected error occurred",
                  "error",
                  false
                )
              }
            })
          } else {
            console.error("Bookmark update returned null")
            showCustomPopup(
              translations[language].errorUnexpected ||
                "An unexpected error occurred",
              "error",
              false
            )
            elements.renamePopup.classList.add("hidden")
          }
        }
      )
    })
  })
}

function handleRenameCancel(e, elements) {
  e.stopPropagation()
  elements.renamePopup.classList.add("hidden")
  elements.renameInput.classList.remove("error")
  elements.renameInput.value = ""
  const language = localStorage.getItem("appLanguage") || "en"
  elements.renameInput.placeholder = translations[language].renamePlaceholder
  setCurrentBookmarkId(null)
}

function handleRenameInputKeypress(e, elements) {
  if (e.key === "Enter") {
    elements.renameSave.click()
  }
}

function handleRenameInputKeydown(e, elements) {
  if (e.key === "Escape") {
    elements.renameCancel.click()
  }
}

function handleRenamePopupClick(e, elements) {
  if (e.target === elements.renamePopup) {
    elements.renameCancel.click()
  }
}

function handleClearRename(e, elements) {
  e.stopPropagation()
  elements.renameInput.value = ""
  elements.renameInput.classList.remove("error")
  const language = localStorage.getItem("appLanguage") || "en"
  elements.renameInput.placeholder = translations[language].renamePlaceholder
  elements.renameInput.focus()
}

function handleAddToFolder(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  if (!bookmarkId) {
    console.error("Bookmark ID is undefined in handleAddToFolder")
    const language = localStorage.getItem("appLanguage") || "en"
    showCustomPopup(translations[language].errorUnexpected, "error", false)
    return
  }

  openAddToFolderPopup(elements, [bookmarkId])
}

function handleDeleteBookmark(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  const language = localStorage.getItem("appLanguage") || "en"
  if (!bookmarkId) {
    console.error("Bookmark ID is undefined in handleDeleteBookmark")
    showCustomPopup(translations[language].errorUnexpected, "error", false)
    return
  }
  showCustomConfirm(translations[language].deleteConfirm, () => {
    safeChromeBookmarksCall("remove", [bookmarkId], () => {
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
          showCustomPopup(
            translations[language].deleteBookmarkSuccess ||
              "Bookmark deleted successfully!",
            "success"
          )
        } else {
          console.error("Failed to retrieve bookmark tree")
          showCustomPopup(
            translations[language].errorUnexpected ||
              "An unexpected error occurred",
            "error",
            false
          )
        }
      })
    })
  })
}

function handleFavoriteBookmark(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  const language = localStorage.getItem("appLanguage") || "en"
  if (!bookmarkId) {
    console.error("Bookmark ID is undefined in handleFavoriteBookmark")
    showCustomPopup(translations[language].errorUnexpected, "error", false)
    return
  }

  safeChromeBookmarksCall("get", [bookmarkId], (bookmarks) => {
    if (chrome.runtime.lastError) {
      console.error("Error retrieving bookmark:", chrome.runtime.lastError)
      showCustomPopup(
        translations[language].errorUnexpected ||
          "An unexpected error occurred",
        "error",
        false
      )
      return
    }

    const bookmark = bookmarks[0]
    if (!bookmark) {
      console.error("Bookmark not found for ID:", bookmarkId)
      showCustomPopup(
        translations[language].bookmarkNotFound || "Bookmark not found",
        "error",
        false
      )
      return
    }

    if (!bookmark.url) {
      console.error("Selected item is not a bookmark, ID:", bookmarkId)
      showCustomPopup(
        translations[language].errorNotABookmark ||
          "Selected item is not a bookmark",
        "error",
        false
      )
      return
    }

    // Toggle isFavorite in chrome.storage.local
    chrome.storage.local.get("favoriteBookmarks", (data) => {
      const favoriteBookmarks = data.favoriteBookmarks || {}
      const isFavorite = !favoriteBookmarks[bookmarkId] // Toggle state
      favoriteBookmarks[bookmarkId] = isFavorite
      chrome.storage.local.set({ favoriteBookmarks }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving favorite state:",
            chrome.runtime.lastError
          )
          showCustomPopup(
            translations[language].errorUnexpected ||
              "An unexpected error occurred",
            "error",
            false
          )
          return
        }

        // Update bookmark tree in memory
        const updateBookmarkInTree = (nodes) => {
          for (const node of nodes) {
            if (node.id === bookmarkId) {
              node.isFavorite = isFavorite
              return true
            }
            if (node.children) {
              if (updateBookmarkInTree(node.children)) return true
            }
          }
          return false
        }

        updateBookmarkInTree(uiState.bookmarkTree)

        // Update the button dynamically
        const button = document.querySelector(
          `.dropdown-btn[data-id="${bookmarkId}"]`
        )
        if (button) {
          button.classList.toggle("favorited", isFavorite)
          button.innerHTML = isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }

        // Re-render bookmarks to ensure consistency
        renderFilteredBookmarks(uiState.bookmarkTree, elements)

        showCustomPopup(
          isFavorite
            ? translations[language].favoriteSuccess ||
                "Bookmark added to favorites!"
            : translations[language].unfavoriteSuccess ||
                "Bookmark removed from favorites!",
          "success"
        )
      })
    })
  })
}

function handleBookmarkCheckbox(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  if (!bookmarkId) {
    console.error("Bookmark ID is undefined in handleBookmarkCheckbox", {
      checkbox: e.target,
      dataset: e.target.dataset,
    })
    return
  }

  if (e.target.checked) {
    uiState.selectedBookmarks.add(bookmarkId)
  } else {
    uiState.selectedBookmarks.delete(bookmarkId)
  }

  elements.addToFolderButton.classList.toggle(
    "hidden",
    uiState.selectedBookmarks.size === 0
  )
  elements.deleteBookmarksButton.classList.toggle(
    "hidden",
    uiState.selectedBookmarks.size === 0
  )
}

export function handleDeleteSelectedBookmarks(elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  if (uiState.selectedBookmarks.size === 0) {
    console.error("No bookmarks selected for deletion")
    showCustomPopup(
      translations[language].errorNoBookmarkSelected || "No bookmarks selected",
      "error",
      false
    )
    return
  }

  showCustomConfirm(
    translations[language].deleteBookmarksConfirm ||
      "Are you sure you want to delete the selected bookmarks?",
    () => {
      const deletePromises = Array.from(uiState.selectedBookmarks).map(
        (bookmarkId) => {
          return new Promise((resolve) => {
            safeChromeBookmarksCall("remove", [bookmarkId], () => {
              resolve()
            })
          })
        }
      )

      Promise.all(deletePromises).then(() => {
        uiState.selectedBookmarks.clear()
        elements.addToFolderButton.classList.add("hidden")
        elements.deleteBookmarksButton.classList.add("hidden")
        document.querySelectorAll(".bookmark-checkbox").forEach((cb) => {
          cb.checked = false
        })
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            showCustomPopup(
              translations[language].deleteBookmarksSuccess ||
                "Bookmarks deleted successfully!",
              "success"
            )
          } else {
            console.error("Failed to retrieve bookmark tree")
            showCustomPopup(
              translations[language].errorUnexpected ||
                "An unexpected error occurred",
              "error",
              false
            )
          }
        })
      })
    }
  )
}

function handleRenameBookmark(e, elements) {
  e.stopPropagation()
  const bookmarkId = e.target.dataset.id
  const language = localStorage.getItem("appLanguage") || "en"

  if (!bookmarkId) {
    console.error("Bookmark ID is undefined in handleRenameBookmark")
    showCustomPopup(translations[language].errorUnexpected, "error", false)
    return
  }

  const renamePopup = document.getElementById("rename-popup")
  const renameInput = document.getElementById("rename-input")
  if (!renamePopup || !renameInput) {
    console.error("Rename popup or input element is missing", {
      renamePopup: !!renamePopup,
      renameInput: !!renameInput,
    })
    showCustomPopup(
      translations[language].popupNotFound || "Rename popup not found",
      "error",
      false
    )
    return
  }

  setCurrentBookmarkId(bookmarkId)
  renameInput.value = ""
  renameInput.classList.remove("error")
  renameInput.placeholder = translations[language].renamePlaceholder
  renamePopup.classList.remove("hidden")
  renameInput.focus()

  safeChromeBookmarksCall("get", [bookmarkId], (bookmark) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error retrieving bookmark:",
        chrome.runtime.lastError.message
      )
      showCustomPopup(
        translations[language].errorUnexpected ||
          "An unexpected error occurred",
        "error",
        false
      )
      renamePopup.classList.add("hidden")
      setCurrentBookmarkId(null)
      return
    }

    if (bookmark && bookmark[0]) {
      if (!bookmark[0].url) {
        console.error("Selected item is not a bookmark, ID:", bookmarkId)
        showCustomPopup(
          translations[language].errorNotABookmark ||
            "Selected item is not a bookmark",
          "error",
          false
        )
        renamePopup.classList.add("hidden")
        setCurrentBookmarkId(null)
        return
      }
      renameInput.value = bookmark[0].title || ""
    } else {
      console.error("Bookmark not found for ID:", bookmarkId)
      showCustomPopup(
        translations[language].bookmarkNotFound || "Bookmark not found",
        "error",
        false
      )
      renamePopup.classList.add("hidden")
      setCurrentBookmarkId(null)
    }
  })
}

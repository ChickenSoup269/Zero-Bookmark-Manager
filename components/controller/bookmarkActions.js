// ./components/controller/bookmarkActions.js
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
  if (elements.renameSave) {
    elements.renameSave.removeEventListener("click", handleRenameSave)
    elements.renameSave.addEventListener("click", (e) =>
      handleRenameSave(e, elements)
    )
  } else {
    console.error("renameSave element not found")
  }

  if (elements.renameCancel) {
    elements.renameCancel.removeEventListener("click", handleRenameCancel)
    elements.renameCancel.addEventListener("click", (e) =>
      handleRenameCancel(e, elements)
    )
  } else {
    console.error("renameCancel element not found")
  }

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

  if (elements.renamePopup) {
    elements.renamePopup.removeEventListener("click", handleRenamePopupClick)
    elements.renamePopup.addEventListener("click", (e) =>
      handleRenamePopupClick(e, elements)
    )
  } else {
    console.error("renamePopup element not found")
  }

  if (elements.clearRenameButton) {
    elements.clearRenameButton.removeEventListener("click", handleClearRename)
    elements.clearRenameButton.addEventListener("click", (e) =>
      handleClearRename(e, elements)
    )
  } else {
    console.error("clearRenameButton element not found")
  }

  const addToFolderButtons = document.querySelectorAll(".add-to-folder")

  addToFolderButtons.forEach((button) => {
    button.removeEventListener("click", handleAddToFolder)
    button.addEventListener("click", (e) => handleAddToFolder(e, elements))
  })

  const deleteButtons = document.querySelectorAll(".delete-btn")

  deleteButtons.forEach((button) => {
    button.removeEventListener("click", handleDeleteBookmark)
    button.addEventListener("click", (e) => handleDeleteBookmark(e, elements))
  })

  const renameButtons = document.querySelectorAll(".rename-btn")

  renameButtons.forEach((button) => {
    button.removeEventListener("click", handleRenameBookmark)
    button.addEventListener("click", (e) => handleRenameBookmark(e, elements))
  })

  const checkboxes = document.querySelectorAll(".bookmark-checkbox")

  checkboxes.forEach((checkbox) => {
    checkbox.removeEventListener("change", handleBookmarkCheckbox)
    checkbox.addEventListener("change", (e) =>
      handleBookmarkCheckbox(e, elements)
    )
  })
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
  e.target.closest(".dropdown-menu").classList.add("hidden")
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
  e.target.closest(".dropdown-menu").classList.add("hidden")
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

  e.target.closest(".dropdown-menu").classList.add("hidden")
}

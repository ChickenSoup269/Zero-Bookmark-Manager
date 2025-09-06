// ./components/controller/addToFolder.js
import { translations, showCustomPopup } from "../utils.js"
import { moveBookmarksToFolder } from "../bookmarks.js"
import { uiState, saveUIState, selectedBookmarks } from "../state.js"

export function openAddToFolderPopup(elements, bookmarkIds) {
  const language = localStorage.getItem("appLanguage") || "en"
  console.log("openAddToFolderPopup called with bookmarkIds:", bookmarkIds)
  elements.addToFolderSelect.innerHTML = `<option value="">${translations[language].selectFolder}</option>`
  uiState.folders.forEach((folder) => {
    const option = document.createElement("option")
    option.value = folder.id
    option.textContent =
      folder.id === "1"
        ? translations[language].bookmarksBar || "Bookmarks Bar"
        : folder.id === "2"
        ? translations[language].otherBookmarks || "Other Bookmarks"
        : folder.title || "Unnamed Folder"
    elements.addToFolderSelect.appendChild(option)
  })
  elements.addToFolderPopup.classList.remove("hidden")
  elements.addToFolderSelect.focus()

  // Remove existing listeners to prevent duplicates
  elements.addToFolderSaveButton.removeEventListener("click", handleSave)
  elements.addToFolderSaveButton.addEventListener("click", handleSave)

  elements.addToFolderCancelButton.removeEventListener("click", handleCancel)
  elements.addToFolderCancelButton.addEventListener("click", handleCancel)

  elements.addToFolderSelect.removeEventListener(
    "keypress",
    handleSelectKeypress
  )
  elements.addToFolderSelect.addEventListener("keypress", handleSelectKeypress)

  elements.addToFolderSelect.removeEventListener("keydown", handleSelectKeydown)
  elements.addToFolderSelect.addEventListener("keydown", handleSelectKeydown)

  elements.addToFolderPopup.removeEventListener("click", handlePopupClick)
  elements.addToFolderPopup.addEventListener("click", handlePopupClick)

  console.log("Add to folder popup listeners attached")

  function handleSave() {
    const targetFolderId = elements.addToFolderSelect.value
    if (!targetFolderId) {
      elements.addToFolderSelect.classList.add("error")
      showCustomPopup(
        translations[language].selectFolderError || "Please select a folder.",
        "error",
        false
      )
      elements.addToFolderSelect.focus()
      return
    }

    if (bookmarkIds.length === 0) {
      console.warn("No bookmarks provided to handleSave:", bookmarkIds)
      showCustomPopup(
        translations[language].noBookmarksSelected,
        "error",
        false
      )
      elements.addToFolderPopup.classList.add("hidden")
      return
    }

    moveBookmarksToFolder(bookmarkIds, targetFolderId, elements, () => {
      elements.addToFolderPopup.classList.add("hidden")
      elements.addToFolderSelect.classList.remove("error")
      showCustomPopup(
        translations[language].addToFolderSuccess ||
          "Bookmark(s) moved successfully!",
        "success"
      )
      saveUIState() // This is fine, as callback only runs on success now
    })
  }

  function handleCancel() {
    elements.addToFolderPopup.classList.add("hidden")
    elements.addToFolderSelect.classList.remove("error")
  }

  function handleSelectKeypress(e) {
    if (e.key === "Enter") {
      elements.addToFolderSaveButton.click()
    }
  }

  function handleSelectKeydown(e) {
    if (e.key === "Escape") {
      elements.addToFolderCancelButton.click()
    }
  }

  function handlePopupClick(e) {
    if (e.target === elements.addToFolderPopup) {
      elements.addToFolderCancelButton.click()
    }
  }
}

export function setupAddToFolderListeners(elements) {
  if (elements.addToFolderButton) {
    console.log("Attaching listener to addToFolderButton")
    elements.addToFolderButton.removeEventListener(
      "click",
      handleAddToFolderButton
    )
    elements.addToFolderButton.addEventListener(
      "click",
      handleAddToFolderButton
    )
  } else {
    console.error("addToFolderButton not found in elements!")
  }

  function handleAddToFolderButton() {
    console.log("Add to folder button clicked!")
    console.log("Selected bookmarks:", Array.from(selectedBookmarks))
    if (selectedBookmarks.size > 0) {
      console.log(
        "Opening popup with bookmarkIds:",
        Array.from(selectedBookmarks)
      )
      openAddToFolderPopup(elements, Array.from(selectedBookmarks))
    } else {
      console.warn("No bookmarks selected!")
      const language = localStorage.getItem("appLanguage") || "en"
      showCustomPopup(
        translations[language].noBookmarksSelected,
        "error",
        false
      )
    }
  }
}

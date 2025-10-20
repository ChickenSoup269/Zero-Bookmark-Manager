// components/controller/bookmarkAction.js

import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
  showCustomConfirm,
} from "../utils/utils.js"
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

  // Handle all menu-item buttons
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
    : e.target.classList.contains("view-detail-btn")
    ? "view-detail"
    : e.target.classList.contains("manage-tags-btn")
    ? "manage-tags"
    : e.target.id === "localstorage-settings-option" ||
      e.target.id === "export-bookmarks-option" ||
      e.target.id === "import-bookmarks-option" ||
      e.target.id === "rename-folder-option" ||
      e.target.id === "show-bookmark-ids-option" ||
      e.target.id === "edit-in-new-tab-option"
    ? null
    : null

  if (!bookmarkId && action) {
    console.error("Invalid bookmark ID for action", { bookmarkId, action })
    return
  }

  if (!action) {
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
    case "view-detail":
      openBookmarkDetailPopup(bookmarkId, elements)
      break
    case "manage-tags":
      openManageTagsPopup(bookmarkId, elements)
      break
  }

  e.target.closest(".dropdown-menu").classList.add("hidden")
}

// Function to open bookmark detail popup
export function openBookmarkDetailPopup(bookmarkId, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const popup = document.getElementById("bookmark-detail-popup")
  const title = document.getElementById("detail-title")
  const url = document.getElementById("detail-url")
  const dateAdded = document.getElementById("detail-date-added")
  const tags = document.getElementById("detail-tags")
  const closeButton = popup?.querySelector(".close-modal")
  const thumbnailEl = popup?.querySelector("#detail-thumbnail")

  if (
    !popup ||
    !title ||
    !url ||
    !dateAdded ||
    !tags ||
    !closeButton ||
    !thumbnailEl
  ) {
    console.error("Bookmark detail popup elements missing", {
      popup: !!popup,
      title: !!title,
      url: !!url,
      dateAdded: !!dateAdded,
      tags: !!tags,
      closeButton: !!closeButton,
      thumbnail: !!thumbnailEl,
    })
    showCustomPopup(translations[language].errorUnexpected, "error", true)
    return
  }

  safeChromeBookmarksCall("get", [bookmarkId], (results) => {
    if (chrome.runtime.lastError || !results || results.length === 0) {
      console.error(
        "Chrome bookmarks API error:",
        chrome.runtime.lastError?.message
      )
      showCustomPopup(translations[language].errorUnexpected, "error", true)
      return
    }

    const bookmark = results[0]

    // Set thumbnail
    let thumbnailUrl = chrome.runtime.getURL("images/default-favicon.png")
    if (bookmark.url && bookmark.url.startsWith("http")) {
      thumbnailUrl = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(
        bookmark.url
      )}?w=1000`
    } else {
      console.warn("Invalid URL for thumbnail:", bookmark.url)
    }

    if (thumbnailEl.src !== thumbnailUrl) {
      thumbnailEl.src = thumbnailUrl
      thumbnailEl.alt = bookmark.title || "Website thumbnail"
      thumbnailEl.style.display = "block"
    }

    // Handle thumbnail errors
    thumbnailEl.onerror = () => {
      console.error("Failed to load thumbnail for URL:", bookmark.url)
      if (
        thumbnailEl.src !== chrome.runtime.getURL("images/default-favicon.png")
      ) {
        thumbnailEl.src = chrome.runtime.getURL("images/default-favicon.png")
        thumbnailEl.alt = "Default thumbnail"
      } else {
        thumbnailEl.style.display = "none"
      }
    }
    thumbnailEl.onload = () => {}

    // Add hover icon and enlarge functionality
    const thumbnailContainer = thumbnailEl.parentElement
    thumbnailContainer.classList.add("thumbnail-container")
    const magnifyIcon = document.createElement("span")
    magnifyIcon.className = "magnify-icon"
    magnifyIcon.innerHTML = "<i class='fas fa-search-plus'></i>"
    thumbnailContainer.appendChild(magnifyIcon)

    // Enlarge image on click
    let enlargeOverlay = null
    thumbnailEl.onclick = () => {
      if (!enlargeOverlay) {
        enlargeOverlay = document.createElement("div")
        enlargeOverlay.className = "enlarge-overlay"
        const enlargedImg = document.createElement("img")
        enlargedImg.src = thumbnailEl.src
        enlargedImg.alt = thumbnailEl.alt
        enlargedImg.className = "enlarged-image"
        enlargeOverlay.appendChild(enlargedImg)
        document.body.appendChild(enlargeOverlay)

        // Close overlay on click
        enlargeOverlay.onclick = (e) => {
          if (e.target === enlargeOverlay) {
            enlargeOverlay.remove()
            enlargeOverlay = null
            document.removeEventListener("keydown", handleOverlayKeydown)
          }
        }

        // Close overlay on Escape
        const handleOverlayKeydown = (e) => {
          if (e.key === "Escape") {
            enlargeOverlay.remove()
            enlargeOverlay = null
            document.removeEventListener("keydown", handleOverlayKeydown)
          }
        }
        document.addEventListener("keydown", handleOverlayKeydown)
      }
    }

    // Populate other fields
    title.textContent =
      bookmark.title || bookmark.url || translations[language].notAvailable
    url.textContent = bookmark.url || translations[language].notAvailable
    dateAdded.textContent = bookmark.dateAdded
      ? new Date(bookmark.dateAdded).toLocaleString()
      : translations[language].notAvailable
    tags.innerHTML =
      (uiState.bookmarkTags[bookmarkId] || [])
        .map(
          (tag) => `
            <span class="bookmark-tag" style="
              background-color: ${uiState.tagColors[tag] || "#ccc"};
              color: ${uiState.tagTextColors?.[tag] || "#ffffff"};
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 12px;
              margin: 0 8px 8px 0;
              display: inline-block;
            ">
              ${tag}
            </span>
          `
        )
        .join("") || translations[language].notAvailable

    popup.classList.remove("hidden")

    const closePopup = () => {
      popup.classList.add("hidden")
      if (enlargeOverlay) {
        enlargeOverlay.remove()
        enlargeOverlay = null
      }
      magnifyIcon.remove()
      document.removeEventListener("keydown", handleKeydown)
    }

    closeButton.onclick = closePopup
    popup.onclick = (e) => {
      if (e.target === popup) closePopup()
    }

    const handleKeydown = (e) => {
      if (e.key === "Escape") closePopup()
    }
    document.addEventListener("keydown", handleKeydown)
  })
}

// Function to open manage tags popup with dropdown for existing tags
async function openManageTagsPopup(bookmarkId) {
  const language = localStorage.getItem("appLanguage") || "en"
  const popup = document.getElementById("manage-tags-popup")
  const existingTags = document.getElementById("existing-tags")
  const newTagInput = document.getElementById("new-tag-input")
  const newTagColor = document.getElementById("new-tag-color")
  const newTagTextColor = document.createElement("input")
  const addTagBtn = document.getElementById("add-tag-btn")
  const closeButton = popup?.querySelector(".close-modal")
  const MAX_TAGS = 10

  // Initialize text color input
  newTagTextColor.type = "color"
  newTagTextColor.id = "new-tag-text-color"
  newTagTextColor.value = "#ffffff"
  newTagTextColor.style.cssText = `
    padding: 8px;
    margin-bottom: 12px;
    border-radius: 6px;
    width: 100%;
  `

  // Predefined background colors
  const predefinedColors = [
    "#ecf2f8",
    "#fa7970",
    "#faa356",
    "#7ce378",
    "#a2b2fb",
    "#77bdfb",
    "#cea5fb",
  ]

  // Function to calculate contrasting text color
  function getContrastColor(bgColor) {
    const hex = bgColor.replace("#", "")
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance > 0.5 ? "#000000" : "#ffffff"
  }

  if (
    !popup ||
    !existingTags ||
    !newTagInput ||
    !newTagColor ||
    !addTagBtn ||
    !closeButton
  ) {
    console.error("Manage tags popup elements missing", {
      popup: !!popup,
      existingTags: !!existingTags,
      newTagInput: !!newTagInput,
      newTagColor: !!newTagColor,
      addTagBtn: !!addTagBtn,
      closeButton: !!closeButton,
    })
    showCustomPopup(translations[language].errorUnexpected, "error", true)
    return
  }

  // Create dropdown for existing tags
  const tagSelect = document.createElement("select")
  tagSelect.className = "select existing-tags-select"
  tagSelect.style.cssText = `
    width: 100%;
    padding: 8px;
    margin-bottom: 12px;
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  `
  tagSelect.innerHTML = `<option value="">${
    translations[language].selectTag || "Select Tag"
  }</option>`

  // Populate dropdown with existing tags
  const tags = await getAllTags()
  tags.forEach((tag) => {
    const option = document.createElement("option")
    option.value = tag
    option.textContent = tag
    option.style.backgroundColor = uiState.tagColors[tag] || "#ccc"
    option.style.color =
      uiState.tagTextColors?.[tag] ||
      getContrastColor(uiState.tagColors[tag] || "#ccc")
    tagSelect.appendChild(option)
  })

  // Insert dropdown and text color input
  const addTagContainer = popup.querySelector(".add-tag-container")
  if (!addTagContainer) {
    console.error("add-tag-container not found")
    showCustomPopup(translations[language].errorUnexpected, "error", true)
    return
  }
  addTagContainer.before(tagSelect)
  addTagContainer.before(newTagTextColor)

  // Create predefined color buttons
  const colorButtonsContainer = document.createElement("div")
  colorButtonsContainer.className = "color-buttons-container"
  colorButtonsContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  `
  predefinedColors.forEach((color) => {
    const button = document.createElement("button")
    button.type = "button"
    button.style.cssText = `
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background-color: ${color};
      border: 1px solid #ccc;
      cursor: pointer;
    `
    button.addEventListener("click", () => {
      newTagColor.value = color
      newTagTextColor.value = getContrastColor(color)
    })
    colorButtonsContainer.appendChild(button)
  })
  addTagContainer.before(colorButtonsContainer)

  // Add tag count display
  const tagCountDisplay = document.createElement("div")
  tagCountDisplay.className = "tag-count"
  tagCountDisplay.style.cssText = `
    font-size: 0.9rem;
    color: var(--text-secondary, #666);
    margin-bottom: 12px;
  `
  addTagContainer.before(tagCountDisplay)

  const renderTags = () => {
    const tags = uiState.bookmarkTags[bookmarkId] || []
    tagCountDisplay.textContent = `${tags.length}/${MAX_TAGS} tags`
    existingTags.innerHTML = tags
      .map(
        (tag) => `
        <div class="tag-item" style="display: inline-flex; align-items: center; gap: 6px; margin: 0 8px 8px 0;">
          <span class="bookmark-tag" style="
            background-color: ${uiState.tagColors[tag] || "#ccc"};
            color: ${
              uiState.tagTextColors?.[tag] ||
              getContrastColor(uiState.tagColors[tag] || "#ccc")
            };
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
          ">
            ${tag}
          </span>
          <button class="edit-tag-btn" data-tag="${tag}" style="
            background: none;
            border: none;
            color: var(--primary-color, #007bff);
            cursor: pointer;
            font-size: 12px;
          ">
            ✎
          </button>
          <button class="remove-tag-btn" data-tag="${tag}" style="
            background: none;
            border: none;
            color: var(--text-danger, #ff5555);
            cursor: pointer;
            font-size: 12px;
          ">
            ✕
          </button>
        </div>
      `
      )
      .join("")
  }

  renderTags()

  popup.classList.remove("hidden")

  // Handle tag selection from dropdown
  tagSelect.addEventListener("change", () => {
    const selectedTag = tagSelect.value
    const currentTags = uiState.bookmarkTags[bookmarkId] || []
    if (currentTags.length >= MAX_TAGS) {
      showCustomPopup(
        translations[language].tagLimitReached ||
          `Cannot add more than ${MAX_TAGS} tags`,
        "error",
        true
      )
      tagSelect.value = ""
      return
    }
    if (selectedTag && !currentTags.includes(selectedTag)) {
      if (!uiState.bookmarkTags[bookmarkId]) {
        uiState.bookmarkTags[bookmarkId] = []
      }
      uiState.bookmarkTags[bookmarkId].push(selectedTag)
      chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags }, () => {
        renderTags()
        tagSelect.value = ""
      })
    }
  })

  // Handle adding new tag
  addTagBtn.onclick = () => {
    const tag = newTagInput.value.trim()
    const bgColor = newTagColor.value
    const textColor = newTagTextColor.value
    const currentTags = uiState.bookmarkTags[bookmarkId] || []
    if (currentTags.length >= MAX_TAGS) {
      showCustomPopup(
        translations[language].tagLimitReached ||
          `Cannot add more than ${MAX_TAGS} tags`,
        "error",
        true
      )
      return
    }
    if (tag) {
      if (!uiState.bookmarkTags[bookmarkId]) {
        uiState.bookmarkTags[bookmarkId] = []
      }
      if (!uiState.bookmarkTags[bookmarkId].includes(tag)) {
        uiState.bookmarkTags[bookmarkId].push(tag)
        uiState.tagColors[tag] = bgColor
        if (!uiState.tagTextColors) uiState.tagTextColors = {}
        uiState.tagTextColors[tag] = textColor
        chrome.storage.local.set(
          {
            bookmarkTags: uiState.bookmarkTags,
            tagColors: uiState.tagColors,
            tagTextColors: uiState.tagTextColors,
          },
          () => {
            renderTags()
            newTagInput.value = ""
            newTagColor.value = "#cccccc"
            newTagTextColor.value = "#ffffff"
            const option = document.createElement("option")
            option.value = tag
            option.textContent = tag
            option.style.backgroundColor = bgColor
            option.style.color = textColor
            tagSelect.appendChild(option)
          }
        )
      } else {
        showCustomPopup(
          translations[language].tagExists || "Tag already exists",
          "error",
          true
        )
      }
    }
  }

  // Handle tag editing and removal
  existingTags.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-tag-btn")) {
      const tag = e.target.dataset.tag

      uiState.bookmarkTags[bookmarkId] = uiState.bookmarkTags[
        bookmarkId
      ].filter((t) => t !== tag)
      chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags }, () => {
        renderTags()
      })
    } else if (e.target.classList.contains("edit-tag-btn")) {
      const tag = e.target.dataset.tag
      const tagItem = e.target.closest(".tag-item")
      const tagSpan = tagItem.querySelector(".bookmark-tag")
      const currentTagName = tagSpan.textContent
      const removeButton = tagItem.querySelector(".remove-tag-btn")

      // Replace tag with input and save button
      const editInput = document.createElement("input")
      editInput.type = "text"
      editInput.value = currentTagName
      editInput.className = "edit-tag-input"
      editInput.style.cssText = `
        padding: 4px 8px;
        border: 1px solid var(--border-color, #d1d1d1);
        border-radius: 6px;
        font-size: 12px;
        width: 100px;
      `

      const saveButton = document.createElement("button")
      saveButton.textContent = translations[language].save || "Save"
      saveButton.style.cssText = `
        background: var(--primary-color, #007bff);
        color: #ffffff;
        border: none;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
      `

      tagItem.innerHTML = ""
      tagItem.appendChild(editInput)
      tagItem.appendChild(saveButton)
      tagItem.appendChild(e.target) // Edit button
      if (removeButton) tagItem.appendChild(removeButton) // Remove button

      saveButton.onclick = () => {
        const newTagName = editInput.value.trim()

        if (!newTagName) {
          showCustomPopup(
            translations[language].tagEmpty || "Tag name cannot be empty",
            "error",
            true
          )
          return
        }
        if (newTagName === currentTagName) {
          renderTags()
          return
        }
        if (uiState.bookmarkTags[bookmarkId].includes(newTagName)) {
          showCustomPopup(
            translations[language].tagExists || "Tag already exists",
            "error",
            true
          )
          return
        }

        // Update all bookmarks with the old tag
        const updatedBookmarkTags = { ...uiState.bookmarkTags }
        for (const id in updatedBookmarkTags) {
          if (updatedBookmarkTags[id].includes(tag)) {
            updatedBookmarkTags[id] = updatedBookmarkTags[id].map((t) =>
              t === tag ? newTagName : t
            )
          }
        }

        // Update colors
        uiState.tagColors[newTagName] = uiState.tagColors[tag]
        uiState.tagTextColors[newTagName] =
          uiState.tagTextColors?.[tag] ||
          getContrastColor(uiState.tagColors[tag])
        delete uiState.tagColors[tag]
        if (uiState.tagTextColors) delete uiState.tagTextColors[tag]

        // Save to storage
        uiState.bookmarkTags = updatedBookmarkTags
        chrome.storage.local.set(
          {
            bookmarkTags: uiState.bookmarkTags,
            tagColors: uiState.tagColors,
            tagTextColors: uiState.tagTextColors,
          },
          () => {
            // Update dropdown
            const option = tagSelect.querySelector(`option[value="${tag}"]`)
            if (option) {
              option.value = newTagName
              option.textContent = newTagName
              option.style.backgroundColor = uiState.tagColors[newTagName]
              option.style.color =
                uiState.tagTextColors?.[newTagName] ||
                getContrastColor(uiState.tagColors[newTagName])
            }
            renderTags()
          }
        )
      }
    }
  })

  const closePopup = () => {
    popup.classList.add("hidden")
    tagSelect.remove()
    colorButtonsContainer.remove()
    newTagTextColor.remove()
    tagCountDisplay.remove()
    document.removeEventListener("keydown", handleKeydown)
  }

  closeButton.onclick = closePopup
  popup.onclick = (e) => {
    if (e.target === popup) closePopup()
  }

  const handleKeydown = (e) => {
    if (e.key === "Escape") closePopup()
  }
  document.addEventListener("keydown", handleKeydown)
}

// Function to get all user-created tags
async function getAllTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["bookmarkTags"], (data) => {
      const bookmarkTags = data.bookmarkTags || {}
      const allTags = new Set()
      Object.values(bookmarkTags).forEach((tags) => {
        tags.forEach((tag) => allTags.add(tag))
      })
      resolve([...allTags].sort())
    })
  })
}

// Existing functions (unchanged)
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
    // Remove tags for the bookmark
    if (uiState.bookmarkTags[bookmarkId]) {
      delete uiState.bookmarkTags[bookmarkId]
      chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags }, () => {
        customSaveUIState()
        // Re-populate tag filter to reflect tag changes
        populateTagFilter(elements)
      })
    }

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

    chrome.storage.local.get("favoriteBookmarks", (data) => {
      const favoriteBookmarks = data.favoriteBookmarks || {}
      const isFavorite = !favoriteBookmarks[bookmarkId]
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

        const button = document.querySelector(
          `.dropdown-btn[data-id="${bookmarkId}"]`
        )
        if (button) {
          button.classList.toggle("favorited", isFavorite)
          button.innerHTML = isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }

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
      // Remove tags for all selected bookmarks
      Array.from(uiState.selectedBookmarks).forEach((bookmarkId) => {
        if (uiState.bookmarkTags[bookmarkId]) {
          delete uiState.bookmarkTags[bookmarkId]
        }
      })

      chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags }, () => {
        customSaveUIState()
        populateTagFilter(elements)
      })

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

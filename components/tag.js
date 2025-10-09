import { renderFilteredBookmarks } from "./ui.js" // To re-render after changes

// Default tag colors - can be customized
export let tagColors = {}

// Load saved tags and colors from storage
export async function loadTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["bookmarkTags", "tagColors"], (data) => {
      if (data.bookmarkTags) {
      }
      if (data.tagColors) {
        tagColors = { ...tagColors, ...data.tagColors }
      }
      resolve()
    })
  })
}

// Save tags and colors to storage
export function saveTags(bookmarkTags, updatedTagColors = null) {
  chrome.storage.local.set({ bookmarkTags }, () => {
    if (updatedTagColors) {
      tagColors = { ...tagColors, ...updatedTagColors }
      chrome.storage.local.set({ tagColors })
    }
  })
}

// Add tag to bookmark
export function addTagToBookmark(bookmarkId, tag, color) {
  chrome.storage.local.get("bookmarkTags", (data) => {
    const bookmarkTags = data.bookmarkTags || {}
    if (!bookmarkTags[bookmarkId]) {
      bookmarkTags[bookmarkId] = []
    }
    if (bookmarkTags[bookmarkId].length >= 10) {
      const language = localStorage.getItem("appLanguage") || "en"
      showCustomPopup(
        translations[language].tagLimitError ||
          "Cannot add more than 10 tags per bookmark",
        "error",
        true
      )
      return
    }
    if (!bookmarkTags[bookmarkId].includes(tag)) {
      bookmarkTags[bookmarkId].push(tag)
      uiState.bookmarkTags = bookmarkTags // Update uiState
      saveTags(bookmarkTags, { [tag]: color })
    } else {
      saveTags(bookmarkTags)
    }
    chrome.bookmarks.getTree((tree) => {
      renderFilteredBookmarks(tree, {
        tagFilterContainer: document.getElementById("tag-filter-container"),
        folderListDiv: document.getElementById("folder-list"),
      })
    })
  })
}

// Remove tag from bookmark
export function removeTagFromBookmark(bookmarkId, tag) {
  chrome.storage.local.get("bookmarkTags", (data) => {
    const bookmarkTags = data.bookmarkTags || {}
    if (bookmarkTags[bookmarkId]) {
      bookmarkTags[bookmarkId] = bookmarkTags[bookmarkId].filter(
        (t) => t !== tag
      )
      if (bookmarkTags[bookmarkId].length === 0) {
        delete bookmarkTags[bookmarkId]
      }
    }
    saveTags(bookmarkTags)
    // Re-render
    chrome.bookmarks.getTree((tree) => {
      renderFilteredBookmarks(tree, elements)
    })
  })
}

// Change color of a tag
export function changeTagColor(tag, color) {
  const updatedColors = { [tag]: color }
  saveTags(null, updatedColors)
  // Re-render to update colors
  chrome.bookmarks.getTree((tree) => {
    renderFilteredBookmarks(tree, elements)
  })
}

// Get tags for a bookmark
export function getTagsForBookmark(bookmarkId) {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarkTags", (data) => {
      const bookmarkTags = data.bookmarkTags || {}
      resolve(bookmarkTags[bookmarkId] || [])
    })
  })
}

// Get all unique tags
export async function getAllTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarkTags", (data) => {
      const bookmarkTags = data.bookmarkTags || {}
      const allTags = new Set()
      Object.values(bookmarkTags).forEach((tags) =>
        tags.forEach((t) => allTags.add(t))
      )
      console.log("All tags:", Array.from(allTags)) // Thêm log để kiểm tra
      resolve(Array.from(allTags))
    })
  })
}

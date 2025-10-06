// tag.js (New file to handle tag-related logic)
import { setBookmarks, setBookmarkTree } from "./state.js" // Assuming state.js exists as per ui.js
import { renderFilteredBookmarks } from "./ui.js" // To re-render after changes

// Default tag colors - can be customized
export let tagColors = {
  python: "#3572A5",
  javascript: "#F1E05A",
  work: "#DB2828",
  personal: "#21BA45",
  important: "#F2711C",
  // Add more default tags/colors as needed
}

// Load saved tags and colors from storage
export async function loadTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["bookmarkTags", "tagColors"], (data) => {
      if (data.bookmarkTags) {
        // bookmarkTags: { bookmarkId: [tag1, tag2, ...] }
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
export function addTagToBookmark(bookmarkId, tag) {
  chrome.storage.local.get("bookmarkTags", (data) => {
    const bookmarkTags = data.bookmarkTags || {}
    if (!bookmarkTags[bookmarkId]) {
      bookmarkTags[bookmarkId] = []
    }
    if (!bookmarkTags[bookmarkId].includes(tag)) {
      bookmarkTags[bookmarkId].push(tag)
    }
    saveTags(bookmarkTags)
    // Re-render bookmarks
    chrome.bookmarks.getTree((tree) => {
      renderFilteredBookmarks(tree, elements) // elements need to be passed or global
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
      resolve(Array.from(allTags))
    })
  })
}

const form = document.getElementById("quick-save-form")
const titleInput = document.getElementById("title")
const urlInput = document.getElementById("url")
const folderSelect = document.getElementById("folder")
const tagsInput = document.getElementById("tags")
const notesInput = document.getElementById("notes")
const saveButton = document.getElementById("save")
const statusBox = document.getElementById("status")
const openDashboardButton = document.getElementById("open-dashboard")

let currentTab = null
let existingBookmark = null
let preferredFolderId = "1"

const AVAILABLE_THEMES = [
  "light",
  "dark",
  "dracula",
  "onedark",
  "tokyonight",
  "nord",
  "synthwave",
  "gruvbox",
  "catppuccin",
  "nightowl",
  "nord-light",
  "gruvbox-light",
  "catppuccin-light",
  "nightowl-light",
  "monokai",
  "winter-is-coming",
  "github-blue",
  "github-light",
  "tet",
]

function resolveActiveTheme(theme) {
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  if (theme === "system") return isDarkMode ? "dark" : "light"
  return AVAILABLE_THEMES.includes(theme) ? theme : "light"
}

function applyTheme(theme) {
  const activeTheme = resolveActiveTheme(theme)

  AVAILABLE_THEMES.forEach((themeName) => {
    document.body.classList.remove(`${themeName}-theme`)
  })
  document.body.classList.remove("light-theme", "dark-theme")
  document.body.classList.add(`${activeTheme}-theme`)
  document.documentElement.setAttribute("data-theme", activeTheme)

  const lightThemes = new Set([
    "light",
    "github-light",
    "nord-light",
    "gruvbox-light",
    "catppuccin-light",
    "nightowl-light",
  ])
  document.documentElement.style.colorScheme = lightThemes.has(activeTheme)
    ? "light"
    : "dark"
}

function initTheme() {
  applyTheme(localStorage.getItem("appTheme") || "system")

  window.addEventListener("storage", (event) => {
    if (event.key === "appTheme") {
      applyTheme(event.newValue || "system")
    }
  })

  window.addEventListener("themeChanged", (event) => {
    const selection =
      event.detail?.originalSelection || event.detail?.theme || "system"
    applyTheme(selection)
  })

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if ((localStorage.getItem("appTheme") || "system") === "system") {
        applyTheme("system")
      }
    })
}

function getSourceTabId() {
  const params = new URLSearchParams(window.location.search)
  const tabId = Number.parseInt(params.get("tabId") || "", 10)
  return Number.isFinite(tabId) ? tabId : null
}

function showStatus(message, type = "") {
  statusBox.textContent = message
  statusBox.className = `status ${type}`.trim()
  statusBox.classList.remove("hidden")
}

function parseTags(value) {
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function flattenFolders(nodes, depth = 0, folders = []) {
  nodes.forEach((node) => {
    if (node.children) {
      folders.push({ id: node.id, title: node.title || "Bookmarks", depth })
      flattenFolders(node.children, depth + 1, folders)
    }
  })
  return folders
}

function fillFolders() {
  chrome.bookmarks.getTree((tree) => {
    const folders = flattenFolders(tree)
    folderSelect.innerHTML = ""
    folders
      .filter((folder) => folder.id !== "0")
      .forEach((folder) => {
        const option = document.createElement("option")
        option.value = folder.id
        option.textContent = `${"  ".repeat(Math.max(0, folder.depth - 1))}${folder.title}`
        folderSelect.appendChild(option)
      })

    const bookmarksBar = folders.find((folder) => folder.id === "1")
    if (bookmarksBar && preferredFolderId === "1") preferredFolderId = bookmarksBar.id
    if (preferredFolderId) folderSelect.value = preferredFolderId
  })
}

function fillExistingMetadata(bookmarkId) {
  chrome.storage.local.get(["bookmarkTags", "bookmarkNotes"], (data) => {
    const tags = data.bookmarkTags?.[bookmarkId] || []
    const note = data.bookmarkNotes?.[bookmarkId] || ""
    tagsInput.value = tags.join(", ")
    notesInput.value = note
  })
}

function populateFromTab(tab) {
  if (chrome.runtime.lastError || !tab?.url) {
    showStatus("No active page found.", "error")
    saveButton.disabled = true
    return
  }

  currentTab = tab
  titleInput.value = tab.title || tab.url
  urlInput.value = tab.url

  if (/^(chrome|edge|about|chrome-extension):\/\//i.test(tab.url)) {
    showStatus("This browser page cannot be saved as a bookmark.", "error")
    saveButton.disabled = true
    return
  }

  chrome.bookmarks.search({ url: tab.url }, (matches) => {
    existingBookmark = matches?.[0] || null
    if (existingBookmark) {
      titleInput.value = existingBookmark.title || titleInput.value
      if (existingBookmark.parentId) {
        preferredFolderId = existingBookmark.parentId
        folderSelect.value = preferredFolderId
      }
      fillExistingMetadata(existingBookmark.id)
      showStatus("This page is already bookmarked. Saving will update its tags and notes.")
    }
  })
}

function loadCurrentTab() {
  const tabId = getSourceTabId()
  if (!tabId) {
    showStatus("No source tab specified.", "error")
    saveButton.disabled = true
    return
  }

  chrome.tabs.get(tabId, populateFromTab)
}

function saveMetadata(bookmarkId, tags, note, callback) {
  chrome.storage.local.get(["bookmarkTags", "bookmarkNotes", "tagColors", "tagTextColors"], (data) => {
    const bookmarkTags = data.bookmarkTags || {}
    const bookmarkNotes = data.bookmarkNotes || {}
    const tagColors = data.tagColors || {}
    const tagTextColors = data.tagTextColors || {}

    if (tags.length) {
      bookmarkTags[bookmarkId] = tags
      tags.forEach((tag) => {
        if (!tagColors[tag]) tagColors[tag] = "#3B82F6"
        if (!tagTextColors[tag]) tagTextColors[tag] = "#FFFFFF"
      })
    } else {
      delete bookmarkTags[bookmarkId]
    }

    if (note) {
      bookmarkNotes[bookmarkId] = note
    } else {
      delete bookmarkNotes[bookmarkId]
    }

    chrome.storage.local.set(
      { bookmarkTags, bookmarkNotes, tagColors, tagTextColors },
      callback,
    )
  })
}

function saveBookmark(event) {
  event.preventDefault()
  const title = titleInput.value.trim() || urlInput.value.trim()
  const url = urlInput.value.trim()
  const parentId = folderSelect.value || "1"
  const tags = parseTags(tagsInput.value)
  const note = notesInput.value.trim()

  saveButton.disabled = true
  showStatus("Saving...")

  const finish = (bookmark, actionText) => {
    if (chrome.runtime.lastError) {
      showStatus(chrome.runtime.lastError.message || "Could not save bookmark.", "error")
      saveButton.disabled = false
      return
    }

    saveMetadata(bookmark.id, tags, note, () => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message || "Bookmark saved, but metadata failed.", "error")
      } else {
        existingBookmark = bookmark
        showStatus(`${actionText} with ${tags.length} tag${tags.length === 1 ? "" : "s"} and notes.`, "success")
      }
      saveButton.disabled = false
    })
  }

  if (existingBookmark) {
    chrome.bookmarks.update(existingBookmark.id, { title, url }, (updated) => {
      if (chrome.runtime.lastError) return finish(existingBookmark, "Updated bookmark")
      if (updated.parentId !== parentId) {
        chrome.bookmarks.move(updated.id, { parentId }, (moved) => finish(moved || updated, "Updated bookmark"))
      } else {
        finish(updated, "Updated bookmark")
      }
    })
  } else {
    chrome.bookmarks.create({ parentId, title, url }, (created) => finish(created, "Saved bookmark"))
  }
}

openDashboardButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") })
})

form.addEventListener("submit", saveBookmark)
initTheme()
fillFolders()
loadCurrentTab()

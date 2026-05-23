import { translations, showCustomPopup } from "./utils/utils.js"

const UNDO_TIMEOUT = 9000

function getLanguage() {
  return localStorage.getItem("appLanguage") || "en"
}

function t(key, fallback) {
  const lang = getLanguage()
  return translations[lang]?.[key] || translations.en?.[key] || fallback
}

function ensureUndoHost() {
  let host = document.getElementById("undo-toast-host")
  if (!host) {
    host = document.createElement("div")
    host.id = "undo-toast-host"
    host.className = "undo-toast-host"
    document.body.appendChild(host)
  }
  return host
}

function refresh(elements) {
  Promise.all([import("./bookmarks.js"), import("./ui.js")]).then(
    ([bookmarksModule, uiModule]) => {
      bookmarksModule.getBookmarkTree((nodes) => {
        if (nodes) uiModule.renderFilteredBookmarks(nodes, elements)
      })
    },
  ).catch((error) => {
    console.error("Undo refresh failed:", error)
  })
}

function chromeBookmark(method, ...args) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks[method](...args, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(result)
    })
  })
}

export function snapshotBookmark(bookmark, extra = {}) {
  if (!bookmark) return null
  return {
    id: bookmark.id,
    parentId: bookmark.parentId,
    index: bookmark.index,
    title: bookmark.title || "",
    url: bookmark.url || "",
    dateAdded: bookmark.dateAdded,
    tags: extra.tags || [],
    favorite: !!extra.favorite,
    pinned: !!extra.pinned,
  }
}

export async function snapshotBookmarks(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean)
  if (!uniqueIds.length) return []

  const [nodes, storage] = await Promise.all([
    chromeBookmark("get", uniqueIds),
    chrome.storage.local.get([
      "bookmarkTags",
      "favoriteBookmarks",
      "pinnedBookmarks",
    ]),
  ])

  const bookmarkTags = storage.bookmarkTags || {}
  const favoriteBookmarks = storage.favoriteBookmarks || {}
  const pinnedBookmarks = storage.pinnedBookmarks || {}

  return nodes
    .filter((node) => node?.url)
    .map((node) =>
      snapshotBookmark(node, {
        tags: bookmarkTags[node.id] || [],
        favorite: favoriteBookmarks[node.id],
        pinned: pinnedBookmarks[node.id],
      }),
    )
}

async function restoreBookmark(snapshot) {
  const createData = {
    parentId: snapshot.parentId,
    index: snapshot.index,
    title: snapshot.title,
    url: snapshot.url,
  }
  const created = await chromeBookmark("create", createData)

  const storage = await chrome.storage.local.get([
    "bookmarkTags",
    "favoriteBookmarks",
    "pinnedBookmarks",
  ])
  const bookmarkTags = storage.bookmarkTags || {}
  const favoriteBookmarks = storage.favoriteBookmarks || {}
  const pinnedBookmarks = storage.pinnedBookmarks || {}

  if (snapshot.tags?.length) bookmarkTags[created.id] = [...snapshot.tags]
  if (snapshot.favorite) favoriteBookmarks[created.id] = true
  if (snapshot.pinned) pinnedBookmarks[created.id] = true

  await chrome.storage.local.set({
    bookmarkTags,
    favoriteBookmarks,
    pinnedBookmarks,
  })

  return created
}

export function registerUndo({ message, actionLabel, undo, elements }) {
  const host = ensureUndoHost()
  const toast = document.createElement("div")
  toast.className = "undo-toast"
  toast.innerHTML = `
    <span>${message}</span>
    <button type="button">${actionLabel || t("undoAction", "Undo")}</button>
  `

  let settled = false
  const close = () => {
    settled = true
    toast.remove()
  }

  const timer = window.setTimeout(close, UNDO_TIMEOUT)
  toast.querySelector("button").addEventListener("click", async () => {
    if (settled) return
    window.clearTimeout(timer)
    try {
      await undo()
      refresh(elements)
      showCustomPopup(t("undoSuccess", "Action undone."), "success", true)
    } catch (error) {
      console.error("Undo failed:", error)
      showCustomPopup(t("undoFailed", "Could not undo this action."), "error", true)
    } finally {
      close()
    }
  })

  host.appendChild(toast)
}

export async function restoreDeletedBookmarks(snapshots) {
  for (const snapshot of snapshots) {
    await restoreBookmark(snapshot)
  }
}

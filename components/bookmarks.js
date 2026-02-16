// ./components/bookmarks.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "./utils/utils.js"
import {
  setBookmarks,
  setFolders,
  setBookmarkTree,
  setVisitCounts,
  uiState,
  selectedBookmarks,
} from "./state.js"
import { renderFilteredBookmarks } from "./ui.js"

// Load visit counts from background script
export function loadVisitCounts(callback) {
  chrome.runtime.sendMessage({ action: "getVisitCounts" }, (response) => {
    if (response && response.visitCounts) {
      setVisitCounts(response.visitCounts)

    }
    if (callback) callback()
  })
}

export function getBookmarkTree(callback) {
  safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
    if (bookmarkTreeNodes) {
      setBookmarkTree(bookmarkTreeNodes)
      setBookmarks(flattenBookmarks(bookmarkTreeNodes))
      setFolders(getFolders(bookmarkTreeNodes))
    } else {
      console.error("Failed to fetch bookmark tree")
    }
    callback(bookmarkTreeNodes)
  })
}

export function flattenBookmarks(nodes) {
  let flat = []
  nodes.forEach((node) => {
    if (node.url) flat.push(node)
    if (node.children) flat = flat.concat(flattenBookmarks(node.children))
  })
  return flat
}

export function getFolders(nodes) {
  let folderList = []
  nodes.forEach((node) => {
    if (node.children) {
      folderList.push({
        id: node.id,
        title:
          node.title && node.title.trim() !== ""
            ? node.title
            : `Folder ${node.id}`,
        parentId: node.parentId || null,
      })
      folderList = folderList.concat(getFolders(node.children))
    }
  })

  return folderList
}

export function isInFolder(
  bookmark,
  folderId,
  bookmarkTree = uiState.bookmarkTree,
) {
  if (!bookmark || !bookmark.parentId || !folderId) {
    return true
  }
  if (bookmark.parentId === folderId) {
    return true
  }

  function findNode(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNode(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  let currentId = bookmark.parentId
  while (currentId) {
    const parentNode = findNode(bookmarkTree, currentId)

    if (!parentNode) break
    if (parentNode.id === folderId) {
      return true
    }
    currentId = parentNode.parentId
  }

  return false
}
export function isAncestorOf(
  folder,
  selectedFolderId,
  bookmarkTree = uiState.bookmarkTree,
) {
  if (!folder || !selectedFolderId || !bookmarkTree) {
    return false
  }

  function findNode(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNode(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  const selectedNode = findNode(bookmarkTree, selectedFolderId)
  if (!selectedNode) {
    return false
  }

  let currentId = selectedNode.parentId
  while (currentId) {
    const parentNode = findNode(bookmarkTree, currentId)

    if (!parentNode) break
    if (parentNode.id === folder.id) {
      return true
    }
    currentId = parentNode.parentId
  }

  return false
}

export function moveBookmarksToFolder(
  bookmarkIds,
  targetFolderId,
  elements,
  callback,
) {
  const language = localStorage.getItem("appLanguage") || "en"

  const movePromises = bookmarkIds.map((bookmarkId) => {
    return new Promise((resolve, reject) => {
      safeChromeBookmarksCall(
        "move",
        [bookmarkId, { parentId: targetFolderId }],
        (result) => {
          if (result) {
            resolve(result)
          } else {
            console.error(`Failed to move bookmark ${bookmarkId}`)
            reject(new Error(`Failed to move bookmark ${bookmarkId}`))
          }
        },
      )
    })
  })

  Promise.allSettled(movePromises)
    .then((results) => {
      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason)
      if (errors.length > 0) {
        console.error("Errors during bookmark move:", errors)
        showCustomPopup(translations[language].errorUnexpected, "error", false)
        callback()
        return
      }

      function fetchBookmarkTreeWithRetry(attempts = 3, delay = 500) {
        safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            setBookmarkTree(bookmarkTreeNodes)
            setBookmarks(flattenBookmarks(bookmarkTreeNodes))
            setFolders(getFolders(bookmarkTreeNodes))
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            selectedBookmarks.clear()
            elements.addToFolderButton.classList.add("hidden")
            elements.deleteBookmarksButton.classList.add("hidden")
            showCustomPopup(
              translations[language].addToFolderSuccess,
              "success",
            )
            callback() // Success: hide popup, save state
          } else if (attempts > 1) {
            console.warn(
              `Retrying getBookmarkTree, attempts left: ${attempts - 1}`,
            )
            setTimeout(
              () => fetchBookmarkTreeWithRetry(attempts - 1, delay),
              delay,
            )
          } else {
            console.error("Failed to fetch bookmark tree after move.")
            showCustomPopup(
              translations[language].errorUnexpected +
                " " +
                (translations[language].restartExtension ||
                  "Please try again or restart the extension."),
              "error",
              false,
            )
            callback()
          }
        })
      }
      fetchBookmarkTreeWithRetry()
    })
    .catch((error) => {
      console.error("Unexpected error in movePromises:", error)
      showCustomPopup(
        translations[language].errorUnexpected +
          " " +
          (translations[language].restartExtension ||
            "Please try again or restart the extension."),
        "error",
        false,
      )
      callback()
    })
}

export function removeDuplicateBookmarks(callback) {
  const bookmarks = uiState.bookmarks
  const urls = {}
  const duplicates = []

  // Group bookmarks by URL
  bookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      if (!urls[bookmark.url]) {
        urls[bookmark.url] = []
      }
      urls[bookmark.url].push(bookmark)
    }
  })

  // Find duplicates and decide which one to keep
  for (const url in urls) {
    if (urls[url].length > 1) {
      // Sort by date added (newest first)
      urls[url].sort((a, b) => b.dateAdded - a.dateAdded)
      // The first one is the newest, the rest are duplicates
      const toRemove = urls[url].slice(1)
      toRemove.forEach((bookmark) => duplicates.push(bookmark.id))
    }
  }

  const language = localStorage.getItem("appLanguage") || "en"

  if (duplicates.length === 0) {
    showCustomPopup(
      translations[language].noDuplicatesFound ||
        "No duplicate bookmarks found.",
    )
    if (callback) callback(0)
    return
  }

  // Remove duplicates
  let removedCount = 0
  const totalDuplicates = duplicates.length
  duplicates.forEach((id) => {
    chrome.bookmarks.remove(id, () => {
      removedCount++
      if (removedCount === totalDuplicates) {
        showCustomPopup(
          `${totalDuplicates} ${translations[language].duplicatesRemoved || "duplicate(s) removed."}`,
        )
        if (callback) {
          callback(totalDuplicates)
        }
      }
    })
  })
}

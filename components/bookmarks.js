// ./components/bookmarks.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "./utils.js"
import {
  setBookmarks,
  setFolders,
  setBookmarkTree,
  uiState,
  selectedBookmarks,
} from "./state.js"
import { renderFilteredBookmarks } from "./ui.js"

export function getBookmarkTree(callback) {
  safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
    if (bookmarkTreeNodes) {
      console.log(
        "Bookmark Tree fetched:",
        JSON.stringify(bookmarkTreeNodes, null, 2)
      )
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
      })
      folderList = folderList.concat(getFolders(node.children))
    }
  })
  console.log("Folders extracted:", folderList)
  return folderList
}

export function isInFolder(
  bookmark,
  folderId,
  bookmarkTree = uiState.bookmarkTree
) {
  if (!bookmark || !bookmark.parentId || !folderId) {
    console.log("isInFolder: Allowing node due to invalid inputs", {
      bookmarkId: bookmark?.id,
      folderId,
    })
    return true // Allow all nodes when no folder is selected
  }
  if (bookmark.parentId === folderId) {
    console.log("isInFolder: Direct match", {
      bookmarkId: bookmark.id,
      folderId,
    })
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
    console.log("isInFolder: Checking parent", {
      bookmarkId: bookmark.id,
      currentId,
      parentNodeId: parentNode?.id,
      folderId,
    })
    if (!parentNode) break
    if (parentNode.id === folderId) {
      console.log("isInFolder: Found match in parent chain", {
        bookmarkId: bookmark.id,
        folderId,
      })
      return true
    }
    currentId = parentNode.parentId
  }
  console.log("isInFolder: No match found", {
    bookmarkId: bookmark.id,
    folderId,
  })
  return false
}
export function isAncestorOf(
  folder,
  selectedFolderId,
  bookmarkTree = uiState.bookmarkTree
) {
  if (!folder || !selectedFolderId || !bookmarkTree) {
    console.log("isAncestorOf: Invalid inputs", {
      folderId: folder?.id,
      selectedFolderId,
    })
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
    console.log("isAncestorOf: Selected node not found", { selectedFolderId })
    return false
  }

  let currentId = selectedNode.parentId
  while (currentId) {
    const parentNode = findNode(bookmarkTree, currentId)
    console.log("isAncestorOf: Checking parent", {
      folderId: folder.id,
      currentId,
      parentNodeId: parentNode?.id,
      selectedFolderId,
    })
    if (!parentNode) break
    if (parentNode.id === folder.id) {
      console.log("isAncestorOf: Found ancestor", {
        folderId: folder.id,
        selectedFolderId,
      })
      return true
    }
    currentId = parentNode.parentId
  }
  console.log("isAncestorOf: No ancestor found", {
    folderId: folder.id,
    selectedFolderId,
  })
  return false
}

export function moveBookmarksToFolder(
  bookmarkIds,
  targetFolderId,
  elements,
  callback
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
        }
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
              "success"
            )
            callback() // Success: hide popup, save state
          } else if (attempts > 1) {
            console.warn(
              `Retrying getBookmarkTree, attempts left: ${attempts - 1}`
            )
            setTimeout(
              () => fetchBookmarkTreeWithRetry(attempts - 1, delay),
              delay
            )
          } else {
            console.error("Failed to fetch bookmark tree after move.")
            showCustomPopup(
              translations[language].errorUnexpected +
                " " +
                (translations[language].restartExtension ||
                  "Please try again or restart the extension."),
              "error",
              false
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
        false
      )
      callback()
    })
}

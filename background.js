// background.js

// ==================== Visit Count Tracking ====================
let visitCounts = {}
let bookmarkUrlMap = {} // Map URLs to bookmark IDs for quick lookup

// Load visit counts and build URL map on startup
// console.log("📌 Background script starting...")
chrome.storage.local.get(["visitCounts"], (result) => {
  visitCounts = result.visitCounts || {}
  // console.log(" Loaded visit counts from storage:", visitCounts)

  // Build bookmark URL map immediately - try multiple times
  // console.log("Attempting to build bookmark URL map...")
  buildBookmarkUrlMap()

  // Also rebuild after a short delay
  setTimeout(() => {
    // console.log("Second attempt - rebuilding bookmark URL map...")
    buildBookmarkUrlMap()
  }, 1000)

  // And one more time with longer delay
  setTimeout(() => {
    // console.log("Third attempt - rebuilding bookmark URL map...")
    buildBookmarkUrlMap()
  }, 2000)
})

// Build a map of bookmark URLs to their IDs for efficient lookup
function buildBookmarkUrlMap() {
  // console.log(
  //   "🔨 Building bookmark URL map... calling chrome.bookmarks.getTree()",
  // )
  try {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      // console.log(" chrome.bookmarks.getTree callback received")
      if (!bookmarkTreeNodes) {
        // console.error("❌ No bookmark tree nodes!")
        return
      }

      // console.log("Bookmark tree nodes count:", bookmarkTreeNodes.length)
      bookmarkUrlMap = {}
      flattenBookmarksForTracking(bookmarkTreeNodes)

      const mapSize = Object.keys(bookmarkUrlMap).length
      // console.log("Built bookmark URL map with", mapSize, "entries")

      if (mapSize === 0) {
        // console.warn("WARNING: Bookmark URL map is empty! No bookmarks found?")
      }

      // Log ALL entries for debugging
      // console.log(" All bookmarks in map:")
      // Object.entries(bookmarkUrlMap).forEach(([url, id]) => {
      //   console.log(`  📌 ${url} -> ${id}`)
      // })
    })
  } catch (err) {
    // console.error("Error calling chrome.bookmarks.getTree:", err)
  }
}

function flattenBookmarksForTracking(nodes) {
  nodes.forEach((node) => {
    if (node.url) {
      // Normalize URL by removing trailing slashes and fragments
      const normalizedUrl = normalizeUrl(node.url)
      bookmarkUrlMap[normalizedUrl] = node.id
      // console.log(`Mapped bookmark: ${normalizedUrl} -> ${node.id}`)
    }
    if (node.children) {
      flattenBookmarksForTracking(node.children)
    }
  })
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url)
    // Remove www. prefix for consistency
    let hostname = urlObj.hostname.toLowerCase()
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4)
    }
    // Remove fragment and trailing slash from pathname
    let pathname = urlObj.pathname.replace(/\/$/, "")
    // If pathname is empty, use /
    if (!pathname) pathname = "/"

    const normalized = `${urlObj.protocol}//${hostname}${pathname}${urlObj.search}`
    return normalized
  } catch (e) {
    return url
  }
}

// Listen for navigation events (when user visits a URL)
chrome.webNavigation.onCompleted.addListener((details) => {
  // Only track main frame navigations (not iframes)
  if (details.frameId !== 0) return

  const url = details.url

  // Skip chrome:// and extension pages
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    return
  }

  // If bookmarkUrlMap is still empty, rebuild it (timing issue)
  if (Object.keys(bookmarkUrlMap).length === 0) {
    // console.warn("⚠️ Bookmark URL map is empty! Rebuilding...")
    buildBookmarkUrlMap()
  }

  const normalizedUrl = normalizeUrl(url)
  // console.log(`🌐 Navigation detected: ${normalizedUrl}`)
  // console.log(`   Original URL: ${url}`)

  let bookmarkId = bookmarkUrlMap[normalizedUrl]

  // If exact match not found, try flexible matching
  if (!bookmarkId) {
    bookmarkId = findMatchingBookmark(normalizedUrl)
  }

  if (bookmarkId) {
    // This URL is a bookmark! Increment visit count
    visitCounts[bookmarkId] = (visitCounts[bookmarkId] || 0) + 1

    // Save to storage (debounced to avoid too many writes)
    saveVisitCounts()

    // console.log(
    //   `✅ Bookmark visited: ${url} (ID: ${bookmarkId}, Count: ${visitCounts[bookmarkId]})`,
    // )
  } else {
    // console.log(`❌ Not a bookmark: ${normalizedUrl}`)
    // Try to find similar bookmarks by domain
    const domain = normalizedUrl.split("/")[2] // Extract domain
    const similar = Object.keys(bookmarkUrlMap).filter((b) =>
      b.includes(domain),
    )
    if (similar.length > 0) {
      // console.log(`   🔍 Similar bookmarks found (same domain):`)
      // similar.forEach((b) => console.log(`      - ${b}`))
    }
  }
})

// Flexible bookmark matching function
function findMatchingBookmark(navigationUrl) {
  try {
    const navObj = new URL(navigationUrl)

    // Try matching strategies in order of specificity
    for (const [bookmarkUrl, bookmarkId] of Object.entries(bookmarkUrlMap)) {
      try {
        const bookObj = new URL(bookmarkUrl)

        // Strategy 1: Same hostname + bookmark path is prefix of nav path
        if (navObj.hostname === bookObj.hostname) {
          const navPath = navObj.pathname
          const bookPath = bookObj.pathname

          // Exact path match (after normalization)
          if (navPath === bookPath) {
            // console.log(`Flexible match (exact path): ${bookmarkUrl}`)
            return bookmarkId
          }

          // Bookmark path is prefix of navigation path (e.g., /mail/ matches /mail/u/0)
          if (navPath.startsWith(bookPath) && bookPath !== "/") {
            // console.log(` Flexible match (base path): ${bookmarkUrl}`)
            return bookmarkId
          }
        }
      } catch (e) {
        continue
      }
    }
  } catch (e) {
    // console.error("Error in flexible matching:", e)
  }

  return null
}

// Debounced save function
let saveTimer = null
function saveVisitCounts() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // console.log(" Saving visit counts to storage:", visitCounts)
    chrome.storage.local.set({ visitCounts }, () => {
      if (chrome.runtime.lastError) {
        // console.error("❌ Error saving visit counts:", chrome.runtime.lastError)
      } else {
        // console.log(" Visit counts saved successfully")
      }
    })
  }, 1000) // Save after 1 second of no activity
}

// Rebuild URL map when bookmarks change
chrome.bookmarks.onCreated.addListener(() => {
  buildBookmarkUrlMap()
})

chrome.bookmarks.onRemoved.addListener((id) => {
  // Remove visit count for deleted bookmark
  delete visitCounts[id]
  saveVisitCounts()
  buildBookmarkUrlMap()
})

chrome.bookmarks.onChanged.addListener(() => {
  buildBookmarkUrlMap()
})

chrome.bookmarks.onMoved.addListener(() => {
  buildBookmarkUrlMap()
})

// Message handler to get visit counts from popup/sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log("Background received message:", request.action)

  if (request.action === "getVisitCounts") {
    // console.log("Sending visit counts:", visitCounts)
    sendResponse({ visitCounts: visitCounts })
    return true
  } else if (request.action === "resetVisitCount") {
    const bookmarkId = request.bookmarkId
    if (bookmarkId) {
      visitCounts[bookmarkId] = 0
      saveVisitCounts()
      sendResponse({ success: true })
      return true
    }
  } else if (request.action === "resetAllVisitCounts") {
    visitCounts = {}
    chrome.storage.local.set({ visitCounts: {} }, () => {
      sendResponse({ success: true })
    })
    return true
  }
  return false
})

// ==================== Original Code ====================
// Function to handle duplicate bookmarks
const handleDuplicateBookmarks = (id, newBookmark) => {
  if (newBookmark.url) {
    chrome.bookmarks.search({ url: newBookmark.url }, (bookmarks) => {
      // Filter out the newly created bookmark and find duplicates
      const duplicates = bookmarks.filter((bookmark) => bookmark.id !== id)

      if (duplicates.length > 0) {
        // console.log(
        //   `Found ${duplicates.length} duplicate(s) for ${newBookmark.url}. Removing old ones.`,
        // )
        // Remove all duplicates, keeping the new one
        duplicates.forEach((duplicate) => {
          chrome.bookmarks.remove(duplicate.id, () => {
            // console.log(
            //   `Removed duplicate bookmark: ${duplicate.title} (ID: ${duplicate.id})`,
            // )
          })
        })
      }
    })
  }
}

// Add listener for when a new bookmark is created
chrome.bookmarks.onCreated.addListener(handleDuplicateBookmarks)

let popupWindowId = null

function createPopupWindow() {
  chrome.system.display.getInfo((displays) => {
    const display = displays[0]
    const screenWidth = display.workArea.width

    const popupWidth = 380
    const popupHeight = 680
    const padding = 20

    chrome.windows.create(
      {
        url: "index.html",
        type: "popup",
        width: popupWidth,
        height: popupHeight,
        left: screenWidth - popupWidth - padding,
        top: display.workArea.height - popupHeight - padding,
      },
      (window) => {
        popupWindowId = window.id
      },
    )
  })
}

function findExistingPopup(callback) {
  const popupUrl = chrome.runtime.getURL("index.html")

  chrome.windows.getAll({ populate: true }, (windows) => {
    for (const win of windows) {
      if (win.type !== "popup") continue

      const hasPopupTab = win.tabs?.some((tab) => tab.url === popupUrl)

      if (hasPopupTab) {
        return callback(win)
      }
    }
    callback(null)
  })
}

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(["quickOpenAction"], (result) => {
    // console.log("Quick Open Action retrieved:", result.quickOpenAction)
    const action = result.quickOpenAction || "popup" // Default to 'popup'

    if (action === "web") {
      const bookmarksUrl = chrome.runtime.getURL("bookmarks.html")
      chrome.tabs.query({ url: bookmarksUrl }, (tabs) => {
        if (tabs.length > 0) {
          // Tab already exists, activate it and focus its window
          chrome.tabs.update(tabs[0].id, { active: true })
          chrome.windows.update(tabs[0].windowId, { focused: true })
        } else {
          // No existing tab, create a new one
          chrome.tabs.create({ url: bookmarksUrl })
        }
      })
    } else if (action === "sidepanel") {
      chrome.sidePanel.open({ windowId: tab.windowId })
    } else {
      // popup
      findExistingPopup((existingWindow) => {
        if (existingWindow) {
          chrome.windows.update(existingWindow.id, { focused: true })
          popupWindowId = existingWindow.id
        } else {
          createPopupWindow()
        }
      })
    }
  })
})

// Listen for when a window is <closed></closed>
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null
  }
})

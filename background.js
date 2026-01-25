// background.js

// Function to handle duplicate bookmarks
const handleDuplicateBookmarks = (id, newBookmark) => {
  if (newBookmark.url) {
    chrome.bookmarks.search({ url: newBookmark.url }, (bookmarks) => {
      // Filter out the newly created bookmark and find duplicates
      const duplicates = bookmarks.filter((bookmark) => bookmark.id !== id)

      if (duplicates.length > 0) {
        console.log(
          `Found ${duplicates.length} duplicate(s) for ${newBookmark.url}. Removing old ones.`,
        )
        // Remove all duplicates, keeping the new one
        duplicates.forEach((duplicate) => {
          chrome.bookmarks.remove(duplicate.id, () => {
            console.log(
              `Removed duplicate bookmark: ${duplicate.title} (ID: ${duplicate.id})`,
            )
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
  chrome.windows.create(
    {
      url: "index.html",
      type: "popup",
      width: 380,
      height: 680,
    },
    (window) => {
      popupWindowId = window.id
    },
  )
}

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(["quickOpenAction"], (result) => {
    console.log("Quick Open Action retrieved:", result.quickOpenAction)
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
      // 'popup'
      if (popupWindowId !== null) {
        chrome.windows.get(popupWindowId, (window) => {
          if (chrome.runtime.lastError) {
            // Window was closed, create a new one.
            createPopupWindow()
          } else {
            // Window exists, just focus it.
            chrome.windows.update(popupWindowId, { focused: true })
          }
        })
      } else {
        createPopupWindow()
      }
    }
  })
})

// Listen for when a window is <closed></closed>
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null
  }
})

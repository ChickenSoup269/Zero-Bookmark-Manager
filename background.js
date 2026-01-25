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

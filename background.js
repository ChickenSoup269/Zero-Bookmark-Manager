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

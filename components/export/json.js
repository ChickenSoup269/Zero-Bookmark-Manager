// components/export/json.js
export async function exportToJSON(exportData) {
  try {
    const { bookmarkAccessCounts, bookmarkTags } =
      await chrome.storage.local.get(["bookmarkAccessCounts", "bookmarkTags"])
    const accessCounts = bookmarkAccessCounts || {}
    const allTags = bookmarkTags || {}

    // Deep copy to avoid mutating original data
    const treeCopy = JSON.parse(JSON.stringify(exportData))

    // Ensure treeCopy.bookmarks is an array before proceeding
    if (!treeCopy.bookmarks || !Array.isArray(treeCopy.bookmarks)) {
      throw new Error(
        "Invalid bookmark data: bookmarks property must be an array"
      )
    }

    function enrichNodes(nodes) {
      if (!Array.isArray(nodes)) {
        console.warn("enrichNodes: nodes is not an array", nodes)
        return
      }
      nodes.forEach((node) => {
        if (node.url) {
          node.tags = allTags[node.id] || []
          node.accessCount = accessCounts[node.id] || 0
        }
        if (node.children) {
          enrichNodes(node.children)
        }
      })
    }

    enrichNodes(treeCopy.bookmarks)

    const jsonString = JSON.stringify(treeCopy, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bookmarks_${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("JSON export failed:", error)
    throw error // Re-throw to be caught by caller
  }
}

export async function exportToJSON(exportData) {
  try {
    // 1. Lấy tất cả dữ liệu bổ sung từ Storage
    const {
      bookmarkAccessCounts,
      bookmarkTags,
      favoriteBookmarks,
      pinnedBookmarks,
    } = await chrome.storage.local.get([
      "bookmarkAccessCounts",
      "bookmarkTags",
      "favoriteBookmarks",
      "pinnedBookmarks",
    ])

    const accessCounts = bookmarkAccessCounts || {}
    const allTags = bookmarkTags || {}
    const favorites = favoriteBookmarks || {}
    const pins = pinnedBookmarks || {}

    // Deep copy để không làm ảnh hưởng đến dữ liệu gốc trong app
    const treeCopy = JSON.parse(JSON.stringify(exportData))

    if (!treeCopy.bookmarks || !Array.isArray(treeCopy.bookmarks)) {
      throw new Error("Invalid bookmark data")
    }

    // 2. Hàm làm giàu dữ liệu (Enrich Nodes)
    function enrichNodes(nodes) {
      if (!Array.isArray(nodes)) return
      nodes.forEach((node) => {
        if (node.url) {
          // Gắn thêm các thuộc tính đặc trưng của App vào JSON
          node.tags = allTags[node.id] || []
          node.accessCount = accessCounts[node.id] || 0
          node.isFavorite = !!favorites[node.id] // Chuyển thành boolean true/false
          node.isPinned = !!pins[node.id]
        }
        if (node.children) {
          enrichNodes(node.children)
        }
      })
    }

    enrichNodes(treeCopy.bookmarks)

    // 3. Tiến hành xuất file
    const jsonString = JSON.stringify(treeCopy, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bookmarks_full_${
      new Date().toISOString().split("T")[0]
    }.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log("✅ Exported JSON with Favorites & Pins status")
  } catch (error) {
    console.error("JSON export failed:", error)
    throw error
  }
}

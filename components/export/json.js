export async function exportToJSON(exportData) {
  try {
    // 1. Lấy tất cả dữ liệu bổ sung từ Storage
    const {
      bookmarkAccessCounts,
      bookmarkTags,
      favoriteBookmarks,
      pinnedBookmarks,
      tagColors,
      tagTextColors,
    } = await chrome.storage.local.get([
      "bookmarkAccessCounts",
      "bookmarkTags",
      "favoriteBookmarks",
      "pinnedBookmarks",
      "tagColors",
      "tagTextColors",
    ])

    const accessCounts = bookmarkAccessCounts || {}
    const allTags = bookmarkTags || {}
    const favorites = favoriteBookmarks || {}
    const pins = pinnedBookmarks || {}
    const allTagColors = tagColors || {}
    const allTagTextColors = tagTextColors || {}

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
          const tagsForBookmark = allTags[node.id] || []
          // Chuyển đổi tags từ string[] thành object[] với đầy đủ thông tin màu sắc
          node.tags = tagsForBookmark.map((tagName) => ({
            name: tagName,
            bgColor: allTagColors[tagName] || "#FFFFFF", // Default màu nền
            textColor: allTagTextColors[tagName] || "#000000", // Default màu chữ
          }))
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

    // Bổ sung thông tin màu sắc vào gốc của file JSON
    const exportPayload = {
      ...treeCopy,
      theme: {
        tagColors: allTagColors,
        tagTextColors: allTagTextColors,
      },
    }

    // 3. Tiến hành xuất file
    const jsonString = JSON.stringify(exportPayload, null, 2)
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

    console.log(
      "✅ Exported JSON with full tag details, Favorites & Pins status"
    )
  } catch (error) {
    console.error("JSON export failed:", error)
    throw error
  }
}

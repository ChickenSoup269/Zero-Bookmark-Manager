import { flattenBookmarks } from "../bookmarks.js"

export async function exportToCSV(
  bookmarkTreeNodes,
  includeCreationDates,
  includeFolderModDates
) {
  const allBookmarks = flattenBookmarks(bookmarkTreeNodes).filter((b) => b.url)

  function findNodeById(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  function getFolderPathCSV(nodes, nodeId, path = []) {
    const node = findNodeById(nodes, nodeId)
    if (!node) return path.join("/")

    if (node.title) path.unshift(node.title)

    if (node.parentId) {
      return getFolderPathCSV(nodes, node.parentId, path)
    }

    return path.join("/")
  }

  let csvContent = "Title,URL,Date Added,Date Group Modified,Folder Path\n"

  allBookmarks.forEach((bookmark) => {
    const folderPath = getFolderPathCSV(
      bookmarkTreeNodes,
      bookmark.id || bookmark.parentId
    )
    const title = `"${(bookmark.title || "").replace(/"/g, '""')}"`
    const url = `"${(bookmark.url || "").replace(/"/g, '""')}"`
    const dateAdded =
      includeCreationDates && bookmark.dateAdded
        ? `"${new Date(bookmark.dateAdded).toLocaleString()}"`
        : ""
    const dateModified =
      includeFolderModDates && bookmark.dateGroupModified
        ? `"${new Date(bookmark.dateGroupModified).toLocaleString()}"`
        : ""

    csvContent += `${title},${url},${dateAdded},${dateModified},"${folderPath}"\n`
  })

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `bookmarks_${new Date().toISOString().split("T")[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// components/export/csv.js
import { flattenBookmarks } from "../bookmarks.js"
import { uiState } from "../state.js"

export async function exportToCSV(
  bookmarkTreeNodes,
  includeCreationDates,
  includeFolderModDates,
  includeIconData,
  includeFolderPath,
  exportOnlySelected,
) {
  try {
    // Get visit counts from background script and tags from storage
    let visitCounts = {}
    try {
      visitCounts = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getVisitCounts" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Error getting visit counts:",
              chrome.runtime.lastError,
            )
            resolve({})
          } else {
            resolve(response?.visitCounts || {})
          }
        })
        // Timeout fallback
        setTimeout(() => resolve({}), 2000)
      })
    } catch (err) {
      console.warn("Failed to get visit counts, using empty object:", err)
      visitCounts = {}
    }

    const { bookmarkTags } = await chrome.storage.local.get(["bookmarkTags"])
    const allTags = bookmarkTags || {}

    if (!Array.isArray(bookmarkTreeNodes)) {
      throw new Error("Invalid bookmarkTreeNodes: must be an array")
    }

    const flatBookmarks = flattenBookmarks(bookmarkTreeNodes).filter(
      (b) => b.url,
    )

    let allBookmarks = flatBookmarks

    // Nếu bật exportOnlySelected và có bookmark đang được check trong UI,
    // chỉ export những bookmark đó.
    if (exportOnlySelected && uiState.selectedBookmarks?.size > 0) {
      const selectedIds = new Set(uiState.selectedBookmarks)
      allBookmarks = flatBookmarks.filter((b) => selectedIds.has(b.id))
    }

    // Function to fetch Base64 favicon
    async function getFaviconBase64(url) {
      if (!url) return ""
      try {
        const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
          url,
        )}`
        const response = await fetch(faviconUrl)
        if (!response.ok) return ""
        const blob = await response.blob()
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        console.warn(`Failed to fetch favicon for ${url}:`, error)
        return ""
      }
    }

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
      if (!nodeId || nodeId === "0") return path.join("/")

      const node = findNodeById(nodes, nodeId)
      if (!node) return path.join("/")

      if (node.title && node.title.trim() !== "") path.unshift(node.title)

      return getFolderPathCSV(nodes, node.parentId, path)
    }

    // Dynamically build header based on selected options
    const headers = ["Title", "URL"]
    if (includeCreationDates) headers.push("Date Added")
    if (includeFolderModDates) headers.push("Date Group Modified")
    if (includeFolderPath) headers.push("Folder Path")
    headers.push("Tags", "Access Count")
    if (includeIconData) headers.push("Icon Data")

    let csvContent = headers.join(",") + "\n"

    for (const bookmark of allBookmarks) {
      const row = []
      row.push(`"${(bookmark.title || "").replace(/"/g, '""')}"`)
      row.push(`"${(bookmark.url || "").replace(/"/g, '""')}"`)
      if (includeCreationDates) {
        row.push(
          bookmark.dateAdded
            ? `"${new Date(bookmark.dateAdded).toLocaleString()}"`
            : '""',
        )
      }
      if (includeFolderModDates) {
        row.push(
          bookmark.dateGroupModified
            ? `"${new Date(bookmark.dateGroupModified).toLocaleString()}"`
            : '""',
        )
      }
      if (includeFolderPath) {
        const folderPath = getFolderPathCSV(
          bookmarkTreeNodes,
          bookmark.parentId,
        )
        row.push(`"${folderPath.replace(/"/g, '""')}"`)
      }
      const tags = allTags[bookmark.id] || []
      const escapedTagsJoin = tags
        .map((tag) => tag.replace(/"/g, '""'))
        .join(", ")
      row.push(`"${escapedTagsJoin}"`)
      row.push(visitCounts[bookmark.id] || 0)
      if (includeIconData) {
        const faviconBase64 = await getFaviconBase64(bookmark.url)
        row.push(`"${faviconBase64.replace(/"/g, '""')}"`)
      }

      csvContent += row.join(",") + "\n"
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bookmarks_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("CSV export failed:", error)
    throw error
  }
}

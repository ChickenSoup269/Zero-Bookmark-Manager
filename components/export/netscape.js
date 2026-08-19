
function escapeHtml(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildNetscapeBookmarks(bookmarkNodes, tagsMap = {}, notesMap = {}, indent = "  ") {
  let html = ""
  for (const node of bookmarkNodes) {
    if (node.children) {
      // This is a folder
      html += `${indent}<DT><H3 ADD_DATE="${Math.round(
        (node.dateAdded || Date.now()) / 1000,
      )}"${
        node.dateGroupModified
          ? ` LAST_MODIFIED="${Math.round(node.dateGroupModified / 1000)}"`
          : ""
      }>${escapeHtml(node.title)}</H3>\n`
      html += `${indent}<DL><p>\n`
      html += buildNetscapeBookmarks(node.children, tagsMap, notesMap, indent + "  ")
      html += `${indent}</DL><p>\n`
    } else if (node.url) {
      // This is a bookmark
      const tags = tagsMap[node.id] || []
      const tagsAttr = tags.length > 0 ? ` TAGS="${escapeHtml(tags.join(","))}"` : ""
      html += `${indent}<DT><A HREF="${escapeHtml(node.url)}" ADD_DATE="${Math.round(
        (node.dateAdded || Date.now()) / 1000,
      )}"${tagsAttr}>${escapeHtml(node.title || node.url)}</A>\n`

      const note = notesMap[node.id] || node.note || node.notes || ""
      if (note) {
        html += `${indent}<DD>${escapeHtml(note)}\n`
      }
    }
  }
  return html
}

export async function exportToNetscape(bookmarkTreeNodes) {
  try {
    const { bookmarkTags, bookmarkNotes } = await chrome.storage.local.get([
      "bookmarkTags",
      "bookmarkNotes",
    ])
    const tagsMap = bookmarkTags || {}
    const notesMap = bookmarkNotes || {}

    let content = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`

    // The top-level nodes from window.BookmarkCache.getTree() are inside a root folder.
    // We need to process the children of the "Bookmarks Bar" and "Other Bookmarks".
    if (
      bookmarkTreeNodes &&
      bookmarkTreeNodes[0] &&
      bookmarkTreeNodes[0].children
    ) {
      content += buildNetscapeBookmarks(
        bookmarkTreeNodes[0].children,
        tagsMap,
        notesMap,
      )
    }

    content += `</DL><p>\n`

    const blob = new Blob([content], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "bookmarks.html"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Failed to export to Netscape HTML:", error)
    throw error
  }
}

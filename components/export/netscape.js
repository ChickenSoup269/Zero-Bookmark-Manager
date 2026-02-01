
function buildNetscapeBookmarks(bookmarkNodes, indent = "  ") {
  let html = ""
  for (const node of bookmarkNodes) {
    if (node.children) {
      // This is a folder
      html += `${indent}<DT><H3 ADD_DATE="${Math.round(
        (node.dateAdded || Date.now()) / 1000
      )}"${ 
        node.dateGroupModified
          ? ` LAST_MODIFIED="${Math.round(node.dateGroupModified / 1000)}"`
          : ""
      }>${node.title}</H3>\n`
      html += `${indent}<DL><p>\n`
      html += buildNetscapeBookmarks(node.children, indent + "  ")
      html += `${indent}</DL><p>\n`
    } else if (node.url) {
      // This is a bookmark
      html += `${indent}<DT><A HREF="${node.url}" ADD_DATE="${Math.round(
        (node.dateAdded || Date.now()) / 1000
      )}">${node.title}</A>\n`
    }
  }
  return html
}

export function exportToNetscape(bookmarkTreeNodes) {
  return new Promise((resolve, reject) => {
    try {
      let content = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`

      // The top-level nodes from chrome.bookmarks.getTree() are inside a root folder.
      // We need to process the children of the "Bookmarks Bar" and "Other Bookmarks".
      if (bookmarkTreeNodes && bookmarkTreeNodes[0] && bookmarkTreeNodes[0].children) {
        content += buildNetscapeBookmarks(bookmarkTreeNodes[0].children)
      }
      
      content += `</DL><p>\n`

      const blob = new Blob([content], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "bookmarks.html"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      resolve()
    } catch (error) {
      console.error("Failed to export to Netscape HTML:", error)
      reject(error)
    }
  })
}

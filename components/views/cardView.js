// views/cardView.js
import { createBookmarkComponent } from "../components/bookmarkItem.js"
import { sortBookmarks, isInFolder } from "../utils/bookmarks.js" // Giả sử đã tách utils

export function renderCardView(treeNodes, filteredBookmarks, elements) {
  const fragment = document.createDocumentFragment()
  elements.folderListDiv.classList.add("card-view")

  const folders = getFolders(treeNodes) // Helper lấy danh sách folder

  // 1. Render các Folder Cards
  folders.forEach((folder) => {
    if (folder.id === "0") return

    const folderCard = createFolderCard(folder, filteredBookmarks)
    fragment.appendChild(folderCard)
  })

  elements.folderListDiv.appendChild(fragment)
}

function createFolderCard(folder, allBookmarks) {
  const card = document.createElement("div")
  card.className = "folder-card"
  // ... Render HTML header folder ...

  // Render bookmarks bên trong folder này
  const folderBookmarks = allBookmarks.filter((b) => isInFolder(b, folder.id))
  const container = document.createElement("div")
  container.className = "bookmarks-container"

  folderBookmarks.forEach((b) => {
    // SỬ DỤNG COMPONENT CHUNG
    const bookmarkEl = createBookmarkComponent(b, "card")
    container.appendChild(bookmarkEl)
  })

  card.appendChild(container)

  // Gắn event drag-and-drop cho Folder
  attachFolderDragEvents(card, folder.id)

  return card
}

function attachFolderDragEvents(card, folderId) {
  // Chuyển toàn bộ logic dragover, drop, dragenter của folder vào đây
  // giúp file chính sạch sẽ hơn.
  card.addEventListener("drop", (e) => {
    // Logic xử lý drop
  })
}

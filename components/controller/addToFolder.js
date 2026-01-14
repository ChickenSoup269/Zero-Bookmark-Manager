import { translations, showCustomPopup } from "../utils/utils.js"
import { moveBookmarksToFolder } from "../bookmarks.js"
import { saveUIState, selectedBookmarks } from "../state.js"
import { renderFilteredBookmarks } from "../ui.js"

export function openAddToFolderPopup(elements, bookmarkIds, onSuccess) {
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en

  // 1. Reset select và hiện trạng thái loading
  elements.addToFolderSelect.innerHTML = `<option value="">${
    t.loading || "Loading folders..."
  }</option>`
  elements.addToFolderPopup.classList.remove("hidden")

  // Áp dụng theme
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light"
  const allThemes = ["light", "dark", "dracula", "onedark", "tet"]
  allThemes.forEach((theme) =>
    elements.addToFolderPopup.classList.remove(`${theme}-theme`)
  )
  elements.addToFolderPopup.classList.add(`${currentTheme}-theme`)

  // 2. Hàm đệ quy tạo Tree View (Logic tạo dấu └─ nằm ở đây)
  function buildOptions(nodes, depth = 0) {
    // Chỉ lấy folder và sắp xếp theo tên
    const folders = nodes
      .filter((node) => node.children)
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))

    folders.forEach((node) => {
      // Bỏ qua thư mục gốc (0)
      if (node.id === "0") {
        if (node.children.length > 0) buildOptions(node.children, depth)
        return
      }

      const option = document.createElement("option")
      option.value = node.id

      // Xử lý tên hiển thị
      let displayName = node.title || "Unnamed Folder"
      if (node.id === "1") displayName = t.bookmarksBar || "Bookmarks Bar"
      else if (node.id === "2")
        displayName = t.otherBookmarks || "Other Bookmarks"

      // --- TẠO THỤT ĐẦU DÒNG ---
      // depth 0: Bookmarks Bar
      // depth 1:   └─ Folder A
      const prefix = depth > 0 ? "\u00A0\u00A0".repeat(depth) + "└─ " : ""

      option.textContent = `${prefix}${displayName}`
      elements.addToFolderSelect.appendChild(option)

      // Đệ quy cho con
      if (node.children.length > 0) {
        buildOptions(node.children, depth + 1)
      }
    })
  }

  // 3. GỌI TRỰC TIẾP API ĐỂ LẤY CÂY MỚI NHẤT
  chrome.bookmarks.getTree((tree) => {
    // Xóa loading, thêm option mặc định
    elements.addToFolderSelect.innerHTML = `<option value="">${
      t.selectFolder || "Select Folder"
    }</option>`

    if (tree && tree.length > 0) {
      buildOptions(tree[0].children, 0)
    }
    // Focus sau khi load xong
    elements.addToFolderSelect.focus()
  })

  // 4. Xử lý các Listener (Clone button để xóa event cũ)

  // Clone nút Save
  const newSaveBtn = elements.addToFolderSaveButton.cloneNode(true)
  elements.addToFolderSaveButton.parentNode.replaceChild(
    newSaveBtn,
    elements.addToFolderSaveButton
  )
  elements.addToFolderSaveButton = newSaveBtn

  // Clone nút Cancel
  const newCancelBtn = elements.addToFolderCancelButton.cloneNode(true)
  elements.addToFolderCancelButton.parentNode.replaceChild(
    newCancelBtn,
    elements.addToFolderCancelButton
  )
  elements.addToFolderCancelButton = newCancelBtn

  elements.addToFolderSaveButton.addEventListener("click", handleSave)
  elements.addToFolderCancelButton.addEventListener("click", handleCancel)

  // Phím tắt
  const handleKeydown = (e) => {
    if (e.key === "Escape") handleCancel()
    if (e.key === "Enter") handleSave()
  }
  elements.addToFolderSelect.removeEventListener("keydown", handleKeydown)
  elements.addToFolderSelect.addEventListener("keydown", handleKeydown)

  // Click ra ngoài để đóng
  const handleClickOutside = (e) => {
    if (e.target === elements.addToFolderPopup) handleCancel()
  }
  elements.addToFolderPopup.removeEventListener("click", handleClickOutside)
  elements.addToFolderPopup.addEventListener("click", handleClickOutside)

  // --- HANDLERS ---
  function handleSave() {
    const targetFolderId = elements.addToFolderSelect.value
    if (!targetFolderId) {
      elements.addToFolderSelect.classList.add("error")
      showCustomPopup(
        t.selectFolderError || "Please select a folder.",
        "error",
        false
      )
      elements.addToFolderSelect.focus()
      return
    }

    if (!bookmarkIds || bookmarkIds.length === 0) {
      showCustomPopup(t.noBookmarksSelected, "error", false)
      handleCancel()
      return
    }

    moveBookmarksToFolder(bookmarkIds, targetFolderId, elements, () => {
      // Đóng popup
      handleCancel()

      // Clear trạng thái chọn
      selectedBookmarks.clear()
      if (elements.addToFolderButton)
        elements.addToFolderButton.classList.add("hidden")
      if (elements.deleteBookmarksButton)
        elements.deleteBookmarksButton.classList.add("hidden")

      // Thông báo thành công
      showCustomPopup(
        t.addToFolderSuccess || "Moved successfully!",
        "success",
        false
      )
      saveUIState()

      // QUAN TRỌNG: Cập nhật lại giao diện chính (reload list bookmark)
      chrome.bookmarks.getTree((tree) => {
        renderFilteredBookmarks(tree, elements)
      })

      if (onSuccess && typeof onSuccess === "function") {
        onSuccess()
      }
    })
  }

  function handleCancel() {
    elements.addToFolderPopup.classList.add("hidden")
    elements.addToFolderSelect.classList.remove("error")
    // Cleanup events
    elements.addToFolderSelect.removeEventListener("keydown", handleKeydown)
    elements.addToFolderPopup.removeEventListener("click", handleClickOutside)
  }
}

export function setupAddToFolderListeners(elements) {
  if (elements.addToFolderButton) {
    // Clone nút mở popup ở sidebar để xóa event cũ
    const newBtn = elements.addToFolderButton.cloneNode(true)
    elements.addToFolderButton.parentNode.replaceChild(
      newBtn,
      elements.addToFolderButton
    )
    elements.addToFolderButton = newBtn

    elements.addToFolderButton.addEventListener("click", () => {
      if (selectedBookmarks.size > 0) {
        openAddToFolderPopup(elements, Array.from(selectedBookmarks))
      } else {
        const language = localStorage.getItem("appLanguage") || "en"
        showCustomPopup(
          translations[language].noBookmarksSelected,
          "error",
          false
        )
      }
    })
  } else {
    console.error("addToFolderButton not found in elements!")
  }
}

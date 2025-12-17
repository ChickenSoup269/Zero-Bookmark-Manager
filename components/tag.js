// components/tag.js
import { renderFilteredBookmarks } from "./ui.js"
import { uiState } from "./state.js"
import { showCustomPopup, translations } from "./utils/utils.js"

export let tagColors = {}

// --- INTERNAL HELPERS ---

// Helper để lấy các DOM elements cần thiết cho việc render lại
function getUIElements() {
  return {
    tagFilterContainer: document.getElementById("tag-filter-container"),
    folderListDiv: document.getElementById("folder-list"),
    // Thêm các elements khác nếu hàm renderFilteredBookmarks cần
    searchInput: document.getElementById("search-input"),
    folderFilter: document.getElementById("folder-filter"),
    sortFilter: document.getElementById("sort-filter"),
    bookmarkCountDiv: document.getElementById("bookmark-count"),
  }
}

// Helper để trigger render lại giao diện sau khi thay đổi data
function refreshUI() {
  chrome.bookmarks.getTree((tree) => {
    const elements = getUIElements()
    // Gọi hàm render từ ui.js (hoặc view.js tùy cấu trúc của bạn)
    renderFilteredBookmarks(tree, elements)
  })
}

// Wrapper Promise cho chrome.storage.local.get
function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data))
  })
}

// --- MAIN FUNCTIONS ---

// Load saved tags and colors from storage
export async function loadTags() {
  const data = await getStorage(["bookmarkTags", "tagColors", "tagTextColors"])
  if (data.tagColors) {
    tagColors = { ...tagColors, ...data.tagColors }
  }
  // Cập nhật uiState nếu cần thiết để đồng bộ
  if (data.bookmarkTags) {
    uiState.bookmarkTags = data.bookmarkTags
  }
  if (data.tagTextColors) {
    uiState.tagTextColors = data.tagTextColors
  }
}

// Save tags and colors to storage
export function saveTags(bookmarkTags, updatedTagColors = null) {
  const dataToSave = {}

  if (bookmarkTags) {
    dataToSave.bookmarkTags = bookmarkTags
    // Cập nhật luôn uiState để UI phản hồi ngay lập tức
    uiState.bookmarkTags = bookmarkTags
  }

  if (updatedTagColors) {
    tagColors = { ...tagColors, ...updatedTagColors }
    dataToSave.tagColors = tagColors
    // Cập nhật uiState tagColors (nếu có trong uiState)
    uiState.tagColors = tagColors
  }

  chrome.storage.local.set(dataToSave)
}

// Add tag to bookmark
export async function addTagToBookmark(bookmarkId, tag, color) {
  const data = await getStorage("bookmarkTags")
  const bookmarkTags = data.bookmarkTags || {}

  if (!bookmarkTags[bookmarkId]) {
    bookmarkTags[bookmarkId] = []
  }

  // Check limit (10 tags)
  if (bookmarkTags[bookmarkId].length >= 10) {
    const language = localStorage.getItem("appLanguage") || "en"
    const t = translations[language] || translations.en
    showCustomPopup(
      t.tagLimitError || "Cannot add more than 10 tags per bookmark",
      "error",
      true
    )
    return
  }

  if (!bookmarkTags[bookmarkId].includes(tag)) {
    bookmarkTags[bookmarkId].push(tag)
    saveTags(bookmarkTags, { [tag]: color })
    refreshUI()
  }
}

// Remove tag from bookmark
export async function removeTagFromBookmark(bookmarkId, tag) {
  const data = await getStorage("bookmarkTags")
  const bookmarkTags = data.bookmarkTags || {}

  if (bookmarkTags[bookmarkId]) {
    bookmarkTags[bookmarkId] = bookmarkTags[bookmarkId].filter((t) => t !== tag)

    // Nếu bookmark không còn tag nào, xóa key đó đi cho gọn storage
    if (bookmarkTags[bookmarkId].length === 0) {
      delete bookmarkTags[bookmarkId]
    }

    saveTags(bookmarkTags)
    refreshUI()
  }
}

// Change color of a tag
export function changeTagColor(tag, color) {
  const updatedColors = { [tag]: color }
  saveTags(null, updatedColors)
  refreshUI()
}

// === TÍNH NĂNG MỚI: ĐỔI TÊN TAG (EDIT TAG) ===
export async function renameTagGlobal(oldTag, newTag) {
  if (!oldTag || !newTag || oldTag === newTag) return

  // 1. Lấy dữ liệu hiện tại
  const data = await getStorage(["bookmarkTags", "tagColors"])
  let bookmarkTags = data.bookmarkTags || {}
  let storedColors = data.tagColors || {}

  // 2. Duyệt qua tất cả bookmark để đổi tên tag
  let hasChanges = false
  for (const bookmarkId in bookmarkTags) {
    if (bookmarkTags[bookmarkId].includes(oldTag)) {
      // Xóa tag cũ
      const filtered = bookmarkTags[bookmarkId].filter((t) => t !== oldTag)

      // Thêm tag mới (kiểm tra để tránh trùng lặp nếu bookmark đó đã có tag mới rồi)
      if (!filtered.includes(newTag)) {
        filtered.push(newTag)
      }

      bookmarkTags[bookmarkId] = filtered
      hasChanges = true
    }
  }

  // 3. Cập nhật màu sắc: Chuyển màu từ tag cũ sang tag mới
  if (storedColors[oldTag]) {
    storedColors[newTag] = storedColors[oldTag]
    delete storedColors[oldTag]
    // Cập nhật biến local export
    tagColors = storedColors
  }

  // 4. Lưu và Render lại nếu có thay đổi
  if (hasChanges || storedColors[newTag]) {
    saveTags(bookmarkTags, storedColors)

    // Cập nhật selectedTags trong uiState nếu người dùng đang lọc theo tag cũ
    if (uiState.selectedTags && uiState.selectedTags.includes(oldTag)) {
      uiState.selectedTags = uiState.selectedTags.map((t) =>
        t === oldTag ? newTag : t
      )
    }

    refreshUI()

    const language = localStorage.getItem("appLanguage") || "en"
    const t = translations[language] || translations.en
    showCustomPopup(t.successTitle || "Success", "success", true)
  }
}

// === TÍNH NĂNG BỔ SUNG: XÓA TAG TOÀN CỤC ===
export async function deleteTagGlobal(tagToDelete) {
  const data = await getStorage(["bookmarkTags", "tagColors"])
  let bookmarkTags = data.bookmarkTags || {}
  let storedColors = data.tagColors || {}

  // Xóa tag khỏi tất cả bookmark
  for (const bookmarkId in bookmarkTags) {
    if (bookmarkTags[bookmarkId].includes(tagToDelete)) {
      bookmarkTags[bookmarkId] = bookmarkTags[bookmarkId].filter(
        (t) => t !== tagToDelete
      )
      if (bookmarkTags[bookmarkId].length === 0) {
        delete bookmarkTags[bookmarkId]
      }
    }
  }

  // Xóa màu
  if (storedColors[tagToDelete]) {
    delete storedColors[tagToDelete]
    tagColors = storedColors
  }

  // Xóa khỏi bộ lọc đang chọn
  if (uiState.selectedTags) {
    uiState.selectedTags = uiState.selectedTags.filter((t) => t !== tagToDelete)
  }

  saveTags(bookmarkTags, storedColors) // Save colors object directly, pass null handled inside logic if needed, but here we pass full object logic
  // Fix logic saveTags for direct object pass:
  chrome.storage.local.set({ tagColors: storedColors })

  refreshUI()
}

// Get tags for a bookmark
export async function getTagsForBookmark(bookmarkId) {
  const data = await getStorage("bookmarkTags")
  const bookmarkTags = data.bookmarkTags || {}
  return bookmarkTags[bookmarkId] || []
}

// Get All Unique Tags
export async function getAllTags() {
  const data = await getStorage("bookmarkTags")
  const bookmarkTags = data.bookmarkTags || {}
  const allTags = new Set()

  Object.values(bookmarkTags).forEach((tags) =>
    tags.forEach((t) => allTags.add(t))
  )

  return Array.from(allTags).sort() // Sort alphabet cho đẹp
}

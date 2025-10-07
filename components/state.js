// components/state.js

export const uiState = {
  bookmarkTree: [],
  bookmarks: [],
  folders: [],
  selectedFolderId: "",
  selectedTag: "",
  searchQuery: "",
  sortType: "default",
  viewMode: "flat",
  selectedBookmarks: new Set(),
  currentBookmarkId: null,
  showBookmarkIds: false,
  checkboxesVisible: false,
  bookmarkTags: {},
  tagColors: {},
  collapsedFolders: new Set(),
  selectedTag: "", // Giữ lại để tương thích ngược
  selectedTags: [], // Thêm để lưu nhiều tag
}

export const selectedBookmarks = uiState.selectedBookmarks

export function setBookmarks(bookmarks) {
  uiState.bookmarks = bookmarks
}

export function setFolders(folders) {
  uiState.folders = folders
}

export function setBookmarkTree(bookmarkTree) {
  uiState.bookmarkTree = bookmarkTree
}

export function setCurrentBookmarkId(id) {
  uiState.currentBookmarkId = id
}

export function setBookmarkTags(bookmarkTags) {
  uiState.bookmarkTags = { ...bookmarkTags }
}

export function setTagColors(tagColors) {
  uiState.tagColors = { ...uiState.tagColors, ...tagColors }
}

export function setSelectedTag(tag) {
  uiState.selectedTag = tag // Giữ lại để tương thích ngược
  uiState.selectedTags = tag ? [tag] : [] // Đồng bộ với selectedTags
}
export function setSelectedTags(tags) {
  uiState.selectedTags = tags
  uiState.selectedTag = tags.length === 1 ? tags[0] : "" // Cập nhật selectedTag
}

export function saveUIState() {
  const state = {
    uiState: {
      searchQuery: uiState.searchQuery,
      selectedFolderId: uiState.selectedFolderId,
      sortType: uiState.sortType,
      viewMode: uiState.viewMode,
      collapsedFolders: Array.from(uiState.collapsedFolders),
      selectedTag: uiState.selectedTag,
    },
    checkboxesVisible: uiState.checkboxesVisible,
    bookmarkTags: uiState.bookmarkTags,
    tagColors: uiState.tagColors,
  }
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError)
    } else {
      console.log("UI state saved:", state)
    }
  })
}

export function loadUIState(callback) {
  chrome.storage.local.get(
    ["uiState", "checkboxesVisible", "bookmarkTags", "tagColors"],
    (result) => {
      if (result.uiState) {
        uiState.searchQuery = result.uiState.searchQuery || ""
        uiState.selectedFolderId = result.uiState.selectedFolderId || ""
        uiState.sortType = result.uiState.sortType || "default"
        uiState.viewMode = result.uiState.viewMode || "flat"
        uiState.collapsedFolders = new Set(
          result.uiState.collapsedFolders || []
        )
        uiState.selectedTag = result.uiState.selectedTag || ""
      }
      uiState.checkboxesVisible = result.checkboxesVisible || false
      uiState.bookmarkTags = result.bookmarkTags || {}
      uiState.tagColors = result.tagColors || {}
      console.log("UI state loaded:", result)
      if (callback) callback()
    }
  )
}

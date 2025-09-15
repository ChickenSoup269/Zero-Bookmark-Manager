// ./components/state.js
export const uiState = {
  bookmarks: [],
  bookmarkTree: [],
  folders: [],
  searchQuery: "",
  selectedFolderId: "",
  sortType: "default",
  checkboxesVisible: false,
  currentBookmarkId: null,
  viewMode: "flat",
  selectedBookmarks: new Set(),
  collapsedFolders: new Set(), // Thêm để theo dõi thư mục thu gọn
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

export function saveUIState() {
  const state = {
    uiState: {
      searchQuery: uiState.searchQuery,
      selectedFolderId: uiState.selectedFolderId,
      sortType: uiState.sortType,
      viewMode: uiState.viewMode,
      collapsedFolders: Array.from(uiState.collapsedFolders), // Chuyển Set thành Array để lưu
    },
    checkboxesVisible: uiState.checkboxesVisible,
  }
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError)
    }
  })
}

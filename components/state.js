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
  selectedBookmarks: new Set(),
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
    },
    checkboxesVisible: uiState.checkboxesVisible,
  }
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError)
    }
  })
}

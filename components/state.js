// components/state.js
export const uiState = {
  bookmarks: [],
  bookmarkTree: [],
  folders: [],
  searchQuery: "",
  selectedFolderId: "",
  sortType: "default",
  checkboxesVisible: false,
  currentBookmarkId: null,
  viewMode: "flat", // flat | tree
  selectedBookmarks: new Set(),
  collapsedFolders: new Set(),
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
      collapsedFolders: Array.from(uiState.collapsedFolders),
    },
    checkboxesVisible: uiState.checkboxesVisible,
  }
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError)
    }
  })
}

export function loadUIState(callback) {
  chrome.storage.local.get(["uiState", "checkboxesVisible"], (result) => {
    if (result.uiState) {
      uiState.searchQuery = result.uiState.searchQuery || ""
      uiState.selectedFolderId = result.uiState.selectedFolderId || ""
      uiState.sortType = result.uiState.sortType || "default"
      uiState.viewMode = result.uiState.viewMode || "flat"
      uiState.collapsedFolders = new Set(result.uiState.collapsedFolders || [])
    }
    uiState.checkboxesVisible = result.checkboxesVisible || false

    if (callback) callback()
  })
}

// components/state.js
export const uiState = {
  bookmarkTree: [],
  bookmarks: [],
  folders: [],
  selectedFolderId: "",
  searchQuery: "",
  sortType: "default",
  viewMode: "flat",
  selectedBookmarks: new Set(),
  currentBookmarkId: null,
  showBookmarkIds: false,
  checkboxesVisible: false,
  bookmarkTags: {},
  tagColors: {},
  tagTextColors: {},
  collapsedFolders: new Set(),
  selectedTags: [],
  healthFilter: "all", // "all", "dead", "suspicious", "safe"
  healthStatus: {},
  visitCounts: {}, // { bookmarkId: count }
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

export function setSelectedTags(tags) {
  uiState.selectedTags = [...tags]
}

export function setVisitCounts(visitCounts) {
  uiState.visitCounts = { ...visitCounts }
}

export function saveUIState() {
  const state = {
    uiState: {
      searchQuery: uiState.searchQuery,
      selectedFolderId: uiState.selectedFolderId,
      sortType: uiState.sortType,
      viewMode: uiState.viewMode,
      collapsedFolders: Array.from(uiState.collapsedFolders),
      selectedTags: uiState.selectedTags,
    },
    checkboxesVisible: uiState.checkboxesVisible,
    bookmarkTags: uiState.bookmarkTags,
    tagColors: uiState.tagColors,
    tagTextColors: uiState.tagTextColors,
  }
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving UI state:", chrome.runtime.lastError)
    } else {
    }
  })
}

export function loadUIState(callback) {
  chrome.storage.local.get(
    [
      "uiState",
      "checkboxesVisible",
      "bookmarkTags",
      "tagColors",
      "tagTextColors",
    ],
    (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading UI state:", chrome.runtime.lastError)
      } else {
      }
      if (result.uiState) {
        uiState.searchQuery = result.uiState.searchQuery || ""
        uiState.selectedFolderId = result.uiState.selectedFolderId || ""
        uiState.sortType = result.uiState.sortType || "default"
        uiState.viewMode = result.uiState.viewMode || "flat"
        uiState.collapsedFolders = new Set(
          result.uiState.collapsedFolders || [],
        )
        uiState.selectedTags = result.uiState.selectedTags || []
      }
      uiState.checkboxesVisible = result.checkboxesVisible || false
      uiState.bookmarkTags = result.bookmarkTags || {}
      uiState.tagColors = result.tagColors || {}
      uiState.tagTextColors = result.tagTextColors || {}

      if (callback) callback()
    },
  )
}

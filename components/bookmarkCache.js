// components/bookmarkCache.js

/**
 * Lớp quản lý bộ nhớ đệm (cache) cho Bookmark.
 * Giúp giảm tải việc gọi chrome.bookmarks.getTree() liên tục, tăng tốc độ cho người dùng có nhiều bookmark.
 */
class BookmarkCache {
  static cachedTree = null;
  static isFetching = false;
  static fetchPromises = [];

  static getTree(callback) {
    if (this.cachedTree) {
      const clone = typeof structuredClone === "function" 
        ? structuredClone(this.cachedTree) 
        : JSON.parse(JSON.stringify(this.cachedTree));
      callback(clone);
      return;
    }

    if (this.isFetching) {
      this.fetchPromises.push(callback);
      return;
    }

    this.isFetching = true;
    chrome.bookmarks.getTree((tree) => {
      this.cachedTree = tree;
      this.isFetching = false;
      
      const clone = typeof structuredClone === "function" 
        ? structuredClone(this.cachedTree) 
        : JSON.parse(JSON.stringify(this.cachedTree));
        
      callback(clone);
      
      this.fetchPromises.forEach(cb => {
        const promiseClone = typeof structuredClone === "function" 
          ? structuredClone(this.cachedTree) 
          : JSON.parse(JSON.stringify(this.cachedTree));
        cb(promiseClone);
      });
      
      this.fetchPromises = [];
    });
  }

  static invalidateCache() {
    this.cachedTree = null;
  }
  
  static async getTreeAsync() {
    return new Promise((resolve) => {
      this.getTree(resolve);
    });
  }
}

if (typeof window !== 'undefined') {
  window.BookmarkCache = BookmarkCache;
}

if (typeof chrome !== 'undefined' && chrome.bookmarks) {
  const invalidate = () => BookmarkCache.invalidateCache();
  
  chrome.bookmarks.onCreated.addListener(invalidate);
  chrome.bookmarks.onRemoved.addListener(invalidate);
  chrome.bookmarks.onChanged.addListener(invalidate);
  chrome.bookmarks.onMoved.addListener(invalidate);
  chrome.bookmarks.onChildrenReordered.addListener(invalidate);
  if (chrome.bookmarks.onImportEnded) {
    chrome.bookmarks.onImportEnded.addListener(invalidate);
  }
}

// Nếu môi trường hỗ trợ module (import/export), ta vẫn export nó ra
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookmarkCache };
}

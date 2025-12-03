// utils/domUtils.js

// 1. Hàm lấy Favicon
export function getFaviconUrl(url) {
  try {
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      url
    )}`
  } catch {
    return "./images/default-favicon.png"
  }
}

// 2. Hàm tạo HTML cho Dropdown Menu (Dùng chung cho tất cả các view)
export function getDropdownHtml(
  bookmarkId,
  isFavorite,
  language,
  translations
) {
  const t = translations[language]
  return `
    <div class="dropdown-btn-group" style="position: relative;">
      <button class="dropdown-btn ${isFavorite ? "favorited" : ""}" 
              data-id="${bookmarkId}" aria-label="Bookmark options">
        ${
          isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
      </button>
      <div class="dropdown-menu hidden">
        <button class="menu-item add-to-folder" data-id="${bookmarkId}">${
    t.addToFolderOption
  }</button>
        <button class="menu-item delete-btn" data-id="${bookmarkId}">${
    t.deleteBookmarkOption
  }</button>
        <button class="menu-item rename-btn" data-id="${bookmarkId}">${
    t.renameBookmarkOption
  }</button>
        <button class="menu-item view-detail-btn" data-id="${bookmarkId}">${
    t.viewDetail
  }</button>
        <button class="menu-item manage-tags-btn" data-id="${bookmarkId}">${
    t.manageTags
  }</button>
        <hr/>
        <button class="menu-item favorite-btn" data-id="${bookmarkId}">
          ${isFavorite ? t.removeFavourite : t.favourite}
        </button>
      </div>
    </div>
  `
}

// 3. Hàm render Tags
export function getTagsHtml(tags, tagColors) {
  if (!tags || tags.length === 0) return ""
  return tags
    .map(
      (tag) => `
    <span class="bookmark-tag" style="background-color: ${
      tagColors[tag] || "#ccc"
    };">
      ${tag}
    </span>
  `
    )
    .join("")
}

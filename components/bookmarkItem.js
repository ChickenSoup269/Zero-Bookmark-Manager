// components/bookmarkItem.js
import {
  getFaviconUrl,
  getDropdownHtml,
  getTagsHtml,
} from "../utils/domUtils.js"
import { translations } from "../utils/utils.js"
import { uiState } from "../state.js"

// Template HTML cho từng loại view
const templates = {
  card: (b, lang, favicon) => `
    <div class="bookmark-content">
      <div class="bookmark-favicon"><img src="${favicon}" loading="lazy"></div>
      <a href="${b.url}" target="_blank" class="card-bookmark-title">${
    b.title || b.url
  }</a>
      ${getDropdownHtml(b.id, b.isFavorite, lang, translations)}
    </div>`,

  detail: (b, lang, favicon) => `
    <div class="detail-row">
       <div class="bookmark-favicon"><img src="${favicon}"></div>
       <a href="${b.url}" target="_blank" class="detail-title">${b.title}</a>
       ${getDropdownHtml(b.id, b.isFavorite, lang, translations)}
    </div>
    <div class="detail-meta">${b.url}</div>
    <div class="detail-tags">${getTagsHtml(b.tags, uiState.tagColors)}</div>
    <button class="view-detail-btn">${translations[lang].viewDetail}</button>
  `,

  list: (b, lang, favicon) => `
    <input type="checkbox" class="bookmark-checkbox" data-id="${b.id}">
    <img src="${favicon}" class="favicon">
    <a href="${b.url}" target="_blank" class="link">${b.title}</a>
    ${getDropdownHtml(b.id, b.isFavorite, lang, translations)}
  `,
}

export function createBookmarkComponent(
  bookmark,
  viewType = "list",
  options = {}
) {
  const language = localStorage.getItem("appLanguage") || "en"
  const favicon = getFaviconUrl(bookmark.url)

  const div = document.createElement("div")
  // Thêm class chung và class riêng theo viewType
  div.className = `bookmark-item ${viewType}-view ${
    bookmark.isFavorite ? "favorited" : ""
  }`
  div.dataset.id = bookmark.id
  div.draggable = true

  // 1. Render HTML dựa trên template
  if (templates[viewType]) {
    div.innerHTML = templates[viewType](bookmark, language, favicon)
  } else {
    div.innerHTML = templates.list(bookmark, language, favicon) // Fallback
  }

  // 2. Gắn Event Listeners chung (DRY - Don't Repeat Yourself)
  attachCommonListeners(div, bookmark)

  return div
}

function attachCommonListeners(element, bookmark) {
  // Drag start
  element.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", bookmark.id)
    e.dataTransfer.setData("type", "bookmark")
    element.classList.add("dragging")
  })

  element.addEventListener("dragend", () => {
    element.classList.remove("dragging")
  })

  // Dropdown toggle logic
  const dropdownBtn = element.querySelector(".dropdown-btn")
  if (dropdownBtn) {
    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const menu = element.querySelector(".dropdown-menu")
      // Đóng các menu khác
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      menu.classList.toggle("hidden")
    })
  }

  // Xử lý click link (đếm số lần truy cập)
  const link = element.querySelector("a")
  if (link) {
    link.addEventListener("click", () => {
      // Logic update access count...
    })
  }
}

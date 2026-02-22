import {
  translations,
  showCustomPopup,
  calculateMatchScore,
} from "./utils/utils.js"
import {
  flattenBookmarks,
  getFolders,
  isInFolder,
  loadVisitCounts,
} from "./bookmarks.js"
import { uiState, setBookmarks, setFolders, setBookmarkTree } from "./state.js"
import { attachDropdownListeners } from "./controller/dropdown.js"
import { setupBookmarkActionListeners } from "./controller/bookmarkActions.js"
import { getAllTags } from "./tag.js"
import { customSaveUIState } from "./option/option.js"
import { checkBrokenLinks } from "./health/health.js"
import { handleDeleteFolder } from "./controller/deleteFolder.js"

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getFaviconUrl(url) {
  if (!url) {
    return "./images/default-favicon.png"
  }

  if (url.startsWith("chrome-extension://")) {
    const manifest = chrome.runtime.getManifest()
    const iconPath =
      manifest.icons["128"] ||
      manifest.icons["48"] ||
      manifest.icons["16"] ||
      "icons/icon.png"
    return iconPath
  }

  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
  } catch (e) {
    return "./images/default-favicon.png"
  }
}

// Global variable to keep track of autoscroll interval
let autoscrollInterval = null

function startAutoscroll(container, event) {
  stopAutoscroll() // Clear any existing interval

  const rect = container.getBoundingClientRect()
  const scrollThreshold = 50 // Pixels from edge to start scrolling
  const scrollSpeed = 10 // Pixels per interval

  const checkScroll = () => {
    if (!container) {
      stopAutoscroll()
      return
    }

    // Determine current mouse position relative to container
    const mouseY = event.clientY

    // Check for vertical scrolling
    if (mouseY < rect.top + scrollThreshold) {
      // Scroll up
      container.scrollTop -= scrollSpeed
    } else if (mouseY > rect.bottom - scrollThreshold) {
      // Scroll down
      container.scrollTop += scrollSpeed
    }
  }

  autoscrollInterval = setInterval(checkScroll, 50) // Check every 50ms
}

function stopAutoscroll() {
  if (autoscrollInterval) {
    clearInterval(autoscrollInterval)
    autoscrollInterval = null
  }
}

// Helper function for fuzzy search matching
function matchesSearchQuery(bookmark) {
  if (!uiState.searchQuery) return true
  const query = uiState.searchQuery.trim()

  // Check title match
  const titleScore = calculateMatchScore(bookmark.title || "", query)
  if (titleScore >= 0.4) return true

  // Check URL match
  const urlScore = calculateMatchScore(bookmark.url || "", query)
  if (urlScore >= 0.4) return true

  // Check tags match
  if (bookmark.tags && bookmark.tags.length > 0) {
    for (const tag of bookmark.tags) {
      if (calculateMatchScore(tag, query) >= 0.5) return true
    }
  }

  return false
}

function getContrastColor(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return "#ffffff"
  const safe = hex.replace("#", "")
  if (safe.length !== 6) return "#ffffff"

  const r = parseInt(safe.substr(0, 2), 16)
  const g = parseInt(safe.substr(2, 2), 16)
  const b = parseInt(safe.substr(4, 2), 16)

  // Công thức contrast phổ biến (YIQ)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#000000" : "#ffffff"
}

function createTagsHTML(tags, styleOverride = "") {
  if (!tags || tags.length === 0) return ""
  return tags
    .map((tag) => {
      const bg = uiState.tagColors[tag] || "#ccc"
      const textColor =
        (uiState.tagTextColors && uiState.tagTextColors[tag]) ||
        getContrastColor(bg)

      return `
    <span class="bookmark-tag" style="
      background-color: ${bg};
      color: ${textColor};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      margin-right: 4px;
      display: inline-block;
      ${styleOverride}
    ">
      ${tag}
    </span>
  `
    })
    .join("")
}

function renderHealthIcon(bookmarkId) {
  const status = uiState.healthStatus ? uiState.healthStatus[bookmarkId] : null
  if (!status) return ""

  // Tooltip đa ngôn ngữ
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en
  const checkingTitle =
    language === "vi"
      ? "Đang kiểm tra liên kết này..."
      : "Checking this link..."
  const deadTitle =
    language === "vi"
      ? "Liên kết có thể đã chết hoặc website không phản hồi."
      : "Link might be dead or the website is not responding."
  const safeTitle =
    language === "vi" ? "Trang web có vẻ hợp lệ." : "Site looks likely safe."
  const suspiciousTitle =
    language === "vi"
      ? "Trang web trông có vẻ mờ ám (dựa trên một số dấu hiệu phổ biến). Hãy cẩn thận!"
      : "Site looks suspicious based on common patterns. Proceed with caution!"

  if (status === "checking") {
    return `<span class="health-icon checking" title="${checkingTitle}">
    <i class="fas fa-spinner fa-spin"></i>
  </span>`
  }

  if (status === "dead") {
    return `<span class="health-icon dead" title="${deadTitle}">
    <i class="fas fa-exclamation-triangle"></i>
  </span>`
  }

  if (status === "alive_suspicious") {
    return `<span class="health-icon suspicious" title="${suspiciousTitle}">
    <i class="fas fa-radiation-alt"></i>
  </span>`
  }

  if (status === "alive_safe") {
    return `<span class="health-icon safe" title="${safeTitle}">
    <i class="fas fa-check"></i>
  </span>`
  }

  return ""
}

// Render visit count badge
function renderVisitCount(bookmarkId) {
  if (uiState.sortType !== "most-visited") return ""
  const visitCount = uiState.visitCounts ? uiState.visitCounts[bookmarkId] : 0
  if (!visitCount || visitCount === 0) return ""

  const language = localStorage.getItem("appLanguage") || "en"
  const tooltipText =
    language === "vi"
      ? `Đã truy cập ${visitCount} lần`
      : `Visited ${visitCount} times`

  return `<span class="visit-count-badge" title="${tooltipText}">
    <i class="fas fa-eye" aria-hidden="true"></i>
    <span class="visit-count-number">${visitCount}</span>
  </span>`
}

function createDropdownHTML(bookmark, language) {
  const t = translations[language] || translations.en
  const isFav = bookmark.isFavorite
  const isPinned = bookmark.isPinned

  const iconStyle = "width: 14px; text-align: center; margin-right: 8px;"

  return `
    <div class="dropdown-btn-group" style="position: relative;">
      <button class="dropdown-btn ${isFav ? "favorited" : ""} ${
        isPinned ? "pinned-active" : ""
      }" 
              data-id="${bookmark.id}" 
              aria-label="Bookmark options"
              style="width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
        ${
          isPinned
            ? '<i class="fas fa-thumbtack" style="font-size: 10px; color: var(--accent-color); margin-right: 2px;"></i>'
            : ""
        }
        ${
          isFav
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
      </button>
      <div class="dropdown-menu hidden" style="
        position: absolute; right: 0; top: 100%; margin-top: 4px;
        background: var(--bg-secondary, #2d2d2d); border: 1px solid var(--border-color, #404040);
        border-radius: 8px; min-width: 180px; padding: 4px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2); z-index: 1000;
      ">
        <button class="menu-item pin-btn" data-id="${bookmark.id}">
            <i class="fas fa-thumbtack" style="${iconStyle}"></i>
            ${
              isPinned
                ? t.unpin || "Unpin from Top"
                : t.pinToTop || "Pin to Top"
            }
        </button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;"/>
        <button class="menu-item add-to-folder" data-id="${
          bookmark.id
        }"><i class="fas fa-folder" style="${iconStyle}"></i>${
          t.addToFolderOption || "Add to Folder"
        }</button>
        <button class="menu-item delete-btn" data-id="${
          bookmark.id
        }"><i class="fas fa-trash" style="${iconStyle}"></i>${
          t.deleteBookmarkOption || "Delete"
        }</button>
        <button class="menu-item rename-btn" data-id="${
          bookmark.id
        }"><i class="fas fa-edit" style="${iconStyle}"></i>${
          t.renameBookmarkOption || "Rename"
        }</button>
        <button class="menu-item view-detail-btn" data-id="${
          bookmark.id
        }"><i class="fas fa-info-circle" style="${iconStyle}"></i>${
          t.viewDetail || "Details"
        }</button>
        <button class="menu-item manage-tags-btn" data-id="${
          bookmark.id
        }"><i class="fas fa-tags" style="${iconStyle}"></i>${
          t.manageTags || "Tags"
        }</button>
        <button class="menu-item qr-code-btn" data-id="${
          bookmark.id
        }"><i class="fas fa-qrcode" style="${iconStyle}"></i>${
          t.generateQrCode || "Generate QR"
        }</button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;"/>
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">
            <i class="fas fa-star" style="${iconStyle}"></i>
          ${
            isFav
              ? t.removeFavourite || "Unfavorite"
              : t.favourite || "Favorite"
          }
        </button>
      </div>
    </div>
  `
}

function handleBookmarkLinkClick(bookmarkId, elements) {
  // Increment visit count immediately when clicked in extension
  chrome.runtime.sendMessage(
    { action: "incrementVisitCount", bookmarkId: bookmarkId },
    () => {
      // Reload UI if sorting by most-visited to show updated counts
      if (uiState.sortType === "most-visited") {
        loadVisitCounts(() => {
          chrome.bookmarks.getTree((tree) =>
            renderFilteredBookmarks(tree, elements),
          )
        })
      }
    },
  )
}

function attachDropdownToggle(element) {
  const btn = element.querySelector(".dropdown-btn")
  const menu = element.querySelector(".dropdown-menu")

  if (btn && menu) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const isHidden = menu.classList.contains("hidden")
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      if (isHidden) menu.classList.remove("hidden")
    })

    element.addEventListener("mouseenter", () => {
      if (
        element.classList.contains("detail-bookmark-item") ||
        element.classList.contains("bookmark-item")
      ) {
        btn.style.opacity = "1"
      }
    })
    element.addEventListener("mouseleave", () => {
      if (
        (element.classList.contains("detail-bookmark-item") ||
          element.classList.contains("bookmark-item")) &&
        menu.classList.contains("hidden")
      ) {
        btn.style.opacity = "0"
      }
    })
  }
}

// --- HELPER: Open Web Preview (Iframe) ---
// Dùng cho nút to ở Detail View
function openWebPreviewModal(bookmark) {
  const favicon = getFaviconUrl(bookmark.url)

  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  // Remove existing overlay
  const existingOverlay = document.querySelector(".bookmark-modal-overlay")
  if (existingOverlay) existingOverlay.remove()

  const overlay = document.createElement("div")
  overlay.className = "bookmark-modal-overlay"

  overlay.innerHTML = `
    <div class="bookmark-modal" style="width: 90%; height: 90%; max-width: 1200px;">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${favicon}" class="modal-favicon" alt="icon" onerror="this.onerror=()=>{this.src='./images/default-favicon.png'}; this.src='https://icons.duckduckgo.com/ip3/${hostname}.ico';">
          <h3 class="modal-title" title="${bookmark.title}">${
            bookmark.title || bookmark.url
          }</h3>
        </div>
        <div class="modal-actions">
           <a href="${
             bookmark.url
           }" target="_blank" class="modal-external-link" title="Open in New Tab" style="text-decoration:none; color:var(--text-secondary); margin-right:10px;">
             <i class="fas fa-link"></i> ↗
           </a>
           <button class="modal-fullscreen" title="Fullscreen">⤢</button>
           <button class="modal-close" title="Close">✕</button>
        </div>
      </div>
      
      <!-- Iframe Wrapper with Fallback -->
      <div class="iframe-wrapper" style="position:relative; flex:1; background:#f0f0f0; overflow:hidden;">
        
        <!-- Fallback Message (Behind Iframe) -->
        <div class="iframe-fallback" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; width: 80%; color: #555;">
            <div style="font-size: 40px; margin-bottom: 10px;">🔒</div>
            <p><strong>Preview unavailable?</strong></p>
            <p style="font-size:12px;">Many websites block being displayed inside extensions.</p>
            <a href="${
              bookmark.url
            }" target="_blank" class="button" style="display:inline-block; margin-top:10px; padding: 8px 16px; background:var(--accent-color); color:white; border-radius:4px; text-decoration:none;">
                Open Website Directly
            </a>
        </div>

        <!-- Main Iframe -->
        <iframe src="${bookmark.url}" 
                style="width:100%; height:100%; border:none; position:relative; z-index:2; background:transparent;" 
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onload="this.style.background='white'">
        </iframe>
      </div>
    </div>`

  document.body.appendChild(overlay)

  const modal = overlay.querySelector(".bookmark-modal")
  overlay.querySelector(".modal-close").onclick = () => overlay.remove()
  overlay.querySelector(".modal-fullscreen").onclick = () =>
    modal.classList.toggle("fullscreen")
  overlay.onclick = (evt) => {
    if (evt.target === overlay) overlay.remove()
  }
}

function generateQRCodePopup(url, title, faviconUrl) {
  // Remove existing QR code popup
  const existingPopup = document.querySelector(".qr-code-popup-overlay")
  if (existingPopup) {
    existingPopup.remove()
  }

  const overlay = document.createElement("div")
  overlay.className = "qr-code-popup-overlay"
  overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 2000;
      `

  const popup = document.createElement("div")
  popup.className = "qr-code-popup"
  popup.style.cssText = `
        background: var(--bg-primary, #fff); padding: 20px; border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align: center;
        max-width: 300px; position: relative;
      `

  overlay.appendChild(popup)

  popup.innerHTML = `
        <button class="modal-close" title="Close" style="position:absolute; top: 10px; right: 10px; background:transparent; border:none; font-size: 20px; cursor:pointer; color: var(--text-primary);">✕</button>
        <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--text-primary);">${title}</h3>
        <div id="qrcode-container" style="position: relative; margin-bottom: 15px; display: inline-block;"></div>
        <p style="font-size: 12px; color: var(--text-secondary); word-break: break-all;">${url}</p>
      `

  document.body.appendChild(overlay)

  // Generate QR Code
  try {
    const qrCodeContainer = document.getElementById("qrcode-container")
    qrCodeContainer.innerHTML = "" // Clear previous content

    // Use the new QRCode library API
    new window.QRCode(qrCodeContainer, {
      text: url,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.H,
    })

    // Add favicon overlay - wait a bit for the QR code to render
    setTimeout(() => {
      const faviconImg = document.createElement("img")
      faviconImg.src = faviconUrl
      faviconImg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 10%;
                height: 10%;
                padding: 2px;
                border-radius: 8px;
                background: var(--text-primary);
            `
      qrCodeContainer.style.position = "relative" // Ensure container has relative positioning
      qrCodeContainer.appendChild(faviconImg)
    }, 100)
  } catch (e) {
    console.error("Error generating QR code:", e)
    const qrCodeContainer = document.getElementById("qrcode-container")
    qrCodeContainer.textContent = "Could not generate QR code."
  }

  overlay.onclick = (evt) => {
    if (evt.target === overlay) {
      overlay.remove()
    }
  }
  popup.querySelector(".modal-close").onclick = () => overlay.remove()
}

function handleOpenSidePanel(bookmark) {
  if (chrome.sidePanel) {
    chrome.sidePanel
      .setOptions({
        path: "components/sidepanel/sidepanel.html",
        enabled: true,
      })
      .then(() => {
        chrome.storage.local.set({ sidePanelBookmarkId: bookmark.id }, () => {
          chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
        })
      })
      .catch((error) => {
        console.error("Error setting side panel options:", error)
        showCustomPopup("Error opening side panel.", "error", true)
      })
  } else {
    console.warn("chrome.sidePanel API not available.")
    showCustomPopup(
      "Side panel not supported or API not available.",
      "error",
      true,
    )
    chrome.tabs.create({ url: bookmark.url })
  }
}

// --- HELPER: Open Properties (Metadata) ---

// ==========================================
// MAIN LOGIC
// ==========================================
export function updateUILanguage(elements, language) {
  const t = translations[language] || translations.en
  const requiredElements = [
    {
      key: "folderFilter",
      selector: "#folder-filter",
      optionText: "allBookmarks",
    },
    { key: "tagFilterContainer", selector: "#tag-filter-container" },
    { key: "sortFilter", selector: "#sort-filter" },
    { key: "createFolderButton", selector: "#create-folder-button" },
    { key: "addToFolderButton", selector: "#add-to-folder-button" },
    { key: "deleteFolderButton", selector: "#delete-folder-button" },
    { key: "renameFolderButton", selector: "#rename-folder-button" },
    { key: "deleteBookmarksButton", selector: "#delete-bookmarks-button" },
    { key: "exportBookmarksOption", selector: "#export-bookmarks-option" },
    { key: "importBookmarksOption", selector: "#import-bookmarks-option" },
    { key: "editInNewTabOption", selector: "#edit-in-new-tab-option" },
    { key: "toggleCheckboxesButton", selector: "#toggle-checkboxes-button" },
    {
      key: "searchInput",
      selector: "#search-input",
      placeholder: "searchPlaceholder",
    },
    { key: "renamePopup", selector: "#rename-popup" },
    {
      key: "renameInput",
      selector: "#rename-input",
      placeholder: "renamePlaceholder",
    },
    { key: "addToFolderPopup", selector: "#add-to-folder-popup" },
    {
      key: "addToFolderSelect",
      selector: "#add-to-folder-select",
      optionText: "selectFolder",
    },
    { key: "addToFolderSaveButton", selector: "#add-to-folder-save" },
    { key: "addToFolderCancelButton", selector: "#add-to-folder-cancel" },
    { key: "bookmarkCountDiv", selector: "#bookmark-count" },
    { key: "scrollToTopButton", selector: "#scroll-to-top" },
    { key: "clearRenameButton", selector: "#clear-rename" },
    { key: "clearSearchButton", selector: "#clear-search" },
    { key: "settingsButton", selector: "#settings-button" },
    { key: "renameFolderPopup", selector: "#rename-folder-popup" },
    {
      key: "renameFolderSelect",
      selector: "#rename-folder-select",
      optionText: "selectFolder",
    },
    {
      key: "renameFolderInput",
      selector: "#rename-folder-input",
      placeholder: "renamePlaceholder",
    },
    { key: "bookmarkDetailPopup", selector: "#bookmark-detail-popup" },
    { key: "manageTagsPopup", selector: "#manage-tags-popup" },
  ]

  let hasError = false
  requiredElements.forEach(({ key, selector, optionText, placeholder }) => {
    if (!elements[key]) {
      elements[key] = document.querySelector(selector)
      if (!elements[key]) {
        console.error(`Failed to find ${key} in DOM with selector: ${selector}`)
        hasError = true
        return
      }
    }
    if (optionText && elements[key].tagName === "SELECT") {
      const option = elements[key].querySelector('option[value=""]')
      if (option) option.textContent = t[optionText] || ""
      else
        elements[key].innerHTML = `<option value="">${
          t[optionText] || ""
        }</option>`
    }
    if (placeholder && elements[key].tagName === "INPUT") {
      elements[key].placeholder = t[placeholder] || ""
    }
  })

  if (hasError) {
    showCustomPopup(
      t.errorUnexpected || "An unexpected error occurred",
      "error",
      true,
    )
    return
  }

  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  if (tagFilterToggle) {
    tagFilterToggle.textContent =
      uiState.selectedTags.length > 0
        ? uiState.selectedTags.join(", ")
        : t.allTags
  }

  elements.sortFilter.innerHTML = `
    <option value="default">${t.sortDefault}</option>
    <option value="favorites">${t.sortFavorites}</option>
    <option value="most-visited">${t.sortMostVisited || "Most Visited"}</option>
    <option value="old">${t.sortOld}</option>
    <option value="last-opened">${t.sortLastOpened}</option>
    <option value="a-z">${t.sortAZ}</option>
    <option value="z-a">${t.sortZA}</option>
    <option value="domain">${t.sortDomain || "By Domain"}</option>
  `
  const updateButtonText = (btnElem, text) => {
    if (!btnElem) return
    const span = btnElem.querySelector("span")
    if (span) {
      span.textContent = text
    } else {
      // Fallback for buttons without a span, though the structure should be consistent
      btnElem.textContent = text
    }
  }

  updateButtonText(elements.createFolderButton, t.createFolder)
  updateButtonText(elements.addToFolderButton, t.addToFolder)
  updateButtonText(elements.deleteFolderButton, t.deleteFolder)
  updateButtonText(elements.renameFolderButton, t.renameFolder)
  updateButtonText(elements.deleteBookmarksButton, t.deleteBookmarks)
  updateButtonText(elements.organizeFoldersButton, t.organizeFolders)
  elements.exportBookmarksOption.innerHTML = `${t.exportBookmarks}  <i class="fas fa-download"></i>`
  elements.importBookmarksOption.innerHTML = `${t.importBookmarks}  <i class="fas fa-upload"></i>`
  elements.editInNewTabOption.innerHTML = `${t.editInNewTabOption} <i class="fas fa-location-arrow"></i>`
  elements.openSidePanelOption.innerHTML = `${t.openSidePanel}  <i class="far fa-caret-square-right"></i>`
  elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
    ? t.hideCheckboxes
    : t.showCheckboxes
  elements.bookmarkCountDiv.textContent = `${t.totalBookmarks}: ${
    elements.bookmarkCountDiv.textContent.match(/\d+$/)?.[0] || 0
  }`

  // Update attributes
  elements.scrollToTopButton.title = t.scrollToTop
  elements.scrollToTopButton.setAttribute("aria-label", t.scrollToTop)
  elements.clearRenameButton.setAttribute("aria-label", t.clearRenameAria)
  elements.clearSearchButton.setAttribute("aria-label", t.clearSearchAria)
  elements.settingsButton.setAttribute("aria-label", t.settingsButtonAria)
  elements.renameInput.dataset.errorPlaceholder = t.emptyTitleError
  elements.renameFolderInput.dataset.errorPlaceholder = t.emptyFolderError
  elements.renameFolderInput.dataset.selectFolderError = t.selectFolderError

  if (elements.manageTagsPopup.querySelector("#new-tag-input")) {
    elements.manageTagsPopup.querySelector("#new-tag-input").placeholder =
      t.newTagPlaceholder
  }
  if (elements.manageTagsPopup.querySelector("#add-tag-btn")) {
    elements.manageTagsPopup.querySelector("#add-tag-btn").textContent =
      t.addTag
  }

  localStorage.setItem("appLanguage", language)
}

export function handleCheckHealth(elements) {
  // Nếu chưa có mảng bookmarks thì lấy từ state
  const bookmarksToCheck = uiState.bookmarks || []

  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en

  const checkHealthButton = elements.checkHealthButton
  const checkHealthIcon = checkHealthButton?.querySelector("i")
  let originalIconClass = ""

  // Trạng thái loading cho nút Check Links (nếu có)
  if (checkHealthButton) {
    if (checkHealthIcon) {
      originalIconClass = checkHealthIcon.className // Store original
      checkHealthIcon.className = "fas fa-spinner fa-spin" // Set spinner
    }
    checkHealthButton.classList.add("is-loading")
    checkHealthButton.disabled = true
  }

  // Popup kiểu loading (không auto close)
  showCustomPopup(
    language === "vi"
      ? "Đang kiểm tra tình trạng các liên kết... Vui lòng đợi."
      : "Checking link health... Please wait.",
    "loading",
    false,
  )

  checkBrokenLinks(
    bookmarksToCheck,
    () => {
      // Callback Progress: Re-render UI để hiện icon Loading/Dead
      // Lưu ý: Re-render toàn bộ cây có thể nặng.
      // Tốt nhất là chỉ update DOM, nhưng để đơn giản ta gọi render lại view hiện tại.

      // Cách tối ưu: Chỉ tìm DOM element và update
      // Tuy nhiên, để đảm bảo code ngắn gọn với cấu trúc hiện tại, ta gọi render lại view hiện tại
      reRenderCurrentView(elements)
    },
    (brokenCount) => {
      // Callback Complete
      const msg =
        brokenCount > 0
          ? language === "vi"
            ? `Hoàn tất! Phát hiện ${brokenCount} liên kết có vấn đề.`
            : `Finished! Found ${brokenCount} broken links.`
          : language === "vi"
            ? "Hoàn tất! Tất cả liên kết có vẻ vẫn hoạt động."
            : "Finished! All links appear healthy."
      const type = brokenCount > 0 ? "warning" : "success"
      showCustomPopup(msg, type, true)
      elements.healthSortFilter.style.display = "block" // Show the filter

      // Reset trạng thái nút
      if (checkHealthButton) {
        checkHealthButton.classList.remove("is-loading")
        checkHealthButton.disabled = false
        if (checkHealthIcon) {
          checkHealthIcon.className = originalIconClass // Restore original
        }
      }
      reRenderCurrentView(elements)
    },
  )
}

// Hàm phụ trợ để render lại view hiện tại mà không reset data
function reRenderCurrentView(elements) {
  const bookmarks = uiState.bookmarks
  const bookmarkTreeNodes = uiState.bookmarkTree

  // Logic filter lại (copy từ renderFilteredBookmarks nhưng bỏ phần set data)
  let filtered = bookmarks.filter((bookmark) => bookmark.url)

  // ... (Áp dụng lại logic filter search/tag/folder như cũ) ...
  // Để ngắn gọn, bạn có thể tách logic filter ra hàm riêng.
  // Ở đây tôi giả định ta gọi lại render view tương ứng:

  if (uiState.viewMode === "tree") {
    // Tree view dùng bookmarkTreeNodes
    const rootChildren = bookmarkTreeNodes[0]?.children || []
    renderTreeView(rootChildren, elements)
  } else if (uiState.viewMode === "detail") {
    renderDetailView(filtered, elements)
  } else if (uiState.viewMode === "card") {
    renderCardView(bookmarkTreeNodes, filtered, elements)
  } else {
    renderBookmarks(filtered, elements)
  }

  // Gắn lại listener
  attachTreeListeners(elements) // Nếu là tree
  // ...
}

export async function populateTagFilter(elements) {
  const tagFilterOptions = elements.tagFilterContainer?.querySelector(
    "#tag-filter-options",
  )
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")

  if (!tagFilterOptions) return

  const allTags = await getAllTags()
  tagFilterOptions.innerHTML = ""

  // Render tags as clickable pills (Raindrop style)
  allTags.forEach((tag) => {
    const tagColor = uiState.tagColors[tag] || "var(--text-secondary)"
    const isActive = uiState.selectedTags.includes(tag)
    const contrastColor = getContrastColor(tagColor)

    const tagItem = document.createElement("div")
    tagItem.className = `sidebar-tag-item${isActive ? " active" : ""}`
    tagItem.setAttribute("data-tag", tag)
    tagItem.style.cssText = isActive
      ? `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
      : `border-color: ${tagColor}; color: ${tagColor};`

    tagItem.innerHTML = `
      <i class="fas fa-tag" style="font-size: 0.65rem;"></i>
      <span>${tag}</span>
    `

    tagItem.addEventListener("click", () => {
      const idx = uiState.selectedTags.indexOf(tag)
      if (idx > -1) {
        uiState.selectedTags.splice(idx, 1)
        tagItem.classList.remove("active")
        tagItem.style.cssText = `border-color: ${tagColor}; color: ${tagColor};`
      } else {
        uiState.selectedTags.push(tag)
        tagItem.classList.add("active")
        tagItem.style.cssText = `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
      }

      // Trigger re-render
      chrome.bookmarks.getTree((tree) => {
        import("./ui.js").then(({ renderFilteredBookmarks }) => {
          renderFilteredBookmarks(tree, elements)
        })
      })
    })

    tagFilterOptions.appendChild(tagItem)
  })

  // Update toggle button text if exists
  if (tagFilterToggle) {
    tagFilterToggle.textContent =
      uiState.selectedTags.length > 0
        ? uiState.selectedTags.join(", ")
        : translations[localStorage.getItem("appLanguage") || "en"].allTags
  }
}

export function updateTheme(elements, theme) {
  const availableThemes = [
    "light",
    "dark",
    "dracula",
    "onedark",
    "tokyonight",
    "monokai",
    "winter-is-coming",
    "github-blue",
    "github-light",
    "tet",
  ]
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const elementsToUpdate = [
    document.body,
    elements.folderListDiv,
    elements.bookmarkCountDiv,
  ]

  elementsToUpdate.forEach((element) => {
    if (element) {
      availableThemes.forEach((themeName) =>
        element.classList.remove(`${themeName}-theme`),
      )
      element.classList.remove("light-theme", "dark-theme")
    }
  })

  let activeTheme =
    theme === "system"
      ? isDarkMode
        ? "dark"
        : "light"
      : availableThemes.includes(theme)
        ? theme
        : "light"

  const logoSrcMap = {
    light: "images/logo.png", // qua tết đổi lại ố kề
    dark: "images/logo.png",
    dracula: "images/logo_dracula.png",
    onedark: "images/logo_onedark.png",
    tokyonight: "images/logo_tokyo_night.png",
    monokai: "images/logo_monokai.png",
    "winter-is-coming": "images/logo.png",
    "github-blue": "images/logo_github.png",
    "github-light": "images/logo_github.png",
    tet: "images/logo_tet.png",
  }

  const getAsset = (path) =>
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(path)
      : path

  document.querySelectorAll(".logo").forEach((el) => {
    const src = logoSrcMap[activeTheme] ?? logoSrcMap["light"]
    el.src = getAsset(src)
    if (!el.alt) el.alt = "App logo"
  })

  elementsToUpdate.forEach((element) => {
    if (element) element.classList.add(`${activeTheme}-theme`)
  })

  document.documentElement.setAttribute("data-theme", activeTheme)

  document
    .querySelectorAll(
      ".input, .select, .button, .rename-popup, .folder-item, .folder-title, .custom-popup",
    )
    .forEach((el) => {
      availableThemes.forEach((themeName) =>
        el.classList.remove(`${themeName}-theme`),
      )
      el.classList.remove("light-theme", "dark-theme")
      el.classList.add(`${activeTheme}-theme`)
    })

  localStorage.setItem("selectedTheme", theme)
  window.dispatchEvent(
    new CustomEvent("themeChanged", {
      detail: { theme: activeTheme, originalSelection: theme },
    }),
  )
}

// Render folder tree in sidebar (Raindrop style)
function renderSidebarFolderTree(folders) {
  const treeContainer = document.getElementById("sidebar-folder-tree")
  if (!treeContainer) return

  treeContainer.innerHTML = ""
  const language = localStorage.getItem("appLanguage") || "en"

  // Build folder hierarchy
  const folderMap = new Map()
  folders.forEach((f) => {
    folderMap.set(f.id, { ...f, children: [] })
  })

  const rootFolders = []
  folderMap.forEach((folder) => {
    // Skip root node (id=0)
    if (folder.id === "0") return

    // If has parent and parent exists in map, add as child
    if (
      folder.parentId &&
      folder.parentId !== "0" &&
      folderMap.has(folder.parentId)
    ) {
      folderMap.get(folder.parentId).children.push(folder)
    } else {
      // Otherwise treat as root folder (including folders with parentId=0 or null)
      rootFolders.push(folder)
    }
  })

  // Sort folders: Bookmarks Bar (1) and Other Bookmarks (2) first
  rootFolders.sort((a, b) => {
    if (a.id === "1") return -1
    if (b.id === "1") return 1
    if (a.id === "2") return -1
    if (b.id === "2") return 1
    return a.title.localeCompare(b.title)
  })

  // Add "All Bookmarks" pseudo folder at the beginning
  const t = translations[language] || translations.en
  const allBookmarksFolder = {
    id: "__all_bookmarks",
    title: t.sidebarAllBookmarks || "All Bookmarks",
    children: [],
    isVirtual: true,
  }
  rootFolders.unshift(allBookmarksFolder)

  // Sort children alphabetically
  const sortChildren = (folder) => {
    if (folder.children && folder.children.length > 0) {
      folder.children.sort((a, b) => a.title.localeCompare(b.title))
      folder.children.forEach(sortChildren)
    }
  }
  rootFolders.forEach(sortChildren)

  // Load collapsed state from localStorage
  const collapsedFolders = new Set(
    JSON.parse(localStorage.getItem("collapsedSidebarFolders") || "[]"),
  )

  // Render folder with nesting (tree view style)
  function renderFolder(
    folder,
    level = 0,
    parent = treeContainer,
    isLast = false,
  ) {
    const li = document.createElement("li")
    li.className = "sidebar-folder-item"
    li.setAttribute("data-folder-id", folder.id)
    li.setAttribute("data-level", level)
    if (isLast) li.classList.add("is-last")

    // Mark "All Bookmarks" as active when no folder is selected
    const isActive =
      (folder.id === "__all_bookmarks" && !uiState.selectedFolderId) ||
      uiState.selectedFolderId === folder.id

    if (isActive) {
      li.classList.add("active")
    }

    const hasChildren = folder.children && folder.children.length > 0
    const isCollapsed = collapsedFolders.has(folder.id)

    // Build tree lines
    let treeLine = ""
    if (level > 0) {
      treeLine = `<span class="tree-line ${isLast ? "last" : ""}"></span>`
    }

    li.innerHTML = `
      ${treeLine}
      ${hasChildren ? `<i class="fas fa-chevron-${isCollapsed ? "right" : "down"} folder-toggle" data-folder-id="${folder.id}"></i>` : '<span class="folder-spacer"></span>'}
      <i class="fas fa-folder${isCollapsed && hasChildren ? "" : "-open"} folder-icon"></i>
      <span class="folder-name">${folder.title}</span>
      ${hasChildren ? `<span class="folder-child-count">${folder.children.length}</span>` : ""}
    `

    // Toggle handler
    const toggleIcon = li.querySelector(".folder-toggle")
    if (toggleIcon) {
      toggleIcon.addEventListener("click", (e) => {
        e.stopPropagation()
        const folderId = e.target.getAttribute("data-folder-id")

        if (collapsedFolders.has(folderId)) {
          collapsedFolders.delete(folderId)
          e.target.className = "fas fa-chevron-down folder-toggle"
        } else {
          collapsedFolders.add(folderId)
          e.target.className = "fas fa-chevron-right folder-toggle"
        }

        // Save state
        localStorage.setItem(
          "collapsedSidebarFolders",
          JSON.stringify([...collapsedFolders]),
        )

        // Toggle children visibility
        const childrenContainer = li.nextElementSibling
        if (
          childrenContainer &&
          childrenContainer.classList.contains("folder-children")
        ) {
          childrenContainer.classList.toggle("collapsed")
        }
      })
    }

    // Folder click handler
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("folder-toggle")) return

      // Update folder filter select
      const folderFilter = document.getElementById("folder-filter")
      if (folderFilter) {
        // For "All Bookmarks" pseudo folder, set empty filter
        if (folder.id === "__all_bookmarks") {
          folderFilter.value = ""
        } else {
          folderFilter.value = folder.id
        }
        folderFilter.dispatchEvent(new Event("change", { bubbles: true }))
      }

      // Update active state
      treeContainer
        .querySelectorAll(".sidebar-folder-item")
        .forEach((item) => item.classList.remove("active"))
      li.classList.add("active")
    })

    // Enable drag & drop for folders (but not for virtual folders)
    if (!folder.isVirtual) {
      li.setAttribute("draggable", "true")
    }

    // Dragstart event
    li.addEventListener("dragstart", (e) => {
      e.stopPropagation()
      e.dataTransfer.setData("text/plain", folder.id)
      currentDragType = "folder"
      e.dataTransfer.effectAllowed = "move"
      li.classList.add("dragging")
    })

    // Dragend event
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging")
      currentDragType = null
    })

    // Dragover event
    li.addEventListener("dragover", (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Only accept folders
      if (currentDragType !== "folder") return

      const draggedId = e.dataTransfer.getData("text/plain")

      // Cannot drop a folder onto itself
      if (draggedId === folder.id) {
        e.dataTransfer.dropEffect = "none"
        li.classList.remove("drag-over")
        return
      }

      // Cannot drop a folder into one of its own descendants
      const draggedNode = findNodeById(draggedId, uiState.bookmarkTree)
      if (draggedNode && isAncestorOf(draggedNode, folder.id)) {
        e.dataTransfer.dropEffect = "none"
        li.classList.remove("drag-over")
        return
      }

      e.dataTransfer.dropEffect = "move"
      li.classList.add("drag-over")
    })

    // Dragleave event
    li.addEventListener("dragleave", (e) => {
      e.stopPropagation()
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove("drag-over")
      }
    })

    // Drop event
    li.addEventListener("drop", (e) => {
      e.preventDefault()
      e.stopPropagation()

      li.classList.remove("drag-over")

      const draggedId = e.dataTransfer.getData("text/plain")
      const targetFolderId = folder.id

      if (!draggedId || !targetFolderId || draggedId === targetFolderId) return

      // Move folder to new parent
      chrome.bookmarks.move(draggedId, { parentId: targetFolderId }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error moving folder:", chrome.runtime.lastError)
          return
        }

        // Refresh bookmark tree
        chrome.bookmarks.getTree((tree) => {
          renderFilteredBookmarks(tree, {
            bookmarkList: document.getElementById("bookmark-list"),
            searchInput: document.getElementById("search-bar"),
            folderFilter: document.getElementById("folder-filter"),
            sortType: document.getElementById("sort-type"),
            viewSwitcher: document.getElementById("view-switcher"),
            tagFilterContainer: document.getElementById("tag-filter-container"),
          })
        })
      })
    })

    // Context menu (right-click) - disabled for virtual folders
    li.addEventListener("contextmenu", (e) => {
      // Don't show context menu for virtual folders like "All Bookmarks"
      if (folder.isVirtual) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      e.preventDefault()
      e.stopPropagation()

      // Remove existing context menu if any
      const existingMenu = document.querySelector(
        ".sidebar-folder-context-menu",
      )
      if (existingMenu) {
        existingMenu.remove()
      }

      // Create context menu
      const contextMenu = document.createElement("div")
      contextMenu.className = "sidebar-folder-context-menu"

      const language = localStorage.getItem("appLanguage") || "en"
      const t = translations[language] || translations.en

      contextMenu.innerHTML = `
        <div class="context-menu-item" data-action="move-to-folder">
          <i class="fas fa-folder-open"></i>
          <span>${t.moveToFolder || "Move to Folder"}</span>
        </div>
      `

      // Position context menu
      contextMenu.style.position = "fixed"
      contextMenu.style.left = `${e.clientX}px`
      contextMenu.style.top = `${e.clientY}px`
      contextMenu.style.zIndex = "10000"

      document.body.appendChild(contextMenu)

      // Handle context menu click
      contextMenu.addEventListener("click", (menuEvent) => {
        menuEvent.stopPropagation()
        const action =
          menuEvent.target.closest(".context-menu-item")?.dataset.action

        if (action === "move-to-folder") {
          // Call existing move folder popup
          const elements = {
            addToFolderPopup: document.getElementById("add-to-folder-popup"),
            addToFolderSelect: document.getElementById("add-to-folder-select"),
            addToFolderSaveButton:
              document.getElementById("add-to-folder-save"),
            addToFolderCancelButton: document.getElementById(
              "add-to-folder-cancel",
            ),
          }

          if (elements.addToFolderPopup) {
            showMoveFolderToFolderPopup(elements, folder.id)
          }
        }

        contextMenu.remove()
      })

      // Close context menu on outside click
      const closeMenu = (event) => {
        if (!contextMenu.contains(event.target)) {
          contextMenu.remove()
          document.removeEventListener("click", closeMenu)
        }
      }

      setTimeout(() => {
        document.addEventListener("click", closeMenu)
      }, 0)
    })

    parent.appendChild(li)

    // Render children
    if (hasChildren) {
      const childrenContainer = document.createElement("ul")
      childrenContainer.className = `folder-children${isCollapsed ? " collapsed" : ""}`
      folder.children.forEach((child, index) => {
        const isLast = index === folder.children.length - 1
        renderFolder(child, level + 1, childrenContainer, isLast)
      })
      parent.appendChild(childrenContainer)
    }
  }

  // Render all root folders
  rootFolders.forEach((folder, index) => {
    const isLast = index === rootFolders.length - 1
    renderFolder(folder, 0, treeContainer, isLast)
  })
}

// Update sidebar counts
function updateSidebarCounts(bookmarks, favoriteBookmarks) {
  const bookmarkCountNumber = document.getElementById("bookmark-count-number")
  const favoritesCount = document.getElementById("favorites-count")
  const sidebarTotalCount = document.getElementById("sidebar-total-count")

  const total = bookmarks.length
  const favorites = bookmarks.filter((b) => b.isFavorite).length

  if (bookmarkCountNumber) bookmarkCountNumber.textContent = total
  if (favoritesCount) favoritesCount.textContent = favorites
  if (sidebarTotalCount) sidebarTotalCount.textContent = `${total} bookmarks`
}

function updateSidebarActiveState() {
  const sortItems = document.querySelectorAll(".sidebar-sort-item")

  sortItems.forEach((item) => item.classList.remove("active"))

  const sortType = uiState.sortType || "default"
  const sortItem = document.querySelector(
    `.sidebar-sort-item[data-sort="${sortType}"]`,
  )
  if (sortItem) sortItem.classList.add("active")
}

export function renderFilteredBookmarks(bookmarkTreeNodes, elements) {
  chrome.storage.local.get(
    [
      "favoriteBookmarks",
      "bookmarkAccessCounts",
      "pinnedBookmarks",
      "bookmarkTags",
    ], // THÊM "bookmarkTags" VÀO ĐÂY
    (data) => {
      const favoriteBookmarks = data.favoriteBookmarks || {}
      const bookmarkAccessCounts = data.bookmarkAccessCounts || {}
      const pinnedBookmarks = data.pinnedBookmarks || {}
      const bookmarkTagsFromStorage = data.bookmarkTags || {} // Lấy tag trực tiếp từ storage

      const addStatus = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            node.isFavorite = !!favoriteBookmarks[node.id]
            node.isPinned = !!pinnedBookmarks[node.id]

            // SỬA TẠI ĐÂY: Ưu tiên lấy từ storage vừa lấy được
            node.tags = bookmarkTagsFromStorage[node.id] || []

            node.accessCount = bookmarkAccessCounts[node.id] || 0
          }
          if (node.children) addStatus(node.children)
        }
      }

      addStatus(bookmarkTreeNodes)

      // Cập nhật lại uiState để đồng bộ với RAM
      uiState.bookmarkTags = bookmarkTagsFromStorage

      const bookmarks = flattenBookmarks(bookmarkTreeNodes)
      const folders = getFolders(bookmarkTreeNodes)

      setBookmarkTree(bookmarkTreeNodes)
      setBookmarks(bookmarks)
      setFolders(folders)
      populateTagFilter(elements)
      populateFolderFilter(bookmarkTreeNodes, elements)
      setupTagFilterListener(elements)
      updateBookmarkCount(bookmarks, elements)

      // Update sidebar (Raindrop style)
      renderSidebarFolderTree(folders)
      updateSidebarCounts(bookmarks, favoriteBookmarks)
      updateSidebarActiveState()

      let filtered = bookmarks.filter((bookmark) => bookmark.url)

      if (uiState.healthFilter && uiState.healthFilter !== "all") {
        filtered = filtered.filter((bookmark) => {
          const status = uiState.healthStatus[bookmark.id]
          if (uiState.healthFilter === "dead") return status === "dead"
          if (uiState.healthFilter === "suspicious")
            return status === "alive_suspicious"
          if (uiState.healthFilter === "safe") return status === "alive_safe"
          return false
        })
      }

      if (uiState.selectedTags.length > 0) {
        filtered = filtered.filter((bookmark) =>
          uiState.selectedTags.some((tag) => bookmark.tags.includes(tag)),
        )
      }
      if (uiState.sortType === "favorites") {
        if (uiState.selectedFolderId) {
          uiState.selectedFolderId = ""
          elements.folderFilter.value = ""
        }
        filtered = filtered.filter((bookmark) => bookmark.isFavorite)
      }
      if (
        uiState.selectedFolderId &&
        uiState.selectedFolderId !== "0" &&
        folders.some((f) => f.id === uiState.selectedFolderId)
      ) {
        filtered = filtered.filter((bookmark) =>
          isInFolder(bookmark, uiState.selectedFolderId),
        )
      } else if (uiState.selectedFolderId && uiState.selectedFolderId !== "0") {
        uiState.selectedFolderId = ""
        elements.folderFilter.value = ""
      }
      if (uiState.searchQuery) {
        const query = uiState.searchQuery.trim()
        // Use improved fuzzy search with scoring
        filtered = filtered
          .map((bookmark) => {
            const titleScore = calculateMatchScore(bookmark.title || "", query)
            const urlScore = calculateMatchScore(bookmark.url || "", query)
            // Also check tags
            let tagScore = 0
            if (bookmark.tags && bookmark.tags.length > 0) {
              for (const tag of bookmark.tags) {
                tagScore = Math.max(tagScore, calculateMatchScore(tag, query))
              }
            }
            const maxScore = Math.max(titleScore, urlScore, tagScore)
            return { bookmark, score: maxScore }
          })
          .filter(({ score }) => score >= 0.4) // Lower threshold for better recall
          .sort((a, b) => b.score - a.score) // Sort by relevance
          .map(({ bookmark }) => bookmark)
      }

      // Render Views
      if (uiState.viewMode === "tree") {
        const rootChildren = bookmarkTreeNodes[0]?.children || []
        renderTreeView(rootChildren, elements)
      } else if (uiState.viewMode === "detail") {
        renderDetailView(filtered, elements)
      } else if (uiState.viewMode === "card") {
        renderCardView(bookmarkTreeNodes, filtered, elements)
      } else {
        renderBookmarks(filtered, elements)
      }

      toggleFolderButtons(elements)
      customSaveUIState()
    },
  )
}

let currentDragType = null
let selectedFolderForContextMenu = null

function renderDetailView(bookmarksList, elements) {
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)
  const language = localStorage.getItem("appLanguage") || "en"

  // Select All Header
  if (uiState.checkboxesVisible) {
    const selectAllDiv = document.createElement("div")
    selectAllDiv.className = "select-all-container"
    selectAllDiv.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 100;`
    selectAllDiv.innerHTML = `
      <input type="checkbox" id="select-all" style="transform: scale(1.2);">
      <label for="select-all" style="font-size: 14px; color: var(--text-primary); font-weight: 500; cursor: pointer;">${translations[language].selectAll}</label>
    `
    fragment.prepend(selectAllDiv)
  }

  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      fragment.appendChild(
        createDetailBookmarkElement(bookmark, language, elements),
      )
    }
  })

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove("tree-view", "card-view")
  elements.folderListDiv.classList.add("detail-view")
  elements.folderListDiv.appendChild(fragment)

  commonPostRenderOps(elements)
}

function renderCardView(bookmarkTreeNodes, filteredBookmarks, elements) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"
  const folders = getFolders(bookmarkTreeNodes)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove("detail-view", "tree-view")
  elements.folderListDiv.classList.add("card-view")

  const isViewingSpecificFolder =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0" &&
    folders.some((f) => f.id === uiState.selectedFolderId)

  if (isViewingSpecificFolder) {
    // --- VIEW 1: Đang xem nội dung 1 Folder cụ thể (Giữ nguyên) ---
    const selectedFolder = findNodeById(
      uiState.selectedFolderId,
      bookmarkTreeNodes,
    )
    if (selectedFolder && selectedFolder.children) {
      // Logic lọc giữ nguyên như cũ
      const folderBookmarks = filteredBookmarks.filter((bookmark) => {
        return (
          bookmark.parentId === selectedFolder.id &&
          matchesSearchQuery(bookmark) &&
          (uiState.sortType !== "favorites" || bookmark.isFavorite) &&
          (uiState.selectedTags.length === 0 ||
            bookmark.tags?.some((tag) => uiState.selectedTags.includes(tag)))
        )
      })
      const sortedBookmarks = sortBookmarks(folderBookmarks, uiState.sortType)

      // Nút Back
      const backButton = document.createElement("button")
      backButton.className = "back-button"
      backButton.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px 16px; margin: 10px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 500;`
      backButton.innerHTML = `<span style="font-size: 16px;">←</span> ${
        translations[language].back || "Back"
      }`
      backButton.addEventListener("click", () => {
        uiState.selectedFolderId = ""
        elements.folderFilter.value = ""
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements),
        )
      })
      fragment.appendChild(backButton)

      elements.folderListDiv.classList.remove("card-view")

      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          // Kéo Bookmark
          el.draggable = true
          el.addEventListener("dragstart", (e) => {
            e.stopPropagation()
            e.dataTransfer.setData("text/plain", bookmark.id)
            currentDragType = "bookmark"
            e.dataTransfer.effectAllowed = "move"
            el.classList.add("dragging")
          })
          el.addEventListener("dragend", () => {
            el.classList.remove("dragging")
            currentDragType = null
          })
          fragment.appendChild(el)
        }
      })
    } else {
      uiState.selectedFolderId = ""
      elements.folderFilter.value = ""
    }
  } else {
    folders.forEach((folder) => {
      if (folder.id === "0") return

      const folderBookmarks = filteredBookmarks.filter(
        (bookmark) =>
          bookmark.parentId === folder.id &&
          matchesSearchQuery(bookmark) &&
          (uiState.sortType !== "favorites" || bookmark.isFavorite) &&
          (uiState.selectedTags.length === 0 ||
            bookmark.tags?.some((tag) => uiState.selectedTags.includes(tag))),
      )

      const sortedBookmarks = sortBookmarks(folderBookmarks, uiState.sortType)

      const folderCard = document.createElement("div")
      folderCard.className = "folder-card"
      folderCard.dataset.folderId = folder.id
      folderCard.draggable = false

      folderCard.innerHTML = `
            <div class="folder-content" style="pointer-events: none;">
                <span class="folder-icon">📂</span>
                <span class="folder-title">${
                  folder.title?.trim() || `Folder ${folder.id}`
                }</span>
                <span class="folder-count">${folderBookmarks.length}</span>
            </div>
            <div class="bookmarks-container"></div>
        `

      // Click mở folder
      folderCard.addEventListener("click", (e) => {
        if (
          e.target.closest(
            ".bookmarks-container, .dropdown-btn, .bookmark-item",
          )
        )
          return
        uiState.selectedFolderId = folder.id
        elements.folderFilter.value = folder.id
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements),
        )
      })

      // Drop Bookmark vào Folder
      folderCard.addEventListener("dragover", (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (currentDragType !== "bookmark") return

        e.dataTransfer.dropEffect = "move"
        folderCard.classList.add("drag-over")
      })

      folderCard.addEventListener("dragleave", (e) => {
        e.stopPropagation()
        if (!folderCard.contains(e.relatedTarget)) {
          folderCard.classList.remove("drag-over")
        }
      })

      folderCard.addEventListener("drop", (e) =>
        handleFolderDrop(
          e,
          folder,
          folderCard,
          bookmarkTreeNodes,
          language,
          elements,
        ),
      )

      // Render Preview Bookmarks
      const bookmarksContainer = folderCard.querySelector(
        ".bookmarks-container",
      )
      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          el.draggable = true
          el.addEventListener("dragstart", (e) => {
            e.stopPropagation()
            e.dataTransfer.setData("text/plain", bookmark.id)
            currentDragType = "bookmark"
            e.dataTransfer.effectAllowed = "move"
            el.classList.add("dragging")
          })
          el.addEventListener("dragend", (e) => {
            e.stopPropagation()
            el.classList.remove("dragging")
            currentDragType = null
          })
          bookmarksContainer.appendChild(el)
        }
      })
      fragment.appendChild(folderCard)
    })
  }

  elements.folderListDiv.appendChild(fragment)
  commonPostRenderOps(elements)
}

function handleFolderDrop(
  e,
  folder,
  folderCard,
  bookmarkTreeNodes,
  language,
  elements,
) {
  e.preventDefault()
  e.stopPropagation()

  folderCard.classList.remove("drag-over")

  const draggedId = e.dataTransfer.getData("text/plain")
  const targetFolderId = folderCard.dataset.folderId

  // Chỉ xử lý nếu đang kéo Bookmark
  if (currentDragType !== "bookmark") return
  if (!draggedId || !targetFolderId) return

  chrome.bookmarks.get(draggedId, (results) => {
    if (!results || !results.length) return
    const bookmark = results[0]

    // Nếu bookmark đã nằm trong folder này rồi thì thôi
    if (bookmark.parentId === targetFolderId) return

    chrome.bookmarks.move(draggedId, { parentId: targetFolderId }, () => {
      if (chrome.runtime.lastError) {
        showCustomPopup(translations[language].errorUnexpected, "error", true)
      } else {
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements),
        )
      }
    })
  })
}

function createSimpleBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id
  const healthIcon = renderHealthIcon(bookmark.id)
  const visitCountBadge = renderVisitCount(bookmark.id)
  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""

  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${
      bookmark.id
    }" ${isChecked} style="display: ${checkboxDisplay}; transform: scale(1.2);">
    <div class="bookmark-content">
      <div class="bookmark-favicon"><img src="${favicon}" alt="icon" onerror="this.onerror=()=>{this.style.display='none'}; this.src='https://icons.duckduckgo.com/ip3/${hostname}.ico';"></div>
      <a href="${bookmark.url}" target="_blank" class="card-bookmark-title">${
        bookmark.title || bookmark.url
      }</a>
   ${healthIcon} 
   ${visitCountBadge}
    ${createDropdownHTML(bookmark, language)}
    </div>
  `

  div
    .querySelector(".card-bookmark-title")
    .addEventListener("click", () =>
      handleBookmarkLinkClick(bookmark.id, elements),
    )
  attachDropdownToggle(div)
  return div
}

function createDetailBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item detail-bookmark-item ${
    bookmark.isFavorite ? "favorited" : ""
  }`
  div.dataset.id = bookmark.id
  div.style.cssText = `display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--hover-bg); box-shadow: var(--shadow-sm);`
  const healthIcon = renderHealthIcon(bookmark.id) // Lấy icon
  const visitCountBadge = renderVisitCount(bookmark.id)

  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div class="bookmark-favicon" style="width:32px;height:32px;border-radius:6px;overflow:hidden;background:white; display:flex;justify-content:center;align-items:center;">
        <img src="${favicon}" style="width:20px;height:20px;object-fit:contain;" onerror="this.onerror=()=>{this.src='./images/default-favicon.png'}; this.src='https://icons.duckduckgo.com/ip3/${hostname}.ico';">
      </div>
      <a href="${
        bookmark.url
      }" target="_blank" style="flex:1;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${bookmark.title || bookmark.url}
      </a>
       ${healthIcon} 
       ${visitCountBadge}
      ${createDropdownHTML(bookmark, language)}
    </div>
    <div class="bookmark_link" style="font-size:13px;color:var(--text-muted);opacity:0.85; display:flex; gap: 10px;">
        <span>${extractDomain(bookmark.url)}</span>
    </div>
    <button class="view-detail-btn-action" style="background:var(--text-primary);color:var(--bg-primary);border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-weight:600;margin-top:8px; width:100%;">
      ${translations[language].viewDetail || "View Details"}
    </button>
  `

  div
    .querySelector(".view-detail-btn-action")
    .addEventListener("click", (e) => {
      e.stopPropagation()
      openWebPreviewModal(bookmark) // GỌI HÀM XEM WEB (IFRAME)
    })

  attachDropdownToggle(div)
  return div
}

function renderBookmarks(bookmarksList, elements) {
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove(
    "tree-view",
    "card-view",
    "detail-view",
  )

  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url)
      fragment.appendChild(createBookmarkElement(bookmark, 0, elements))
  })

  elements.folderListDiv.appendChild(fragment)
  commonPostRenderOps(elements)
}

function renderTreeView(nodes, elements, depth = 0, targetElement = null) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"

  const actualTargetElement = targetElement || elements.folderListDiv // Use targetElement or default

  // Setup container lần đầu
  if (depth === 0) {
    actualTargetElement.innerHTML = ""
    actualTargetElement.classList.add("tree-view")
    if (uiState.checkboxesVisible) {
      const selectAllDiv = document.createElement("div")
      selectAllDiv.className = "select-all"
      fragment.appendChild(selectAllDiv)
    }
  }

  // Logic lọc nodes để render (giữ nguyên của bạn)
  let nodesToRender = nodes
  if (
    depth === 0 &&
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0"
  ) {
    const selectedFolder = findNodeById(
      uiState.selectedFolderId,
      uiState.bookmarkTree,
    )
    nodesToRender =
      selectedFolder && selectedFolder.children ? [selectedFolder] : []
  }

  const folders = nodesToRender
    .filter((node) => node.children)
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
  const bookmarks = nodesToRender.filter((node) => node.url)
  const sortedBookmarks = sortBookmarks(bookmarks, uiState.sortType)

  // --- LOOP QUA TỪNG NODE ---
  ;[...folders, ...sortedBookmarks].forEach((node) => {
    // Logic filter (Search, Tag, Favorite...)
    const matchesSearch = matchesSearchQuery(node)
    const matchesFavorite =
      uiState.sortType === "favorites" ? node.isFavorite : true
    const matchesTag =
      uiState.selectedTags.length > 0
        ? node.tags?.some((tag) => uiState.selectedTags.includes(tag))
        : true

    const status = uiState.healthStatus ? uiState.healthStatus[node.id] : null
    const matchesHealth =
      !uiState.healthFilter || uiState.healthFilter === "all"
        ? true
        : status &&
          ((uiState.healthFilter === "dead" && status === "dead") ||
            (uiState.healthFilter === "suspicious" &&
              status === "alive_suspicious") ||
            (uiState.healthFilter === "safe" && status === "alive_safe"))

    // >>> TRƯỜNG HỢP LÀ FOLDER <<<
    if (node.children) {
      const isCollapsed = uiState.collapsedFolders.has(node.id)
      const folderDiv = document.createElement("div")
      folderDiv.className = "folder-item"
      folderDiv.dataset.id = node.id
      folderDiv.draggable = true // Enable dragging for folders
      folderDiv.style.marginLeft = `${depth * 20}px`

      // HTML hiển thị Folder
      folderDiv.innerHTML = `
        <div class="folder-toggle" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid var(--text-primary);border-radius:6px;cursor:pointer;margin-right:8px;font-weight:bold;">${
          isCollapsed ? "+" : "−"
        }</div>
        <span class="folder-icon" style="margin-right:8px;font-size:18px;">${
          isCollapsed ? "📁" : "📂"
        }</span>
        <span class="folder-title" style="flex-grow:1;font-weight:600;">${
          node.title || `Folder ${node.id}`
        }</span>
        <span class="folder-count" style="background:var(--bg-secondary);padding:2px 8px;border-radius:12px;font-size:12px;">${countFolderItems(
          node,
        )}</span>
        <button class="button delete-folder-tree-btn" data-id="${node.id}" style="margin-left: 8px; background: none; border: none; color: var(--text-muted); cursor: pointer;" title="${translations[language].deleteFolder}">
            <i class="fas fa-trash"></i>
        </button>
      `

      // Add dragstart event listener for folders
      folderDiv.addEventListener("dragstart", (e) => {
        e.stopPropagation()
        e.dataTransfer.setData("text/plain", node.id)
        currentDragType = "folder"
        e.dataTransfer.effectAllowed = "move"
        folderDiv.classList.add("dragging")
      })

      // Add dragend event listener for folders
      folderDiv.addEventListener("dragend", () => {
        folderDiv.classList.remove("dragging")
        currentDragType = null
      })

      // >>> SỰ KIỆN 1: DRAG OVER (Khi rê bookmark hoặc folder lên trên Folder này)
      folderDiv.addEventListener("dragover", (e) => {
        e.preventDefault()
        e.stopPropagation()

        // Chỉ nhận Bookmark hoặc Folder
        if (currentDragType !== "bookmark" && currentDragType !== "folder")
          return

        const draggedId = e.dataTransfer.getData("text/plain")
        // Prevent dropping a folder onto itself or into its own subfolder
        if (currentDragType === "folder") {
          // Cannot drop a folder onto itself
          if (draggedId === node.id) {
            e.dataTransfer.dropEffect = "none"
            folderDiv.classList.remove("drag-over")
            return
          }
          // Cannot drop a folder into one of its own descendants
          const draggedNode = findNodeById(draggedId, uiState.bookmarkTree)
          if (draggedNode && isAncestorOf(draggedNode, node.id)) {
            e.dataTransfer.dropEffect = "none"
            folderDiv.classList.remove("drag-over")
            return
          }
        }

        e.dataTransfer.dropEffect = "move"
        folderDiv.classList.add("drag-over")

        startAutoscroll(actualTargetElement, e) // Start autoscroll
      })

      // >>> SỰ KIỆN 2: DRAG LEAVE (Khi rê bookmark ra khỏi Folder này)
      folderDiv.addEventListener("dragleave", (e) => {
        e.stopPropagation()
        // Chỉ remove class nếu thực sự rời khỏi folder
        if (!folderDiv.contains(e.relatedTarget)) {
          folderDiv.classList.remove("drag-over")
        }
        stopAutoscroll() // Stop autoscroll
      })

      // >>> SỰ KIỆN 3: DROP (Khi thả bookmark hoặc folder vào Folder này)
      folderDiv.addEventListener("drop", (e) => {
        e.preventDefault()
        e.stopPropagation()

        stopAutoscroll() // Stop autoscroll
        // Remove drag-over class
        folderDiv.classList.remove("drag-over")

        const draggedId = e.dataTransfer.getData("text/plain")
        const targetFolderId = node.id

        if (!draggedId || !targetFolderId) return

        if (currentDragType === "bookmark") {
          // Existing bookmark drop logic
          chrome.bookmarks.get(draggedId, (results) => {
            if (!results || !results.length) return
            const bookmark = results[0]

            if (bookmark.parentId === targetFolderId) return

            chrome.bookmarks.move(
              draggedId,
              { parentId: targetFolderId },
              () => {
                if (chrome.runtime.lastError) {
                  showCustomPopup(
                    translations[language].errorUnexpected,
                    "error",
                    true,
                  )
                }
              },
            ) // Removed else block to avoid double reload
          })
        } else if (currentDragType === "folder") {
          // New folder drop logic
          // Prevent dropping a folder onto itself
          if (draggedId === targetFolderId) {
            showCustomPopup(
              translations[language].errorCannotMoveFolderToSelf ||
                "Cannot move folder to itself.",
              "error",
              true,
            )
            return
          }

          // Prevent dropping a folder into one of its own descendants
          const draggedNode = findNodeById(draggedId, uiState.bookmarkTree)
          if (draggedNode && isAncestorOf(draggedNode, targetFolderId)) {
            showCustomPopup(
              translations[language].errorCannotMoveFolderToDescendant ||
                "Cannot move folder to its descendant.",
              "error",
              true,
            )
            return
          }

          chrome.bookmarks.move(draggedId, { parentId: targetFolderId }, () => {
            if (chrome.runtime.lastError) {
              showCustomPopup(
                translations[language].errorUnexpected ||
                  "An unexpected error occurred while moving folder.",
                "error",
                true,
              )
            } else {
              chrome.bookmarks.getTree((tree) =>
                renderFilteredBookmarks(tree, elements),
              )
            }
          })
        }
        // Reload tree after any successful move operation (bookmark or folder)
        chrome.bookmarks.getTree((tree) => {
          uiState.bookmarkTree = tree
          renderFilteredBookmarks(tree, elements)
          // Refresh organize folders popup if it's open
          refreshOrganizeFoldersPopup(elements)
        })
      })

      fragment.appendChild(folderDiv)

      // Xử lý đệ quy cho con cháu (Children)
      const childrenContainer = document.createElement("div")
      childrenContainer.className = "folder-children"
      childrenContainer.style.display = isCollapsed ? "none" : "block"
      childrenContainer.setAttribute("data-depth", depth + 1)

      // Tự gọi lại chính nó nếu folder mở
      if (!isCollapsed)
        childrenContainer.appendChild(
          renderTreeView(node.children, elements, depth + 1),
        )
      fragment.appendChild(childrenContainer)
    }
    // >>> TRƯỜNG HỢP LÀ BOOKMARK <<<
    else if (
      node.url &&
      matchesSearch &&
      matchesFavorite &&
      matchesTag &&
      matchesHealth
    ) {
      // Gọi hàm tạo bookmark (đã update ở trên để có thể drag)
      fragment.appendChild(createEnhancedBookmarkElement(node, depth, elements))
    }
  })

  // Chỉ gắn listener tổng ở lần gọi đầu tiên (root)
  if (depth === 0) {
    actualTargetElement.appendChild(fragment)
    // Call commonPostRenderOps to attach listeners for buttons inside bookmarks
    commonPostRenderOps(elements)
    // Call attachTreeListeners with the correct element for event delegation
    if (targetElement) {
      // If rendering to a specific target (popup), attach listeners to it
      attachTreeListeners(elements, actualTargetElement) // Pass elements and the popup's target element
    } else {
      // If rendering to the main folderListDiv
      attachTreeListeners(elements)
    }
  }
  return fragment
}

function createEnhancedBookmarkElement(bookmark, depth = 0, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  const healthIcon = renderHealthIcon(bookmark.id) // Lấy icon
  const visitCountBadge = renderVisitCount(bookmark.id)
  // Class css
  div.className = `bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id

  // >>> QUAN TRỌNG: Bật tính năng kéo
  div.draggable = true

  // Style layout
  div.style.cssText = `display: flex; align-items: center; gap: 8px; margin: 7px 0; padding: 12px 16px; border: 1px solid transparent; box-shadow: var(--shadow-sm); margin-left: ${
    depth * 20
  }px; transition: opacity 0.2s;`

  // >>> XỬ LÝ SỰ KIỆN KÉO (DRAG START)
  div.addEventListener("dragstart", (e) => {
    e.stopPropagation() // Ngăn sự kiện lan ra ngoài

    // Lưu ID của bookmark đang kéo
    e.dataTransfer.setData("text/plain", bookmark.id)
    e.dataTransfer.effectAllowed = "move"

    // Đánh dấu toàn cục là đang kéo bookmark
    currentDragType = "bookmark"

    // Hiệu ứng mờ đi khi đang kéo (dùng class thay vì inline style)
    div.classList.add("dragging")
  })

  // >>> XỬ LÝ KẾT THÚC KÉO (DRAG END)
  div.addEventListener("dragend", (e) => {
    e.stopPropagation()
    div.classList.remove("dragging")
    currentDragType = null // Reset biến toàn cục
  })

  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  // (Phần render HTML bên trong giữ nguyên)
  const tagsHtml = createTagsHTML(bookmark.tags)
  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""

  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${
      bookmark.id
    }" ${isChecked} style="display: ${checkboxDisplay}; transform: scale(1.2);">
    <div class="bookmark-favicon" style="width: 22px; height: 22px; border-radius: 4px; overflow: hidden; background: white; display: flex; justify-content: center; align-items: center;">
      <img src="${favicon}" style="width: 90%; height: 90%; object-fit: cover;" onerror="this.onerror=()=>{this.style.display='none'}; this.src='https://icons.duckduckgo.com/ip3/${hostname}.ico';">
    </div>
    <a href="${
      bookmark.url
    }" target="_blank" class="bookmark-title" style="flex: 1; color: var(--text-primary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
      bookmark.title
    }">
      ${bookmark.title || bookmark.url}
    </a>
       ${healthIcon} 
       ${visitCountBadge}
    <div class="bookmark-url" style="font-size: 11px; color: var(--text-secondary); opacity: 0.7; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${extractDomain(
      bookmark.url,
    )}</div>
    <div class="bookmark-tags" style="display: flex; gap: 4px;">${tagsHtml}</div>
    ${
      uiState.showBookmarkIds
        ? `<span class="bookmark-id" style="font-size: 11px; color: #888;">[${bookmark.id}]</span>`
        : ""
    }
    ${createDropdownHTML(bookmark, language)}
  `

  div
    .querySelector(".bookmark-title")
    .addEventListener("click", () =>
      handleBookmarkLinkClick(bookmark.id, elements),
    )
  attachDropdownToggle(div)
  return div
}

function createBookmarkElement(bookmark, depth = 0, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = "bookmark-item"
  div.style.marginLeft = `${depth * 20}px`
  const healthIcon = renderHealthIcon(bookmark.id)
  const visitCountBadge = renderVisitCount(bookmark.id)

  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""
  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${
      bookmark.id
    }" ${isChecked} style="display: ${checkboxDisplay}">
    <img src="${favicon}" alt="fav" class="favicon" onerror="this.onerror=()=>{this.src='./images/default-favicon.png'}; this.src='https://icons.duckduckgo.com/ip3/${hostname}.ico';">
    <a href="${bookmark.url}" target="_blank" class="link">${
      bookmark.title || bookmark.url
    }</a>
    ${healthIcon} 
    ${visitCountBadge}
    ${
      uiState.showBookmarkIds
        ? `<span class="bookmark-id">[ID: ${bookmark.id}]</span>`
        : ""
    }
    ${createDropdownHTML(bookmark, language)}
  `

  div
    .querySelector(".link")
    .addEventListener("click", () =>
      handleBookmarkLinkClick(bookmark.id, elements),
    )
  attachDropdownToggle(div)
  return div
}

// ==========================================
// UTILITY & EVENT FUNCTIONS
// ==========================================

function commonPostRenderOps(elements) {
  elements.searchInput.value = uiState.searchQuery || ""
  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
  elements.sortFilter.value = uiState.sortType || "default"

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)

  // --- MANUAL EVENT HANDLERS (Since some are dynamic) ---

  // 1. PIN Buttons
  const pinButtons = elements.folderListDiv.querySelectorAll(".pin-btn")
  pinButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const bookmarkId = btn.getAttribute("data-id")
      togglePin(bookmarkId, elements)
      const dropdownMenu = btn.closest(".dropdown-menu")
      if (dropdownMenu) dropdownMenu.classList.add("hidden")
    })
  })

  // 2. DETAIL Buttons (In Dropdown Menu)
  const detailButtons = elements.folderListDiv.querySelectorAll(
    ".menu-item.view-detail-btn",
  )
  detailButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const id = btn.dataset.id
      const bookmark = uiState.bookmarks.find((b) => b.id === id)

      // GỌI HÀM XEM THUỘC TÍNH (METADATA)
      if (bookmark) openBookmarkPropertiesModal(bookmark)

      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
    })
  })

  // 3. QR Code Buttons
  const qrCodeButtons = elements.folderListDiv.querySelectorAll(".qr-code-btn")
  qrCodeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const bookmarkId = btn.getAttribute("data-id")
      const bookmark = uiState.bookmarks.find((b) => b.id === bookmarkId)
      if (bookmark) {
        const faviconUrl = getFaviconUrl(bookmark.url)
        generateQRCodePopup(bookmark.url, bookmark.title, faviconUrl)
      }
      const dropdownMenu = btn.closest(".dropdown-menu")
      if (dropdownMenu) dropdownMenu.classList.add("hidden")
    })
  })

  // 4. Open Side Panel Buttons
  const openSidePanelButtons = elements.folderListDiv.querySelectorAll(
    ".open-side-panel-btn",
  )
  openSidePanelButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const bookmarkId = btn.getAttribute("data-id")
      const bookmark = uiState.bookmarks.find((b) => b.id === bookmarkId)
      if (bookmark) {
        handleOpenSidePanel(bookmark)
      }
      const dropdownMenu = btn.closest(".dropdown-menu")
      if (dropdownMenu) dropdownMenu.classList.add("hidden")
    })
  })
}

function attachSelectAllListener(elements) {
  const selectAllCheckbox = document.getElementById("select-all")
  if (!selectAllCheckbox) return

  selectAllCheckbox.removeEventListener("change", handleSelectAll)
  selectAllCheckbox.addEventListener("change", handleSelectAll)

  function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll(".bookmark-checkbox")
    if (e.target.checked) {
      checkboxes.forEach((cb) => {
        cb.checked = true
        uiState.selectedBookmarks.add(cb.dataset.id)
      })
    } else {
      checkboxes.forEach((cb) => (cb.checked = false))
      uiState.selectedBookmarks.clear()
    }
    elements.addToFolderButton.classList.toggle(
      "hidden",
      uiState.selectedBookmarks.size === 0,
    )
    elements.deleteBookmarksButton.classList.toggle(
      "hidden",
      uiState.selectedBookmarks.size === 0,
    )
  }
}

export function setupTagFilterListener(elements) {
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  const tagFilterDropdown = elements.tagFilterContainer?.querySelector(
    "#tag-filter-dropdown",
  )
  if (!tagFilterToggle || !tagFilterDropdown) return

  tagFilterToggle.onclick = (e) => {
    e.stopPropagation()
    tagFilterDropdown.classList.toggle("hidden")
  }
  document.onclick = (e) => {
    if (!elements.tagFilterContainer.contains(e.target))
      tagFilterDropdown.classList.add("hidden")
  }

  tagFilterDropdown.onchange = (e) => {
    if (e.target.type === "checkbox") {
      uiState.selectedTags = Array.from(
        tagFilterDropdown.querySelectorAll('input[type="checkbox"]:checked'),
      ).map((cb) => cb.value)
      tagFilterToggle.textContent =
        uiState.selectedTags.length > 0
          ? uiState.selectedTags.join(", ")
          : translations[localStorage.getItem("appLanguage") || "en"].allTags
      customSaveUIState()
      chrome.bookmarks.getTree((tree) =>
        renderFilteredBookmarks(tree, elements),
      )
    }
  }
}

export function attachTreeListeners(elements, targetContainer = null) {
  const container = targetContainer || elements.folderListDiv

  // Add contextmenu listener to the container
  container.addEventListener("contextmenu", (e) => {
    const folderItem = e.target.closest(".folder-item")
    if (folderItem) {
      e.preventDefault() // Prevent default browser context menu
      selectedFolderForContextMenu = folderItem.dataset.id // Store folder ID

      const contextMenu = elements.folderContextMenu
      contextMenu.style.left = `${e.clientX}px`
      contextMenu.style.top = `${e.clientY}px`
      contextMenu.classList.remove("hidden")

      // Apply current theme to context menu
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light"
      const allThemes = ["light", "dark", "dracula", "onedark"]
      allThemes.forEach((theme) =>
        contextMenu.classList.remove(`${theme}-theme`),
      )
      contextMenu.classList.add(`${currentTheme}-theme`)
    } else {
      // If right-clicked outside a folder item, hide the menu
      elements.folderContextMenu?.classList.add("hidden")
    }
  })

  // Hide context menu when clicking anywhere else
  document.body.addEventListener("click", () => {
    elements.folderContextMenu?.classList.add("hidden")
  })

  container.onclick = (e) => {
    // 1. PIN Button in Tree View
    const pinBtn = e.target.closest(".pin-btn")
    if (pinBtn) {
      e.stopPropagation()
      const bookmarkId = pinBtn.dataset.id
      togglePin(bookmarkId, elements)
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      return
    }

    // 2. DETAIL Button in Tree View (Dropdown)
    const detailBtn = e.target.closest(".menu-item.view-detail-btn")
    if (detailBtn) {
      e.stopPropagation()
      const id = detailBtn.dataset.id
      const bookmark = uiState.bookmarks.find((b) => b.id === id)

      if (bookmark) openBookmarkPropertiesModal(bookmark)

      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      return
    }

    // 4. Folder Toggle (Logic đóng mở folder)
    const toggle = e.target.closest(".folder-toggle")
    if (toggle) {
      e.stopPropagation()
      const folderDiv = toggle.closest(".folder-item")
      const folderId = folderDiv.dataset.id
      const childrenContainer = folderDiv.nextElementSibling

      if (uiState.collapsedFolders.has(folderId)) {
        // Mở folder ra
        uiState.collapsedFolders.delete(folderId)
        toggle.textContent = "−"
        folderDiv.querySelector(".folder-icon").textContent = "📂"
        if (childrenContainer) {
          childrenContainer.style.display = "block"
          // Nếu chưa có nội dung thì render mới
          if (childrenContainer.innerHTML === "") {
            const node = findNodeById(folderId, uiState.bookmarkTree)
            if (node && node.children)
              childrenContainer.appendChild(
                renderTreeView(
                  node.children,
                  elements,
                  parseInt(childrenContainer.getAttribute("data-depth")) || 1,
                ),
              )
          }
        }
      } else {
        // Đóng folder lại
        uiState.collapsedFolders.add(folderId)
        toggle.textContent = "+"
        folderDiv.querySelector(".folder-icon").textContent = "📁"
        if (childrenContainer) childrenContainer.style.display = "none"
      }
      customSaveUIState()
      return
    }

    // 4. Dropdown closing logic
    if (
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu") &&
      !e.target.closest(".delete-folder-tree-btn") // Allow delete button to not close dropdown
    ) {
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
    }
  }

  // Handle delete folder button clicks in tree view
  const deleteFolderTreeButtons = container.querySelectorAll(
    ".delete-folder-tree-btn",
  )
  deleteFolderTreeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation() // Prevent folder toggle and other click handlers
      const folderId = btn.dataset.id
      const language = localStorage.getItem("appLanguage") || "en"
      const t = translations[language] || translations.en

      try {
        // Call the centralized deleteFolder function
        handleDeleteFolder(folderId, elements)
        // showCustomConfirm is handled internally by handleDeleteFolder
      } catch (deleteError) {
        console.error("Error initiating folder deletion:", deleteError)
        showCustomPopup(
          t.errorUnexpected ||
            "An unexpected error occurred while trying to delete the folder.",
          "error",
          true,
        )
      }
    })
  })

  // Attach listener for "Move to Folder" context menu item
  if (elements.contextMenuMoveFolderButton) {
    elements.contextMenuMoveFolderButton.onclick = (e) => {
      e.stopPropagation() // Prevent document.body click from immediately closing it
      elements.folderContextMenu?.classList.add("hidden") // Hide context menu

      if (selectedFolderForContextMenu) {
        showMoveFolderToFolderPopup(elements, selectedFolderForContextMenu)
      } else {
        showCustomPopup(
          translations[localStorage.getItem("appLanguage") || "en"]
            .errorUnexpected || "An unexpected error occurred.",
          "error",
          true,
        )
      }
    }
  }

  // Giữ lại các listener phụ trợ (Chỉ gọi cho main UI, không gọi cho popup)
  if (!targetContainer) {
    attachSelectAllListener(elements)
    attachDropdownListeners(elements)
    setupBookmarkActionListeners(elements)
  }
}

export function populateFolderDropdown(
  selectElement,
  bookmarkTreeNodes,
  language,
  initialOptionText,
) {
  if (!selectElement) return
  // Lấy bản dịch
  const t = translations[language] || translations.en

  // Reset select và thêm option mặc định (ví dụ: "Tất cả bookmarks")
  selectElement.innerHTML = `<option value="">${initialOptionText}</option>`

  // --- HÀM ĐỆ QUY ĐỂ TẠO CÁC OPTION ---
  function buildFolderOptions(nodes, depth = 0) {
    // Sắp xếp các thư mục theo tên trước khi render
    const folders = nodes
      .filter((node) => node.children) // Chỉ lấy những node là folder
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))

    folders.forEach((node) => {
      // Bỏ qua thư mục gốc hệ thống (id="0")
      if (node.id === "0") {
        // Nếu muốn render con của root, gọi đệ quy tiếp
        if (node.children.length > 0) buildFolderOptions(node.children, depth)
        return
      }

      const option = document.createElement("option")
      option.value = node.id

      // --- LOGIC MỚI: Xử lý tên và ký tự thụt đầu dòng ---

      // Xử lý tên hiển thị đa ngôn ngữ cho các folder đặc biệt
      let displayName = node.title || `Folder ${node.id}`
      if (node.id === "1") displayName = t.bookmarksBar || "Bookmarks Bar"
      else if (node.id === "2")
        displayName = t.otherBookmarks || "Other Bookmarks"

      // Tạo ký tự thụt đầu dòng (prefix)
      // depth = 0: không có gì
      // depth = 1:   └─
      // depth = 2:     └─
      const prefix = depth > 0 ? "\u00A0\u00A0".repeat(depth) + "└─ " : ""

      option.textContent = `${prefix}${displayName}`
      selectElement.appendChild(option)
      // --- KẾT THÚC LOGIC MỚI ---

      // Gọi đệ quy cho các thư mục con
      if (node.children.length > 0) {
        buildFolderOptions(node.children, depth + 1)
      }
    })
  }

  // Bắt đầu quá trình build từ cây bookmark
  if (bookmarkTreeNodes && bookmarkTreeNodes.length > 0) {
    // Thường bắt đầu từ children của node gốc (vì node gốc id="0" không hiển thị)
    buildFolderOptions(bookmarkTreeNodes[0].children, 0)
  }
}

export function populateFolderFilter(bookmarkTreeNodes, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const folderFilter = elements.folderFilter
  if (!folderFilter) return
  populateFolderDropdown(
    folderFilter,
    bookmarkTreeNodes,
    language,
    translations[language].allBookmarks,
  )

  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    folderFilter.value = ""
  }
}

export function showMoveFolderToFolderPopup(elements, folderToMoveId) {
  const popup = elements.addToFolderPopup
  const select = elements.addToFolderSelect
  const saveButton = elements.addToFolderSaveButton
  const cancelButton = elements.addToFolderCancelButton
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en

  // 1. Reset select và hiện popup
  select.innerHTML = `<option value="">${t.loading || "Loading..."}</option>`

  // Đổi tiêu đề popup cho đúng ngữ cảnh
  const titleElement = popup.querySelector("h3")
  if (titleElement)
    titleElement.textContent = t.moveToFolderTitle || "Move Folder"

  popup.classList.remove("hidden")

  // Áp dụng theme
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light"
  const allThemes = ["light", "dark", "dracula", "onedark", "tet"]
  allThemes.forEach((theme) => popup.classList.remove(`${theme}-theme`))
  popup.classList.add(`${currentTheme}-theme`)

  // 2. Hàm đệ quy tạo Options (Tree View)
  function buildOptions(nodes, depth = 0) {
    const folders = nodes
      .filter((node) => node.children) // Chỉ lấy folder
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))

    folders.forEach((node) => {
      // --- LOGIC QUAN TRỌNG: NGĂN CHẶN DI CHUYỂN VÀO CHÍNH MÌNH ---
      // Nếu node hiện tại chính là folder đang muốn di chuyển -> Bỏ qua nó và toàn bộ con của nó.
      // Điều này ngăn chặn việc hiển thị folder đó và các folder con trong danh sách chọn.
      if (node.id === folderToMoveId) return

      // Bỏ qua root (0) nhưng vẫn duyệt con
      if (node.id === "0") {
        if (node.children.length > 0) buildOptions(node.children, depth)
        return
      }

      const option = document.createElement("option")
      option.value = node.id

      // Tên hiển thị
      let displayName = node.title || "Unnamed Folder"
      if (node.id === "1") displayName = t.bookmarksBar || "Bookmarks Bar"
      else if (node.id === "2")
        displayName = t.otherBookmarks || "Other Bookmarks"

      // Tạo thụt đầu dòng
      const prefix = depth > 0 ? "\u00A0\u00A0".repeat(depth) + "└─ " : ""

      option.textContent = `${prefix}${displayName}`
      select.appendChild(option)

      // Đệ quy
      if (node.children.length > 0) {
        buildOptions(node.children, depth + 1)
      }
    })
  }

  // 3. Gọi API lấy cây mới nhất
  chrome.bookmarks.getTree((tree) => {
    select.innerHTML = `<option value="">${
      t.selectFolder || "Select Folder"
    }</option>`
    if (tree && tree.length > 0) {
      buildOptions(tree[0].children, 0)
    }
    select.focus()
  })

  // 4. Xử lý Listeners (Clone để xóa event cũ)

  // Check if buttons exist
  if (!saveButton || !cancelButton) {
    console.error("Save or Cancel button not found in popup")
    return
  }

  // Clone nút Save
  const newSaveBtn = saveButton.cloneNode(true)
  saveButton.parentNode.replaceChild(newSaveBtn, saveButton)

  // Clone nút Cancel
  const newCancelBtn = cancelButton.cloneNode(true)
  cancelButton.parentNode.replaceChild(newCancelBtn, cancelButton)

  // Gán lại biến tham chiếu (để dùng bên dưới nếu cần, dù ở đây dùng biến local newSaveBtn là được)
  const currentSaveBtn = newSaveBtn
  const currentCancelBtn = newCancelBtn

  const closePopup = () => {
    popup.classList.add("hidden")
    // Trả lại tiêu đề mặc định cho popup (vì popup này dùng chung cho cả Add Bookmark)
    if (titleElement)
      titleElement.textContent = t.addToFolderTitle || "Add to Folder"

    document.removeEventListener("keydown", handleKeydown)
    popup.removeEventListener("click", handleClickOutside)
  }

  // Handler Save
  currentSaveBtn.addEventListener("click", () => {
    const targetFolderId = select.value
    if (!targetFolderId) {
      // Hiển thị lỗi trên select (thêm class error css nếu có)
      select.classList.add("error")
      showCustomPopup(
        t.selectFolderError || "Please select a destination.",
        "error",
        true,
      )
      return
    }

    // Thực hiện di chuyển Folder
    chrome.bookmarks.move(folderToMoveId, { parentId: targetFolderId }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
        showCustomPopup(t.errorUnexpected || "Move failed.", "error", true)
      } else {
        showCustomPopup(
          t.moveFolderSuccess || "Folder moved successfully!",
          "success",
          true,
        )

        // Render lại giao diện chính
        chrome.bookmarks.getTree(async (tree) => {
          // Giả định hàm renderFilteredBookmarks được import trong ui.js hoặc file này
          // Nếu trong ui.js hàm này gọi lại chính nó thì ok.
          // Nếu không, bạn cần đảm bảo hàm renderFilteredBookmarks khả dụng.
          // Trong file ui.js gốc của bạn hàm renderFilteredBookmarks đã được export, nên gọi đệ quy hoặc gọi trực tiếp đều ổn.

          // Vì đây là file ui.js, ta có thể gọi hàm renderFilteredBookmarks trực tiếp (nếu nó nằm cùng file)
          // hoặc gọi thông qua đệ quy nếu cần thiết.
          // Dựa vào code cũ, hàm renderFilteredBookmarks nằm ngay trong file ui.js
          const { renderFilteredBookmarks } = await import("./ui.js") // Dynamic import để tránh lỗi vòng lặp nếu cần, hoặc gọi trực tiếp nếu cùng scope

          // Tuy nhiên, vì showMoveFolderToFolderPopup nằm cùng file ui.js với renderFilteredBookmarks,
          // ta có thể gọi trực tiếp (do hoisting function):
          renderFilteredBookmarks(tree, elements)
        })
      }
      closePopup()
    })
  })

  // Handler Cancel
  currentCancelBtn.addEventListener("click", closePopup)

  // Handler Click Outside
  const handleClickOutside = (e) => {
    if (e.target === popup) closePopup()
  }
  popup.addEventListener("click", handleClickOutside)

  // Handler Keyboard
  const handleKeydown = (e) => {
    if (e.key === "Escape") closePopup()
    if (e.key === "Enter") currentSaveBtn.click()
  }
  document.addEventListener("keydown", handleKeydown)
}

// Helper function to render the tree view specifically for the Organize Folders popup
function renderOrganizeFoldersTree(elements, container) {
  chrome.bookmarks.getTree((tree) => {
    // uiState.bookmarkTree needs to be updated with the latest tree for findNodeById and isAncestorOf
    uiState.bookmarkTree = tree
    renderTreeView(tree[0].children, elements, 0, container)
  })
}

// Helper function to refresh organize folders popup if it's open
function refreshOrganizeFoldersPopup(elements) {
  const popup = document.getElementById("organize-folders-popup")
  const treeViewContainer = document.getElementById(
    "organize-folders-tree-view",
  )

  if (popup && !popup.classList.contains("hidden") && treeViewContainer) {
    // Refresh the tree view in the popup
    chrome.bookmarks.getTree((tree) => {
      uiState.bookmarkTree = tree
      treeViewContainer.innerHTML = ""
      renderTreeView(tree[0].children, elements, 0, treeViewContainer)
    })
  }
}

function updateBookmarkCount(bookmarks, elements) {
  const language = localStorage.getItem("appLanguage") || "en"

  // Lấy ID từ State. Nếu state rỗng mới lấy từ Dropdown.
  let currentFolderId = uiState.selectedFolderId
  if (!currentFolderId || currentFolderId === "0") {
    currentFolderId = elements.folderFilter.value
  }

  let count = 0

  // Trường hợp 1: Có chọn Folder (Khác '0' và khác rỗng)
  if (currentFolderId && currentFolderId !== "0") {
    // SỬA LỖI: Đếm những bookmark là con trực tiếp của folder này
    // Dùng parentId === id sẽ chính xác hơn isInFolder trong trường hợp này
    count = bookmarks.filter(
      (b) => b.url && b.parentId === currentFolderId,
    ).length

    // Nếu vẫn bằng 0 (có thể do logic đệ quy), thử dùng isInFolder làm phương án dự phòng
    if (count === 0 && bookmarks.some((b) => b.parentId === currentFolderId)) {
      count = bookmarks.filter(
        (b) => b.url && isInFolder(b, currentFolderId),
      ).length
    }
  }
  // Trường hợp 2: Lọc theo Favorites
  else if (uiState.sortType === "favorites") {
    count = bookmarks.filter((b) => b.url && b.isFavorite).length
  }
  // Trường hợp 3: Mặc định (Hiện tất cả)
  else {
    count = bookmarks.filter((b) => b.url).length
  }

  elements.bookmarkCountDiv.textContent = `${translations[language].totalBookmarks}: ${count}`
}

function toggleFolderButtons(elements) {
  const isUserCreated =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "1" &&
    uiState.selectedFolderId !== "2"
  elements.deleteFolderButton.classList.toggle("hidden", !isUserCreated)
  elements.renameFolderButton.classList.toggle("hidden", !isUserCreated)
}

function sortBookmarks(list, type) {
  // Map visit counts from background script to accessCount for sorting
  const bookmarksWithCounts = list.map((bookmark) => ({
    ...bookmark,
    accessCount: uiState.visitCounts
      ? uiState.visitCounts[bookmark.id] || 0
      : 0,
  }))

  const pinned = bookmarksWithCounts.filter((b) => b.isPinned)
  const unpinned = bookmarksWithCounts.filter((b) => !b.isPinned)

  const sortFn = (a, b) => {
    switch (type) {
      case "favorites":
        return (b.dateAdded || 0) - (a.dateAdded || 0)
      case "default":
      case "new":
        return (b.dateAdded || 0) - (a.dateAdded || 0)
      case "old":
        return (a.dateAdded || 0) - (b.dateAdded || 0)
      case "a-z":
        return (a.title || a.url).localeCompare(b.title || b.url)
      case "z-a":
        return (b.title || b.url).localeCompare(a.title || b.url)
      case "most-visited":
        return (b.accessCount || 0) - (a.accessCount || 0)
      case "domain":
        return extractDomain(a.url).localeCompare(extractDomain(b.url))
      default:
        return (b.dateAdded || 0) - (a.dateAdded || 0)
    }
  }

  pinned.sort(sortFn)
  unpinned.sort(sortFn)
  return [...pinned, ...unpinned]
}

function countFolderItems(node) {
  return node.children
    ? node.children.reduce((c, child) => c + (child.url ? 1 : 0), 0)
    : 0
}

function extractDomain(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function findNodeById(id, nodes) {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeById(id, node.children)
      if (found) return found
    }
  }
  return null
}

function findParentFolder(bookmarkId, nodes) {
  for (const node of nodes) {
    if (node.children) {
      if (node.children.some((child) => child.id === bookmarkId)) return node
      const found = findParentFolder(bookmarkId, node.children)
      if (found) return found
    }
  }
  return null
}

function isDescendant(nodeId, targetId, bookmarkTreeNodes) {
  const node = findNodeById(nodeId, bookmarkTreeNodes)
  if (!node || !node.children) return false
  function check(curr) {
    if (curr.id === targetId) return true
    return curr.children ? curr.children.some((c) => check(c)) : false
  }
  return check(node)
}

function isAncestorOf(node, targetFolderId) {
  if (!node.children) return false
  for (const child of node.children) {
    if (child.id === targetFolderId) return true
    if (isAncestorOf(child, targetFolderId)) return true
  }
  return false
}

document.querySelectorAll(".close-modal").forEach((btn) => {
  btn.onclick = () => btn.closest(".rename-popup")?.classList.add("hidden")
})

export function openOrganizeFoldersModal(elements) {
  const popup = document.getElementById("organize-folders-popup")
  const treeViewContainer = document.getElementById(
    "organize-folders-tree-view",
  )
  const closeButton = document.getElementById("organize-folders-close")
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en
  const titleEl = document.getElementById("organize-folders-title")

  if (!popup || !treeViewContainer || !closeButton || !titleEl) {
    console.error("Organize folders popup elements missing.")
    showCustomPopup(
      t.errorUnexpected || "An unexpected error occurred",
      "error",
      true,
    )
    return
  }

  // Update title and close button text
  titleEl.textContent = t.organizeFoldersTitle || "Organize Folders"
  closeButton.textContent = t.cancel || "Close"

  // Clear previous content
  treeViewContainer.innerHTML = ""

  // Update bookmark tree state before rendering
  chrome.bookmarks.getTree((tree) => {
    uiState.bookmarkTree = tree
    // Render the draggable tree view inside the popup
    renderTreeView(tree[0].children, elements, 0, treeViewContainer)
  })

  popup.classList.remove("hidden")

  // Apply current theme
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light"
  const allThemes = ["light", "dark", "dracula", "onedark", "tet"]
  allThemes.forEach((theme) => popup.classList.remove(`${theme}-theme`))
  popup.classList.add(`${currentTheme}-theme`)

  const closePopup = () => {
    popup.classList.add("hidden")
    document.removeEventListener("keydown", handleKeydown)
    // Refresh the main view after closing
    chrome.bookmarks.getTree((tree) => {
      renderFilteredBookmarks(tree, elements)
    })
  }

  closeButton.onclick = () => closePopup()

  popup.onclick = (e) => {
    if (e.target === popup) {
      closePopup()
    }
  }

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closePopup()
    }
  }

  document.addEventListener("keydown", handleKeydown)
}

export function togglePin(bookmarkId, elements) {
  chrome.storage.local.get("pinnedBookmarks", (data) => {
    const pinnedBookmarks = data.pinnedBookmarks || {}

    if (pinnedBookmarks[bookmarkId]) {
      delete pinnedBookmarks[bookmarkId]
    } else {
      pinnedBookmarks[bookmarkId] = true
    }

    chrome.storage.local.set({ pinnedBookmarks }, () => {
      chrome.bookmarks.getTree((tree) =>
        renderFilteredBookmarks(tree, elements),
      )
      const language = localStorage.getItem("appLanguage") || "en"
      const msg = pinnedBookmarks[bookmarkId]
        ? translations[language].pinSuccess || "Pinned to top"
        : translations[language].unpinSuccess || "Unpinned"
      showCustomPopup(msg, "success", false)
    })
  })
}

export function toggleFavorite(bookmarkId, buttonElement) {
  chrome.storage.local.get("favoriteBookmarks", (data) => {
    const favoriteBookmarks = data.favoriteBookmarks || {}
    if (favoriteBookmarks[bookmarkId]) {
      delete favoriteBookmarks[bookmarkId]
      buttonElement.classList.remove("favorited")
    } else {
      favoriteBookmarks[bookmarkId] = true
      buttonElement.classList.add("favorited")
    }
    chrome.storage.local.set({ favoriteBookmarks }, () => {
      if (uiState.sortType === "favorites") {
        buttonElement.closest(".bookmark-item")?.remove()
      } else {
        const icon = buttonElement.querySelector("i")
        if (icon)
          icon.className = favoriteBookmarks[bookmarkId]
            ? "fas fa-star"
            : "fas fa-ellipsis-v"
        buttonElement
          .closest(".bookmark-item")
          ?.classList.toggle("favorited", !!favoriteBookmarks[bookmarkId])
      }
    })
  })
}

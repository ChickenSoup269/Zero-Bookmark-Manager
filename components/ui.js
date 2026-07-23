import {
  translations,
  showCustomPopup,
  calculateMatchScore,
  showCustomConfirm,
} from "./utils/utils.js"
import { appendBookmarksLazily } from "./utils/lazyRender.js"
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

// Centralized Favicon Error Handling
window.addEventListener('error', function(e) {
  const t = e.target;
  if (t && t.tagName === 'IMG') {
    if (t.dataset.hostname) window.handleFaviconError(t, t.dataset.hostname);
    else if (t.dataset.hideOnError) t.style.opacity = 0;
    else if (!t.dataset.errorHandled) { t.dataset.errorHandled = 'true'; t.src = './images/default-favicon.png'; }
  }
}, true);
window.addEventListener('load', function(e) {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset.bgOnLoad) t.style.background = t.dataset.bgOnLoad;
}, true);
window.handleFaviconError = function (img, hostname) {
  if (!img || img.dataset.fallback === "final") return

  const opt =
    (window.uiState && window.uiState.faviconOption) ||
    (typeof uiState !== "undefined" && uiState.faviconOption) ||
    "auto"

  if (img.dataset.fallback === "hostname" || opt === "hostname") {
    img.src = "./images/default-favicon.png"
    img.dataset.fallback = "final"
  } else {
    // Nếu đang dùng Google hoặc Auto, fallback sang DuckDuckGo
    img.src = `https://icons.duckduckgo.com/ip3/${hostname}.ico`
    img.dataset.fallback = "hostname"
  }
}

function getFaviconUrl(url) {
  if (!url) return "./images/default-favicon.png"
  if (url.startsWith("chrome-extension://")) {
    const manifest = chrome.runtime.getManifest()
    const iconPath =
      manifest.icons["128"] ||
      manifest.icons["48"] ||
      manifest.icons["16"] ||
      "icons/icon.png"
    return iconPath
  }
  let domain = ""
  try {
    domain = new URL(url).hostname
  } catch (e) {
    return "./images/default-favicon.png"
  }
  const opt =
    (window.uiState && window.uiState.faviconOption) ||
    (typeof uiState !== "undefined" && uiState.faviconOption) ||
    "auto"
  const size =
    (window.uiState && window.uiState.faviconSize) ||
    (typeof uiState !== "undefined" && uiState.faviconSize) ||
    "32"
  if (opt === "google") {
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`
  } else if (opt === "hostname") {
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`
  } else {
    // auto: ưu tiên Google, fallback hostname (xử lý ở onerror khi render <img>)
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`
  }
}

// Global variable to keep track of autoscroll interval
let autoscrollInterval = null
let currentMouseY = 0

function startAutoscroll(container, event) {
  currentMouseY = event.clientY;

  if (autoscrollInterval) return; // Already running

  const rect = container.getBoundingClientRect()
  const scrollThreshold = 50 // Pixels from edge to start scrolling
  const scrollSpeed = 15 // Pixels per interval

  const checkScroll = () => {
    if (!container) {
      stopAutoscroll()
      return
    }

    // Check for vertical scrolling
    if (currentMouseY < rect.top + scrollThreshold) {
      // Scroll up
      container.scrollTop -= scrollSpeed
    } else if (currentMouseY > rect.bottom - scrollThreshold) {
      // Scroll down
      container.scrollTop += scrollSpeed
    }
  }

  autoscrollInterval = setInterval(checkScroll, 20) // Check every 20ms for smooth scrolling
}

function stopAutoscroll() {
  if (autoscrollInterval) {
    clearInterval(autoscrollInterval)
    autoscrollInterval = null
  }
}

export function setupGlobalDragScroll(elements) {
  const containers = [
    elements.folderListDiv,
    elements.sidebarList,
    document.getElementById("organize-folders-tree-view")
  ];

  containers.forEach(container => {
    if (!container) return;
    
    container.addEventListener("dragover", (e) => {
      // Only autoscroll if dragging a bookmark or folder
      if (typeof currentDragType !== 'undefined' && currentDragType) {
        startAutoscroll(container, e);
      }
    });

    container.addEventListener("dragleave", (e) => {
      // If we leave the container bounds
      if (!container.contains(e.relatedTarget)) {
        stopAutoscroll();
      }
    });

    container.addEventListener("drop", () => {
      stopAutoscroll();
    });

    // Also handle dragend on window/document just in case
    document.addEventListener("dragend", () => {
      stopAutoscroll();
    });
  });
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

  // Check private note match
  const noteScore = calculateMatchScore(uiState.bookmarkNotes?.[bookmark.id] || "", query)
  if (noteScore >= 0.35) return true

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

  const language = localStorage.getItem("appLanguage") || "en"

  const checkingTitle =
    language === "vi" ? "Đang kiểm tra liên kết này..." : "Checking this link..."
  const deadTitle =
    language === "vi"
      ? "Liên kết có thể đã chết hoặc website không phản hồi."
      : "Dead link — site not responding or unreachable."
  const safeTitle =
    language === "vi"
      ? "Trang web có vẻ hợp lệ và an toàn."
      : "Site looks safe and legitimate."
  const suspiciousTitle =
    language === "vi"
      ? "Trang web có dấu hiệu đáng ngờ. Hãy cẩn thận khi truy cập!"
      : "Suspicious — site shows risky patterns (phishing/typosquat signals). Be careful!"
  const malwareTitle =
    language === "vi"
      ? "⚠️ Phát hiện trong cơ sở dữ liệu MALWARE (URLhaus). Không nên truy cập!"
      : "⚠️ MALWARE DETECTED — listed in URLhaus malware database. Do not visit!"

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

  if (status === "alive_malware") {
    return `<span class="health-icon malware" title="${malwareTitle}">
    <i class="fas fa-skull-crossbones"></i>
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
      <div class="dropdown-menu bookmark-dropdown-menu hidden">
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
          window.BookmarkCache.getTree((tree) =>
            renderFilteredBookmarks(tree, elements),
          )
        })
      }
    },
  )
}

function attachDropdownToggle(element) {
  // We no longer attach click listener here for .dropdown-btn since controller/dropdown.js handles it globally.
  // But we DO need to handle contextmenu on the element itself.

  element.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Find the button to get the data-id, or just look for the dropdown-menu in this element.
    const btn = element.querySelector(".dropdown-btn");
    let menu = element.querySelector(".dropdown-menu");
    const bookmarkId = btn ? btn.getAttribute("data-id") : null;

    if (!menu && bookmarkId) {
      // It might have been moved to document.body by click handler or previous contextmenu
      const bodyMenus = document.body.querySelectorAll(".bookmark-dropdown-menu");
      bodyMenus.forEach(m => {
        if (m.querySelector(`[data-id="${bookmarkId}"]`)) {
          menu = m;
        }
      });
    }

    if (menu) {
      const isHidden = menu.classList.contains("hidden");
      
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"));

      if (isHidden) {
        if (menu.parentNode !== document.body) {
          document.body.appendChild(menu);
        }

        menu.classList.remove("hidden");
        menu.style.position = "fixed";
        menu.style.zIndex = "10000";
        menu.style.right = "auto";
        let x = e.clientX;
        let y = e.clientY;
        const menuRect = menu.getBoundingClientRect();
        if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 5;
        if (y + menuRect.height > window.innerHeight) {
          y = window.innerHeight - menuRect.height - 5;
          if (y < 0) y = 5;
        }
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
      } else {
        menu.classList.add("hidden");
      }
    }
  });

  const btn = element.querySelector(".dropdown-btn")
  const menu = element.querySelector(".dropdown-menu")
  
  if (btn && menu) {
    element.addEventListener("mouseenter", () => {
      if (
        element.classList.contains("detail-bookmark-item") ||
        element.classList.contains("bookmark-item")
      ) {
        btn.style.opacity = "1"
      }
    })
    element.addEventListener("mouseleave", () => {
      // Find the menu wherever it is
      const bookmarkId = btn.getAttribute("data-id");
      let currentMenu = menu;
      if (currentMenu.parentNode === null || currentMenu.parentNode === document.body) {
        const bodyMenus = document.body.querySelectorAll(".bookmark-dropdown-menu");
        bodyMenus.forEach(m => {
          if (m.querySelector(`[data-id="${bookmarkId}"]`)) {
            currentMenu = m;
          }
        });
      }

      if (
        (element.classList.contains("detail-bookmark-item") ||
          element.classList.contains("bookmark-item")) &&
        currentMenu && currentMenu.classList.contains("hidden")
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
          <img src="${favicon}" class="modal-favicon" alt="icon" 
            data-hostname="${hostname}"
          >
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
        <div class="iframe-fallback" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; width: 80%; color: #555; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <img src="${chrome.runtime.getURL('icons/icon.png')}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: white; padding: 10px;" alt="Zero Bookmark Manager Logo">
            <p><strong>Loading or Preview unavailable?</strong></p>
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
                data-bg-on-load="white">
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
    <option value="new">${t.sortNew}</option>
    <option value="old">${t.sortOld}</option>
    <option value="favorites">${t.sortFavorites}</option>
    <option value="most-visited">${t.sortMostVisited || "Most Visited"}</option>
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
  elements.exportBookmarksOption.innerHTML = `<i class="fas fa-download"></i> ${t.exportBookmarks}`
  elements.importBookmarksOption.innerHTML = `<i class="fas fa-upload"></i> ${t.importBookmarks}`
  elements.editInNewTabOption.innerHTML = `<i class="fas fa-location-arrow"></i> ${t.editInNewTabOption}`
  elements.openSidePanelOption.innerHTML = `<i class="fas fa-arrow-circle-right"></i> ${t.openSidePanel}`
  elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
    ? t.hideCheckboxes
    : t.showCheckboxes
  if (elements.bookmarkCountDiv) {
    elements.bookmarkCountDiv.textContent = `${t.totalBookmarks}: ${
      elements.bookmarkCountDiv.textContent.match(/\d+$/)?.[0] || 0
    }`
  }

  // Update attributes
  elements.scrollToTopButton.title = t.scrollToTop
  elements.scrollToTopButton.setAttribute("aria-label", t.scrollToTop)

  if (elements.reportBugButton) {
    elements.reportBugButton.title = t.reportBug
    elements.reportBugButton.setAttribute("aria-label", t.reportBug)
  }

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
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ appLanguage: language })
  }
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

  let filtered = bookmarks.filter((bookmark) => bookmark.url)

  // Apply Health Filter
  if (uiState.healthFilter && uiState.healthFilter !== "all") {
    filtered = filtered.filter((bookmark) => {
      const status = uiState.healthStatus[bookmark.id]
      if (uiState.healthFilter === "dead") return status === "dead"
      if (uiState.healthFilter === "malware") return status === "alive_malware"
      if (uiState.healthFilter === "suspicious") return status === "alive_suspicious"
      if (uiState.healthFilter === "safe") return status === "alive_safe"
      return false
    })
  }

  // Apply Tag Filter
  if (uiState.selectedTags.length > 0) {
    filtered = filtered.filter((bookmark) =>
      uiState.selectedTags.some((tag) => bookmark.tags.includes(tag)),
    )
  }

  // Apply Favorites Filter (if sorting by favorites)
  if (uiState.sortType === "favorites") {
    filtered = filtered.filter((bookmark) => bookmark.isFavorite)
  }

  // Apply Folder Filter
  if (uiState.selectedFolderId && uiState.selectedFolderId !== "0") {
    filtered = filtered.filter((bookmark) =>
      isInFolder(bookmark, uiState.selectedFolderId),
    )
  }

  // Apply Search Query
  if (uiState.searchQuery) {
    const query = uiState.searchQuery.trim()
    filtered = filtered
      .map((bookmark) => {
        const titleScore = calculateMatchScore(bookmark.title || "", query)
        const urlScore = calculateMatchScore(bookmark.url || "", query)
        let tagScore = 0
        if (bookmark.tags && bookmark.tags.length > 0) {
          for (const tag of bookmark.tags) {
            tagScore = Math.max(tagScore, calculateMatchScore(tag, query))
          }
        }
        const maxScore = Math.max(titleScore, urlScore, tagScore)
        return { bookmark, score: maxScore }
      })
      .filter(({ score }) => score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .map(({ bookmark }) => bookmark)
  }

  elements.folderListDiv.style.display = ""

  if (uiState.viewMode === "tree") {
    // Tree view dùng bookmarkTreeNodes
    const rootChildren = bookmarkTreeNodes[0]?.children || []
    renderTreeView(rootChildren, elements)
  } else if (uiState.viewMode === "detail") {
    renderDetailView(filtered, elements)
  } else if (uiState.viewMode === "bento") {
    renderBentoView(bookmarkTreeNodes, filtered, elements)
  } else if (uiState.viewMode === "split" || uiState.viewMode === "kanban") {
    renderKanbanView(bookmarkTreeNodes, filtered, elements)
  } else if (uiState.viewMode === "card") {
    renderCardView(bookmarkTreeNodes, filtered, elements)
  } else if (uiState.viewMode === "list") {
    renderListView(filtered, elements)
  } else if (uiState.viewMode === "mockup") {
    renderMockupView(bookmarkTreeNodes, filtered, elements)
  } else {
    renderBookmarks(filtered, elements)
  }

  // Gắn lại listener
  if (uiState.viewMode === "tree") {
    attachTreeListeners(elements)
  }
}

// Helper: count how many bookmarks each tag is used on
function buildTagUsageCounts() {
  const counts = {}
  Object.values(uiState.bookmarkTags || {}).forEach((tags) => {
    tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1
    })
  })
  return counts
}

// Helper: update the active-count badge + clear-all button visibility
function syncTagHeaderControls(container) {
  const activeCount = uiState.selectedTags.length
  const badge = document.getElementById("tags-active-count")
  const clearBtn = container?.querySelector("#tag-clear-all")

  if (badge) {
    badge.textContent = activeCount
    badge.classList.toggle("hidden", activeCount === 0)
  }
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", activeCount === 0)
  }
}

export async function populateTagFilter(elements) {
  const tagFilterOptions = elements.tagFilterContainer?.querySelector(
    "#tag-filter-options",
  )
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  const tagSearchInput =
    elements.tagFilterContainer?.querySelector("#tag-search-input")
  const tagSearchClear =
    elements.tagFilterContainer?.querySelector("#tag-search-clear")
  const tagClearAll =
    elements.tagFilterContainer?.querySelector("#tag-clear-all")
  const tagEmptyState =
    elements.tagFilterContainer?.querySelector("#tag-empty-state")

  if (!tagFilterOptions) return

  const lang = localStorage.getItem("appLanguage") || "en"
  const t = translations[lang] || translations.en

  // Apply translated placeholder
  if (tagSearchInput) {
    tagSearchInput.placeholder = t.searchTagsPlaceholder || "Search tags..."
  }
  if (tagClearAll) {
    tagClearAll.title = t.clearTagFilter || "Clear tag filter"
  }

  const allTags = await getAllTags()
  const usageCounts = buildTagUsageCounts()

  // Sort: active (selected) tags first, then alphabetical
  const sorted = [...allTags].sort((a, b) => {
    const aActive = uiState.selectedTags.includes(a) ? 0 : 1
    const bActive = uiState.selectedTags.includes(b) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return a.localeCompare(b)
  })

  // --- Render function (called on init + search input) ---
  function renderTagPills(filterQuery = "") {
    tagFilterOptions.innerHTML = ""
    const query = filterQuery.trim().toLowerCase()
    let visibleCount = 0

    sorted.forEach((tag) => {
      if (query && !tag.toLowerCase().includes(query)) return
      visibleCount++

      const tagColor = uiState.tagColors[tag] || "var(--text-secondary)"
      const isActive = uiState.selectedTags.includes(tag)
      const contrastColor = getContrastColor(tagColor)
      const count = usageCounts[tag] || 0

      const tagItem = document.createElement("div")
      tagItem.className = `sidebar-tag-item${isActive ? " active" : ""}`
      tagItem.setAttribute("data-tag", tag)
      tagItem.title = `${tag} (${count})`
      tagItem.style.cssText = isActive
        ? `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
        : `border-color: ${tagColor}; color: var(--text-primary); background: transparent;`

      tagItem.innerHTML = `
        <i class="fas fa-tag" style="font-size: 0.65rem; color: ${tagColor}; flex-shrink:0;"></i>
        <span>${tag}</span>
        <span class="sidebar-tag-count">${count}</span>
      `

      tagItem.addEventListener("click", () => {
        const idx = uiState.selectedTags.indexOf(tag)
        if (idx > -1) {
          uiState.selectedTags.splice(idx, 1)
          tagItem.classList.remove("active")
          tagItem.style.cssText = `border-color: ${tagColor}; color: var(--text-primary); background: transparent;`
        } else {
          uiState.selectedTags.push(tag)
          tagItem.classList.add("active")
          tagItem.style.cssText = `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
        }
        syncTagHeaderControls(elements.tagFilterContainer)
        window.BookmarkCache.getTree((tree) => {
          import("./ui.js").then(({ renderFilteredBookmarks }) => {
            renderFilteredBookmarks(tree, elements)
          })
        })
      })

      tagFilterOptions.appendChild(tagItem)
    })

    // Show/hide empty state
    if (tagEmptyState) {
      tagEmptyState.classList.toggle("hidden", visibleCount > 0)
    }
  }

  renderTagPills()
  syncTagHeaderControls(elements.tagFilterContainer)

  // --- Search input: filter tag pills (debounced) ---
  if (tagSearchInput && !tagSearchInput._tagSearchBound) {
    tagSearchInput._tagSearchBound = true
    let _sidebarTagDebounce = null
    tagSearchInput.addEventListener("input", () => {
      const query = tagSearchInput.value
      if (tagSearchClear) tagSearchClear.classList.toggle("hidden", !query)
      clearTimeout(_sidebarTagDebounce)
      _sidebarTagDebounce = setTimeout(() => renderTagPills(query), 400)
    })
    if (tagSearchClear) {
      tagSearchClear.addEventListener("click", () => {
        tagSearchInput.value = ""
        tagSearchClear.classList.add("hidden")
        clearTimeout(_sidebarTagDebounce)
        renderTagPills()
        tagSearchInput.focus()
      })
    }
  }

  // --- Clear all selected tags ---
  if (tagClearAll && !tagClearAll._clearAllBound) {
    tagClearAll._clearAllBound = true
    tagClearAll.addEventListener("click", () => {
      uiState.selectedTags = []
      syncTagHeaderControls(elements.tagFilterContainer)
      renderTagPills(tagSearchInput?.value || "")
      window.BookmarkCache.getTree((tree) => {
        import("./ui.js").then(({ renderFilteredBookmarks }) => {
          renderFilteredBookmarks(tree, elements)
        })
      })
    })
  }

  // --- Tags Browser Popup ---
  const tagExpandBtn =
    elements.tagFilterContainer?.querySelector("#tag-expand-btn")
  const tagsBrowserPopup = document.getElementById("tags-browser-popup")
  const tagsBrowserList = document.getElementById("tags-browser-list")
  const tagsBrowserClose = document.getElementById("tags-browser-close")
  const tagsBrowserClearAll = document.getElementById("tags-browser-clear-all")
  const tagsBrowserSearch = document.getElementById("tags-browser-search-input")
  const tagsBrowserSearchClear = document.getElementById(
    "tags-browser-search-clear",
  )
  const tagsBrowserEmpty = document.getElementById("tags-browser-empty")
  const tagsBrowserActiveCount = document.getElementById(
    "tags-browser-active-count",
  )

  function syncBrowserControls() {
    const count = uiState.selectedTags.length
    if (tagsBrowserActiveCount) {
      tagsBrowserActiveCount.textContent = count
      tagsBrowserActiveCount.classList.toggle("hidden", count === 0)
    }
    if (tagsBrowserClearAll) {
      tagsBrowserClearAll.classList.toggle("hidden", count === 0)
    }
  }

  function renderBrowserPills(filterQuery = "") {
    if (!tagsBrowserList) return
    tagsBrowserList.innerHTML = ""
    const query = filterQuery.trim().toLowerCase()
    let visibleCount = 0

    sorted.forEach((tag) => {
      if (query && !tag.toLowerCase().includes(query)) return
      visibleCount++

      const tagColor = uiState.tagColors[tag] || "var(--text-secondary)"
      const isActive = uiState.selectedTags.includes(tag)
      const contrastColor = getContrastColor(tagColor)
      const count = usageCounts[tag] || 0

      const pill = document.createElement("div")
      pill.className = `sidebar-tag-item${isActive ? " active" : ""}`
      pill.setAttribute("data-tag", tag)
      pill.title = `${tag} (${count})`
      pill.style.cssText = isActive
        ? `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
        : `border-color: ${tagColor}; color: var(--text-primary);`
      pill.innerHTML = `
        <div class="tag-pill-content">
          <i class="fas fa-tag" style="font-size:0.65rem; color: ${tagColor}; flex-shrink:0;"></i>
          <span>${tag}</span>
          <span class="sidebar-tag-count">${count}</span>
        </div>
        <div class="tag-pill-actions">
          <button class="tag-edit-btn" title="Edit Tag" aria-label="Edit Tag"><i class="fas fa-edit"></i></button>
          <button class="tag-delete-btn" title="Delete Tag" aria-label="Delete Tag"><i class="fas fa-trash"></i></button>
        </div>
      `

      // We need to stop propagation on the action buttons so they don't trigger the filter toggle
      const contentDiv = pill.querySelector('.tag-pill-content')
      contentDiv.addEventListener("click", () => {
        const idx = uiState.selectedTags.indexOf(tag)
        if (idx > -1) {
          uiState.selectedTags.splice(idx, 1)
          pill.classList.remove("active")
          pill.style.cssText = `border-color: ${tagColor}; color: var(--text-primary);`
        } else {
          uiState.selectedTags.push(tag)
          pill.classList.add("active")
          pill.style.cssText = `background: ${tagColor}; border-color: ${tagColor}; color: ${contrastColor};`
        }
        syncTagHeaderControls(elements.tagFilterContainer)
        syncBrowserControls()
        // Also sync sidebar pills
        renderTagPills(tagSearchInput?.value || "")
        window.BookmarkCache.getTree((tree) => {
          import("./ui.js").then(({ renderFilteredBookmarks }) => {
            renderFilteredBookmarks(tree, elements)
          })
        })
      })

      const editBtn = pill.querySelector('.tag-edit-btn')
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        const newTag = prompt(`Rename tag "${tag}" to:`, tag)
        if (newTag && newTag.trim() !== "" && newTag !== tag) {
          const trimmedNewTag = newTag.trim()
          
          // Update bookmarkTags
          Object.keys(uiState.bookmarkTags).forEach(id => {
            const tagsArray = uiState.bookmarkTags[id]
            const idx = tagsArray.indexOf(tag)
            if (idx > -1) {
              tagsArray[idx] = trimmedNewTag
              // Remove duplicates if the new tag already existed
              uiState.bookmarkTags[id] = [...new Set(tagsArray)]
            }
          })
          
          // Update selectedTags filter
          const selectedIdx = uiState.selectedTags.indexOf(tag)
          if (selectedIdx > -1) {
            uiState.selectedTags[selectedIdx] = trimmedNewTag
          }
          
          // Move colors
          if (uiState.tagColors[tag]) {
            uiState.tagColors[trimmedNewTag] = uiState.tagColors[tag]
            delete uiState.tagColors[tag]
          }
          if (uiState.tagTextColors[tag]) {
            uiState.tagTextColors[trimmedNewTag] = uiState.tagTextColors[tag]
            delete uiState.tagTextColors[tag]
          }
          
          import("./tag.js").then(({ saveTags }) => {
            saveTags(uiState.bookmarkTags, uiState.tagColors, uiState.tagTextColors)
            setTimeout(() => {
              renderBrowserPills(tagsBrowserSearch?.value || "")
              renderTagPills(tagSearchInput?.value || "")
              window.BookmarkCache.getTree((tree) => {
                import("./ui.js").then(({ renderFilteredBookmarks }) => {
                  renderFilteredBookmarks(tree, elements)
                })
              })
            }, 100)
          })
        }
      })
      
      const deleteBtn = pill.querySelector('.tag-delete-btn')
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        import("./dialog.js").then(({ showConfirm }) => {
          showConfirm({
            title: "Delete Tag",
            message: `Are you sure you want to permanently delete the tag "${tag}" from all bookmarks?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: () => {
              // Remove from all bookmarks
              Object.keys(uiState.bookmarkTags).forEach(id => {
                const tagsArray = uiState.bookmarkTags[id]
                const idx = tagsArray.indexOf(tag)
                if (idx > -1) {
                  tagsArray.splice(idx, 1)
                  if (tagsArray.length === 0) {
                    delete uiState.bookmarkTags[id]
                  }
                }
              })
              
              // Remove from selected filters
              const selectedIdx = uiState.selectedTags.indexOf(tag)
              if (selectedIdx > -1) {
                uiState.selectedTags.splice(selectedIdx, 1)
              }
              
              // Remove colors
              delete uiState.tagColors[tag]
              delete uiState.tagTextColors[tag]
              
              import("./tag.js").then(({ saveTags }) => {
                saveTags(uiState.bookmarkTags, uiState.tagColors, uiState.tagTextColors)
                setTimeout(() => {
                  renderBrowserPills(tagsBrowserSearch?.value || "")
                  renderTagPills(tagSearchInput?.value || "")
                  window.BookmarkCache.getTree((tree) => {
                    import("./ui.js").then(({ renderFilteredBookmarks }) => {
                      renderFilteredBookmarks(tree, elements)
                    })
                  })
                }, 100)
              })
            }
          })
        })
      })

      tagsBrowserList.appendChild(pill)
    })

    if (tagsBrowserEmpty) {
      tagsBrowserEmpty.classList.toggle("hidden", visibleCount > 0)
    }
  }

  function openTagsBrowser() {
    if (!tagsBrowserPopup) return
    if (tagsBrowserSearch) {
      tagsBrowserSearch.value = ""
      tagsBrowserSearch.placeholder =
        t.searchTagsPlaceholder || "Search tags..."
    }
    if (tagsBrowserSearchClear) tagsBrowserSearchClear.classList.add("hidden")
    renderBrowserPills()
    syncBrowserControls()
    tagsBrowserPopup.classList.remove("hidden")
    tagsBrowserSearch?.focus()
  }

  if (tagExpandBtn && !tagExpandBtn._expandBound) {
    tagExpandBtn._expandBound = true
    tagExpandBtn.addEventListener("click", openTagsBrowser)
  }

  if (tagsBrowserClose && !tagsBrowserClose._closeBound) {
    tagsBrowserClose._closeBound = true
    tagsBrowserClose.addEventListener("click", () => {
      tagsBrowserPopup?.classList.add("hidden")
    })
  }

  // Close on overlay click
  if (tagsBrowserPopup && !tagsBrowserPopup._overlayBound) {
    tagsBrowserPopup._overlayBound = true
    tagsBrowserPopup.addEventListener("click", (e) => {
      if (e.target === tagsBrowserPopup)
        tagsBrowserPopup.classList.add("hidden")
    })
  }

  // Popup search
  if (tagsBrowserSearch && !tagsBrowserSearch._searchBound) {
    tagsBrowserSearch._searchBound = true
    let _browserTagDebounce = null
    tagsBrowserSearch.addEventListener("input", () => {
      if (tagsBrowserSearchClear) {
        tagsBrowserSearchClear.classList.toggle(
          "hidden",
          !tagsBrowserSearch.value,
        )
      }
      clearTimeout(_browserTagDebounce)
      _browserTagDebounce = setTimeout(
        () => renderBrowserPills(tagsBrowserSearch.value),
        400,
      )
    })
    if (tagsBrowserSearchClear) {
      tagsBrowserSearchClear.addEventListener("click", () => {
        tagsBrowserSearch.value = ""
        tagsBrowserSearchClear.classList.add("hidden")
        clearTimeout(_browserTagDebounce)
        renderBrowserPills()
        tagsBrowserSearch.focus()
      })
    }
  }

  // Popup clear all
  if (tagsBrowserClearAll && !tagsBrowserClearAll._clearBound) {
    tagsBrowserClearAll._clearBound = true
    tagsBrowserClearAll.addEventListener("click", () => {
      uiState.selectedTags = []
      syncTagHeaderControls(elements.tagFilterContainer)
      syncBrowserControls()
      renderTagPills(tagSearchInput?.value || "")
      renderBrowserPills(tagsBrowserSearch?.value || "")
      window.BookmarkCache.getTree((tree) => {
        import("./ui.js").then(({ renderFilteredBookmarks }) => {
          renderFilteredBookmarks(tree, elements)
        })
      })
    })
  }

  // Update legacy toggle button text if exists
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
    "nord",
    "synthwave",
    "gruvbox",
    "catppuccin",
    "nightowl",
    "nord-light",
    "gruvbox-light",
    "catppuccin-light",
    "nightowl-light",
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
    nord: "images/logo.png",
    synthwave: "images/logo.png",
    gruvbox: "images/logo.png",
    catppuccin: "images/logo.png",
    nightowl: "images/logo.png",
    "nord-light": "images/logo.png",
    "gruvbox-light": "images/logo.png",
    "catppuccin-light": "images/logo.png",
    "nightowl-light": "images/logo.png",
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
function renderSidebarFolderTree(folders, elements) {
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
      currentDragId = folder.id
      e.dataTransfer.setData("text/plain", folder.id)
      currentDragType = "folder"
      e.dataTransfer.effectAllowed = "copyMove"
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

      // Only accept folders and bookmarks
      if (currentDragType !== "folder" && currentDragType !== "bookmark") return

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

      if (currentDragType === "bookmark" && draggedNode && draggedNode.parentId !== folder.id && !uiState.autoRemoveDup && uiState.duplicateScope === "all") {
        e.dataTransfer.dropEffect = "copy"
      } else {
        e.dataTransfer.dropEffect = "move"
      }
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
        window.BookmarkCache.getTree((tree) => {
          renderFilteredBookmarks(tree, elements)
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
      const existingMenu = document.querySelector(".sidebar-folder-context-menu")
      if (existingMenu) {
        existingMenu.remove()
      }

      // Create context menu
      const contextMenu = document.createElement("div")
      contextMenu.className = "sidebar-folder-context-menu"

      const language = localStorage.getItem("appLanguage") || "en"
      const t = translations[language] || translations.en

      const isDefaultFolder = folder.id === "1" || folder.id === "2" || folder.id === "3"

      contextMenu.innerHTML = `
        <div class="context-menu-item" data-action="move-to-folder">
          <i class="fas fa-folder-open"></i>
          <span>${t.moveToFolder || "Move to Folder"}</span>
        </div>
        ${!isDefaultFolder ? `
        <div class="context-menu-item delete" data-action="delete-folder" style="color: var(--danger-color);">
          <i class="fas fa-trash"></i>
          <span>${t.deleteFolder || "Delete Folder"}</span>
        </div>
        ` : ''}
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
        const action = menuEvent.target.closest(".context-menu-item")?.dataset.action

        if (action === "move-to-folder") {
          const popupElements = {
            addToFolderPopup: document.getElementById("add-to-folder-popup"),
            addToFolderSelect: document.getElementById("add-to-folder-select"),
            addToFolderSaveButton: document.getElementById("add-to-folder-save"),
            addToFolderCancelButton: document.getElementById("add-to-folder-cancel"),
          }
          if (popupElements.addToFolderPopup) {
            showMoveFolderToFolderPopup(popupElements, folder.id)
          }
        } else if (action === "delete-folder") {
          handleDeleteFolder(folder.id, elements)
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
        const isLastChild = index === folder.children.length - 1
        renderFolder(child, level + 1, childrenContainer, isLastChild)
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

function prepareBookmarkViewTransition(elements) {
  const list = elements?.folderListDiv
  if (!list) return

  const nextView = uiState.viewMode || "flat"
  const currentView = list.dataset.currentView || ""
  list.dataset.pendingViewAnimation =
    currentView && currentView !== nextView ? "true" : "false"
  list.dataset.currentView = nextView
}

function runBookmarkViewTransition(elements) {
  const list = elements?.folderListDiv
  if (!list || list.dataset.pendingViewAnimation !== "true") return

  list.dataset.pendingViewAnimation = "false"
  list.classList.remove("bookmark-view-animate")

  const animatedItems = list.querySelectorAll(
    [
      ".bookmark-item",
      ".folder-card",
      ".folder-item",
      ".list-bookmark-item",
      ".list-view-header",
      ".select-all-container",
      ".back-button",
    ].join(","),
  )

  animatedItems.forEach((item, index) => {
    item.style.setProperty("--view-stagger", `${Math.min(index, 18) * 18}ms`)
  })

  window.requestAnimationFrame(() => {
    list.classList.add("bookmark-view-animate")
  })

  window.clearTimeout(list._bookmarkViewAnimationTimer)
  list._bookmarkViewAnimationTimer = window.setTimeout(() => {
    list.classList.remove("bookmark-view-animate")
    animatedItems.forEach((item) => item.style.removeProperty("--view-stagger"))
  }, 720)
}

export function renderFilteredBookmarks(bookmarkTreeNodes, elements) {
  uiState.bookmarkTree = bookmarkTreeNodes;
  chrome.storage.local.get(
    [
      "favoriteBookmarks",
      "bookmarkAccessCounts",
      "pinnedBookmarks",
      "bookmarkTags",
      "readingQueue",
      "bookmarkNotes",
    ], // THÊM "bookmarkTags" VÀO ĐÂY
    (data) => {
      const favoriteBookmarks = data.favoriteBookmarks || {}
      const bookmarkAccessCounts = data.bookmarkAccessCounts || {}
      const pinnedBookmarks = data.pinnedBookmarks || {}
      const bookmarkTagsFromStorage = data.bookmarkTags || {} // Lấy tag trực tiếp từ storage
      const readingQueue = data.readingQueue || {}
      const bookmarkNotes = data.bookmarkNotes || {}

      const addStatus = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            node.isFavorite = !!favoriteBookmarks[node.id]
            node.isPinned = !!pinnedBookmarks[node.id]

            // SỬA TẠI ĐÂY: Ưu tiên lấy từ storage vừa lấy được
            node.tags = bookmarkTagsFromStorage[node.id] || []
            node.readingStatus = readingQueue[node.id] || null

            node.accessCount = bookmarkAccessCounts[node.id] || 0
          }
          if (node.children) addStatus(node.children)
        }
      }

      addStatus(bookmarkTreeNodes)

      // Cập nhật lại uiState để đồng bộ với RAM
      uiState.bookmarkTags = bookmarkTagsFromStorage
      uiState.readingQueue = readingQueue
      uiState.bookmarkNotes = bookmarkNotes

      const bookmarks = flattenBookmarks(bookmarkTreeNodes)
      const folders = getFolders(bookmarkTreeNodes)

      setBookmarkTree(bookmarkTreeNodes)
      setBookmarks(bookmarks)
      setFolders(folders)
      populateTagFilter(elements)
      populateFolderFilter(bookmarkTreeNodes, elements)
      setupTagFilterListener(elements)
      updateBookmarkCount(bookmarks, elements)
      prepareBookmarkViewTransition(elements)

      // Update sidebar (Raindrop style)
      renderSidebarFolderTree(folders, elements)
      updateSidebarCounts(bookmarks, favoriteBookmarks)
      updateSidebarActiveState()

      let filtered = bookmarks.filter((bookmark) => bookmark.url)

      if (uiState.healthFilter && uiState.healthFilter !== "all") {
        filtered = filtered.filter((bookmark) => {
          const status = uiState.healthStatus[bookmark.id]
          if (uiState.healthFilter === "dead") return status === "dead"
          if (uiState.healthFilter === "malware") return status === "alive_malware"
          if (uiState.healthFilter === "suspicious") return status === "alive_suspicious"
          if (uiState.healthFilter === "safe") return status === "alive_safe"
          return false
        })
      }

      if (uiState.selectedTags.length > 0) {
        filtered = filtered.filter((bookmark) =>
          uiState.selectedTags.some((tag) => bookmark.tags.includes(tag)),
        )
      }
      if (uiState.readingQueueOnly) {
        filtered = filtered.filter((bookmark) => readingQueue[bookmark.id])
      }
      if (uiState.sortType === "favorites") {
        if (uiState.selectedFolderId) {
          uiState.selectedFolderId = ""
          if (elements.folderFilter) elements.folderFilter.value = ""
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
        if (elements.folderFilter) elements.folderFilter.value = ""
      }
      if (uiState.searchQuery) {
        const query = uiState.searchQuery.trim()
        // Use improved fuzzy search with scoring
        filtered = filtered
          .map((bookmark) => {
            const titleScore = calculateMatchScore(bookmark.title || "", query)
            const urlScore = calculateMatchScore(bookmark.url || "", query)
            const noteScore = calculateMatchScore(bookmarkNotes[bookmark.id] || "", query)
            // Also check tags
            let tagScore = 0
            if (bookmark.tags && bookmark.tags.length > 0) {
              for (const tag of bookmark.tags) {
                tagScore = Math.max(tagScore, calculateMatchScore(tag, query))
              }
            }
            const maxScore = Math.max(titleScore, urlScore, tagScore, noteScore)
            return { bookmark, score: maxScore }
          })
          .filter(({ score }) => score >= 0.35) // Lower threshold so note searches are discoverable
          .sort((a, b) => b.score - a.score) // Sort by relevance
          .map(({ bookmark }) => bookmark)
      }

      // Render Views
      if (elements && elements.folderListDiv) {
        elements.folderListDiv.style.display = ""
        if (uiState.viewMode === "tree") {
          const rootChildren = bookmarkTreeNodes[0]?.children || []
          renderTreeView(rootChildren, elements)
        } else if (uiState.viewMode === "bento") {
          renderBentoView(bookmarkTreeNodes, filtered, elements)
        } else if (uiState.viewMode === "split" || uiState.viewMode === "kanban") {
          renderKanbanView(bookmarkTreeNodes, filtered, elements)
        } else if (uiState.viewMode === "detail") {
          renderDetailView(filtered, elements)
        } else if (uiState.viewMode === "card") {
          renderCardView(bookmarkTreeNodes, filtered, elements)
        } else if (uiState.viewMode === "list") {
          renderListView(filtered, elements)
        } else if (uiState.viewMode === "mockup") {
          renderMockupView(bookmarkTreeNodes, filtered, elements)
        } else {
          renderBookmarks(filtered, elements)
        }
      }

      toggleFolderButtons(elements)
      customSaveUIState()
    },
  )
}

let currentDragType = null
let currentDragId = null
let selectedFolderForContextMenu = null

function getDragId(e) {
  return e.dataTransfer?.getData("text/plain") || currentDragId
}

function getCardDropPosition(e, cardElement) {
  const rect = cardElement.getBoundingClientRect()
  const midX = rect.left + rect.width / 2
  return e.clientX < midX ? "before" : "after"
}

function calculateMoveIndex(draggedNode, targetNode, dropPosition) {
  let newIndex = targetNode.index + (dropPosition === "after" ? 1 : 0)

  if (
    draggedNode.parentId === targetNode.parentId &&
    draggedNode.index < targetNode.index
  ) {
    newIndex -= 1
  }

  return Math.max(0, newIndex)
}

function clearCardFolderDropState(folderCard) {
  folderCard.classList.remove(
    "drag-over",
    "drop-target-above",
    "drop-target-below",
    "drop-target-left",
    "drop-target-right",
  )
}

function moveFolderByCardDrop(draggedId, targetId, dropPosition, elements, language) {
  if (!draggedId || !targetId || draggedId === targetId) return

  if (uiState.sortType !== "default" || uiState.searchQuery) {
    showCustomPopup(
      translations[language].errorUnexpected ||
        "Cannot reorder while sorting or searching",
      "error",
      true,
    )
    return
  }

  chrome.bookmarks.get([draggedId, targetId], (results) => {
    if (!results || results.length < 2) return

    let draggedNode
    let targetNode
    if (results[0].id === draggedId) {
      draggedNode = results[0]
      targetNode = results[1]
    } else {
      draggedNode = results[1]
      targetNode = results[0]
    }

    const newIndex = calculateMoveIndex(draggedNode, targetNode, dropPosition)

    chrome.bookmarks.move(
      draggedId,
      { parentId: targetNode.parentId, index: newIndex },
      () => {
        if (chrome.runtime.lastError) {
          showCustomPopup(chrome.runtime.lastError.message, "error", true)
          return
        }
        window.BookmarkCache.getTree((tree) => renderFilteredBookmarks(tree, elements))
      },
    )
  })
}

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

  if (!elements || !elements.folderListDiv) return

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove("tree-view", "card-view", "list-view")
  elements.folderListDiv.classList.add("detail-view")

  appendBookmarksLazily(
    elements.folderListDiv,
    fragment,
    sortedBookmarks,
    (bookmark) => createDetailBookmarkElement(bookmark, language, elements),
    commonPostRenderOps,
    elements
  )
}

function renderListView(bookmarksList, elements) {
  if (!elements || !elements.folderListDiv) return
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove(
    "tree-view",
    "card-view",
    "detail-view",
  )
  elements.folderListDiv.classList.add("list-view")

  // Header Row
  const header = document.createElement("div")
  header.className = "list-view-header"
  header.innerHTML = `
    <div class="header-col-check" style="width: ${uiState.checkboxesVisible ? '30px' : '0px'}; overflow: hidden; display: flex; align-items: center;"></div>
    <div class="header-col-icon"></div>
    <div class="header-col-info">Name & URL</div>
    <div class="header-col-tags" style="text-align: right;">Tags</div>
    <div class="header-col-actions">Actions</div>
  `
  fragment.appendChild(header)

  // Back Button if in a folder
  if (uiState.selectedFolderId && uiState.selectedFolderId !== "0") {
    const backRow = document.createElement("div")
    backRow.className = "list-bookmark-item back-row"
    backRow.style.cursor = "pointer"
    backRow.innerHTML = `
      <div class="list-col-check" style="width: ${uiState.checkboxesVisible ? '30px' : '0px'}; overflow: hidden;"></div>
      <div style="width: 40px;"></div>
      <div class="list-info-main" style="display: flex; align-items: center; gap: 5px; width: 100%; min-width: 300px;">
        <span style="font-size: 1.2rem; margin-right: 10px;">↩</span>
        <span class="list-bookmark-title-link">${t.back || "Back"}</span>
      </div>
      <div class="list-bookmark-url-display" style="margin-left: 40px; font-size: 12px; color: var(--text-secondary);">
        Go up one level
      </div>
      <div class="list-tags"></div>
      <div class="list-actions"></div>
    `
    backRow.onclick = () => {
      chrome.bookmarks.get(uiState.selectedFolderId, (results) => {
        if (results && results[0]) {
          uiState.selectedFolderId = results[0].parentId || "0"
          if (elements.folderFilter)
            elements.folderFilter.value = uiState.selectedFolderId
          window.BookmarkCache.getTree((tree) =>
            renderFilteredBookmarks(tree, elements),
          )
        }
      })
    }
    fragment.appendChild(backRow)
  }

  // Render Folders (only if not searching/filtering by tags/favorites)
  const isSearching =
    uiState.searchQuery ||
    uiState.selectedTags.length > 0 ||
    uiState.sortType === "favorites"
  if (!isSearching) {
    const currentFolders = uiState.folders.filter(
      (f) => f.parentId === uiState.selectedFolderId,
    )
    currentFolders.forEach((folder) => {
      fragment.appendChild(createListFolderElement(folder, elements))
    })
  }

  // Render Bookmarks
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)
  
  appendBookmarksLazily(
    elements.folderListDiv,
    fragment,
    sortedBookmarks,
    (bookmark) => createListBookmarkElement(bookmark, language, elements),
    commonPostRenderOps,
    elements
  )
}

function createListFolderElement(folder, elements) {
  const div = document.createElement("div")
  div.className = "list-bookmark-item list-folder-item"
  div.style.cursor = "pointer"
  div.dataset.id = folder.id

  div.innerHTML = `
    <div style="width: 30px;"></div>
    <div class="bookmark-favicon" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: none; border: none;">
      <span style="font-size: 1rem;">📂</span>
    </div>
    <div class="list-info-main" style="display: flex; flex-direction: column; gap: 2px; width: 100%; min-width: 0;">
      <span class="list-bookmark-title-link">${folder.title || "Untitled Folder"}</span>
      <div class="list-bookmark-url-display">Folder</div>
    </div>
    <div class="list-tags"></div>
    <div class="list-actions">
       <button class="dropdown-btn"><i class="fas fa-ellipsis-v"></i></button>
    </div>
  `

  div.onclick = (e) => {
    if (e.target.closest(".dropdown-btn")) return
    uiState.selectedFolderId = folder.id
    if (elements.folderFilter) elements.folderFilter.value = folder.id
    window.BookmarkCache.getTree((tree) => renderFilteredBookmarks(tree, elements))
  }

  return div
}

function renderBentoView(bookmarkTreeNodes, filteredBookmarks, elements) {
  if (!elements || !elements.folderListDiv) return;
  elements.folderListDiv.innerHTML = "";
  elements.folderListDiv.className = `folder-list bento-view ${!uiState.folderListBg ? 'no-bg' : ''}`;
  elements.folderListDiv.style.display = "block";
  
  const isPopup = window.innerWidth <= 800;
  
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gridTemplateColumns = isPopup ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))";
  container.style.gridAutoFlow = "dense";
  container.style.gap = isPopup ? "16px" : "24px";
  container.style.padding = isPopup ? "0" : "24px"; // Fixed padding in popup
  
  const folders = getFolders(bookmarkTreeNodes);
  const colors = ["#FF2D55", "#FF9500", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6", "#FF3B30", "#34C759", "#AF52DE"];
  
  sortFoldersArray(folders, uiState.sortType).forEach((folder, index) => {
    let folderBookmarks = filteredBookmarks.filter(b => b.parentId === folder.id);
    folderBookmarks = sortBookmarks(folderBookmarks, uiState.sortType);
    if (folderBookmarks.length === 0) return;
    
    const color = colors[index % colors.length];
    
    const widget = document.createElement("div");
    widget.style.position = "relative";
    widget.style.background = "var(--bg-secondary)";
    widget.style.borderRadius = "24px";
    widget.style.padding = "20px";
    widget.style.display = "flex";
    widget.style.flexDirection = "column";
    widget.style.minWidth = "0";
    widget.style.boxSizing = "border-box";
    widget.style.gap = "12px";
    widget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)";
    widget.style.border = "1px solid var(--border-color)";
    widget.style.height = "100%";
    widget.style.minHeight = isPopup ? "220px" : "280px";
    widget.style.maxHeight = isPopup ? "320px" : "400px";
    widget.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease";
    
    // Setup drag and drop for widget
    widget.dataset.folderId = folder.id;
    widget.addEventListener("dragover", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (typeof currentDragType === 'undefined' || currentDragType !== "bookmark") return;
      const draggedNode = findNodeById(currentDragId, uiState.bookmarkTree);
      if (draggedNode && draggedNode.parentId !== folder.id && !uiState.autoRemoveDup && uiState.duplicateScope === "all") {
        e.dataTransfer.dropEffect = "copy";
      } else {
        e.dataTransfer.dropEffect = "move";
      }
      widget.classList.add("drag-over");
      widget.style.boxShadow = `0 0 0 2px var(--accent-color, #007bff), 0 14px 40px rgba(0,0,0,0.12)`;
      widget.style.background = `var(--hover-bg, rgba(0, 123, 255, 0.05))`;
    });
    widget.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      if (!widget.contains(e.relatedTarget)) {
        widget.classList.remove("drag-over");
        widget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)";
        widget.style.background = "var(--bg-secondary)";
      }
    });
    widget.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      widget.classList.remove("drag-over");
      widget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)";
      widget.style.background = "var(--bg-secondary)";
      if (typeof currentDragType === 'undefined' || currentDragType !== "bookmark") return;
      handleFolderDrop(e, folder, widget, bookmarkTreeNodes, language, elements);
    });

    // Feature widget logic (disable spanning in popup mode to prevent horizontal overflow)
    if (!isPopup && folderBookmarks.length >= 6 && index % 3 === 0) {
      widget.style.gridColumn = "span 2";
      widget.style.gridRow = "span 2";
    }

    widget.onmouseover = () => {
      widget.style.transform = "translateY(-4px)";
      widget.style.boxShadow = `0 14px 40px rgba(0,0,0,0.12), 0 0 0 1px ${color}40, inset 0 1px 0 rgba(255,255,255,0.2)`;
    };
    widget.onmouseout = () => {
      widget.style.transform = "translateY(0)";
      widget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)";
    };
    
    // Background glowing orb
    const orbWrapper = document.createElement("div");
    orbWrapper.style.position = "absolute";
    orbWrapper.style.top = "0";
    orbWrapper.style.left = "0";
    orbWrapper.style.width = "100%";
    orbWrapper.style.height = "100%";
    orbWrapper.style.overflow = "hidden";
    orbWrapper.style.borderRadius = "24px";
    orbWrapper.style.pointerEvents = "none";
    orbWrapper.style.zIndex = "0";
    
    const orb = document.createElement("div");
    orb.style.position = "absolute";
    orb.style.top = "-50px";
    orb.style.right = "-50px";
    orb.style.width = "150px";
    orb.style.height = "150px";
    orb.style.background = `radial-gradient(circle, ${color}20 0%, transparent 70%)`;
    orb.style.borderRadius = "50%";
    orbWrapper.appendChild(orb);
    widget.appendChild(orbWrapper);
    
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.zIndex = "1";
    header.style.minWidth = "0";
    
    const title = document.createElement("h3");
    title.style.margin = "0";
    title.style.fontSize = "1rem"; // Reduced from 1.3rem
    title.style.fontWeight = "700";
    title.style.color = "var(--text-color)";
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.minWidth = "0";
    title.style.flex = "1";
    title.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0;border-radius:8px;background:${color}15;color:${color}"><i class="fas fa-folder"></i></div> <span style="overflow:hidden;text-overflow:ellipsis;min-width:0;">${folder.title}</span>`;
    
    const countBadge = document.createElement("span");
    countBadge.style.background = "var(--bg-tertiary)";
    countBadge.style.color = "var(--text-secondary)";
    countBadge.style.padding = "4px 10px";
    countBadge.style.borderRadius = "20px";
    countBadge.style.fontSize = "0.75rem";
    countBadge.style.fontWeight = "600";
    countBadge.style.flexShrink = "0";
    countBadge.textContent = `${folderBookmarks.length} items`;
    
    header.appendChild(title);
    header.appendChild(countBadge);
    widget.appendChild(header);
    
    const listContainer = document.createElement("div");
    listContainer.style.overflowY = "auto";
    listContainer.style.display = "flex";
    listContainer.style.flexDirection = "column";
    listContainer.style.gap = "8px";
    listContainer.style.paddingRight = "4px";
    listContainer.style.marginTop = "8px";
    listContainer.style.zIndex = "1";
    listContainer.style.flexGrow = "1";
    
    // Custom scrollbar for listContainer
    listContainer.classList.add("custom-scrollbar");
    
    const language = localStorage.getItem("appLanguage") || "en";
    
    folderBookmarks.forEach(b => {
      const item = document.createElement("div");
      item.style.cursor = "pointer";
      item.onclick = (e) => {
        if (!e.target.closest('.dropdown-btn-group')) window.open(b.url, '_blank');
      };
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "12px";
      item.style.textDecoration = "none";
      item.style.color = "var(--text-color)";
      item.style.padding = "10px 12px";
      item.style.borderRadius = "14px";
      item.style.background = "var(--bg-primary)";
      item.style.border = "1px solid var(--border-color)";
      item.style.transition = "all 0.25s ease";
      makeBookmarkDraggableAndDroppable(item, b, elements, language);
      
      item.onmouseover = () => {
        item.style.background = `${color}10`;
        item.style.borderColor = `${color}40`;
        item.style.transform = "translateX(4px)";
      };
      item.onmouseout = () => {
        item.style.background = "var(--bg-primary)";
        item.style.borderColor = "var(--border-color)";
        item.style.transform = "translateX(0)";
      };
      
      const icon = document.createElement("img");
      icon.src = getFaviconUrl(b.url);
      icon.style.width = "22px";
      icon.style.height = "22px";
      icon.style.borderRadius = "6px";
      icon.style.flexShrink = "0";
      icon.style.background = "#fff";
      icon.style.padding = "2px";
      
      const textWrap = document.createElement("div");
      textWrap.dataset.tooltip = b.title || b.url;
      textWrap.style.display = "flex";
      textWrap.style.flexDirection = "column";
      textWrap.style.minWidth = "0";
      textWrap.style.flex = "1";
      
      const text = document.createElement("span");
      text.textContent = b.title;
      text.style.fontWeight = "500";
      text.style.fontSize = "0.95rem";
      text.style.whiteSpace = "nowrap";
      text.style.overflow = "hidden";
      text.style.textOverflow = "ellipsis";
      
      const urlText = document.createElement("span");
      urlText.textContent = b.url;
      urlText.style.fontSize = "0.7rem";
      urlText.style.color = "var(--text-secondary)";
      urlText.style.whiteSpace = "nowrap";
      urlText.style.overflow = "hidden";
      urlText.style.textOverflow = "ellipsis";
      
      textWrap.appendChild(text);
      textWrap.appendChild(urlText);
      
      item.appendChild(icon);
      item.appendChild(textWrap);
      
      const badgeStr = renderVisitCount(b.id);
      if (badgeStr) {
        const badgeWrap = document.createElement("div");
        badgeWrap.style.marginRight = "8px";
        badgeWrap.style.display = "flex";
        badgeWrap.style.alignItems = "center";
        badgeWrap.innerHTML = badgeStr;
        item.appendChild(badgeWrap);
      }
      
      const dropdownWrap = document.createElement("div");
      dropdownWrap.style.marginLeft = "auto";
      dropdownWrap.innerHTML = createDropdownHTML(b, language);
      item.appendChild(dropdownWrap);
      
      attachDropdownToggle(item);
      listContainer.appendChild(item);
    });
    
    widget.appendChild(listContainer);
    container.appendChild(widget);
  });
  
  elements.folderListDiv.appendChild(container);
  if (typeof commonPostRenderOps === "function") commonPostRenderOps(elements);
}

function renderKanbanView(bookmarkTreeNodes, filteredBookmarks, elements) {
  if (!elements || !elements.folderListDiv) return;
  elements.folderListDiv.innerHTML = "";
  elements.folderListDiv.className = `folder-list kanban-view ${!uiState.folderListBg ? 'no-bg' : ''}`;
  elements.folderListDiv.style.display = "block";
  
  const isPopup = window.innerWidth <= 800;
  
  const container = document.createElement("div");
  container.style.display = isPopup ? "flex" : "grid";
  container.style.gridTemplateColumns = isPopup ? "none" : "repeat(auto-fill, minmax(280px, 1fr))";
  container.style.gridAutoRows = isPopup ? "auto" : "1fr"; 
  container.style.gap = isPopup ? "16px" : "20px";
  container.style.padding = isPopup ? "0" : "16px 8px";
  container.style.overflowX = "hidden";
  container.style.overflowY = isPopup ? "visible" : "hidden";
  container.style.alignItems = "stretch";
  if (isPopup) {
    container.style.flexDirection = "column"; // Bắt buộc hàng dọc
    container.style.flexWrap = "nowrap";
  }
  container.classList.add("custom-scrollbar");
  
  const folders = getFolders(bookmarkTreeNodes);
  const colors = ["#FF2D55", "#FF9500", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6"];
  
  sortFoldersArray(folders, uiState.sortType).forEach((folder, index) => {
    let folderBookmarks = filteredBookmarks.filter(b => b.parentId === folder.id);
    folderBookmarks = sortBookmarks(folderBookmarks, uiState.sortType);
    if (folderBookmarks.length === 0) return;
    
    const accent = colors[index % colors.length];
    
    const column = document.createElement("div");
    column.style.background = "var(--bg-secondary)";
    column.style.backdropFilter = "blur(12px)";
    column.style.webkitBackdropFilter = "blur(12px)";
    column.style.border = "1px solid var(--border-color)";
    column.style.borderRadius = "20px";
    // For popup, use 100% width so it stacks vertically perfectly
    column.style.minWidth = isPopup ? "100%" : "280px"; 
    column.style.maxWidth = isPopup ? "100%" : "320px";
    column.style.flex = isPopup ? "0 0 auto" : "1 1 280px";  
    column.style.display = "flex";
    column.style.flexDirection = "column";
    column.style.maxHeight = isPopup ? "400px" : "65vh"; 
    // Removed height: 100% to allow flex/grid stretch to work naturally
    column.style.padding = "12px 10px";
    column.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.06)";
    column.style.scrollSnapAlign = "start"; 
    column.style.position = "relative";
    column.style.transition = "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
    
    // Setup drag and drop for column
    column.dataset.folderId = folder.id;
    column.addEventListener("dragover", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (typeof currentDragType === 'undefined' || currentDragType !== "bookmark") return;
      const draggedNode = findNodeById(currentDragId, uiState.bookmarkTree);
      if (draggedNode && draggedNode.parentId !== folder.id && !uiState.autoRemoveDup && uiState.duplicateScope === "all") {
        e.dataTransfer.dropEffect = "copy";
      } else {
        e.dataTransfer.dropEffect = "move";
      }
      column.classList.add("drag-over");
      column.style.boxShadow = `0 0 0 2px var(--accent-color, #007bff), 0 14px 28px rgba(0, 0, 0, 0.1)`;
      column.style.background = `var(--hover-bg, rgba(0, 123, 255, 0.05))`;
    });
    column.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove("drag-over");
        column.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.06)";
        column.style.background = "var(--bg-secondary)";
      }
    });
    column.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      column.classList.remove("drag-over");
      column.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.06)";
      column.style.background = "var(--bg-secondary)";
      if (typeof currentDragType === 'undefined' || currentDragType !== "bookmark") return;
      handleFolderDrop(e, folder, column, bookmarkTreeNodes, language, elements);
    });

    // Smooth hover effect
    column.onmouseover = () => {
      column.style.transform = "translateY(-4px)";
      column.style.boxShadow = "0 14px 28px rgba(0, 0, 0, 0.1)";
    };
    column.onmouseout = () => {
      column.style.transform = "translateY(0)";
      column.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.06)";
    };
    
    const header = document.createElement("div");
    header.style.padding = "0 0 16px 0";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "8px";
    
    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.alignItems = "center";
    titleWrap.style.gap = "12px";
    titleWrap.style.overflow = "hidden";
    
    const iconSpan = document.createElement("div");
    iconSpan.style.background = `${accent}20`; // 20 hex opacity
    iconSpan.style.color = accent;
    iconSpan.style.display = "flex";
    iconSpan.style.alignItems = "center";
    iconSpan.style.justifyContent = "center";
    iconSpan.style.width = "36px";
    iconSpan.style.height = "36px";
    iconSpan.style.borderRadius = "10px";
    iconSpan.style.boxShadow = `0 4px 10px ${accent}30`;
    iconSpan.innerHTML = `<i class="fas fa-folder" style="font-size: 1.1rem;"></i>`;
    
    const titleText = document.createElement("span");
    titleText.textContent = folder.title;
    titleText.style.fontWeight = "700";
    titleText.style.fontSize = "1.05rem";
    titleText.style.color = "var(--text-primary)";
    titleText.style.whiteSpace = "nowrap";
    titleText.style.overflow = "hidden";
    titleText.style.textOverflow = "ellipsis";
    
    titleWrap.appendChild(iconSpan);
    titleWrap.appendChild(titleText);
    
    const badge = document.createElement("span");
    badge.textContent = folderBookmarks.length;
    badge.style.background = `${accent}15`;
    badge.style.color = accent;
    badge.style.fontSize = "0.75rem";
    badge.style.fontWeight = "700";
    badge.style.padding = "4px 10px";
    badge.style.borderRadius = "20px";
    
    header.appendChild(titleWrap);
    header.appendChild(badge);
    
    const list = document.createElement("div");
    list.style.overflowY = "auto";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    list.style.paddingRight = "4px";
    list.style.flexGrow = "1";
    list.classList.add("custom-scrollbar");
    
    const language = localStorage.getItem("appLanguage") || "en";
    
    folderBookmarks.forEach(b => {
      const card = document.createElement("div");
      card.className = "kanban-bookmark-card"; // Added class for z-index management
      card.style.cursor = "pointer";
      card.onclick = (e) => {
        if (!e.target.closest('.dropdown-btn-group')) window.open(b.url, '_blank');
      };
      card.style.background = "var(--bg-primary)";
      card.style.border = "1px solid transparent"; // Invisible border to prevent shift on hover
      card.style.padding = "8px 10px";
      card.style.borderRadius = "12px";
      card.style.display = "flex";
      card.style.alignItems = "center";
      card.style.gap = "12px";
      card.style.textDecoration = "none";
      card.style.color = "var(--text-primary)";
      card.style.transition = "all 0.2s ease";
      card.style.position = "relative";
      card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
      makeBookmarkDraggableAndDroppable(card, b, elements, language);
      
      card.onmouseover = () => {
        card.style.background = "var(--hover-bg, var(--bg-tertiary))";
        card.style.borderColor = "var(--border-color)";
        card.style.transform = "translateY(-2px)";
        card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
      };
      card.onmouseout = () => {
        card.style.background = "var(--bg-primary)";
        card.style.borderColor = "transparent";
        card.style.transform = "translateY(0)";
        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
      };
      
      const icon = document.createElement("img");
      icon.src = getFaviconUrl(b.url);
      icon.style.width = "20px";
      icon.style.height = "20px";
      icon.style.borderRadius = "4px";
      icon.style.flexShrink = "0";
      
      const titleWrapper = document.createElement("div");
      titleWrapper.dataset.tooltip = b.title || b.url;
      titleWrapper.style.display = "flex";
      titleWrapper.style.flexDirection = "column";
      titleWrapper.style.gap = "2px";
      titleWrapper.style.minWidth = "0";
      titleWrapper.style.flex = "1";
      
      const title = document.createElement("div");
      title.textContent = b.title;
      title.style.fontWeight = "500";
      title.style.fontSize = "0.9rem";
      title.style.whiteSpace = "nowrap";
      title.style.overflow = "hidden";
      title.style.textOverflow = "ellipsis";
      title.style.color = "var(--text-primary)";
      
      const url = document.createElement("div");
      url.textContent = b.url;
      url.style.fontSize = "0.75rem";
      url.style.color = "var(--text-muted)";
      url.style.whiteSpace = "nowrap";
      url.style.overflow = "hidden";
      url.style.textOverflow = "ellipsis";
      
      titleWrapper.appendChild(title);
      titleWrapper.appendChild(url);
      
      card.appendChild(icon);
      card.appendChild(titleWrapper);
      
      const badgeStr = renderVisitCount(b.id);
      if (badgeStr) {
        const badgeWrap = document.createElement("div");
        badgeWrap.style.marginRight = "8px";
        badgeWrap.style.display = "flex";
        badgeWrap.style.alignItems = "center";
        badgeWrap.innerHTML = badgeStr;
        card.appendChild(badgeWrap);
      }
      
      const dropdownWrap = document.createElement("div");
      dropdownWrap.style.marginLeft = "auto";
      dropdownWrap.innerHTML = createDropdownHTML(b, language);
      card.appendChild(dropdownWrap);
      
      attachDropdownToggle(card);
      list.appendChild(card);
    });
    
    column.appendChild(header);
    column.appendChild(list);
    container.appendChild(column);
  });
  
  elements.folderListDiv.appendChild(container);
  if (typeof commonPostRenderOps === "function") commonPostRenderOps(elements);
}

function renderCardView(bookmarkTreeNodes, filteredBookmarks, elements) {
  if (!elements || !elements.folderListDiv) return
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"
  const folders = getFolders(bookmarkTreeNodes)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove(
    "detail-view",
    "tree-view",
    "list-view",
  )
  elements.folderListDiv.classList.add("card-view")

  const isViewingSpecificFolder =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0" &&
    folders.some((f) => f.id === uiState.selectedFolderId)

  const isSearching = uiState.searchQuery && uiState.searchQuery.trim() !== ""

  if (isSearching) {
    // --- VIEW 3: Đang tìm kiếm (Search Results) ---
    const searchHeader = document.createElement("h3")
    searchHeader.style.cssText = "margin: 10px; color: var(--text-primary);"
    searchHeader.textContent =
      translations[language].searchResults || "Search Results"
    fragment.appendChild(searchHeader)

    const sortedBookmarks = sortBookmarks(filteredBookmarks, uiState.sortType)
    sortedBookmarks.forEach((bookmark) => {
      if (bookmark.url) {
        const el = createSimpleBookmarkElement(bookmark, language, elements)
        el.draggable = true
        el.addEventListener("dragstart", (e) => {
          e.stopPropagation()
          currentDragId = bookmark.id
          e.dataTransfer.setData("text/plain", bookmark.id)
          currentDragType = "bookmark"
          e.dataTransfer.effectAllowed = "copyMove"
          el.classList.add("dragging")
        })
        el.addEventListener("dragend", () => {
          el.classList.remove("dragging")
          currentDragType = null
          currentDragId = null
        })
        fragment.appendChild(el)
      }
    })
  } else if (isViewingSpecificFolder) {
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
        if (elements.folderFilter) elements.folderFilter.value = ""
        window.BookmarkCache.getTree((tree) =>
          renderFilteredBookmarks(tree, elements),
        )
      })
      fragment.appendChild(backButton)

      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          makeBookmarkDraggableAndDroppable(el, bookmark, elements, language)
          fragment.appendChild(el)
        }
      })
    } else {
      uiState.selectedFolderId = ""
      if (elements.folderFilter) elements.folderFilter.value = ""
    }
  } else {
    sortFoldersArray(folders, uiState.sortType).forEach((folder) => {

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
      folderCard.draggable = true

      folderCard.innerHTML = `
            <div class="folder-drop-zone folder-drop-zone-before" data-drop-position="before" aria-hidden="true"></div>
            <div class="folder-drop-zone folder-drop-zone-after" data-drop-position="after" aria-hidden="true"></div>
            <div class="folder-content" style="pointer-events: none;">
                <span class="folder-icon">📂</span>
                <span class="folder-title">${
                  folder.title?.trim() || `Folder ${folder.id}`
                }</span>
                <span class="folder-count">${folderBookmarks.length}</span>
            </div>
            <div class="bookmarks-container"></div>
        `

      // Drag Folder
      folderCard.addEventListener("dragstart", (e) => {
        e.stopPropagation()
        currentDragId = folder.id
        e.dataTransfer.setData("text/plain", folder.id)
        currentDragType = "folder"
        e.dataTransfer.effectAllowed = "copyMove"
        folderCard.classList.add("dragging")
        elements.folderListDiv?.classList.add("is-folder-dragging")
      })

      folderCard.addEventListener("dragend", () => {
        folderCard.classList.remove("dragging")
        elements.folderListDiv?.classList.remove("is-folder-dragging")
        currentDragType = null
        currentDragId = null
      })

      // Click mở folder
      folderCard.addEventListener("click", (e) => {
        if (
          e.target.closest(
            ".bookmarks-container, .dropdown-btn, .bookmark-item",
          )
        )
          return
        uiState.selectedFolderId = folder.id
        if (elements.folderFilter) elements.folderFilter.value = folder.id
        window.BookmarkCache.getTree((tree) =>
          renderFilteredBookmarks(tree, elements),
        )
      })

      folderCard.querySelectorAll(".folder-drop-zone").forEach((zone) => {
        zone.addEventListener("dragover", (e) => {
          if (currentDragType !== "folder") return
          e.preventDefault()
          e.stopPropagation()

          const draggedId = getDragId(e)
          if (!draggedId || draggedId === folder.id) {
            e.dataTransfer.dropEffect = "none"
            return
          }

          const draggedNode = findNodeById(draggedId, uiState.bookmarkTree)
          if (draggedNode && isAncestorOf(draggedNode, folder.id)) {
            e.dataTransfer.dropEffect = "none"
            return
          }

          clearCardFolderDropState(folderCard)
          const dropPosition = zone.dataset.dropPosition || "before"
          folderCard.classList.add(
            dropPosition === "before"
              ? "drop-target-left"
              : "drop-target-right",
          )
          e.dataTransfer.dropEffect = "move"
        })

        zone.addEventListener("dragleave", (e) => {
          e.stopPropagation()
          if (!folderCard.contains(e.relatedTarget)) {
            clearCardFolderDropState(folderCard)
          }
        })

        zone.addEventListener("drop", (e) => {
          if (currentDragType !== "folder") return
          e.preventDefault()
          e.stopPropagation()

          clearCardFolderDropState(folderCard)
          elements.folderListDiv?.classList.remove("is-folder-dragging")
          moveFolderByCardDrop(
            getDragId(e),
            folder.id,
            zone.dataset.dropPosition || "before",
            elements,
            language,
          )
        })
      })

      // Drop Bookmark/Folder vào Folder
      folderCard.addEventListener("dragover", (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (currentDragType !== "bookmark" && currentDragType !== "folder") return

        // Ngăn kéo folder vào chính nó hoặc con của nó
        const draggedId = currentDragId
        if (!draggedId) return

        if (currentDragType === "folder") {
            if (draggedId === folder.id) {
                e.dataTransfer.dropEffect = "none"
                return
            }
            const draggedNode = findNodeById(draggedId, uiState.bookmarkTree)
            if (draggedNode && isAncestorOf(draggedNode, folder.id)) {
                e.dataTransfer.dropEffect = "none"
                return
            }

            // Logic Reorder cho Folder (Swap vị trí)
            if (uiState.sortType === "default" && !uiState.searchQuery) {
                folderCard.classList.remove("drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")

                // Trong Card View (Grid), ưu tiên check ngang
                if (getCardDropPosition(e, folderCard) === "before") {
                    folderCard.classList.add("drop-target-left")
                } else {
                    folderCard.classList.add("drop-target-right")
                }
            }
        }

        if (currentDragType === "bookmark") {
            const draggedNode = findNodeById(currentDragId, uiState.bookmarkTree);
            if (draggedNode && draggedNode.parentId !== folder.id && !uiState.autoRemoveDup && uiState.duplicateScope === "all") {
                e.dataTransfer.dropEffect = "copy";
            } else {
                e.dataTransfer.dropEffect = "move";
            }
        } else {
            e.dataTransfer.dropEffect = "move";
        }
        folderCard.classList.add("drag-over")
      })

      folderCard.addEventListener("dragleave", (e) => {
        e.stopPropagation()
        if (!folderCard.contains(e.relatedTarget)) {
          folderCard.classList.remove("drag-over", "drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")
        }
      })

      folderCard.addEventListener("drop", (e) => {
        e.preventDefault()
        e.stopPropagation()
        folderCard.classList.remove("drag-over", "drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")

        const draggedId = getDragId(e)
        const targetId = folder.id

        if (currentDragType === "bookmark") {
            handleFolderDrop(e, folder, folderCard, bookmarkTreeNodes, language, elements)
        } else if (currentDragType === "folder") {
            if (!draggedId) return
            if (draggedId === targetId) return
            moveFolderByCardDrop(
              draggedId,
              targetId,
              getCardDropPosition(e, folderCard),
              elements,
              language,
            )
        }
      })

      // Render Preview Bookmarks
      const bookmarksContainer = folderCard.querySelector(
        ".bookmarks-container",
      )
      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          el.draggable = true
          el.addEventListener("dragend", (e) => {
            e.stopPropagation()
            el.classList.remove("dragging")
            currentDragType = null
            currentDragId = null
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

  const draggedId = getDragId(e)
  const targetFolderId = folderCard.dataset.folderId

  // Chỉ xử lý nếu đang kéo Bookmark
  if (currentDragType !== "bookmark") return
  if (!draggedId || !targetFolderId) return

  chrome.bookmarks.get(draggedId, (results) => {
    if (!results || !results.length) return
    const bookmark = results[0]

    // Nếu bookmark đã nằm trong folder này rồi thì thôi
    if (bookmark.parentId === targetFolderId) return

    if (!uiState.autoRemoveDup && uiState.duplicateScope === "all") {
      chrome.bookmarks.create(
        { parentId: targetFolderId, title: bookmark.title, url: bookmark.url },
        () => {
          if (chrome.runtime.lastError) {
            showCustomPopup(
              translations[language].errorUnexpected,
              "error",
              true,
            )
          } else {
            window.BookmarkCache.getTree((tree) =>
              renderFilteredBookmarks(tree, elements),
            )
          }
        },
      )
    } else {
      chrome.bookmarks.move(draggedId, { parentId: targetFolderId }, () => {
        if (chrome.runtime.lastError) {
          showCustomPopup(translations[language].errorUnexpected, "error", true)
        } else {
          window.BookmarkCache.getTree((tree) =>
            renderFilteredBookmarks(tree, elements),
          )
        }
      })
    }
  })
}

function makeBookmarkDraggableAndDroppable(el, bookmark, elements, language) {
  el.draggable = true

  el.addEventListener("dragstart", (e) => {
    e.stopPropagation()
    currentDragId = bookmark.id
    e.dataTransfer.setData("text/plain", bookmark.id)
    currentDragType = "bookmark"
    e.dataTransfer.effectAllowed = "copyMove"
    el.classList.add("dragging")
  })
    el.addEventListener("dragend", (e) => {
      e.stopPropagation()
      el.classList.remove("dragging")
      currentDragType = null
      currentDragId = null
      document
        .querySelectorAll(".drop-target-above, .drop-target-below, .drop-target-left, .drop-target-right")
        .forEach((node) => {
          node.classList.remove("drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")
        })
    })

  el.addEventListener("dragover", (e) => {
    if (currentDragType !== "bookmark") return
    if (uiState.sortType !== "default" || uiState.searchQuery) return
    e.preventDefault()
    e.stopPropagation()
    const draggedNode = findNodeById(currentDragId, uiState.bookmarkTree);
    if (draggedNode && draggedNode.parentId !== bookmark.parentId && !uiState.autoRemoveDup && uiState.duplicateScope === "all") {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "move";
    }

    const rect = el.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const midY = rect.top + rect.height / 2
    
    // Clear old classes
    el.classList.remove("drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")

    if (uiState.viewMode === "card") {
      // In Card View (Grid), check horizontal position first
      if (e.clientX < midX) {
        el.classList.add("drop-target-left")
      } else {
        el.classList.add("drop-target-right")
      }
    } else {
      // In List/Tree view, use vertical position
      if (e.clientY < midY) {
        el.classList.add("drop-target-above")
      } else {
        el.classList.add("drop-target-below")
      }
    }
  })

  el.addEventListener("dragleave", (e) => {
    el.classList.remove("drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")
  })

  el.addEventListener("drop", (e) => {
    e.preventDefault()
    e.stopPropagation()
    el.classList.remove("drop-target-above", "drop-target-below", "drop-target-left", "drop-target-right")

    if (currentDragType !== "bookmark") return
    if (uiState.sortType !== "default" || uiState.searchQuery) {
      showCustomPopup(
        translations[language].errorUnexpected ||
          "Cannot reorder while sorting or searching",
        "error",
        true,
      )
      return
    }
    const draggedId = getDragId(e)
    const targetId = bookmark.id
    if (draggedId === targetId) return

    const rect = el.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const midY = rect.top + rect.height / 2
    
    let dropPosition
    if (uiState.viewMode === "card") {
      dropPosition = e.clientX < midX ? "before" : "after"
    } else {
      dropPosition = e.clientY < midY ? "before" : "after"
    }

    chrome.bookmarks.get([draggedId, targetId], (results) => {
      if (!results || results.length < 2) {
        showCustomPopup("Could not get bookmarks", "error", true)
        return
      }
      let draggedNode, targetNode
      if (results[0].id === draggedId) {
        draggedNode = results[0]
        targetNode = results[1]
      } else {
        draggedNode = results[1]
        targetNode = results[0]
      }

      let newIndex = targetNode.index
      if (dropPosition === "after") newIndex++

      if (
        draggedNode.parentId === targetNode.parentId &&
        draggedNode.index < targetNode.index
      ) {
        newIndex--
      }

      chrome.bookmarks.move(
        draggedId,
        {
          parentId: targetNode.parentId,
          index: newIndex,
        },
        () => {
          if (chrome.runtime.lastError) {
            showCustomPopup(chrome.runtime.lastError.message, "error", true)
          } else {
            window.BookmarkCache.getTree((tree) => {
              renderFilteredBookmarks(tree, elements)
            })
          }
        },
      )
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
      <div class="bookmark-favicon"><img src="${favicon}" alt="icon" data-hostname="${hostname}"></div>
      <div data-tooltip="${bookmark.title || bookmark.url}" style="min-width: 0; flex: 1; display: flex;">
        <a href="${bookmark.url}" target="_blank" class="card-bookmark-title">${
        bookmark.title || bookmark.url
      }</a>
      </div>
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
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
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
        <img src="${favicon}" style="width:20px;height:20px;object-fit:contain;" 
          data-hostname="${hostname}"
        >
      </div>
      <div data-tooltip="${bookmark.title || bookmark.url}" style="min-width: 0; flex: 1; display: flex;">
        <a href="${
          bookmark.url
        }" target="_blank" style="flex:1;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none; max-width:160px;">
          ${bookmark.title || bookmark.url}
        </a>
      </div>
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
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
  return div
}

function createListBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item list-bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id

  const healthIcon = renderHealthIcon(bookmark.id)
  const visitCountBadge = renderVisitCount(bookmark.id)
  const tagsHtml = createTagsHTML(bookmark.tags)
  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""

  let hostname = ""
  try {
    hostname = new URL(bookmark.url).hostname
  } catch (e) {}

  div.innerHTML = `
    <div class="list-col-check" style="width: ${uiState.checkboxesVisible ? '30px' : '0px'}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
      <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}" ${isChecked} style="display: ${checkboxDisplay}; transform: scale(0.9);">
    </div>
    <div class="bookmark-favicon" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; border-radius: 4px;">
      <img src="${favicon}" style="width: 14px; height: 14px;" data-hostname="${hostname}">
    </div>
    <div class="list-info-main" style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
      <a href="${bookmark.url}" target="_blank" class="link list-bookmark-title-link" style="white-space: normal !important; word-break: break-word !important; min-width: 0; display: block;">
        ${bookmark.title || bookmark.url}
      </a>
      <div class="list-bookmark-url-display" style="opacity: 0.6; font-size: 0.7rem;">
        ${bookmark.url}
      </div>
    </div>
    <div class="list-tags" style="display: flex; gap: 4px; align-items: center; justify-content: flex-end;">${tagsHtml}</div>
    <div class="list-actions" style="display: flex !important;">
       ${healthIcon} 
       ${visitCountBadge}
       ${createDropdownHTML(bookmark, language)}
    </div>
  `

  div
    .querySelector(".list-bookmark-title-link")
    .addEventListener("click", () =>
      handleBookmarkLinkClick(bookmark.id, elements),
    )
  attachDropdownToggle(div)
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
  return div
}


function renderBookmarks(bookmarksList, elements) {
  if (!elements || !elements.folderListDiv) return
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove(
    "tree-view",
    "card-view",
    "detail-view",
    "list-view",
  )

  appendBookmarksLazily(
    elements.folderListDiv,
    fragment,
    sortedBookmarks,
    (bookmark) => createBookmarkElement(bookmark, 0, elements),
    commonPostRenderOps,
    elements
  )
}

function renderTreeView(nodes, elements, depth = 0, targetElement = null, options = {}) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"

  const actualTargetElement = targetElement || elements.folderListDiv // Use targetElement or default

  // Setup container lần đầu
  if (depth === 0) {
    if (!actualTargetElement) return
    actualTargetElement.innerHTML = ""
    actualTargetElement.classList.remove(
      "card-view",
      "detail-view",
      "list-view",
    )
    actualTargetElement.classList.add("tree-view")
    if (options.onlyFolders) {
      actualTargetElement.classList.add("compact-tree")
    }
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
  
  const bookmarks = options.onlyFolders ? [] : nodesToRender.filter((node) => node.url)
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
      folderDiv.draggable = true
      // Indentation handled by .folder-children in CSS

      folderDiv.innerHTML = `
        <div class="folder-toggle">${isCollapsed ? "+" : "−"}</div>
        <span class="folder-icon">${isCollapsed ? "📁" : "📂"}</span>
        <span class="folder-title">${node.title || `Folder ${node.id}`}</span>
        <span class="folder-count">${countFolderItems(node)}</span>
        <button class="button delete-folder-tree-btn" data-id="${node.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer;" title="${translations[language].deleteFolder}">
            <i class="fas fa-trash"></i>
        </button>
      `

      // Add dragstart event listener for folders
      folderDiv.addEventListener("dragstart", (e) => {
        e.stopPropagation()
        currentDragId = node.id
        e.dataTransfer.setData("text/plain", node.id)
        currentDragType = "folder"
        e.dataTransfer.effectAllowed = "copyMove"
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

            if (!uiState.autoRemoveDup && uiState.duplicateScope === "all") {
              chrome.bookmarks.create(
                {
                  parentId: targetFolderId,
                  title: bookmark.title,
                  url: bookmark.url,
                },
                () => {
                  if (chrome.runtime.lastError) {
                    showCustomPopup(
                      translations[language].errorUnexpected,
                      "error",
                      true,
                    )
                  }
                },
              )
            } else {
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
            }
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
              window.BookmarkCache.getTree((tree) =>
                renderFilteredBookmarks(tree, elements),
              )
            }
          })
        }
        // Reload tree after any successful move operation (bookmark or folder)
        window.BookmarkCache.getTree((tree) => {
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
          renderTreeView(node.children, elements, depth + 1, actualTargetElement, options),
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

  // Style layout handled by CSS
  div.style.display = "flex"
  div.style.alignItems = "center"
  div.style.gap = "8px"

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
      <img src="${favicon}" style="width: 90%; height: 90%; object-fit: cover;" 
        data-hostname="${hostname}"
      >
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
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
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
    <img src="${favicon}" alt="fav" class="favicon" 
      data-hostname="${hostname}"
    >
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
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
  return div
}

// ==========================================
// UTILITY & EVENT FUNCTIONS
// ==========================================

function commonPostRenderOps(elements) {
  if (!elements) return
  if (elements.searchInput)
    elements.searchInput.value = uiState.searchQuery || ""
  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    if (elements.folderFilter)
      elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    if (elements.folderFilter) elements.folderFilter.value = ""
  }
  if (elements.sortFilter)
    elements.sortFilter.value = uiState.sortType || "default"

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)
  runBookmarkViewTransition(elements)

  // --- MANUAL EVENT HANDLERS (Since some are dynamic) ---

  // 1. PIN Buttons
  const pinButtons = elements.folderListDiv.querySelectorAll(".pin-btn")
  pinButtons.forEach((btn) => {
    if (btn.dataset.boundPinAction === "true") return
    btn.dataset.boundPinAction = "true"
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
    if (btn.dataset.boundDetailAction === "true") return
    btn.dataset.boundDetailAction = "true"
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
    if (btn.dataset.boundQrAction === "true") return
    btn.dataset.boundQrAction = "true"
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
    if (btn.dataset.boundSidePanelAction === "true") return
    btn.dataset.boundSidePanelAction = "true"
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
      window.BookmarkCache.getTree((tree) =>
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

      if (bookmark) openWebPreviewModal(bookmark)

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
            if (node && node.children) {
              childrenContainer.appendChild(
                renderTreeView(
                  node.children,
                  elements,
                  parseInt(childrenContainer.getAttribute("data-depth")) || 1,
                ),
              )
              commonPostRenderOps(elements)
            }
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
  window.BookmarkCache.getTree((tree) => {
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
        window.BookmarkCache.getTree(async (tree) => {
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
  window.BookmarkCache.getTree((tree) => {
    // uiState.bookmarkTree needs to be updated with the latest tree for findNodeById and isAncestorOf
    uiState.bookmarkTree = tree
    renderTreeView(tree[0].children, elements, 0, container, { onlyFolders: true })
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
    const language = localStorage.getItem("appLanguage") || "en";
    const t = translations[language] || translations.en;
    window.BookmarkCache.getTree((tree) => {
      uiState.bookmarkTree = tree
      // Use the current navigated folder, default to "0"
      renderOrganizeExplorer(typeof currentOrganizeFolderId !== "undefined" ? currentOrganizeFolderId : "0", elements, treeViewContainer, t)
    })
  }
}

function updateBookmarkCount(bookmarks, elements) {
  const language = localStorage.getItem("appLanguage") || "en"

  // Lấy ID từ State. Nếu state rỗng mới lấy từ Dropdown.
  let currentFolderId = uiState.selectedFolderId
  if (
    (!currentFolderId || currentFolderId === "0") &&
    elements &&
    elements.folderFilter
  ) {
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

  if (elements && elements.bookmarkCountDiv) {
    elements.bookmarkCountDiv.textContent = `${translations[language].totalBookmarks}: ${count}`
  }
}

function toggleFolderButtons(elements) {
  if (!elements || !elements.deleteFolderButton || !elements.renameFolderButton)
    return
  const isUserCreated =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "1" &&
    uiState.selectedFolderId !== "2"
  elements.deleteFolderButton.classList.toggle("hidden", !isUserCreated)
  elements.renameFolderButton.classList.toggle("hidden", !isUserCreated)
}

function sortBookmarks(list, type) {
  if (type === "default" && uiState.searchQuery) {
    return list
  }

  const pinned = list.filter((b) => b.isPinned)
  const unpinned = list.filter((b) => !b.isPinned)

  const sortFn = (a, b) => {
    switch (type) {
      case "favorites":
        return (b.dateAdded || 0) - (a.dateAdded || 0)
      case "default":
        if (a.parentId !== b.parentId) {
          return (a.parentId || "").localeCompare(b.parentId || "")
        }
        return (a.index || 0) - (b.index || 0)
      case "newest":
      case "new":
        return (b.dateAdded || 0) - (a.dateAdded || 0)
      case "oldest":
      case "old":
        return (a.dateAdded || 0) - (b.dateAdded || 0)
      case "a-z":
        return (a.title || a.url || "").localeCompare(b.title || b.url || "")
      case "z-a":
        return (b.title || b.url || "").localeCompare(a.title || a.url || "")
      case "most-visited": {
        const countA = uiState.visitCounts?.[a.id] || a.accessCount || 0
        const countB = uiState.visitCounts?.[b.id] || b.accessCount || 0
        return countB - countA
      }
      case "last-opened":
        return (b.lastOpened || b.dateAdded || 0) - (a.lastOpened || a.dateAdded || 0)
      case "domain":
        return extractDomain(a.url).localeCompare(extractDomain(b.url))
      default:
        return (b.dateAdded || 0) - (a.dateAdded || 0)
    }
  }

  return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)]
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

  let toolbar = popup.querySelector('.organize-folders-toolbar');
  if (toolbar) {
      toolbar.remove();
  }

  // Update bookmark tree state before rendering
  window.BookmarkCache.getTree((tree) => {
    uiState.bookmarkTree = tree
    // Render the new explorer layout inside the popup, start at root
    renderOrganizeExplorer("0", elements, treeViewContainer, t)
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
    window.BookmarkCache.getTree((tree) => {
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
      window.BookmarkCache.getTree((tree) =>
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

function createMockupBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const screenshot = `https://image.thum.io/get/width/400/crop/600/${bookmark.url}`;
  const div = document.createElement("div")
  div.className = `bookmark-item mockup-bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`;
  div.dataset.id = bookmark.id
  const healthIcon = renderHealthIcon(bookmark.id)
  
  let hostname = ""
  try { hostname = new URL(bookmark.url).hostname } catch (e) {}

  div.innerHTML = `
    <div class="mockup-image-container">
      <img class="mockup-image" src="${screenshot}" loading="lazy" data-hide-on-error="true">
      <div class="mockup-overlay"></div>
    </div>
    <div class="mockup-content">
      <div class="mockup-meta">
        <img class="mockup-favicon" src="${favicon}" data-hostname="${hostname}">
        <div data-tooltip="${hostname}" style="min-width: 0; flex: 1;">
          <span class="mockup-hostname" style="display: block;">${hostname}</span>
        </div>
      </div>
      <div data-tooltip="${bookmark.title || bookmark.url}" style="min-width: 0; width: 100%;">
        <a href="${bookmark.url}" target="_blank" class="card-bookmark-title mockup-title">${bookmark.title || bookmark.url}</a>
      </div>
      <div class="mockup-footer">
        ${healthIcon}
        ${renderVisitCount(bookmark.id)}
        ${createDropdownHTML(bookmark, language)}
      </div>
    </div>
  `;

  // Entire card click opens bookmark (excluding buttons, dropdowns, and the title <a> which handles itself)
  div.addEventListener("click", (e) => {
    if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.dropdown-menu-2')) {
      handleBookmarkLinkClick(bookmark.id, elements);
      window.open(bookmark.url, "_blank");
    }
  });

  attachDropdownToggle(div)
  makeBookmarkDraggableAndDroppable(div, bookmark, elements, language)
  return div
}

function renderMockupView(bookmarkTreeNodes, filteredBookmarks, elements) {
  if (!elements || !elements.folderListDiv) return
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"
  
  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.className = `folder-list mockup-view ${!uiState.folderListBg ? 'no-bg' : ''}`;
  elements.folderListDiv.style.display = ""; // Reset inline display
  elements.folderListDiv.style.gridTemplateColumns = ""; 
  elements.folderListDiv.style.gap = "";
  elements.folderListDiv.style.padding = "";

  const sortedBookmarks = sortBookmarks(filteredBookmarks, uiState.sortType)
  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      const el = createMockupBookmarkElement(bookmark, language, elements)
      fragment.appendChild(el)
    }
  })
  
  elements.folderListDiv.appendChild(fragment)
  if (typeof commonPostRenderOps === "function") commonPostRenderOps(elements);
}

// --- Global CSS Toast Logic ---
const globalTooltip = document.createElement("div");
globalTooltip.style.position = "fixed";
globalTooltip.style.background = "var(--bg-tertiary, #333)";
globalTooltip.style.color = "var(--text-primary, #fff)";
globalTooltip.style.border = "1px solid var(--border-color, #444)";
globalTooltip.style.padding = "6px 12px";
globalTooltip.style.borderRadius = "8px";
globalTooltip.style.fontSize = "13px";
globalTooltip.style.fontWeight = "500";
globalTooltip.style.whiteSpace = "normal";
globalTooltip.style.maxWidth = "300px";
globalTooltip.style.width = "max-content";
globalTooltip.style.textAlign = "center";
globalTooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
globalTooltip.style.zIndex = "2147483647"; // Max z-index
globalTooltip.style.pointerEvents = "none";
globalTooltip.style.transform = "translateX(-50%) translateY(-100%)";
// Animation styles
globalTooltip.style.visibility = "hidden";
globalTooltip.style.opacity = "0";
globalTooltip.style.transition = "opacity 0.25s ease, visibility 0.25s ease";
document.body.appendChild(globalTooltip);

function checkIsTruncated(el) {
  if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
    return true;
  }
  // Fallback for -webkit-line-clamp
  const style = window.getComputedStyle(el);
  if (style.webkitLineClamp && style.webkitLineClamp !== 'none') {
    const clone = el.cloneNode(true);
    clone.style.webkitLineClamp = 'none';
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.width = el.clientWidth + 'px';
    document.body.appendChild(clone);
    const isTrunc = clone.scrollHeight > el.clientHeight;
    document.body.removeChild(clone);
    return isTrunc;
  }
  return false;
}

document.addEventListener("mouseover", (e) => {
  const target = e.target.closest("[data-tooltip]");
  if (target && target.dataset.tooltip) {
    // Check truncation on target or any of its children
    let isTruncated = checkIsTruncated(target);
    if (!isTruncated) {
      const children = target.querySelectorAll("*");
      for (let i = 0; i < children.length; i++) {
        if (checkIsTruncated(children[i])) {
          isTruncated = true;
          break;
        }
      }
    }

    if (isTruncated) {
      globalTooltip.textContent = target.dataset.tooltip;
      const rect = target.getBoundingClientRect();
      globalTooltip.style.left = e.clientX + "px";
      globalTooltip.style.top = (rect.top - 8) + "px";
      globalTooltip.style.visibility = "visible";
      globalTooltip.style.opacity = "1";
    }
  }
});

document.addEventListener("mouseout", (e) => {
  const target = e.target.closest("[data-tooltip]");
  if (target) {
    const related = e.relatedTarget;
    if (related && target.contains(related)) return;
    globalTooltip.style.visibility = "hidden";
    globalTooltip.style.opacity = "0";
  }
});

// Hide tooltip on scroll to prevent detached tooltips floating around
document.addEventListener("scroll", () => {
  globalTooltip.style.visibility = "hidden";
  globalTooltip.style.opacity = "0";
}, true);


function sortFoldersArray(foldersArr, type) {
  const sorted = [...foldersArr]
  if (type === "a-z") {
    sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
  } else if (type === "z-a") {
    sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""))
  } else if (type === "new" || type === "newest") {
    sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
  } else if (type === "old" || type === "oldest") {
    sorted.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
  } else {
    sorted.sort((a, b) => (a.index || 0) - (b.index || 0))
  }
  return sorted
}


export function openBookmarkPropertiesModal(bookmark) {
  const popup = document.getElementById("bookmark-detail-popup");
  if (!popup) return;

  const titleEl = document.getElementById("detail-title");
  const urlEl = document.getElementById("detail-url");
  const dateEl = document.getElementById("detail-date-added");
  const tagsEl = document.getElementById("detail-tags");
  const thumbnailEl = document.getElementById("detail-thumbnail");

  if (titleEl) titleEl.textContent = bookmark.title || '';
  if (urlEl) {
    urlEl.innerHTML = '';
    const link = document.createElement('a');
    link.href = bookmark.url || '#';
    link.textContent = bookmark.url || '';
    link.target = '_blank';
    urlEl.appendChild(link);
  }
  if (dateEl) {
    dateEl.textContent = bookmark.dateAdded ? new Date(bookmark.dateAdded).toLocaleString() : '';
  }
  
  if (tagsEl) {
    if (bookmark.tags && bookmark.tags.length > 0) {
      tagsEl.textContent = bookmark.tags.join(", ");
    } else {
      tagsEl.textContent = "No tags";
    }
  }

  if (thumbnailEl) {
    if (bookmark.url) {
      try {
        const domain = new URL(bookmark.url).hostname;
        thumbnailEl.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch (e) {
        thumbnailEl.src = '';
      }
    } else {
      thumbnailEl.src = '';
    }
  }

  const closePopup = () => {
    popup.classList.add("hidden");
  };

  const closeBtn = popup.querySelector(".close-modal");
  if (closeBtn) {
    closeBtn.onclick = closePopup;
  }

  // Close when clicking outside the content
  popup.onclick = (e) => {
    if (e.target === popup) {
      closePopup();
    }
  };

  popup.classList.remove("hidden");
}


// Helper function for Organize Folders Explorer view
let currentOrganizeFolderId = "0"; // Root by default

function renderOrganizeExplorer(folderId, elements, container, t) {
  currentOrganizeFolderId = folderId;
  
  // Helper to get breadcrumb trail
  function getBreadcrumbs(id, callback, trail = []) {
      if (!id || id === "0") {
          callback(trail.reverse());
          return;
      }
      chrome.bookmarks.get(id, (results) => {
          if (!results || !results.length) {
              callback(trail.reverse());
              return;
          }
          trail.push(results[0]);
          getBreadcrumbs(results[0].parentId, callback, trail);
      });
  }

  getBreadcrumbs(folderId, (trail) => {
      chrome.bookmarks.getSubTree(folderId, (results) => {
        if (!results || !results.length) return;
        const folder = results[0];
        const children = folder.children || [];
        
        container.innerHTML = "";
        
        // Header for navigation (Breadcrumb)
        const navHeader = document.createElement("div");
        navHeader.style.display = "flex";
        navHeader.style.alignItems = "center";
        navHeader.style.gap = "8px";
        navHeader.style.marginBottom = "16px";
        navHeader.style.padding = "0 8px";
        navHeader.style.flexWrap = "wrap";
        
        // Render Breadcrumb
        const rootCrumb = document.createElement("button");
        rootCrumb.className = "dropdown-btn"; rootCrumb.title = "Root";
        rootCrumb.style.padding = "4px 8px";
        rootCrumb.style.display = "flex";
        rootCrumb.style.alignItems = "center";
        rootCrumb.innerHTML = `<i class="fas fa-home"></i>`;
        rootCrumb.onclick = () => renderOrganizeExplorer("0", elements, container, t);
        
        // Drag over breadcrumb to move items
        rootCrumb.ondragover = (e) => { e.preventDefault(); rootCrumb.style.background = "var(--primary-color-transparent, rgba(0,0,0,0.1))"; };
        rootCrumb.ondragleave = (e) => { rootCrumb.style.background = "transparent"; };
        rootCrumb.ondrop = (e) => {
             e.preventDefault();
             rootCrumb.style.background = "transparent";
             const draggedId = e.dataTransfer.getData("text/plain");
             if (draggedId && draggedId !== "0") {
                 chrome.bookmarks.move(draggedId, { parentId: "0" }, () => {
                     renderOrganizeExplorer(folderId, elements, container, t);
                     if(typeof refreshFolders === 'function' && elements.folderFilter) refreshFolders(elements);
                 });
             }
        };
        navHeader.appendChild(rootCrumb);

        trail.forEach((crumb, index) => {
            const separator = document.createElement("span");
            separator.innerHTML = `<i class="fas fa-chevron-right" style="font-size: 0.8rem; color: var(--text-secondary);"></i>`;
            navHeader.appendChild(separator);
            
            const crumbBtn = document.createElement("button");
            crumbBtn.className = "button";
            crumbBtn.style.padding = "4px 8px";
            crumbBtn.style.background = "transparent";
            crumbBtn.style.border = "none";
            crumbBtn.style.color = index === trail.length - 1 ? "var(--text-primary)" : "var(--text-secondary)";
            crumbBtn.style.fontWeight = index === trail.length - 1 ? "600" : "normal";
            crumbBtn.textContent = crumb.title || "Root";
            crumbBtn.onclick = () => renderOrganizeExplorer(crumb.id, elements, container, t);
            
            // Allow drag dropping into breadcrumbs
            crumbBtn.ondragover = (e) => { e.preventDefault(); crumbBtn.style.background = "var(--primary-color-transparent, rgba(0,0,0,0.1))"; crumbBtn.style.borderRadius = "4px"; };
            crumbBtn.ondragleave = (e) => { crumbBtn.style.background = "transparent"; };
            crumbBtn.ondrop = (e) => {
                 e.preventDefault();
                 crumbBtn.style.background = "transparent";
                 const draggedId = e.dataTransfer.getData("text/plain");
                 if (draggedId && draggedId !== crumb.id) {
                     chrome.bookmarks.move(draggedId, { parentId: crumb.id }, () => {
                         renderOrganizeExplorer(folderId, elements, container, t);
                         if(typeof refreshFolders === 'function' && elements.folderFilter) refreshFolders(elements);
                     });
                 }
            };
            navHeader.appendChild(crumbBtn);
        });
        
        container.appendChild(navHeader);
        
        // List container
        const listContainer = document.createElement("div");
        listContainer.className = "folder-list list-view";
        listContainer.style.display = "flex";
        listContainer.style.flexDirection = "column";
        listContainer.style.gap = "8px";
        listContainer.style.padding = "8px";
        listContainer.style.maxHeight = "65vh";
        listContainer.style.overflowY = "auto";
        
        // Sort: Folders first, then bookmarks
        const sortedChildren = children.slice().sort((a, b) => {
           const aIsFolder = !a.url;
           const bIsFolder = !b.url;
           if (aIsFolder && !bIsFolder) return -1;
           if (!aIsFolder && bIsFolder) return 1;
           return 0;
        });
        
        if (sortedChildren.length === 0) {
           const emptyMsg = document.createElement("div");
           emptyMsg.style.textAlign = "center";
           emptyMsg.style.padding = "32px";
           emptyMsg.style.color = "var(--text-secondary)";
           emptyMsg.textContent = "Empty folder";
           listContainer.appendChild(emptyMsg);
        }
        
        sortedChildren.forEach(item => {
          const isFolder = !item.url;
          const isRootFolder = item.id === "1" || item.id === "2" || item.id === "3";
          
          const itemRow = document.createElement("div");
          itemRow.className = `list-bookmark-item ${isFolder ? "list-folder-item" : ""}`;
          itemRow.style.cursor = isFolder ? "pointer" : "default";
          itemRow.style.padding = "8px 12px";
          itemRow.style.display = "flex";
          itemRow.style.alignItems = "center";
          itemRow.style.gap = "12px";
          itemRow.style.border = "1px solid var(--border-color)";
          itemRow.style.borderRadius = "8px";
          itemRow.style.background = "var(--bg-secondary)";
          itemRow.style.transition = "background 0.2s, border-color 0.2s, transform 0.2s";
          itemRow.draggable = true;
          
          // Hover effect manual fallback
          itemRow.onmouseenter = () => { itemRow.style.background = "var(--bg-tertiary)"; };
          itemRow.onmouseleave = () => { itemRow.style.background = "var(--bg-secondary)"; };
          
          // Drag events
          itemRow.ondragstart = (e) => {
             e.dataTransfer.setData("text/plain", item.id);
             itemRow.style.opacity = "0.5";
             itemRow.style.transform = "scale(0.98)";
          };
          itemRow.ondragend = (e) => {
             itemRow.style.opacity = "1";
             itemRow.style.transform = "none";
          };
          
          // Drop events for folders
          if (isFolder) {
             itemRow.ondragover = (e) => {
                e.preventDefault(); 
                itemRow.style.borderColor = "var(--primary-color)";
                itemRow.style.background = "var(--bg-tertiary)";
             };
             itemRow.ondragleave = (e) => {
                itemRow.style.borderColor = "var(--border-color)";
                itemRow.style.background = "var(--bg-secondary)";
             };
             itemRow.ondrop = (e) => {
                e.preventDefault();
                itemRow.style.borderColor = "var(--border-color)";
                itemRow.style.background = "var(--bg-secondary)";
                const draggedId = e.dataTransfer.getData("text/plain");
                
                if (draggedId && draggedId !== item.id) {
                    chrome.bookmarks.move(draggedId, { parentId: item.id }, () => {
                        renderOrganizeExplorer(folderId, elements, container, t);
                        if(typeof refreshFolders === 'function' && elements.folderFilter) refreshFolders(elements);
                    });
                }
             };
          }
          
          if (isFolder) {
              itemRow.onclick = (e) => {
                 if(e.target.closest("button")) return;
                 renderOrganizeExplorer(item.id, elements, container, t);
              };
          }
          
          // Icon
          const iconDiv = document.createElement("div");
          iconDiv.className = "bookmark-favicon";
          iconDiv.style.width = "28px";
          iconDiv.style.height = "28px";
          iconDiv.style.display = "flex";
          iconDiv.style.alignItems = "center";
          iconDiv.style.justifyContent = "center";
          iconDiv.style.flexShrink = "0";
          
          if (isFolder) {
              iconDiv.innerHTML = `<span style="font-size: 1.2rem;">📂</span>`;
          } else {
              const urlObj = new URL(item.url || "https://example.com");
              iconDiv.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32" alt="icon" style="width:20px;height:20px;border-radius:4px;">`;
          }
          
          // Info
          const infoDiv = document.createElement("div");
          infoDiv.className = "list-info-main";
          infoDiv.style.display = "flex";
          infoDiv.style.flexDirection = "column";
          infoDiv.style.gap = "4px";
          infoDiv.style.flex = "1";
          infoDiv.style.minWidth = "0";
          
          const titleLink = document.createElement("span");
          titleLink.className = "list-bookmark-title-link";
          titleLink.style.fontWeight = "600";
          titleLink.style.fontSize = "1rem";
          titleLink.style.color = "var(--text-primary)";
          titleLink.style.whiteSpace = "nowrap";
          titleLink.style.overflow = "hidden";
          titleLink.style.textOverflow = "ellipsis";
          titleLink.textContent = item.title || (isFolder ? "Folder" : "Bookmark");
          
          const subText = document.createElement("div");
          subText.className = "list-bookmark-url-display";
          subText.style.fontSize = "0.85rem";
          subText.style.color = "var(--text-secondary)";
          subText.style.whiteSpace = "nowrap";
          subText.style.overflow = "hidden";
          subText.style.textOverflow = "ellipsis";
          
          if (isFolder) {
             const childCount = item.children ? item.children.length : 0;
             subText.textContent = `${childCount} items`;
          } else {
             subText.textContent = item.url;
          }
          
          infoDiv.appendChild(titleLink);
          infoDiv.appendChild(subText);
          
          // Actions
          const actionsDiv = document.createElement("div");
          actionsDiv.className = "list-actions";
          actionsDiv.style.display = "flex";
          actionsDiv.style.gap = "4px";
          actionsDiv.style.flexShrink = "0";
          
          const renameBtn = document.createElement("button");
          // Use dropdown-btn class so it looks exactly like the extension's icon buttons
          renameBtn.className = "dropdown-btn"; renameBtn.title = t.rename || "Rename";
          renameBtn.style.padding = "6px";
          renameBtn.style.width = "32px";
          renameBtn.style.height = "32px";
          renameBtn.style.display = "flex";
          renameBtn.style.alignItems = "center";
          renameBtn.style.justifyContent = "center";
          renameBtn.innerHTML = `<i class="fas fa-edit" style="font-size: 0.9rem;"></i>`;
          if(isRootFolder) renameBtn.disabled = true;
          renameBtn.onclick = (e) => {
             e.stopPropagation();
             const popup = document.getElementById("custom-prompt-popup");
             if (!popup) {
                const newName = prompt(t.renamePrompt || "Enter new name:", item.title);
                if (newName && newName !== item.title) {
                    chrome.bookmarks.update(item.id, { title: newName }, () => {
                        renderOrganizeExplorer(folderId, elements, container, t);
                        if (elements && elements.folderFilter && typeof refreshFolders === "function") refreshFolders(elements);
                    });
                }
                return;
             }
             
             const titleEl = document.getElementById("custom-prompt-title");
             const inputEl = document.getElementById("custom-prompt-input");
             const saveBtn = document.getElementById("custom-prompt-save");
             const cancelBtn = document.getElementById("custom-prompt-cancel");
             
             if(titleEl) titleEl.textContent = t.rename || "Rename";
             if(inputEl) {
                 inputEl.value = item.title;
                 inputEl.style.width = "100%";
                 inputEl.style.boxSizing = "border-box";
             }
             
             const cleanup = () => {
                popup.classList.add("hidden");
                saveBtn.onclick = null;
                cancelBtn.onclick = null;
             };
             
             if(saveBtn) saveBtn.onclick = () => {
                const newName = inputEl ? inputEl.value : "";
                cleanup();
                if (newName && newName !== item.title) {
                    chrome.bookmarks.update(item.id, { title: newName }, () => {
                        renderOrganizeExplorer(folderId, elements, container, t);
                        if (elements && elements.folderFilter && typeof refreshFolders === "function") refreshFolders(elements);
                    });
                }
             };
             if(cancelBtn) cancelBtn.onclick = cleanup;
             
             popup.classList.remove("hidden");
             if(inputEl) inputEl.focus();
          };
          
          const deleteBtn = document.createElement("button");
          // Use dropdown-btn class
          deleteBtn.className = "dropdown-btn"; deleteBtn.title = t.delete || "Delete";
          deleteBtn.style.padding = "6px";
          deleteBtn.style.width = "32px";
          deleteBtn.style.height = "32px";
          deleteBtn.style.display = "flex";
          deleteBtn.style.alignItems = "center";
          deleteBtn.style.justifyContent = "center";
          deleteBtn.style.color = "var(--error-color, #ef4444)"; // Override color for delete
          deleteBtn.innerHTML = `<i class="fas fa-trash" style="font-size: 0.9rem;"></i>`;
          if(isRootFolder) deleteBtn.disabled = true;
          deleteBtn.onclick = (e) => {
             e.stopPropagation();
             
             import('./utils/utils.js').then(({ showCustomPopup }) => {
                if (showCustomPopup) {
                    showCustomPopup(
                        `Are you sure you want to delete '${item.title}'${isFolder ? ' and all its contents' : ''}?`,
                        "warning",
                        false,
                        () => {
                             if (isFolder) {
                                chrome.bookmarks.removeTree(item.id, () => {
                                    renderOrganizeExplorer(folderId, elements, container, t);
                                    if (elements && elements.folderFilter && typeof refreshFolders === "function") refreshFolders(elements);
                                });
                             } else {
                                chrome.bookmarks.remove(item.id, () => {
                                    renderOrganizeExplorer(folderId, elements, container, t);
                                });
                             }
                        },
                        true
                    );
                }
             });
          };
          
          actionsDiv.appendChild(renameBtn);
          actionsDiv.appendChild(deleteBtn);
          
          itemRow.appendChild(iconDiv);
          itemRow.appendChild(infoDiv);
          itemRow.appendChild(actionsDiv);
          
          listContainer.appendChild(itemRow);
        });
        
        container.appendChild(listContainer);
      });
  });
}

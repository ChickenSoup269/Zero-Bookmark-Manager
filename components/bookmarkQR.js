// components/bookmarkQR.js
// Shared "Bookmarks + QR" view: mounted as a tab in index.html (popup) and
// as a sidebar-triggered overlay in bookmarks.html (webview).
// Dependency-light: only state.js + utils.js (no ui.js / main.js chain),
// so tabs.js can lazy-import it safely.
import { uiState } from "./state.js"
import { translations } from "./utils/utils.js"
import { showQrPopup } from "./qrPopup.js"
import { createDropdownHTML, renderVisitCount } from "./ui.js"
import { attachDropdownListeners } from "./controller/dropdown.js"

let mounted = null // { root, listEl, searchEl, countEl, emptyEl }
let bookmarksListenersAttached = false
let qrObserver = null
let qrQueue = new Set()
let qrQueueRunning = false
let searchDebounce = null
let bookmarkEventDebounce = null
let lang = localStorage.getItem("appLanguage") || "en"

function t(key) {
  const table = translations[lang] || translations.en
  return table[key] || key
}

function getFaviconUrl(url) {
  if (!url) return "./images/default-favicon.png"
  let domain = ""
  try {
    domain = new URL(url).hostname
  } catch (e) {
    return "./images/default-favicon.png"
  }
  const size = uiState.faviconSize || "32"
  // auto/google: Google s2 (img onerror fallback is not worth an extra
  // handler here — DuckDuckGo mirrors nearly all domains)
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch (e) {
    return url
  }
}

function collectBookmarksFromTree(nodes, out) {
  for (const node of nodes || []) {
    if (node.url) out.push(node)
    if (node.children) collectBookmarksFromTree(node.children, out)
  }
  return out
}

function getBookmarksSync() {
  if (uiState.bookmarks && uiState.bookmarks.length) return uiState.bookmarks
  return collectBookmarksFromTree(uiState.bookmarkTree, [])
}

async function loadBookmarks() {
  const snapshot = getBookmarksSync()
  if (snapshot.length) return snapshot

  // Dashboard data may not be ready yet (lazy tab) — read from the API once.
  if (typeof chrome !== "undefined" && chrome.bookmarks && chrome.bookmarks.getTree) {
    try {
      const tree = await new Promise((resolve) => {
        chrome.bookmarks.getTree((nodes) => resolve(nodes || []))
      })
      return collectBookmarksFromTree(tree, [])
    } catch (e) {
      /* fall through */
    }
  }
  return snapshot
}

// ============ QR generation (throttled: max 2 per animation frame) ============

function renderQrInto(container, url, size, level) {
  container.textContent = ""
  new window.QRCode(container, {
    text: url,
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel[level] || window.QRCode.CorrectLevel.M,
  })
}

function pumpQrQueue() {
  if (qrQueueRunning) return
  qrQueueRunning = true
  const step = () => {
    let done = 0
    for (const row of qrQueue) {
      qrQueue.delete(row)
      const url = row.dataset.qrUrl
      if (url && row.isConnected) {
        const holder = row.querySelector(".bqr-thumb-qr")
        if (holder) {
          try {
            renderQrInto(holder, url, 72, "M")
            holder.classList.add("rendered")
          } catch (e) {
            holder.textContent = ""
          }
        }
      }
      if (++done >= 2) break
    }
    if (qrQueue.size > 0) {
      setTimeout(step, 0)
    } else {
      qrQueueRunning = false
    }
  }
  setTimeout(step, 0)
}

function ensureQrObserver() {
  if (qrObserver) return
  qrObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          qrObserver.unobserve(entry.target)
          qrQueue.add(entry.target)
        }
      }
      pumpQrQueue()
    },
    { rootMargin: "300px" },
  )
}

// ============ Row rendering ============

function createRow(bookmark) {
  // bookmark-item keeps the exact flat-list card look in the dashboard grid;
  // createDropdownHTML reuses the same ⋮ menu (and its action delegation) as
  // every other view; the checkbox plugs into the bulk-selection delegation.
  const row = document.createElement("div")
  row.className = "bookmark-item bqr-row"
  row.dataset.qrUrl = bookmark.url
  const title = bookmark.title || bookmark.url
  const safeTitle = escapeHtml(title)
  const safeUrl = escapeHtml(bookmark.url)
  const safeHost = escapeHtml(getHostname(bookmark.url))
  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""
  row.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}" ${isChecked}
        style="display: ${checkboxDisplay}; width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent-color); margin: 0; flex-shrink: 0;">
    <img class="bqr-favicon" src="${escapeHtml(getFaviconUrl(bookmark.url))}" alt="" loading="lazy"
        onerror="this.style.visibility='hidden'">
    <div class="bqr-info">
      <a class="bqr-title" href="${safeUrl}" target="_blank" rel="noopener noreferrer"
          title="${safeTitle}">${safeTitle}</a>
      <span class="bqr-host">${safeHost}</span>
    </div>
    ${renderVisitCount(bookmark.id)}
    ${createDropdownHTML(bookmark, lang)}
    <button type="button" class="bqr-thumb" data-qr-url="${safeUrl}"
        title="${escapeHtml(t("generateQrCode"))}" aria-label="${escapeHtml(t("generateQrCode"))}">
      <span class="bqr-thumb-qr"><i class="fas fa-qrcode"></i></span>
    </button>
  `
  row.querySelector(".bqr-thumb").addEventListener("click", () =>
    showQrPopup({
      url: bookmark.url,
      title: bookmark.title || bookmark.url,
      faviconUrl: getFaviconUrl(bookmark.url),
    }),
  )
  return row
}

function filterBookmarks(items, query) {
  if (!query) return items
  return items.filter(
    (b) =>
      (b.title || "").toLowerCase().includes(query) ||
      (b.url || "").toLowerCase().includes(query),
  )
}

async function render() {
  if (!mounted) return
  const { listEl, countEl, searchEl } = mounted
  const query = searchEl ? searchEl.value.trim().toLowerCase() : ""
  // When mounted with an override list (dashboard view mode) the main
  // search/folder filters already applied upstream — skip the API read.
  const all = mounted.override ? null : await loadBookmarks()
  // Ignore stale renders (view re-mounted while loading)
  if (!mounted || mounted.searchEl !== searchEl) return

  const items = mounted.override ?? filterBookmarks(all, query)
  if (countEl) countEl.textContent = String(items.length)

  if (mounted.inline) {
    // Rows live directly in the .folder-list grid (flat-list look) — remove
    // only rows/empty state; prepareViewContainer wipes the grid on every
    // re-dispatch, so the empty-state node must be recreated each render.
    mounted.root.querySelectorAll(".bqr-row, .bqr-empty").forEach((el) => el.remove())
    const empty = document.createElement("div")
    empty.className = "bqr-empty"
    empty.style.display = items.length ? "none" : "flex"
    empty.textContent = t("qrEmpty")
    mounted.emptyEl = empty
    mounted.root.appendChild(empty)
  } else {
    const { emptyEl } = mounted
    emptyEl.textContent = t("qrEmpty")
    emptyEl.style.display = items.length ? "none" : "flex"
    listEl.textContent = ""
  }
  if (qrObserver) qrObserver.disconnect()
  qrQueue.clear()

  if (!items.length) return

  ensureQrObserver()
  const CHUNK = 100
  let index = 0
  const appendChunk = () => {
    if (!mounted) return
    const frag = document.createDocumentFragment()
    const end = Math.min(index + CHUNK, items.length)
    for (; index < end; index++) {
      frag.appendChild(createRow(items[index]))
    }
    listEl.appendChild(frag)
    // Observe only after rows are attached to the DOM — a detached target
    // never reports an intersection in some engines.
    for (const row of listEl.children) {
      if (row.classList.contains("bqr-row") && row.dataset.qrUrl) qrObserver.observe(row)
    }
    if (index < items.length) {
      // setTimeout instead of rAF: rAF is suspended entirely for hidden or
      // unfocused panes, which left the count updated but the list empty
      setTimeout(appendChunk, 0)
    }
  }
  appendChunk()
}

function scheduleRender(delay = 180) {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(render, delay)
}

// ============ Mount / unmount ============

function buildViewMarkup(root, withSearch) {
  root.innerHTML = `
    <div class="bqr-view">
      <div class="bqr-toolbar">
        ${withSearch ? `
        <div class="bqr-search-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" class="bqr-search" placeholder="${escapeHtml(t("qrSearchPlaceholder"))}">
        </div>
        ` : ""}
        <span class="bqr-count">0</span>
      </div>
      <div class="bqr-list"></div>
      <div class="bqr-empty" style="display: none;"></div>
    </div>
  `
  return {
    searchEl: root.querySelector(".bqr-search"),
    listEl: root.querySelector(".bqr-list"),
    countEl: root.querySelector(".bqr-count"),
    emptyEl: root.querySelector(".bqr-empty"),
  }
}

// bookmarksOverride: pre-filtered list from the dashboard render pipeline —
// the main search/sort/folder filters already applied. In that mode the rows
// are appended straight into the .folder-list grid (same layout as the flat
// list); only the standalone overlay uses its own wrapper with a search box.
export function mountBookmarkQRView(root, bookmarksOverride = null) {
  if (!root) return
  // Same root AND still in the live DOM → refresh data. The override list
  // MUST be updated here: a folder/search change re-dispatches with a new
  // pre-filtered list while the mount itself can stay.
  if (mounted && mounted.root === root && root.contains(mounted.listEl)) {
    if (bookmarksOverride) mounted.override = bookmarksOverride
    scheduleRender(0)
    return
  }
  unmountBookmarkQRView()

  const inline = !!bookmarksOverride
  let parts
  if (inline) {
    // Rows join the .folder-list grid directly; the dashboard already shows
    // its own bookmark count above, and render() recreates the empty-state
    // node on every pass (prepareViewContainer wipes the grid between runs).
    root.innerHTML = ""
    parts = {
      searchEl: null,
      listEl: root,
      countEl: null,
      emptyEl: null,
    }
  } else {
    parts = buildViewMarkup(root, true)
  }
  mounted = { root, override: bookmarksOverride, inline, ...parts }
  parts.searchEl?.addEventListener("input", () => scheduleRender())
  // The ⋮ menus in QR rows use the same document-level delegation as other
  // views; this is a no-op if already attached by main.js.
  attachDropdownListeners()
  render()

  // Keep the list in sync with bookmark changes. In override mode the
  // dashboard re-renders on bookmark events and re-dispatches, so skip.
  if (!bookmarksOverride && !bookmarksListenersAttached && typeof chrome !== "undefined" && chrome.bookmarks) {
    bookmarksListenersAttached = true
    for (const eventName of ["onCreated", "onRemoved", "onChanged", "onMoved"]) {
      try {
        chrome.bookmarks[eventName].addListener(() => {
          if (!mounted) return
          clearTimeout(bookmarkEventDebounce)
          bookmarkEventDebounce = setTimeout(render, 400)
        })
      } catch (e) {
        /* listener already attached or API unavailable */
      }
    }
  }

  window.addEventListener("languageChanged", onLanguageChanged)
}

export function unmountBookmarkQRView() {
  if (qrObserver) qrObserver.disconnect()
  qrQueue.clear()
  clearTimeout(searchDebounce)
  clearTimeout(bookmarkEventDebounce)
  window.removeEventListener("languageChanged", onLanguageChanged)
  mounted = null
}

function onLanguageChanged() {
  lang = localStorage.getItem("appLanguage") || "en"
  if (mounted) {
    if (mounted.root.contains(mounted.listEl)) {
      if (mounted.searchEl) mounted.searchEl.placeholder = t("qrSearchPlaceholder")
      scheduleRender(0)
    } else {
      // The container was wiped (another view is active now) — drop the
      // stale mount so the next activation rebuilds with the new language
      unmountBookmarkQRView()
    }
  }
}

// ============ Webview (bookmarks.html) entry: sidebar button -> overlay ============

export function openBookmarkQRModal() {
  document.querySelector(".bqr-modal-overlay")?.remove()

  const overlay = document.createElement("div")
  overlay.className = "bqr-modal-overlay"
  overlay.innerHTML = `
    <div class="bqr-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("bookmarkQrTitle"))}">
      <div class="bqr-modal-header">
        <i class="fas fa-qrcode"></i>
        <span>${escapeHtml(t("bookmarkQrTitle"))}</span>
        <button type="button" class="bqr-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="bqr-modal-body"></div>
    </div>
  `
  document.body.appendChild(overlay)
  mountBookmarkQRView(overlay.querySelector(".bqr-modal-body"))

  const close = () => {
    unmountBookmarkQRView()
    overlay.remove()
    document.removeEventListener("keydown", onKeydown)
  }
  const onKeydown = (e) => {
    if (e.key === "Escape") close()
  }
  document.addEventListener("keydown", onKeydown)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector(".bqr-modal-close").addEventListener("click", close)
}

// Wire the webview sidebar trigger when present
document.getElementById("open-bookmark-qr-btn")?.addEventListener("click", openBookmarkQRModal)

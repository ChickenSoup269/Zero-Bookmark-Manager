import { openDuplicateMergeModal } from "./duplicateMerge.js"
import { handleCheckHealth } from "./ui.js"
import { uiState } from "./state.js"
import { translations } from "./utils/utils.js"

function getLanguage() {
  return localStorage.getItem("appLanguage") || "en"
}

function t(key, fallback) {
  const lang = getLanguage()
  return translations[lang]?.[key] || translations.en?.[key] || fallback
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getDuplicateGroups() {
  const groups = new Map()
  ;(uiState.bookmarks || []).forEach((bookmark) => {
    if (!bookmark.url) return
    const key = bookmark.url.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(bookmark)
  })
  return [...groups.values()].filter((group) => group.length > 1)
}

function getEmptyFolders(nodes = uiState.bookmarkTree) {
  const empty = []
  const walk = (items) => {
    items.forEach((node) => {
      if (node.children) {
        if (node.id !== "0" && node.children.length === 0) empty.push(node)
        walk(node.children)
      }
    })
  }
  walk(nodes || [])
  return empty
}

function getStaleBookmarks() {
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
  return (uiState.bookmarks || []).filter((bookmark) => {
    const visits = uiState.visitCounts?.[bookmark.id] || bookmark.accessCount || 0
    return bookmark.url && visits === 0 && (bookmark.dateAdded || 0) < oneYearAgo
  })
}

function getUntaggedBookmarks() {
  return (uiState.bookmarks || []).filter(
    (bookmark) => bookmark.url && !(bookmark.tags || []).length,
  )
}

function getDeadBookmarks() {
  return (uiState.bookmarks || []).filter(
    (bookmark) => uiState.healthStatus?.[bookmark.id] === "dead",
  )
}

function getReadingQueueItems() {
  const readingQueue = uiState.readingQueue || {}
  return (uiState.bookmarks || []).filter((bookmark) => readingQueue[bookmark.id])
}

function getBookmarksWithNotes() {
  const notes = uiState.bookmarkNotes || {}
  return (uiState.bookmarks || []).filter((bookmark) => notes[bookmark.id])
}

function getTopDomains() {
  const domains = new Map()
  ;(uiState.bookmarks || []).forEach((bookmark) => {
    if (!bookmark.url) return
    try {
      const hostname = new URL(bookmark.url).hostname.replace(/^www\./, "")
      domains.set(hostname, (domains.get(hostname) || 0) + 1)
    } catch {}
  })
  return [...domains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([title, count]) => ({ title, count }))
}

function renderList(title, items, getMeta, intro = "") {
  if (!items.length) {
    return `
      <h4>${escapeHtml(title)}</h4>
      <p class="smart-cleanup-empty">${escapeHtml(t("smartCleanupNone", "Nothing to review here."))}</p>
    `
  }

  return `
    <div class="smart-cleanup-detail-title">
      <h4>${escapeHtml(title)}</h4>
      <span>${items.length}</span>
    </div>
    ${intro ? `<p class="smart-cleanup-detail-intro">${escapeHtml(intro)}</p>` : ""}
    <ul class="smart-cleanup-list">
      ${items
        .slice(0, 18)
        .map(
          (item) => `
            <li>
              <strong>${escapeHtml(item.title || item.url || item.id)}</strong>
              <span>${escapeHtml(getMeta(item))}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
    ${
      items.length > 18
        ? `<p class="smart-cleanup-more">+${items.length - 18} ${escapeHtml(t("smartCleanupMore", "more"))}</p>`
        : ""
    }
  `
}

export function initCleanupDashboard(elements) {
  const button = document.getElementById("smart-cleanup-button")
  const popup = document.getElementById("smart-cleanup-popup")
  const grid = document.getElementById("smart-cleanup-grid")
  const details = document.getElementById("smart-cleanup-details")
  const closeButton = document.getElementById("smart-cleanup-close")
  const closeX = document.getElementById("smart-cleanup-close-x")
  const refreshButton = document.getElementById("smart-cleanup-refresh")
  const title = document.getElementById("smart-cleanup-title")
  const subtitle = document.getElementById("smart-cleanup-subtitle")
  const summary = document.getElementById("smart-cleanup-summary")
  const next = document.getElementById("smart-cleanup-next")

  if (!button || !popup || !grid || !details) return

  const close = () => popup.classList.add("hidden")

  const renderNext = () => {
    if (!next) return
    const nextItems = [
      {
        icon: "fa-clock-rotate-left",
        title: t("smartCleanupNextHistory", "Cleanup history"),
        text: t("smartCleanupNextHistoryText", "Review recent cleanup actions and restore safer checkpoints."),
      },
      {
        icon: "fa-sliders",
        title: t("smartCleanupNextRules", "Cleanup rules"),
        text: t("smartCleanupNextRulesText", "Choose stale thresholds, protected folders, and duplicate rules."),
      },
      {
        icon: "fa-bell",
        title: t("smartCleanupNextReminders", "Review reminders"),
        text: t("smartCleanupNextRemindersText", "Surface old read-later items and stale bookmarks on a schedule."),
      },
    ]

    next.innerHTML = `
      <h4>${escapeHtml(t("smartCleanupNextTitle", "Next up"))}</h4>
      ${nextItems
        .map(
          (item) => `
            <div class="smart-cleanup-next-item">
              <i class="fas ${item.icon}" aria-hidden="true"></i>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.text)}</span>
              </div>
            </div>
          `,
        )
        .join("")}
    `
  }

  const render = (selectedKey = "duplicates") => {
    const duplicateGroups = getDuplicateGroups()
    const duplicateCount = duplicateGroups.reduce(
      (sum, group) => sum + group.length - 1,
      0,
    )
    const emptyFolders = getEmptyFolders()
    const staleBookmarks = getStaleBookmarks()
    const untaggedBookmarks = getUntaggedBookmarks()
    const deadBookmarks = getDeadBookmarks()
    const readingQueueItems = getReadingQueueItems()
    const notesItems = getBookmarksWithNotes()
    const topDomains = getTopDomains()
    const issueCount =
      duplicateCount +
      emptyFolders.length +
      staleBookmarks.length +
      untaggedBookmarks.length +
      deadBookmarks.length

    title.textContent = t("smartCleanupTitle", "Smart Cleanup")
    subtitle.textContent = t(
      "smartCleanupSubtitle",
      "Review bookmark cleanup opportunities before changing anything.",
    )
    button.title = t("smartCleanupTitle", "Smart Cleanup")
    button.querySelector("span").textContent = t("smartCleanupShort", "Cleanup")
    refreshButton.textContent = t("refresh", "Refresh")
    closeButton.textContent = t("close", "Close")

    if (summary) {
      summary.innerHTML = `
        <div>
          <strong>${issueCount}</strong>
          <span>${escapeHtml(t("smartCleanupTotalIssues", "items to review"))}</span>
        </div>
        <div>
          <strong>${uiState.bookmarks?.length || 0}</strong>
          <span>${escapeHtml(t("bookmarks", "bookmarks"))}</span>
        </div>
        <div>
          <strong>${topDomains.length}</strong>
          <span>${escapeHtml(t("smartCleanupDomains", "top domains"))}</span>
        </div>
      `
    }

    const cards = [
      {
        key: "duplicates",
        icon: "fa-clone",
        label: t("smartCleanupDuplicates", "Duplicates"),
        count: duplicateCount,
        action: t("duplicateMergeTitle", "Duplicate Merge"),
      },
      {
        key: "dead",
        icon: "fa-link-slash",
        label: t("smartCleanupDeadLinks", "Dead links"),
        count: deadBookmarks.length,
        action: t("smartCleanupScanLinks", "Scan links"),
      },
      {
        key: "stale",
        icon: "fa-box-archive",
        label: t("smartCleanupStale", "Old unused"),
        count: staleBookmarks.length,
        action: t("smartCleanupFilter", "Filter"),
      },
      {
        key: "untagged",
        icon: "fa-tags",
        label: t("smartCleanupUntagged", "Untagged"),
        count: untaggedBookmarks.length,
        action: t("smartCleanupFilter", "Filter"),
      },
      {
        key: "empty",
        icon: "fa-folder-open",
        label: t("smartCleanupEmptyFolders", "Empty folders"),
        count: emptyFolders.length,
        action: t("smartCleanupReview", "Review"),
      },
      {
        key: "reading",
        icon: "fa-book-open-reader",
        label: t("commandPaletteReadingQueue", "Reading Queue"),
        count: readingQueueItems.length,
        action: t("smartCleanupReview", "Review"),
      },
      {
        key: "notes",
        icon: "fa-note-sticky",
        label: t("smartCleanupNotes", "With notes"),
        count: notesItems.length,
        action: t("smartCleanupReview", "Review"),
      },
      {
        key: "domains",
        icon: "fa-globe",
        label: t("smartCleanupDomains", "Top domains"),
        count: topDomains.length,
        action: t("smartCleanupReview", "Review"),
      },
    ]

    grid.innerHTML = cards
      .map(
        (card) => `
          <button type="button" class="smart-cleanup-card ${card.key === selectedKey ? "active" : ""}" data-cleanup="${card.key}">
            <i class="fas ${card.icon}" aria-hidden="true"></i>
            <strong>${card.count}</strong>
            <span>${escapeHtml(card.label)}</span>
            <small>${escapeHtml(card.action)}</small>
          </button>
        `,
      )
      .join("")

    const detailMap = {
      duplicates: () => ({
        html: renderList(
          t("smartCleanupDuplicates", "Duplicates"),
          duplicateGroups.flatMap((group) => group.slice(1)),
          (bookmark) => bookmark.url,
          t("smartCleanupDuplicateIntro", "These are extra copies. The best titled/newest item is kept by the cleanup action."),
        ),
        action: "duplicates",
      }),
      dead: () => ({
        html: renderList(
          t("smartCleanupDeadLinks", "Dead links"),
          deadBookmarks,
          (bookmark) => bookmark.url,
          t("smartCleanupDeadIntro", "Run a fresh scan first if these results look old."),
        ),
        action: "dead",
      }),
      stale: () => ({
        html: renderList(
          t("smartCleanupStale", "Old unused"),
          staleBookmarks,
          (bookmark) => bookmark.url,
          t("smartCleanupStaleIntro", "Older than one year with no tracked visits."),
        ),
        action: "stale",
      }),
      untagged: () => ({
        html: renderList(
          t("smartCleanupUntagged", "Untagged"),
          untaggedBookmarks,
          (bookmark) => bookmark.url,
          t("smartCleanupUntaggedIntro", "Good candidates for the new tag suggestions in Bookmark Detail."),
        ),
      }),
      empty: () => ({
        html: renderList(
          t("smartCleanupEmptyFolders", "Empty folders"),
          emptyFolders,
          (folder) => `ID: ${folder.id}`,
        ),
        action: "empty",
      }),
      reading: () => ({
        html: renderList(
          t("commandPaletteReadingQueue", "Reading Queue"),
          readingQueueItems,
          (bookmark) => bookmark.url,
        ),
      }),
      notes: () => ({
        html: renderList(
          t("smartCleanupNotes", "With notes"),
          notesItems,
          (bookmark) => bookmark.url,
        ),
      }),
      domains: () => ({
        html: renderList(
          t("smartCleanupDomains", "Top domains"),
          topDomains,
          (domain) => `${domain.count} ${t("bookmarks", "bookmarks")}`,
        ),
      }),
    }

    const selectedDetail = detailMap[selectedKey]?.() || detailMap.duplicates()
    details.innerHTML = `
      ${selectedDetail.html}
      <div class="smart-cleanup-detail-actions">
        ${
          selectedDetail.action === "duplicates"
            ? `<button type="button" class="button save" data-cleanup-action="duplicates">${escapeHtml(t("duplicateMergeTitle", "Duplicate Merge"))}</button>`
            : ""
        }
        ${
          selectedDetail.action === "dead"
            ? `
               <button type="button" class="button save" data-cleanup-action="dead">${escapeHtml(t("smartCleanupScanLinks", "Scan links"))}</button>
               ${deadBookmarks.length > 0 ? `<button type="button" class="button delete" data-cleanup-action="dead-delete" style="margin-left: 8px;">${escapeHtml(t("smartCleanupDeleteDead", "Delete Dead Links"))}</button>` : ""}
              `
            : ""
        }
        ${
          selectedDetail.action === "stale" && staleBookmarks.length > 0
            ? `<button type="button" class="button delete" data-cleanup-action="stale">${escapeHtml(t("smartCleanupDeleteStale", "Delete Old Unused"))}</button>`
            : ""
        }
        ${
          selectedDetail.action === "empty" && emptyFolders.length > 0
            ? `<button type="button" class="button delete" data-cleanup-action="empty">${escapeHtml(t("smartCleanupDeleteEmpty", "Delete Empty Folders"))}</button>`
            : ""
        }
      </div>
    `

    details.querySelector("[data-cleanup-action='duplicates']")?.addEventListener("click", () => {
      openDuplicateMergeModal({
        groups: duplicateGroups,
        elements,
        onComplete: () => render("duplicates"),
      })
    })
    details.querySelector("[data-cleanup-action='dead']")?.addEventListener("click", () => {
      handleCheckHealth(elements)
      close()
    })
    details.querySelector("[data-cleanup-action='dead-delete']")?.addEventListener("click", () => {
      if (confirm(t("smartCleanupConfirmDelete", "Are you sure you want to delete these items? This cannot be undone."))) {
        Promise.all(deadBookmarks.map(b => new Promise(res => chrome.bookmarks.remove(b.id, res))))
          .then(() => setTimeout(() => render("dead"), 500))
      }
    })
    details.querySelector("[data-cleanup-action='stale']")?.addEventListener("click", () => {
      if (confirm(t("smartCleanupConfirmDelete", "Are you sure you want to delete these items? This cannot be undone."))) {
        Promise.all(staleBookmarks.map(b => new Promise(res => chrome.bookmarks.remove(b.id, res))))
          .then(() => setTimeout(() => render("stale"), 500))
      }
    })
    details.querySelector("[data-cleanup-action='empty']")?.addEventListener("click", () => {
      if (confirm(t("smartCleanupConfirmDelete", "Are you sure you want to delete these items? This cannot be undone."))) {
        Promise.all(emptyFolders.map(f => new Promise(res => chrome.bookmarks.remove(f.id, res))))
          .then(() => setTimeout(() => render("empty"), 500))
      }
    })

    grid.querySelectorAll("[data-cleanup]").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.dataset.cleanup
        if (key === "duplicates") {
          render("duplicates")
          return
        }
        if (key === "dead") {
          render("dead")
          return
        }
        if (key === "stale") {
          render("stale")
          return
        }
        if (key === "untagged") {
          render("untagged")
          return
        }
        render(key)
      })
    })

    renderNext()
  }

  button.addEventListener("click", () => {
    render()
    popup.classList.remove("hidden")
  })
  closeButton.addEventListener("click", close)
  closeX.addEventListener("click", close)
  refreshButton.addEventListener("click", () => render())
  popup.addEventListener("click", (e) => {
    if (e.target === popup) close()
  })
  window.addEventListener("languageChanged", () => render())
}

import { openDuplicateMergeModal } from "./duplicateMerge.js"
import { handleCheckHealth } from "./ui.js"
import { uiState } from "./state.js"
import { translations, showCustomPopup, showCustomPrompt, showCustomConfirm } from "./utils/utils.js"

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

  const limit = 18;
  const initialItems = items.slice(0, limit);
  const hiddenItems = items.slice(limit);

  return `
    <div class="smart-cleanup-detail-title">
      <h4>${escapeHtml(title)}</h4>
      <span>${items.length}</span>
    </div>
    ${intro ? `<p class="smart-cleanup-detail-intro">${escapeHtml(intro)}</p>` : ""}
    <ul class="smart-cleanup-list">
      ${initialItems
        .map(
          (item) => `
            <li>
              <strong>${escapeHtml(item.title || item.url || item.id)}</strong>
              <span>${escapeHtml(getMeta(item))}</span>
            </li>
          `,
        )
        .join("")}
      ${hiddenItems.length ? `
          <div class="smart-cleanup-hidden-items" style="display: none;">
            ${hiddenItems
              .map(
                (item) => `
                  <li>
                    <strong>${escapeHtml(item.title || item.url || item.id)}</strong>
                    <span>${escapeHtml(getMeta(item))}</span>
                  </li>
                `,
              )
              .join("")}
          </div>
      ` : ""}
    </ul>
    ${
      hiddenItems.length
        ? `<button type="button" class="button smart-cleanup-more-btn" style="width: 100%; margin-top: 8px; background: transparent; color: var(--text-primary); border: 1px solid var(--border-color);">+${hiddenItems.length} ${escapeHtml(t("smartCleanupMore", "more"))}</button>`
        : ""
    }
  `
}

export async function groupBookmarksByDomain() {
  const folderName = await showCustomPrompt(t("smartCleanupGroupName", "Enter folder name for grouped domains:"), "Organized by Domain");
  if (!folderName) return;

  const domainsMap = new Map();
  (uiState.bookmarks || []).forEach(bm => {
    if (!bm.url) return;
    try {
      const host = new URL(bm.url).hostname.replace(/^www\./, "");
      if (!domainsMap.has(host)) domainsMap.set(host, []);
      domainsMap.get(host).push(bm);
    } catch {}
  });

  const toGroup = [...domainsMap.entries()].filter(([_, arr]) => arr.length > 1);
  if (toGroup.length === 0) {
    showCustomPopup(t("smartCleanupNoDomains", "No domains with multiple bookmarks found."), "info", true);
    return;
  }

  const undoData = [];
  try {
    const rootFolder = await new Promise(res => chrome.bookmarks.create({ title: folderName }, res));
    let count = 0;
    for (const [domain, bms] of toGroup) {
      const subFolder = await new Promise(res => chrome.bookmarks.create({ parentId: rootFolder.id, title: domain }, res));
      for (const bm of bms) {
        undoData.push({ id: bm.id, parentId: bm.parentId, index: bm.index });
        await new Promise(res => chrome.bookmarks.move(bm.id, { parentId: subFolder.id }, res));
        count++;
      }
    }
    
    // Refresh UI after a short delay to allow the popup to be read
    setTimeout(() => window.location.reload(), 1500);

    import("./undo.js").then(({ registerUndo }) => {
      registerUndo({
        message: t("smartCleanupGroupSuccess", "Successfully grouped {count} bookmarks into {folder}").replace("{count}", count).replace("{folder}", folderName),
        actionLabel: t("undoAction", "Undo"),
        undo: async () => {
          for (const item of undoData) {
            await new Promise(res => chrome.bookmarks.move(item.id, { parentId: item.parentId, index: item.index }, res));
          }
          if (rootFolder) {
            await new Promise(res => chrome.bookmarks.removeTree(rootFolder.id, res));
          }
        }
      });
    });

    showCustomPopup(t("smartCleanupGroupSuccess", "Successfully grouped {count} bookmarks into {folder}").replace("{count}", count).replace("{folder}", folderName), "success", true);
  } catch (e) {
    console.error(e);
    showCustomPopup(t("smartCleanupGroupError", "Error organizing bookmarks."), "error", true);
  }
}

export function autoTagByDomain() {
  showCustomConfirm(t("smartCleanupTagConfirm", "Auto-tag all bookmarks based on their domains?"), () => {
    const originalTagsBackup = JSON.parse(JSON.stringify(uiState.bookmarkTags || {}));
  const originalTagColorsBackup = JSON.parse(JSON.stringify(uiState.tagColors || {}));
  const originalTagTextColorsBackup = JSON.parse(JSON.stringify(uiState.tagTextColors || {}));

  let count = 0;
  (uiState.bookmarks || []).forEach(bm => {
    if (!bm.url) return;
    try {
      const host = new URL(bm.url).hostname.replace(/^www\./, "");
      let domainTag = host.split(".")[0];
      if (domainTag.length < 3) domainTag = host;
      
      if (!uiState.bookmarkTags) uiState.bookmarkTags = {};
      if (!uiState.bookmarkTags[bm.id]) uiState.bookmarkTags[bm.id] = [];
      
      const currentTags = uiState.bookmarkTags[bm.id];
      if (currentTags.length < 10 && !currentTags.includes(domainTag)) {
        currentTags.push(domainTag);
        
        if (!uiState.tagColors) uiState.tagColors = {};
        if (!uiState.tagColors[domainTag]) uiState.tagColors[domainTag] = "#4a90e2";
        
        if (!uiState.tagTextColors) uiState.tagTextColors = {};
        if (!uiState.tagTextColors[domainTag]) uiState.tagTextColors[domainTag] = "#ffffff";
        
        count++;
      }
    } catch {}
  });

  if (count > 0) {
    const originalTags = JSON.parse(JSON.stringify(originalTagsBackup));
    const originalTagColors = JSON.parse(JSON.stringify(originalTagColorsBackup));
    const originalTagTextColors = JSON.parse(JSON.stringify(originalTagTextColorsBackup));

    import("./tag.js").then(({ saveTags }) => {
      saveTags(uiState.bookmarkTags, uiState.tagColors, uiState.tagTextColors);
      
      import("./undo.js").then(({ registerUndo }) => {
        registerUndo({
          message: t("smartCleanupTagSuccess", "Added {count} new domain tags!").replace("{count}", count),
          actionLabel: t("undoAction", "Undo"),
          undo: async () => {
            uiState.bookmarkTags = originalTags;
            uiState.tagColors = originalTagColors;
            uiState.tagTextColors = originalTagTextColors;
            saveTags(originalTags, originalTagColors, originalTagTextColors);
          }
        });
      });

      showCustomPopup(t("smartCleanupTagSuccess", "Added {count} new domain tags!").replace("{count}", count), "success", true);
      setTimeout(() => window.location.reload(), 1500);
    }).catch(err => console.error(err));
  } else {
    showCustomPopup(t("smartCleanupTagNone", "No new tags needed (or tag limits reached)."), "info", true);
  }
  });
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
        action: "untagged"
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
          t("smartCleanupDomainsIntro", "Group bookmarks by domain or auto-tag them based on URLs.")
        ),
        action: "domains",
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
        ${
          selectedDetail.action === "untagged" && untaggedBookmarks.length > 0
            ? `<button type="button" class="button save" data-cleanup-action="untagged">${escapeHtml(t("smartCleanupFilterUntagged", "Filter Untagged"))}</button>`
            : ""
        }
        ${
          selectedDetail.action === "domains" && topDomains.length > 0
            ? `
               <div class="smart-cleanup-guide" style="margin-top: 12px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; font-size: 0.9em; line-height: 1.4;">
                 <strong style="color: var(--accent-color);"><i class="fas fa-lightbulb"></i> ${escapeHtml(t("guideTitle", "How to use:"))}</strong>
                 <ul style="margin: 12px 0 20px 24px; padding: 0;">
                   <li style="margin-bottom: 8px;"><strong>${escapeHtml(t("smartCleanupGroupDomain", "Group by Domain"))}:</strong> ${escapeHtml(t("guideGroupDomain", "Creates folders for domains with multiple bookmarks and moves them inside."))}</li>
                   <li><strong>${escapeHtml(t("smartCleanupAutoTag", "Auto-Tag Domains"))}:</strong> ${escapeHtml(t("guideAutoTag", "Extracts the domain name and adds it as a tag to each bookmark."))}</li>
                 </ul>
                 <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                   <button type="button" class="button button-primary" data-cleanup-action="domains-group" style="flex: 1; min-width: 150px; justify-content: center; padding: 10px 16px;">
                     <i class="fas fa-folder-plus"></i> ${escapeHtml(t("smartCleanupGroupDomain", "Group by Domain"))}
                   </button>
                   <button type="button" class="button button-secondary" data-cleanup-action="domains-tag" style="flex: 1; min-width: 150px; justify-content: center; padding: 10px 16px;">
                     <i class="fas fa-tags"></i> ${escapeHtml(t("smartCleanupAutoTag", "Auto-Tag Domains"))}
                   </button>
                 </div>
               </div>
              `
            : ""
        }
      </div>
    `

    const moreBtn = details.querySelector(".smart-cleanup-more-btn")
    if (moreBtn) {
      moreBtn.addEventListener("click", () => {
        const hiddenDiv = details.querySelector(".smart-cleanup-hidden-items")
        if (hiddenDiv) {
          hiddenDiv.style.display = "block"
          moreBtn.style.display = "none"
        }
      })
    }

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
    details.querySelector("[data-cleanup-action='untagged']")?.addEventListener("click", () => {
      // Add logic for untagged action: for instance filtering
      close()
      // Open tags browser popup, or apply a specific filter. 
      // Right now we can just show the tags browser or simply close and let the user filter manually.
      document.getElementById("tag-expand-btn")?.click()
    })

    details.querySelector("[data-cleanup-action='domains-group']")?.addEventListener("click", groupBookmarksByDomain)
    details.querySelector("[data-cleanup-action='domains-tag']")?.addEventListener("click", autoTagByDomain)

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

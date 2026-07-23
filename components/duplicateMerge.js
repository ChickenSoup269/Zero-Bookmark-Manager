import { getBookmarkTree } from "./bookmarks.js"
import { renderFilteredBookmarks } from "./ui.js"
import { showCustomPopup, translations } from "./utils/utils.js"

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

function getDefaultKeeper(group) {
  return [...group].sort((a, b) => {
    const titleDiff = (b.title || "").length - (a.title || "").length
    if (titleDiff !== 0) return titleDiff
    return (b.dateAdded || 0) - (a.dateAdded || 0)
  })[0]
}

function ensureModal() {
  let popup = document.getElementById("duplicate-merge-popup")
  if (popup) return popup

  popup = document.createElement("div")
  popup.id = "duplicate-merge-popup"
  popup.className = "rename-popup hidden popup-animate"
  popup.setAttribute("role", "dialog")
  popup.setAttribute("aria-labelledby", "duplicate-merge-title")
  popup.innerHTML = `
    <div class="rename-popup-content duplicate-merge-content">
      <div class="duplicate-merge-header">
        <div>
          <h3 id="duplicate-merge-title"></h3>
          <p id="duplicate-merge-subtitle"></p>
        </div>
        <button id="duplicate-merge-close-x" class="modal-close" type="button" title="Close">✕</button>
      </div>
      <div id="duplicate-merge-summary" class="duplicate-merge-summary"></div>
      <div id="duplicate-merge-list" class="duplicate-merge-list"></div>
      <div class="rename-popup-buttons duplicate-merge-footer">
        <button id="duplicate-merge-apply" class="button button-primary" type="button"></button>
        <button id="duplicate-merge-cancel" class="button cancel" type="button"></button>
      </div>
    </div>
  `
  document.body.appendChild(popup)
  return popup
}

function chromeRemoveBookmark(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.remove(id, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}

function mergeObjectFlag(targetId, duplicateIds, objectStore) {
  const hasFlag = [targetId, ...duplicateIds].some((id) => !!objectStore[id])
  duplicateIds.forEach((id) => delete objectStore[id])
  if (hasFlag) objectStore[targetId] = true
}

function mergeBookmarkMetadata(targetId, duplicateIds, storage) {
  const bookmarkTags = storage.bookmarkTags || {}
  const favoriteBookmarks = storage.favoriteBookmarks || {}
  const pinnedBookmarks = storage.pinnedBookmarks || {}
  const bookmarkNotes = storage.bookmarkNotes || {}
  const readingQueue = storage.readingQueue || {}
  const bookmarkAccessCounts = storage.bookmarkAccessCounts || {}
  const visitCounts = storage.visitCounts || {}

  const mergedTags = new Set(bookmarkTags[targetId] || [])
  duplicateIds.forEach((id) => {
    ;(bookmarkTags[id] || []).forEach((tag) => mergedTags.add(tag))
    delete bookmarkTags[id]
  })
  if (mergedTags.size) bookmarkTags[targetId] = [...mergedTags].slice(0, 10)

  mergeObjectFlag(targetId, duplicateIds, favoriteBookmarks)
  mergeObjectFlag(targetId, duplicateIds, pinnedBookmarks)

  const noteParts = [bookmarkNotes[targetId], ...duplicateIds.map((id) => bookmarkNotes[id])]
    .filter(Boolean)
    .map((note) => note.trim())
  duplicateIds.forEach((id) => delete bookmarkNotes[id])
  if (noteParts.length) bookmarkNotes[targetId] = [...new Set(noteParts)].join("\n\n---\n\n")

  const queueItems = [targetId, ...duplicateIds]
    .map((id) => readingQueue[id])
    .filter(Boolean)
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
  duplicateIds.forEach((id) => delete readingQueue[id])
  if (queueItems.length) readingQueue[targetId] = queueItems[0]

  const accessTotal = [targetId, ...duplicateIds].reduce(
    (sum, id) => sum + (Number(bookmarkAccessCounts[id]) || 0),
    0,
  )
  duplicateIds.forEach((id) => delete bookmarkAccessCounts[id])
  if (accessTotal > 0) bookmarkAccessCounts[targetId] = accessTotal

  const visitTotal = [targetId, ...duplicateIds].reduce(
    (sum, id) => sum + (Number(visitCounts[id]) || 0),
    0,
  )
  duplicateIds.forEach((id) => delete visitCounts[id])
  if (visitTotal > 0) visitCounts[targetId] = visitTotal

  return {
    bookmarkTags,
    favoriteBookmarks,
    pinnedBookmarks,
    bookmarkNotes,
    readingQueue,
    bookmarkAccessCounts,
    visitCounts,
  }
}

async function applyDuplicateMerge(groups, selections) {
  const allDuplicateIds = groups.flatMap((group, groupIndex) => {
    const keeperId = selections.get(String(groupIndex))
    return group.filter((bookmark) => bookmark.id !== keeperId).map((bookmark) => bookmark.id)
  })
  const storage = await chrome.storage.local.get([
    "bookmarkTags",
    "favoriteBookmarks",
    "pinnedBookmarks",
    "bookmarkNotes",
    "readingQueue",
    "bookmarkAccessCounts",
    "visitCounts",
  ])

  const nextStorage = {
    bookmarkTags: storage.bookmarkTags || {},
    favoriteBookmarks: storage.favoriteBookmarks || {},
    pinnedBookmarks: storage.pinnedBookmarks || {},
    bookmarkNotes: storage.bookmarkNotes || {},
    readingQueue: storage.readingQueue || {},
    bookmarkAccessCounts: storage.bookmarkAccessCounts || {},
    visitCounts: storage.visitCounts || {},
  }

  for (const [groupIndex, group] of groups.entries()) {
    const targetId = selections.get(String(groupIndex))
    const duplicateIds = group
      .filter((bookmark) => bookmark.id !== targetId)
      .map((bookmark) => bookmark.id)

    if (!targetId || !duplicateIds.length) continue
    Object.assign(nextStorage, mergeBookmarkMetadata(targetId, duplicateIds, nextStorage))
  }

  await chrome.storage.local.set(nextStorage)
  for (const id of allDuplicateIds) {
    await chromeRemoveBookmark(id)
  }

  return { removedCount: allDuplicateIds.length }
}

export function openDuplicateMergeModal({ groups, elements, onComplete }) {
  const popup = ensureModal()
  const title = popup.querySelector("#duplicate-merge-title")
  const subtitle = popup.querySelector("#duplicate-merge-subtitle")
  const summary = popup.querySelector("#duplicate-merge-summary")
  const list = popup.querySelector("#duplicate-merge-list")
  const applyButton = popup.querySelector("#duplicate-merge-apply")
  const cancelButton = popup.querySelector("#duplicate-merge-cancel")
  const closeX = popup.querySelector("#duplicate-merge-close-x")

  const mergeGroups = groups.filter((group) => group.length > 1)
  const duplicateCount = mergeGroups.reduce((sum, group) => sum + group.length - 1, 0)
  const selections = new Map()

  title.textContent = t("duplicateMergeTitle", "Duplicate Merge")
  subtitle.textContent = t(
    "duplicateMergeSubtitle",
    "Choose the bookmark to keep in each duplicate group. Metadata from removed copies will be merged into it.",
  )
  applyButton.innerHTML = `<i class="fas fa-object-group" aria-hidden="true"></i> ${escapeHtml(t("duplicateMergeApply", "Merge selected"))}`
  cancelButton.innerHTML = escapeHtml(t("cancel", "Cancel"))

  summary.innerHTML = `
    <div>
      <strong>${mergeGroups.length}</strong>
      <span>${escapeHtml(t("duplicateMergeGroups", "duplicate groups"))}</span>
    </div>
    <div>
      <strong>${duplicateCount}</strong>
      <span>${escapeHtml(t("duplicateMergeWillRemove", "copies to remove"))}</span>
    </div>
    <div>
      <strong>${escapeHtml(t("duplicateMergeMetadata", "Tags, notes, pins"))}</strong>
      <span>${escapeHtml(t("duplicateMergeMetadataHint", "will be preserved"))}</span>
    </div>
  `

  if (!mergeGroups.length) {
    list.innerHTML = `<p class="duplicate-merge-empty">${escapeHtml(t("noDuplicatesFound", "No duplicate bookmarks found."))}</p>`
    applyButton.disabled = true
  } else {
    applyButton.disabled = false
    list.innerHTML = mergeGroups
      .map((group, groupIndex) => {
        const defaultKeeper = getDefaultKeeper(group)
        selections.set(String(groupIndex), defaultKeeper.id)
        return `
          <section class="duplicate-merge-group">
            <div class="duplicate-merge-group-header">
              <strong>${escapeHtml(group[0].url || "")}</strong>
              <span>${group.length} ${escapeHtml(t("bookmarks", "bookmarks"))}</span>
            </div>
            <div class="duplicate-merge-options">
              ${group
                .map(
                  (bookmark) => `
                    <label class="duplicate-merge-option ${bookmark.id === defaultKeeper.id ? "selected" : ""}">
                      <input type="radio" name="duplicate-group-${groupIndex}" value="${bookmark.id}" ${bookmark.id === defaultKeeper.id ? "checked" : ""}>
                      <span>
                        <strong>${escapeHtml(bookmark.title || bookmark.url)}</strong>
                        <small>ID ${bookmark.id} • ${bookmark.dateAdded ? new Date(bookmark.dateAdded).toLocaleDateString() : "N/A"} • ${(bookmark.tags || []).length} tags</small>
                      </span>
                    </label>
                  `,
                )
                .join("")}
            </div>
          </section>
        `
      })
      .join("")
  }

  list.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      const groupIndex = input.name.replace("duplicate-group-", "")
      selections.set(groupIndex, input.value)
      input
        .closest(".duplicate-merge-options")
        ?.querySelectorAll(".duplicate-merge-option")
        .forEach((option) => option.classList.remove("selected"))
      input.closest(".duplicate-merge-option")?.classList.add("selected")
    })
  })

  const close = () => popup.classList.add("hidden")
  cancelButton.onclick = close
  closeX.onclick = close
  popup.onclick = (event) => {
    if (event.target === popup) close()
  }

  applyButton.onclick = async () => {
    applyButton.disabled = true
    applyButton.textContent = t("merging", "Merging...")
    try {
      const result = await applyDuplicateMerge(mergeGroups, selections)
      getBookmarkTree((nodes) => {
        if (nodes) renderFilteredBookmarks(nodes, elements)
      })
      showCustomPopup(
        `${result.removedCount} ${t("duplicatesRemoved", "duplicate(s) removed.")}`,
        "success",
        true,
      )
      close()
      onComplete?.()
    } catch (error) {
      console.error("Duplicate merge failed:", error)
      showCustomPopup(t("duplicateMergeFailed", "Duplicate merge failed."), "error", true)
      applyButton.disabled = false
      applyButton.innerHTML = `<i class="fas fa-object-group" aria-hidden="true"></i> ${escapeHtml(t("duplicateMergeApply", "Merge selected"))}`
    }
  }

  popup.classList.remove("hidden")
}

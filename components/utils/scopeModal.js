import { uiState } from "../state.js"
import { translations, escapeHtml } from "./utils.js"

function getLanguage() {
  return localStorage.getItem("appLanguage") || "en"
}

function t(key, fallback = "") {
  const lang = getLanguage()
  return translations[lang]?.[key] || translations.en?.[key] || fallback
}

function getAllDescendantFolderIds(folderId, treeNodes) {
  const ids = new Set([folderId])

  function findAndCollect(nodes) {
    for (const node of nodes) {
      if (node.id === folderId) {
        collectChildren(node)
        return true
      }
      if (node.children && findAndCollect(node.children)) {
        return true
      }
    }
    return false
  }

  function collectChildren(node) {
    if (node.children) {
      for (const child of node.children) {
        if (child.children) {
          ids.add(child.id)
          collectChildren(child)
        }
      }
    }
  }

  findAndCollect(treeNodes || [])
  return ids
}

function buildFolderMetadata(treeNodes, validBookmarks) {
  const folderList = []
  const folderMap = new Map()

  const directCounts = new Map()
  validBookmarks.forEach((b) => {
    if (b.parentId) {
      directCounts.set(b.parentId, (directCounts.get(b.parentId) || 0) + 1)
    }
  })

  function walk(nodes, depth = 0, pathParts = []) {
    for (const node of nodes) {
      if (!node.children) continue
      if (node.id === "0") {
        if (node.children?.length > 0) walk(node.children, depth, pathParts)
        continue
      }

      let displayName = node.title || "Folder"
      if (node.id === "1") displayName = t("bookmarksBar", "Bookmarks Bar")
      else if (node.id === "2") displayName = t("otherBookmarks", "Other Bookmarks")

      const currentPath = [...pathParts, displayName]
      const folderItem = {
        id: node.id,
        title: displayName,
        path: pathParts.join(" › "),
        fullPath: currentPath.join(" › "),
        depth,
        directCount: directCounts.get(node.id) || 0,
        recursiveCount: 0,
        childFolderIds: new Set(),
      }

      folderList.push(folderItem)
      folderMap.set(node.id, folderItem)

      if (node.children?.length > 0) {
        walk(node.children, depth + 1, currentPath)
      }
    }
  }

  walk(treeNodes[0]?.children || treeNodes, 0, [])

  // Calculate recursive counts
  folderList.forEach((folder) => {
    const descIds = getAllDescendantFolderIds(folder.id, treeNodes)
    folder.childFolderIds = descIds
    let total = 0
    descIds.forEach((fId) => {
      total += directCounts.get(fId) || 0
    })
    folder.recursiveCount = total
  })

  return { folderList, folderMap }
}

function ensureScopeModal() {
  let popup = document.getElementById("scope-selection-popup")
  if (popup) return popup

  popup = document.createElement("div")
  popup.id = "scope-selection-popup"
  popup.className = "rename-popup hidden popup-animate"
  popup.setAttribute("role", "dialog")
  popup.setAttribute("aria-labelledby", "scope-selection-title")

  popup.innerHTML = `
    <div class="rename-popup-content scope-modal-content">
      <!-- Modal Header -->
      <div class="scope-modal-header">
        <div class="scope-modal-title-group">
          <div class="scope-modal-header-icon" id="scope-header-icon-box">
            <i id="scope-selection-icon" class="fas fa-stethoscope"></i>
          </div>
          <div>
            <h3 id="scope-selection-title">
              <span id="scope-selection-heading">Scope Selection</span>
            </h3>
            <p id="scope-modal-desc" class="scope-modal-desc"></p>
          </div>
        </div>
        <button id="scope-modal-close-x" class="modal-close" type="button" title="Close">✕</button>
      </div>

      <!-- Scope Option Cards -->
      <div class="scope-cards-grid">
        <div class="scope-radio-card active" data-scope="all" role="button" tabindex="0">
          <div class="scope-card-radio-indicator">
            <div class="scope-radio-dot"></div>
          </div>
          <div class="scope-card-icon scope-icon-all"><i class="fas fa-globe"></i></div>
          <div class="scope-card-text">
            <strong id="scope-card-all-title">All Bookmarks</strong>
            <small id="scope-card-all-desc">Scan all bookmarks across the entire browser</small>
          </div>
          <span class="scope-count-badge" id="scope-card-all-badge">0</span>
        </div>

        <div class="scope-radio-card" data-scope="folder" role="button" tabindex="0">
          <div class="scope-card-radio-indicator">
            <div class="scope-radio-dot"></div>
          </div>
          <div class="scope-card-icon scope-icon-folder"><i class="fas fa-folder-tree"></i></div>
          <div class="scope-card-text">
            <strong id="scope-card-folder-title">By Specific Folder</strong>
            <small id="scope-card-folder-desc">Scan only bookmarks within the selected folder</small>
          </div>
          <span class="scope-count-badge" id="scope-card-folder-badge">0</span>
        </div>
      </div>

      <!-- Folder Controls Section -->
      <div id="scope-folder-controls" class="scope-folder-controls" style="display: none;">
        <!-- Quick Select Chips -->
        <div class="scope-quick-chips-row">
          <span class="scope-quick-label" id="scope-quick-label">Quick:</span>
          <div class="scope-chips-container" id="scope-chips-container"></div>
        </div>

        <!-- Search input -->
        <div class="scope-search-box">
          <i class="fas fa-search scope-search-icon"></i>
          <input type="text" id="scope-folder-search" class="scope-folder-search-input" placeholder="Search folders..." autocomplete="off">
          <button type="button" id="scope-folder-search-clear" class="scope-search-clear" style="display: none;" title="Clear">✕</button>
        </div>

        <!-- Folder Interactive Tree/List -->
        <div class="scope-folder-list-container">
          <div id="scope-folder-list" class="scope-folder-list" role="listbox"></div>
          <div id="scope-no-folders-msg" class="scope-no-folders-msg" style="display: none;">
            <i class="fas fa-folder-open"></i>
            <span id="scope-no-folders-text">No matching folders found</span>
          </div>
        </div>

        <!-- Subfolders Switch -->
        <div class="scope-subfolder-switch-row">
          <label class="scope-switch-label" for="scope-include-subfolders">
            <div class="scope-switch-info">
              <span id="scope-include-subfolders-text" class="scope-switch-title">Include subfolders</span>
              <small id="scope-include-subfolders-hint" class="scope-switch-hint">Also scan bookmarks in all nested subfolders</small>
            </div>
            <div class="scope-switch-track">
              <input type="checkbox" id="scope-include-subfolders" checked>
              <span class="scope-switch-thumb"></span>
            </div>
          </label>
        </div>
      </div>

      <!-- Summary Info Card -->
      <div id="scope-summary-banner" class="scope-summary-card">
        <div class="scope-summary-left">
          <div class="scope-summary-icon-box">
            <i id="scope-summary-icon" class="fas fa-shield-halved"></i>
          </div>
          <div class="scope-summary-text-group">
            <div id="scope-summary-text" class="scope-summary-title"></div>
            <div id="scope-summary-sub" class="scope-summary-sub"></div>
          </div>
        </div>
        <div id="scope-summary-time-badge" class="scope-summary-time-badge">
          <i class="fas fa-clock"></i>
          <span id="scope-summary-time-text">~2s</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="rename-popup-buttons scope-modal-buttons">
        <button id="scope-cancel-btn" class="button cancel" type="button">Cancel</button>
        <button id="scope-start-btn" class="button button-primary scope-start-btn" type="button">
          <i id="scope-start-btn-icon" class="fas fa-play"></i>
          <span id="scope-start-btn-text">Start Check</span>
        </button>
      </div>
    </div>
  `

  document.body.appendChild(popup)
  return popup
}

export function openScopeSelectionModal({
  type = "health", // "health" | "duplicates"
  title = "",
  desc = "",
  icon = "fa-stethoscope",
  actionText = "",
  initialFolderId = null,
  onConfirm = () => {},
}) {
  const popup = ensureScopeModal()

  // Apply active theme
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light"
  const allThemes = ["light", "dark", "dracula", "onedark", "tet"]
  allThemes.forEach((th) => popup.classList.remove(`${th}-theme`))
  popup.classList.add(`${currentTheme}-theme`)

  // Element references
  const headingEl = popup.querySelector("#scope-selection-heading")
  const iconEl = popup.querySelector("#scope-selection-icon")
  const descEl = popup.querySelector("#scope-modal-desc")
  const cardAll = popup.querySelector('.scope-radio-card[data-scope="all"]')
  const cardFolder = popup.querySelector('.scope-radio-card[data-scope="folder"]')
  const cardAllTitle = popup.querySelector("#scope-card-all-title")
  const cardAllDesc = popup.querySelector("#scope-card-all-desc")
  const cardAllBadge = popup.querySelector("#scope-card-all-badge")
  const cardFolderTitle = popup.querySelector("#scope-card-folder-title")
  const cardFolderDesc = popup.querySelector("#scope-card-folder-desc")
  const cardFolderBadge = popup.querySelector("#scope-card-folder-badge")
  const folderControls = popup.querySelector("#scope-folder-controls")
  const quickLabel = popup.querySelector("#scope-quick-label")
  const chipsContainer = popup.querySelector("#scope-chips-container")
  const searchInput = popup.querySelector("#scope-folder-search")
  const searchClearBtn = popup.querySelector("#scope-folder-search-clear")
  const folderListEl = popup.querySelector("#scope-folder-list")
  const noFoldersMsg = popup.querySelector("#scope-no-folders-msg")
  const noFoldersText = popup.querySelector("#scope-no-folders-text")
  const includeSubfoldersCb = popup.querySelector("#scope-include-subfolders")
  const includeSubfoldersText = popup.querySelector("#scope-include-subfolders-text")
  const includeSubfoldersHint = popup.querySelector("#scope-include-subfolders-hint")
  const summaryBanner = popup.querySelector("#scope-summary-banner")
  const summaryIcon = popup.querySelector("#scope-summary-icon")
  const summaryText = popup.querySelector("#scope-summary-text")
  const summarySub = popup.querySelector("#scope-summary-sub")
  const timeBadge = popup.querySelector("#scope-summary-time-badge")
  const timeText = popup.querySelector("#scope-summary-time-text")
  const startBtn = popup.querySelector("#scope-start-btn")
  const startBtnIcon = popup.querySelector("#scope-start-btn-icon")
  const startBtnText = popup.querySelector("#scope-start-btn-text")
  const cancelBtn = popup.querySelector("#scope-cancel-btn")
  const closeX = popup.querySelector("#scope-modal-close-x")

  // Set titles & descriptions
  const defaultTitle =
    type === "health"
      ? t("checkHealthModalTitle", "Check Link Health")
      : t("checkDuplicatesModalTitle", "Check Duplicate Bookmarks")
  const defaultDesc =
    type === "health"
      ? t(
          "checkHealthModalDesc",
          "Choose scope to check for dead (404/500), malware, or risky links:",
        )
      : t(
          "checkDuplicatesModalDesc",
          "Choose scope to check for duplicate bookmark URLs:",
        )
  const defaultAction =
    type === "health"
      ? t("scopeStartCheck", "Start Check")
      : t("checkDuplicates", "Check Duplicates")

  headingEl.textContent = title || defaultTitle
  iconEl.className = `fas ${icon}`
  descEl.textContent = desc || defaultDesc

  cardAllTitle.textContent = t("scopeAllBookmarks", "All Bookmarks")
  cardAllDesc.textContent = t(
    "scopeAllBookmarksDesc",
    "Scan all bookmarks across the entire browser",
  )
  cardFolderTitle.textContent = t("scopeByFolder", "By Specific Folder")
  cardFolderDesc.textContent = t(
    "scopeByFolderDesc",
    "Scan only bookmarks within the selected folder",
  )

  quickLabel.textContent = t("scopeQuickSelect", "Quick:")
  searchInput.placeholder = t("scopeSearchFolderPlaceholder", "Search folders...")
  noFoldersText.textContent = t("scopeNoFoldersFound", "No matching folders found")
  includeSubfoldersText.textContent = t("scopeIncludeSubfolders", "Include subfolders")
  includeSubfoldersHint.textContent = t(
    "scopeIncludeSubfoldersHint",
    "Also scan bookmarks in all nested subfolders",
  )

  startBtnText.textContent = actionText || defaultAction
  startBtnIcon.className = `fas ${icon}`
  cancelBtn.textContent = t("cancel", "Cancel")

  summaryIcon.className =
    type === "health" ? "fas fa-shield-halved" : "fas fa-clone"

  // Bookmarks source
  const allBookmarks = uiState.bookmarks || []
  const isSeparator = (b) => b.title && b.title.match(/^[-=_+*~:]{3,}$/)

  // Filter valid bookmarks
  const validBookmarks = allBookmarks.filter((b) => {
    if (!b.url) return false
    if (type === "health") return b.url.startsWith("http")
    if (type === "duplicates") return !isSeparator(b)
    return true
  })

  cardAllBadge.textContent = `${validBookmarks.length}`

  // Build folder metadata
  const treeNodes = uiState.bookmarkTree || []
  const { folderList, folderMap } = buildFolderMetadata(treeNodes, validBookmarks)

  // Determine current/initial folder
  const currentViewFolderId =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0" &&
    !uiState.selectedFolderId.startsWith("__smart_")
      ? uiState.selectedFolderId
      : null

  let selectedFolderId =
    initialFolderId ||
    currentViewFolderId ||
    (folderList.length > 0 ? folderList[0].id : null)

  let activeScope = (initialFolderId || currentViewFolderId) ? "folder" : "all"

  // Quick Chips setup
  chipsContainer.innerHTML = ""
  const quickCandidates = []

  if (currentViewFolderId && folderMap.has(currentViewFolderId)) {
    quickCandidates.push({
      id: currentViewFolderId,
      label: `${t("scopeCurrentFolder", "Current")}: ${folderMap.get(currentViewFolderId).title}`,
      icon: "fa-crosshairs",
    })
  }

  if (folderMap.has("1")) {
    quickCandidates.push({
      id: "1",
      label: folderMap.get("1").title,
      icon: "fa-star",
    })
  }

  if (folderMap.has("2")) {
    quickCandidates.push({
      id: "2",
      label: folderMap.get("2").title,
      icon: "fa-folder",
    })
  }

  quickCandidates.forEach((cand) => {
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className = "scope-chip"
    chip.dataset.id = cand.id
    chip.innerHTML = `<i class="fas ${cand.icon}"></i> <span>${escapeHtml(cand.label)}</span>`
    chip.onclick = () => {
      selectFolder(cand.id)
    }
    chipsContainer.appendChild(chip)
  })

  // Render folder items
  function renderFolderList(filterQuery = "") {
    folderListEl.innerHTML = ""
    const query = filterQuery.trim().toLowerCase()

    let visibleCount = 0

    folderList.forEach((folder) => {
      const matches =
        !query ||
        folder.title.toLowerCase().includes(query) ||
        folder.fullPath.toLowerCase().includes(query)

      if (!matches) return
      visibleCount++

      const item = document.createElement("div")
      item.className = `scope-folder-item ${folder.id === selectedFolderId ? "selected" : ""}`
      item.dataset.id = folder.id
      item.setAttribute("role", "option")
      item.setAttribute("aria-selected", folder.id === selectedFolderId ? "true" : "false")

      const isSub = includeSubfoldersCb.checked
      const count = isSub ? folder.recursiveCount : folder.directCount

      const folderIconClass =
        folder.id === "1"
          ? "fa-star"
          : folder.id === selectedFolderId
          ? "fa-folder-open"
          : "fa-folder"

      // Indent calculation
      const indentPx = query ? 8 : Math.min(folder.depth * 14 + 8, 56)

      item.style.paddingLeft = `${indentPx}px`

      item.innerHTML = `
        <div class="scope-folder-item-left">
          <i class="fas ${folderIconClass} scope-folder-item-icon"></i>
          <div class="scope-folder-item-text">
            <span class="scope-folder-name">${escapeHtml(folder.title)}</span>
            ${folder.path ? `<span class="scope-folder-path">${escapeHtml(folder.path)}</span>` : ""}
          </div>
        </div>
        <div class="scope-folder-item-right">
          <span class="scope-item-badge">${count}</span>
          <i class="fas fa-check-circle scope-item-check"></i>
        </div>
      `

      item.onclick = () => {
        selectFolder(folder.id)
      }

      folderListEl.appendChild(item)
    })

    noFoldersMsg.style.display = visibleCount === 0 ? "flex" : "none"
  }

  function selectFolder(id) {
    if (!folderMap.has(id)) return
    selectedFolderId = id

    // Highlight active chip
    chipsContainer.querySelectorAll(".scope-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.id === id)
    })

    // Update list selection
    folderListEl.querySelectorAll(".scope-folder-item").forEach((el) => {
      const isSel = el.dataset.id === id
      el.classList.toggle("selected", isSel)
      el.setAttribute("aria-selected", isSel ? "true" : "false")
      const icon = el.querySelector(".scope-folder-item-icon")
      if (icon) {
        if (el.dataset.id === "1") {
          icon.className = "fas fa-star scope-folder-item-icon"
        } else {
          icon.className = `fas ${isSel ? "fa-folder-open" : "fa-folder"} scope-folder-item-icon`
        }
      }
    })

    // Auto-scroll selected into view
    const selectedEl = folderListEl.querySelector(`.scope-folder-item[data-id="${id}"]`)
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }

    updatePreview()
  }

  // Update preview counts & status banner
  function updatePreview() {
    const isAll = activeScope === "all"
    const isSub = includeSubfoldersCb.checked

    let targetCount = 0
    let targetTitle = ""

    if (isAll) {
      targetCount = validBookmarks.length
      targetTitle = t("scopeAllBookmarks", "All Bookmarks")
    } else {
      const folder = folderMap.get(selectedFolderId)
      if (folder) {
        targetTitle = folder.title
        targetCount = isSub ? folder.recursiveCount : folder.directCount
      }
    }

    cardFolderBadge.textContent = `${targetCount}`

    // Update quick chips active state
    chipsContainer.querySelectorAll(".scope-chip").forEach((chip) => {
      chip.classList.toggle("active", activeScope === "folder" && chip.dataset.id === selectedFolderId)
    })

    // Time estimate
    if (type === "health") {
      // Concurrency limit is 5, ~250ms per request average
      const estSeconds = Math.max(1, Math.ceil((targetCount / 5) * 0.35))
      const timeTemplate = t("scopeEstimatedTime", "Estimated time: ~{0}s")
      timeText.textContent = timeTemplate.replace("{0}", estSeconds)
      timeBadge.style.display = targetCount > 0 ? "inline-flex" : "none"
    } else {
      timeText.textContent = "< 1s"
      timeBadge.style.display = targetCount > 0 ? "inline-flex" : "none"
    }

    if (targetCount === 0) {
      summaryBanner.className = "scope-summary-card warning"
      summaryIcon.className = "fas fa-exclamation-triangle"
      summaryText.textContent = t(
        "scopeNoBookmarks",
        "No bookmarks found in the selected scope.",
      )
      summarySub.textContent = isAll
        ? "Please add bookmarks first."
        : "Selected folder contains no matching links."
      startBtn.disabled = true
      startBtn.classList.remove("ready")
    } else {
      summaryBanner.className = "scope-summary-card"
      summaryIcon.className =
        type === "health" ? "fas fa-shield-halved" : "fas fa-clone"

      const previewTemplate =
        type === "health"
          ? t("scopePreviewCheckLinks", "Will check: {0} links")
          : t("scopePreviewCheckDuplicates", "Will scan: {0} bookmarks")

      summaryText.innerHTML = previewTemplate.replace(
        "{0}",
        `<strong>${targetCount}</strong>`,
      )

      if (isAll) {
        summarySub.textContent =
          type === "health"
            ? "Testing HTTP status, URLhaus malware database, and risk patterns."
            : "Comparing URLs across all folders in your library."
      } else {
        const folder = folderMap.get(selectedFolderId)
        const subNote = isSub ? " (+ subfolders)" : " (direct only)"
        summarySub.textContent = `Target: "${folder?.title || 'Folder'}"${subNote}`
      }

      startBtn.disabled = false
      startBtn.classList.add("ready")
    }
  }

  // Switch between All and Folder cards
  function setScope(scope) {
    activeScope = scope
    if (scope === "all") {
      cardAll.classList.add("active")
      cardFolder.classList.remove("active")
      folderControls.style.display = "none"
    } else {
      cardFolder.classList.add("active")
      cardAll.classList.remove("active")
      folderControls.style.display = "block"
      renderFolderList(searchInput.value)
      if (selectedFolderId) selectFolder(selectedFolderId)
    }
    updatePreview()
  }

  cardAll.onclick = () => setScope("all")
  cardFolder.onclick = () => setScope("folder")

  // Search input handler
  searchInput.oninput = () => {
    const q = searchInput.value
    searchClearBtn.style.display = q ? "block" : "none"
    renderFolderList(q)
  }

  searchClearBtn.onclick = () => {
    searchInput.value = ""
    searchClearBtn.style.display = "none"
    renderFolderList("")
    searchInput.focus()
  }

  // Subfolder switch handler
  includeSubfoldersCb.onchange = () => {
    renderFolderList(searchInput.value)
    updatePreview()
  }

  // Initial render
  renderFolderList()
  setScope(activeScope)

  // Close handlers
  const closeModal = () => {
    popup.classList.add("hidden")
    document.removeEventListener("keydown", handleKeydown)
  }

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closeModal()
    } else if (e.key === "Enter" && !startBtn.disabled && document.activeElement !== searchInput) {
      startCheck()
    }
  }

  document.addEventListener("keydown", handleKeydown)
  cancelBtn.onclick = closeModal
  closeX.onclick = closeModal
  popup.onclick = (e) => {
    if (e.target === popup) closeModal()
  }

  // Start check handler
  function startCheck() {
    const isAll = activeScope === "all"
    const isSub = includeSubfoldersCb.checked

    let targets = []
    let folderTitle = ""

    if (isAll) {
      targets = validBookmarks
    } else if (selectedFolderId) {
      const folder = folderMap.get(selectedFolderId)
      folderTitle = folder?.title || "Folder"

      if (isSub) {
        const descIds = folder?.childFolderIds || new Set([selectedFolderId])
        targets = validBookmarks.filter((b) => descIds.has(b.parentId))
      } else {
        targets = validBookmarks.filter((b) => b.parentId === selectedFolderId)
      }
    }

    closeModal()
    onConfirm(targets, {
      scopeType: isAll ? "all" : "folder",
      folderId: isAll ? null : selectedFolderId,
      folderTitle,
      includeSubfolders: isSub,
    })
  }

  startBtn.onclick = startCheck
  popup.classList.remove("hidden")
}

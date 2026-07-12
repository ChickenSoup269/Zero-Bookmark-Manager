import { translations, calculateMatchScore, showCustomPopup } from "./utils/utils.js"
import {
  handleCheckHealth,
  renderFilteredBookmarks,
  updateTheme,
} from "./ui.js"
import { saveUIState, uiState } from "./state.js"

const MAX_RESULTS = 10

function getLanguage() {
  return localStorage.getItem("appLanguage") || "en"
}

function t(key, fallback) {
  const language = getLanguage()
  return translations[language]?.[key] || translations.en?.[key] || fallback
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function getNoteSnippet(note = "", query = "") {
  const cleanNote = String(note).replace(/\s+/g, " ").trim()
  if (!cleanNote) return ""

  const normalizedQuery = query.trim().toLowerCase()
  const matchIndex = normalizedQuery
    ? cleanNote.toLowerCase().indexOf(normalizedQuery)
    : -1
  const start = Math.max(matchIndex - 36, 0)
  const snippet =
    matchIndex >= 0
      ? cleanNote.slice(start, start + 112)
      : cleanNote.slice(0, 112)
  return `${start > 0 ? "... " : ""}${snippet}${cleanNote.length > start + snippet.length ? " ..." : ""}`
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  )
}

function setSearchQuery(query, elements) {
  uiState.searchQuery = query.toLowerCase()
  uiState.readingQueueOnly = false
  if (elements.searchInput) elements.searchInput.value = query
  renderFilteredBookmarks(uiState.bookmarkTree, elements)
  saveUIState()
}

function setFolder(folderId, elements) {
  uiState.selectedFolderId = folderId
  if (elements.folderFilter) elements.folderFilter.value = folderId
  renderFilteredBookmarks(uiState.bookmarkTree, elements)
  saveUIState()
}

function setView(viewMode, elements) {
  uiState.viewMode = viewMode
  localStorage.setItem("appView", viewMode)
  if (elements.viewSwitcher) elements.viewSwitcher.value = viewMode
  renderFilteredBookmarks(uiState.bookmarkTree, elements)
  saveUIState()
}

function setTheme(theme, elements) {
  localStorage.setItem("appTheme", theme)
  if (elements.themeSwitcher) elements.themeSwitcher.value = theme
  updateTheme(elements, theme)
}

function buildStaticCommands(elements) {
  const viewCommands = [
    ["flat", "fa-list", "Flat"],
    ["card", "fa-table-cells-large", "Card"],
    ["list", "fa-bars", "List"],
    ["tree", "fa-diagram-project", "Tree"],
    ["detail", "fa-circle-info", "Detail"],
  ].map(([view, icon, label]) => ({
    type: "command",
    icon,
    title: `${t("commandPaletteView", "View")}: ${label}`,
    meta: t("commandPaletteViewMeta", "Change bookmark layout"),
    keywords: `view layout ${view} ${label}`,
    run: () => setView(view, elements),
  }))

  const themeCommands = [
    ["system", "fa-circle-half-stroke", "System"],
    ["light", "fa-sun", "Light"],
    ["dark", "fa-moon", "Dark"],
    ["dracula", "fa-wand-magic-sparkles", "Dracula"],
    ["tokyonight", "fa-star", "Tokyo Night"],
    ["nord", "fa-snowflake", "Nord"],
    ["synthwave", "fa-rocket", "SynthWave 84"],
  ].map(([theme, icon, label]) => ({
    type: "command",
    icon,
    title: `${t("commandPaletteTheme", "Theme")}: ${label}`,
    meta: t("commandPaletteThemeMeta", "Switch appearance"),
    keywords: `theme appearance ${theme} ${label}`,
    run: () => setTheme(theme, elements),
  }))

  return [
    {
      type: "command",
      icon: "fa-magnifying-glass",
      title: t("commandPaletteFocusSearch", "Focus bookmark search"),
      meta: t("commandPaletteFocusSearchMeta", "Jump to sidebar search"),
      keywords: "search find filter bookmark",
      run: () => elements.searchInput?.focus(),
    },
    {
      type: "command",
      icon: "fa-eraser",
      title: t("commandPaletteClearSearch", "Clear search and filters"),
      meta: t("commandPaletteClearSearchMeta", "Show all bookmarks again"),
      keywords: "clear reset search filter all",
      run: () => {
        uiState.searchQuery = ""
        uiState.selectedFolderId = ""
        uiState.selectedTags = []
        uiState.readingQueueOnly = false
        if (elements.searchInput) elements.searchInput.value = ""
        if (elements.folderFilter) elements.folderFilter.value = ""
        renderFilteredBookmarks(uiState.bookmarkTree, elements)
        saveUIState()
      },
    },
    {
      type: "command",
      icon: "fa-book-open-reader",
      title: t("commandPaletteReadingQueue", "Reading Queue"),
      meta: t("commandPaletteReadingQueueMeta", "Show saved read-later bookmarks"),
      keywords: "reading queue read later unread",
      run: () => {
        uiState.readingQueueOnly = true
        uiState.searchQuery = ""
        if (elements.searchInput) elements.searchInput.value = ""
        renderFilteredBookmarks(uiState.bookmarkTree, elements)
        saveUIState()
      },
    },
    ...viewCommands,
    ...themeCommands,
    {
      type: "command",
      icon: "fa-folder-plus",
      title: t("createFolder", "Create Folder"),
      meta: t("commandPaletteCreateFolderMeta", "Open folder creator"),
      keywords: "create folder add collection",
      run: () => elements.createFolderButton?.click(),
    },
    {
      type: "command",
      icon: "fa-download",
      title: t("exportBookmarks", "Export Bookmarks"),
      meta: t("commandPaletteExportMeta", "Open export options"),
      keywords: "export backup download html csv json netscape",
      run: () => elements.exportBookmarksOption?.click(),
    },
    {
      type: "command",
      icon: "fa-upload",
      title: t("importBookmarks", "Import Bookmarks"),
      meta: t("commandPaletteImportMeta", "Import a backup file"),
      keywords: "import restore upload backup",
      run: () => elements.importBookmarksOption?.click(),
    },
    {
      type: "command",
      icon: "fa-heart-pulse",
      title: t("checkLinks", "Check Links"),
      meta: t("commandPaletteCheckLinksMeta", "Scan bookmark health"),
      keywords: "check links health dead broken",
      run: () => handleCheckHealth(elements),
    },
    {
      type: "command",
      icon: "fa-broom",
      title: t("smartCleanupTitle", "Smart Cleanup"),
      meta: t("smartCleanupSubtitle", "Review bookmark cleanup opportunities"),
      keywords: "cleanup clean duplicates dead links stale untagged empty folder",
      run: () => document.getElementById("smart-cleanup-button")?.click(),
    },
    {
      type: "command",
      icon: "fa-robot",
      title: t("aiConfigTitle", "AI Settings"),
      meta: t("commandPaletteAiMeta", "Configure chat provider"),
      keywords: "ai chatbot gemini openai model api settings",
      run: () => document.getElementById("ai-settings-option")?.click(),
    },
    {
      type: "command",
      icon: "fa-circle-question",
      title: t("helpGuideTitle", "Help Guide"),
      meta: t("commandPaletteHelpMeta", "Open command guide"),
      keywords: "help guide commands tutorial",
      run: () => document.getElementById("chat-help")?.click(),
    },
    {
      type: "command",
      icon: "fa-check-square",
      title: t("showCheckboxes", "Show Checkboxes"),
      meta: t("commandPaletteSelectionMeta", "Toggle bulk selection"),
      keywords: "select checkbox bulk multi",
      run: () => elements.toggleCheckboxesButton?.click(),
    },
  ]
}

function buildBookmarkResults(query, elements) {
  const normalized = query.trim()
  const bookmarks = uiState.bookmarks || []
  const source = normalized
    ? bookmarks
        .map((bookmark) => {
          const titleScore = calculateMatchScore(bookmark.title || "", normalized)
          const urlScore = calculateMatchScore(bookmark.url || "", normalized)
          const tagScore = (bookmark.tags || []).reduce(
            (score, tag) => Math.max(score, calculateMatchScore(tag, normalized)),
            0,
          )
          const noteScore = calculateMatchScore(
            uiState.bookmarkNotes?.[bookmark.id] || "",
            normalized,
          )
          return {
            bookmark,
            score: Math.max(titleScore, urlScore, tagScore, noteScore),
          }
        })
        .filter(({ bookmark, score }) => bookmark.url && score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .map(({ bookmark }) => bookmark)
    : bookmarks
        .filter((bookmark) => bookmark.url)
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))

  return source.slice(0, 6).map((bookmark) => ({
    type: "bookmark",
    icon: "fa-bookmark",
    title: bookmark.title || bookmark.url,
    meta: getDomain(bookmark.url),
    keywords: `${bookmark.title || ""} ${bookmark.url || ""} ${(bookmark.tags || []).join(" ")} ${uiState.bookmarkNotes?.[bookmark.id] || ""}`,
    run: () => chrome.tabs.create({ url: bookmark.url }),
    actions: [
      {
        label: t("commandPaletteCopyUrl", "Copy URL"),
        run: () => {
          navigator.clipboard.writeText(bookmark.url)
          showCustomPopup(t("copySuccess", "Copied!"), "success", true)
        },
      },
      {
        label: t("commandPaletteFilter", "Filter"),
        run: () => setSearchQuery(bookmark.title || bookmark.url, elements),
      },
    ],
  }))
}

function buildNoteResults(query, elements) {
  const normalized = query.trim()
  if (!normalized) return []

  return (uiState.bookmarks || [])
    .filter((bookmark) => bookmark.url && uiState.bookmarkNotes?.[bookmark.id])
    .map((bookmark) => ({
      bookmark,
      score: calculateMatchScore(uiState.bookmarkNotes[bookmark.id], normalized),
    }))
    .filter(({ score }) => score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ bookmark }) => ({
      type: "note",
      icon: "fa-note-sticky",
      title: bookmark.title || bookmark.url,
      meta: getNoteSnippet(uiState.bookmarkNotes[bookmark.id], normalized),
      keywords: `${bookmark.title || ""} ${bookmark.url || ""} ${uiState.bookmarkNotes[bookmark.id]}`,
      run: () => {
        import("./controller/bookmarkActions.js").then(({ openBookmarkDetailPopup }) => {
          openBookmarkDetailPopup(bookmark.id, elements)
        })
      },
      actions: [
        {
          label: t("commandPaletteFilter", "Filter"),
          run: () => setSearchQuery(normalized, elements),
        },
        {
          label: t("commandPaletteOpenUrl", "Open URL"),
          run: () => chrome.tabs.create({ url: bookmark.url }),
        },
      ],
    }))
}

function buildFolderResults(query, elements) {
  const normalized = query.trim()
  if (!normalized) return []

  return (uiState.folders || [])
    .map((folder) => ({
      folder,
      score: calculateMatchScore(folder.title || "", normalized),
    }))
    .filter(({ folder, score }) => folder.id !== "0" && score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ folder }) => ({
      type: "folder",
      icon: "fa-folder",
      title: folder.title || t("unnamedFolder", "Unnamed Folder"),
      meta: t("commandPaletteFolderMeta", "Filter by folder"),
      keywords: `folder ${folder.title || ""}`,
      run: () => setFolder(folder.id, elements),
    }))
}

function rankCommands(commands, query) {
  if (!query.trim()) return commands.slice(0, 8)

  return commands
    .map((command) => {
      const haystack = `${command.title} ${command.meta} ${command.keywords || ""}`
      return { command, score: calculateMatchScore(haystack, query) }
    })
    .filter(({ score }) => score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map(({ command }) => command)
}

export function initCommandPalette(elements) {
  const palette = document.getElementById("command-palette")
  const button = document.getElementById("command-palette-button")
  const input = document.getElementById("command-palette-input")
  const resultsEl = document.getElementById("command-palette-results")
  const countEl = document.getElementById("command-palette-count")
  const titleEl = document.getElementById("command-palette-title")

  if (!palette || !input || !resultsEl) return

  let activeIndex = 0
  let currentResults = []

  const syncLabels = () => {
    if (titleEl) titleEl.textContent = t("commandPaletteTitle", "Command Palette")
    input.placeholder = t(
      "commandPalettePlaceholder",
      "Search bookmarks or run command...",
    )
    input.setAttribute("aria-label", t("commandPaletteAria", "Command palette search"))
    if (button) {
      button.title = t("commandPaletteOpen", "Open command palette")
      button.setAttribute("aria-label", t("commandPaletteOpen", "Open command palette"))
    }
  }

  const closePalette = () => {
    palette.classList.add("hidden")
    input.value = ""
  }

  const openPalette = () => {
    palette.classList.remove("hidden")
    renderResults()
    window.requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }

  const runResult = (result, actionIndex = null) => {
    closePalette()
    if (actionIndex !== null && result.actions?.[actionIndex]) {
      result.actions[actionIndex].run()
      return
    }
    result.run()
  }

  const renderResults = () => {
    const query = input.value.trim()
    const commands = rankCommands(buildStaticCommands(elements), query)
    const notes = buildNoteResults(query, elements)
    const bookmarks = buildBookmarkResults(query, elements)
    const folders = buildFolderResults(query, elements)

    currentResults = [...commands, ...folders, ...notes, ...bookmarks].slice(0, MAX_RESULTS)
    activeIndex = Math.min(activeIndex, Math.max(currentResults.length - 1, 0))

    if (countEl) countEl.textContent = String(currentResults.length)

    if (!currentResults.length) {
      resultsEl.innerHTML = `
        <div class="command-palette-empty">
          ${escapeHtml(t("commandPaletteNoResults", "No matching command or bookmark."))}
        </div>
      `
      return
    }

    resultsEl.innerHTML = currentResults
      .map((result, index) => {
        const actions = result.actions?.length
          ? `<div class="command-palette-result-actions">
              ${result.actions
                .map(
                  (action, actionIndex) => `
                    <button type="button" data-index="${index}" data-action-index="${actionIndex}">
                      ${escapeHtml(action.label)}
                    </button>
                  `,
                )
                .join("")}
            </div>`
          : ""

        return `
          <div class="command-palette-result ${index === activeIndex ? "active" : ""}"
            role="option" aria-selected="${index === activeIndex}" tabindex="-1" data-index="${index}">
            <span class="command-palette-result-icon">
              <i class="fas ${escapeHtml(result.icon)}" aria-hidden="true"></i>
            </span>
            <span class="command-palette-result-copy">
              <strong>${escapeHtml(result.title)}</strong>
              <small>${escapeHtml(result.meta || "")}</small>
            </span>
            <span class="command-palette-result-type">${escapeHtml(result.type)}</span>
            ${actions}
          </div>
        `
      })
      .join("")
  }

  const setActiveIndex = (nextIndex) => {
    if (!currentResults.length) return
    activeIndex = (nextIndex + currentResults.length) % currentResults.length
    renderResults()
  }

  button?.addEventListener("click", openPalette)

  document.addEventListener("keydown", (e) => {
    const isPaletteShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"
    if (!isPaletteShortcut) return
    e.preventDefault()
    if (palette.classList.contains("hidden")) {
      openPalette()
    } else {
      closePalette()
    }
  })

  input.addEventListener("input", () => {
    activeIndex = 0
    renderResults()
  })

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      closePalette()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(activeIndex + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(activeIndex - 1)
    } else if (e.key === "Enter" && currentResults[activeIndex]) {
      e.preventDefault()
      runResult(currentResults[activeIndex])
    }
  })

  resultsEl.addEventListener("click", (e) => {
    const actionButton = e.target.closest("[data-action-index]")
    if (actionButton) {
      const result = currentResults[Number(actionButton.dataset.index)]
      if (result) runResult(result, Number(actionButton.dataset.actionIndex))
      return
    }

    const resultButton = e.target.closest(".command-palette-result")
    if (!resultButton) return
    const result = currentResults[Number(resultButton.dataset.index)]
    if (result) runResult(result)
  })

  palette.addEventListener("click", (e) => {
    if (e.target === palette) closePalette()
  })

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || !palette.classList.contains("hidden")) return
    if (isTypingTarget(e.target)) return
    e.preventDefault()
    openPalette()
  })

  syncLabels()
  window.addEventListener("languageChanged", () => {
    syncLabels()
    renderResults()
  })
}

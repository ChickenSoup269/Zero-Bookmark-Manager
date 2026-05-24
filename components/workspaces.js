import { renderFilteredBookmarks } from "./ui.js"
import { saveUIState, uiState } from "./state.js"
import { showCustomPopup, translations } from "./utils/utils.js"

const WORKSPACE_KEY = "pinnedWorkspaces"

const WORKSPACES = [
  { id: "work", icon: "fa-briefcase", labelKey: "workspaceWork", fallback: "Work" },
  { id: "learning", icon: "fa-graduation-cap", labelKey: "workspaceLearning", fallback: "Learning" },
  { id: "design", icon: "fa-palette", labelKey: "workspaceDesign", fallback: "Design" },
  { id: "personal", icon: "fa-heart", labelKey: "workspacePersonal", fallback: "Personal" },
]

function getLanguage() {
  return localStorage.getItem("appLanguage") || "en"
}

function t(key, fallback) {
  const language = getLanguage()
  return translations[language]?.[key] || translations.en?.[key] || fallback
}

function getWorkspaceSnapshot() {
  return {
    searchQuery: uiState.searchQuery || "",
    selectedFolderId: uiState.selectedFolderId || "",
    selectedTags: [...(uiState.selectedTags || [])],
    sortType: uiState.sortType || "default",
    viewMode: uiState.viewMode || "flat",
    healthFilter: uiState.healthFilter || "all",
    readingQueueOnly: !!uiState.readingQueueOnly,
    savedAt: Date.now(),
  }
}

function applyWorkspaceState(snapshot, elements) {
  uiState.searchQuery = snapshot.searchQuery || ""
  uiState.selectedFolderId = snapshot.selectedFolderId || ""
  uiState.selectedTags = Array.isArray(snapshot.selectedTags)
    ? [...snapshot.selectedTags]
    : []
  uiState.sortType = snapshot.sortType || "default"
  uiState.viewMode = snapshot.viewMode || "flat"
  uiState.healthFilter = snapshot.healthFilter || "all"
  uiState.readingQueueOnly = !!snapshot.readingQueueOnly

  localStorage.setItem("appView", uiState.viewMode)
  if (elements.searchInput) elements.searchInput.value = uiState.searchQuery
  if (elements.folderFilter) elements.folderFilter.value = uiState.selectedFolderId
  if (elements.sortFilter) elements.sortFilter.value = uiState.sortType
  if (elements.viewSwitcher) elements.viewSwitcher.value = uiState.viewMode
  if (elements.healthSortFilter) elements.healthSortFilter.value = uiState.healthFilter

  renderFilteredBookmarks(uiState.bookmarkTree, elements)
  saveUIState()
}

async function loadWorkspaces() {
  const data = await chrome.storage.local.get([WORKSPACE_KEY])
  return data[WORKSPACE_KEY] || {}
}

async function saveWorkspace(workspaceId, elements, render) {
  const workspaces = await loadWorkspaces()
  workspaces[workspaceId] = getWorkspaceSnapshot()
  await chrome.storage.local.set({ [WORKSPACE_KEY]: workspaces })
  render(workspaces)
  showCustomPopup(t("workspaceSaved", "Workspace saved."), "success", true)
}

function getStateSummary(snapshot) {
  if (!snapshot) return t("workspaceEmpty", "No saved view")

  const parts = []
  if (snapshot.searchQuery) parts.push(`"${snapshot.searchQuery}"`)
  if (snapshot.selectedTags?.length) parts.push(`${snapshot.selectedTags.length} tags`)
  if (snapshot.readingQueueOnly) parts.push(t("commandPaletteReadingQueue", "Reading Queue"))
  if (snapshot.sortType && snapshot.sortType !== "default") parts.push(snapshot.sortType)
  if (snapshot.viewMode) parts.push(snapshot.viewMode)
  return parts.slice(0, 2).join(" • ") || t("workspaceSavedView", "Saved view")
}

export function initWorkspaces(elements) {
  const host = document.getElementById("workspace-list")
  if (!host) return

  const render = (stored = {}) => {
    host.innerHTML = WORKSPACES.map((workspace) => {
      const snapshot = stored[workspace.id]
      return `
        <div class="workspace-row ${snapshot ? "saved" : ""}" data-workspace="${workspace.id}">
          <button type="button" class="workspace-apply" data-workspace-apply="${workspace.id}">
            <i class="fas ${workspace.icon}" aria-hidden="true"></i>
            <span>${t(workspace.labelKey, workspace.fallback)}</span>
            <small>${getStateSummary(snapshot)}</small>
          </button>
          <button type="button" class="workspace-save" data-workspace-save="${workspace.id}"
            title="${t("workspaceSaveCurrent", "Save current view")}">
            <i class="fas fa-bookmark" aria-hidden="true"></i>
          </button>
        </div>
      `
    }).join("")
  }

  loadWorkspaces().then(render)

  host.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-workspace-save]")
    if (saveButton) {
      await saveWorkspace(saveButton.dataset.workspaceSave, elements, render)
      return
    }

    const applyButton = event.target.closest("[data-workspace-apply]")
    if (!applyButton) return

    const workspaces = await loadWorkspaces()
    const snapshot = workspaces[applyButton.dataset.workspaceApply]
    if (!snapshot) {
      showCustomPopup(t("workspaceEmpty", "No saved view"), "info", true)
      return
    }

    applyWorkspaceState(snapshot, elements)
    showCustomPopup(t("workspaceApplied", "Workspace applied."), "success", true)
  })

  window.addEventListener("languageChanged", async () => {
    render(await loadWorkspaces())
  })
}

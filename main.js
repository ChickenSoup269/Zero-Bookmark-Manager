// Sự kiện cho favicon option
const faviconOptionSelect = document.getElementById("favicon-option-select")
if (faviconOptionSelect) {
  // Ưu tiên lấy từ localStorage nếu có
  const savedFaviconOption =
    localStorage.getItem("faviconOption") || uiState.faviconOption || "auto"
  faviconOptionSelect.value = savedFaviconOption
  uiState.faviconOption = savedFaviconOption
  faviconOptionSelect.addEventListener("change", (e) => {
    uiState.faviconOption = e.target.value
    localStorage.setItem("faviconOption", uiState.faviconOption)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.faviconOption = uiState.faviconOption
      chrome.storage.local.set({ uiState: newUiState }, () => {
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          }
        })
      })
    })
  })
}

// Cài đặt cho Header Line
const headerLineSelect = document.getElementById("header-line-select")
if (headerLineSelect) {
  const savedHeaderLine =
    localStorage.getItem("headerLineStyle") ||
    window.uiState?.headerLineStyle ||
    "pattern"
  headerLineSelect.value = savedHeaderLine
  if (window.uiState) window.uiState.headerLineStyle = savedHeaderLine
  document.body.setAttribute("data-header-line", savedHeaderLine)

  headerLineSelect.addEventListener("change", (e) => {
    const val = e.target.value
    if (window.uiState) window.uiState.headerLineStyle = val
    localStorage.setItem("headerLineStyle", val)
    document.body.setAttribute("data-header-line", val)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.headerLineStyle = val
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}

// Cài đặt nền dropdown menu của từng bookmark
setupBookmarkMenuBgControl()

// Sự kiện cho Duplicate Scope
const duplicateScopeSelect = document.getElementById("duplicate-scope-select")
if (duplicateScopeSelect) {
  const savedDuplicateScope =
    localStorage.getItem("duplicateScope") || uiState.duplicateScope || "folder"
  duplicateScopeSelect.value = savedDuplicateScope
  uiState.duplicateScope = savedDuplicateScope
  duplicateScopeSelect.addEventListener("change", (e) => {
    uiState.duplicateScope = e.target.value
    localStorage.setItem("duplicateScope", uiState.duplicateScope)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.duplicateScope = uiState.duplicateScope
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}

// Sự kiện cho Background Auto Remove Duplicates
const autoRemoveDupToggle = document.getElementById("auto-remove-dup-toggle")
if (autoRemoveDupToggle) {
  const savedAutoRemove =
    localStorage.getItem("autoRemoveDup") === "true" ||
    uiState.autoRemoveDup ||
    false
  autoRemoveDupToggle.checked = savedAutoRemove
  uiState.autoRemoveDup = savedAutoRemove
  autoRemoveDupToggle.addEventListener("change", (e) => {
    uiState.autoRemoveDup = e.target.checked
    localStorage.setItem("autoRemoveDup", uiState.autoRemoveDup)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.autoRemoveDup = uiState.autoRemoveDup
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}
import {
  updateTheme,
  renderFilteredBookmarks,
  updateUILanguage,
  openOrganizeFoldersModal,
} from "./components/ui.js"
import { getBookmarkTree, loadVisitCounts } from "./components/bookmarks.js"
import {
  translations,
  debounce,
  showCustomPopup,
} from "./components/utils/utils.js"
import { setupEventListeners } from "./components/events.js"
import { uiState } from "./components/state.js"
import { customLoadUIState } from "./components/option/option.js"
import { initCopyButtons } from "./components/copy-code.js"
import { initCommandPalette } from "./components/commandPalette.js"
import { initCleanupDashboard } from "./components/cleanupDashboard.js"
import { initWorkspaces } from "./components/workspaces.js"

let elements = {}
const CUSTOM_LANGUAGES_KEY = "customLanguagePacks"

export function getElements() {
  return elements
}

function getActiveTranslations() {
  const language = localStorage.getItem("appLanguage") || "en"
  return translations[language] || translations.en
}

function readCustomLanguagePacks() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_LANGUAGES_KEY) || "{}")
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : {}
  } catch (error) {
    console.warn("Failed to read custom languages:", error)
    return {}
  }
}

function writeCustomLanguagePacks(packs) {
  localStorage.setItem(CUSTOM_LANGUAGES_KEY, JSON.stringify(packs))
}

function setupBookmarkMenuBgControl() {
  const select = document.getElementById("bookmark-menu-bg-select")
  const saved =
    localStorage.getItem("bookmarkMenuBg") ||
    uiState.bookmarkMenuBg ||
    "glass"

  uiState.bookmarkMenuBg = saved
  document.body.setAttribute("data-bookmark-menu-bg", saved)
  if (!select) return

  select.value = saved
  if (select.dataset.bound === "true") return
  select.dataset.bound = "true"

  select.addEventListener("change", (e) => {
    const val = e.target.value
    uiState.bookmarkMenuBg = val
    localStorage.setItem("bookmarkMenuBg", val)
    document.body.setAttribute("data-bookmark-menu-bg", val)
    chrome.storage.local.get(["uiState"], (data) => {
      const newUiState = data.uiState || {}
      newUiState.bookmarkMenuBg = val
      chrome.storage.local.set({ uiState: newUiState })
    })
  })
}

function normalizeCustomLanguagePack(rawPack) {
  if (!rawPack || typeof rawPack !== "object" || Array.isArray(rawPack)) {
    throw new Error("Invalid language pack")
  }

  const translationsObject = rawPack.translations
  if (
    !translationsObject ||
    typeof translationsObject !== "object" ||
    Array.isArray(translationsObject)
  ) {
    throw new Error("Missing translations object")
  }

  const rawCode = String(
    rawPack.languageCode || rawPack.code || rawPack.locale || "",
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")

  if (!rawCode) throw new Error("Missing language code")

  const code = ["en", "vi"].includes(rawCode) ? `custom-${rawCode}` : rawCode
  const name = String(
    rawPack.languageName || rawPack.name || rawPack.label || code,
  ).trim()

  return {
    languageCode: code,
    languageName: name,
    translations: { ...translationsObject },
  }
}

function registerCustomLanguagePacks() {
  const packs = readCustomLanguagePacks()
  Object.values(packs).forEach((pack) => {
    try {
      const normalized = normalizeCustomLanguagePack(pack)
      translations[normalized.languageCode] = {
        ...translations.en,
        ...normalized.translations,
      }
    } catch (error) {
      console.warn("Skipped invalid custom language pack:", error)
    }
  })
  return packs
}

function renderCustomLanguageOptions(languageSwitcher) {
  if (!languageSwitcher) return

  languageSwitcher
    .querySelectorAll("option[data-custom-language]")
    .forEach((option) => option.remove())

  Object.values(readCustomLanguagePacks()).forEach((pack) => {
    const option = document.createElement("option")
    option.value = pack.languageCode
    option.textContent = pack.languageName
    option.dataset.customLanguage = "true"
    languageSwitcher.appendChild(option)
  })
}

function createCustomLanguageTemplate(preset = {}) {
  return JSON.stringify(
    {
      languageCode: preset.languageCode || "my-language",
      languageName: preset.languageName || "My Language",
      translations: translations.en,
    },
    null,
    2,
  )
}

function setupCustomLanguageControls(elements) {
  const openButton = document.getElementById("add-custom-language-option")
  const popup = document.getElementById("custom-language-popup")
  const textarea = document.getElementById("custom-language-json-input")
  const fileInput = document.getElementById("custom-language-file-input")
  const importButton = document.getElementById("custom-language-import-file")
  const templateButton = document.getElementById("custom-language-template")
  const saveButton = document.getElementById("custom-language-save")
  const cancelButton = document.getElementById("custom-language-cancel")
  const copyPromptBtn = document.getElementById("copy-ai-prompt-btn")
  const presetButtons = document.querySelectorAll("[data-custom-language-preset]")

  if (
    !openButton ||
    !popup ||
    !textarea ||
    !fileInput ||
    !importButton ||
    !templateButton ||
    !saveButton ||
    !cancelButton
  ) {
    return
  }

  const closePopup = () => {
    popup.classList.add("hidden")
    textarea.value = ""
  }

  openButton.addEventListener("click", () => {
    textarea.value = ""
    popup.classList.remove("hidden")
    textarea.focus()
  })

  cancelButton.addEventListener("click", closePopup)
  popup.addEventListener("click", (event) => {
    if (event.target === popup) closePopup()
  })

  importButton.addEventListener("click", () => fileInput.click())
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      textarea.value = String(reader.result || "")
      fileInput.value = ""
    }
    reader.readAsText(file)
  })

  templateButton.addEventListener("click", () => {
    textarea.value = createCustomLanguageTemplate()
    textarea.focus()
  })

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      textarea.value = createCustomLanguageTemplate({
        languageCode: button.dataset.languageCode,
        languageName: button.dataset.languageName,
      })
      textarea.focus()
    })
  })

  // Add functionality for Copy Prompt & Template logic
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", () => {
      const template = createCustomLanguageTemplate()
      const prompt = `Translate the following JSON language file into {YOUR_LANGUAGE_HERE}. Keep the JSON keys and structure identical. Output ONLY the raw JSON format so I can copy it directly.\n\n${template}`

      navigator.clipboard
        .writeText(prompt)
        .then(() => {
          const originalText = copyPromptBtn.innerHTML
          copyPromptBtn.innerHTML = `<i class="fas fa-check"></i> Copied to Clipboard!`
          setTimeout(() => {
            copyPromptBtn.innerHTML = originalText
          }, 2000)
        })
        .catch((err) => {
          console.error("Could not copy text: ", err)
        })
    })
  }

  saveButton.addEventListener("click", () => {
    const t = getActiveTranslations()

    try {
      const normalized = normalizeCustomLanguagePack(JSON.parse(textarea.value))
      const packs = readCustomLanguagePacks()
      packs[normalized.languageCode] = normalized
      writeCustomLanguagePacks(packs)

      translations[normalized.languageCode] = {
        ...translations.en,
        ...normalized.translations,
      }

      renderCustomLanguageOptions(elements.languageSwitcher)
      elements.languageSwitcher.value = normalized.languageCode
      updateUILanguage(elements, normalized.languageCode)
      window.dispatchEvent(new CustomEvent("languageChanged"))

      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        }
      })

      closePopup()
      showCustomPopup(
        t.customLanguageSaved || "Custom language saved!",
        "success",
        true,
      )
    } catch (error) {
      console.warn("Invalid custom language JSON:", error)
      showCustomPopup(
        t.customLanguageInvalid ||
          "Invalid language JSON. Use languageCode, languageName, and translations.",
        "error",
        true,
      )
    }
  })
}

function getFirstRunTourSteps(isWebviewPage = false) {
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en

  if (isWebviewPage) {
    return [
      {
        selector: "#toggle-sidebar",
        title: t.firstRunWebTourSidebarTitle,
        message: t.firstRunWebTourSidebarMsg,
        ensureSidebarOpen: true,
      },
      {
        selector: "#command-palette-button",
        title: t.firstRunWebTourCommandTitle,
        message: t.firstRunWebTourCommandMsg,
        ensureSidebarOpen: true,
      },
      {
        selector: "#workspaces-content",
        title: t.firstRunWebTourWorkspacesTitle,
        message: t.firstRunWebTourWorkspacesMsg,
        ensureSidebarOpen: true,
        openSection: "workspaces",
      },
      {
        selector: "#folders-content",
        title: t.firstRunWebTourFoldersTitle,
        message: t.firstRunWebTourFoldersMsg,
        ensureSidebarOpen: true,
        openSection: "folders",
      },
      {
        selector: "#options-content",
        title: t.firstRunWebTourSortTitle,
        message: t.firstRunWebTourSortMsg,
        ensureSidebarOpen: true,
        openSection: "options",
      },
      {
        selector: "#tags-content",
        title: t.firstRunWebTourTagsTitle,
        message: t.firstRunWebTourTagsMsg,
        ensureSidebarOpen: true,
        openSection: "tags",
      },
      {
        selector: "#admin-content",
        title: t.firstRunWebTourManageTitle,
        message: t.firstRunWebTourManageMsg,
        ensureSidebarOpen: true,
        openSection: "admin",
      },
      {
        selector: "#smart-cleanup-button",
        title: t.firstRunWebTourSmartCleanupTitle,
        message: language === "vi" ? "Nhấn vào đây để mở bảng Dọn dẹp." : "Click here to open the Cleanup dashboard.",
        ensureSidebarOpen: true,
        openSection: "admin",
      },
      {
        selector: "#smart-cleanup-popup .smart-cleanup-popup-content",
        title: t.firstRunWebTourSmartCleanupTitle,
        message: t.firstRunWebTourSmartCleanupMsg,
        openCleanup: true,
      },
      {
        selector: "#smart-cleanup-details",
        title: language === "vi" ? "Tự động gắn thẻ & Nhóm tên miền" : "Auto Tag & Domain Group",
        message: language === "vi" ? "Chọn Top Domains (ở cột trái) để tự động gắn thẻ hoặc gom nhóm theo tên miền." : "Select Top Domains (on the left) to auto-tag or group bookmarks.",
        openCleanup: true,
        dynamic: true,
        action: () => {
          setTimeout(() => {
            const cards = document.querySelectorAll(".smart-cleanup-card");
            cards.forEach(c => {
              if (c.querySelector(".fa-globe")) c.click();
            });
          }, 150);
        }
      },
      {
        selector: "#google-drive-sync-btn",
        title: t.firstRunWebTourCloudSyncTitle,
        message: t.firstRunWebTourCloudSyncMsg,
        ensureSidebarOpen: true,
        openSection: "admin",
      },
      {
        selector: ".bookmark-item .dropdown-btn",
        title: t.firstRunTourBookmarkMenuTitle,
        message: t.firstRunTourBookmarkMenuMsg,
        ensureSidebarOpen: true,
      },
      {
        selector: "#settings-button",
        title: t.firstRunTourSettingsTitle,
        message: t.firstRunWebTourSettingsMsg,
        ensureSidebarOpen: true,
      },
      {
        selector: "#settings-menu",
        title: t.firstRunTourPanelTitle,
        message: t.firstRunWebTourPanelMsg,
        openSettings: true,
        ensureSidebarOpen: true,
      },
      {
        selector: ".language-settings-row",
        title: language === "vi" ? "Ngôn ngữ" : "Language",
        message: language === "vi" ? "Thay đổi ngôn ngữ hiển thị của extension." : "Change the extension's display language.",
        openSettings: true,
        ensureSidebarOpen: true,
      },
      {
        selector: "#view-switcher",
        title: language === "vi" ? "Chế độ xem" : "View Modes",
        message: language === "vi" ? "Chuyển đổi giữa chế độ Cây, Thẻ (Card), hoặc Bảng Kanban." : "Toggle between Tree, Card, or Kanban board views.",
        openSettings: true,
        ensureSidebarOpen: true,
      },
    ]
  }

  return [
    {
      selector: "#settings-button",
      title: t.firstRunTourSettingsTitle,
      message: t.firstRunTourSettingsMsg,
      openSettings: false,
    },
    {
      selector: "#settings-menu",
      title: t.firstRunTourPanelTitle,
      message: t.firstRunTourPanelMsg,
      openSettings: true,
    },
    {
      selector: "#edit-in-new-tab-option",
      title: t.firstRunTourWebTitle,
      message: t.firstRunTourWebMsg,
      openSettings: true,
    },
    {
      selector: "#open-side-panel-option",
      title: t.firstRunTourSidePanelTitle,
      message: t.firstRunTourSidePanelMsg,
      openSettings: true,
    },
    {
      selector: "#search",
      title: t.firstRunTourSearchTitle,
      message: t.firstRunTourSearchMsg,
      openSettings: false,
    },
    {
      selector: ".bookmark-item .dropdown-btn",
      title: t.firstRunTourBookmarkMenuTitle,
      message: t.firstRunTourBookmarkMenuMsg,
      openSettings: false,
    },
  ]
}

function setSettingsMenuOpen(isOpen) {
  const settingsMenu = document.getElementById("settings-menu")
  if (!settingsMenu) return

  settingsMenu.classList.toggle("hidden", !isOpen)
  settingsMenu.setAttribute("aria-hidden", String(!isOpen))
  document.body.classList.toggle("settings-panel-open", isOpen)
}

function applyLanguageText(language) {
  const activeTranslations = translations[language] || translations.en
  const translate = (key) => activeTranslations[key] || translations.en[key] || key

  localStorage.setItem("appLanguage", language)
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ appLanguage: language })
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n")
    if (key) element.textContent = translate(key)
  })

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder")
    if (key) element.placeholder = translate(key)
  })

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.getAttribute("data-i18n-title")
    if (!key) return
    element.title = translate(key)
    if (element.hasAttribute("aria-label")) {
      element.setAttribute("aria-label", translate(key))
    }
  })
}

function ensureWebviewSidebarOpen() {
  const sidebar = document.getElementById("sidebar")
  const container = document.querySelector(".container")
  if (!sidebar) return

  sidebar.classList.remove("collapsed")
  container?.classList.remove("collapsed")
  if (window.innerWidth <= 768) {
    sidebar.classList.add("mobile-open")
  }
}

function setSidebarSectionOpen(sectionId) {
  if (!sectionId) return

  document.documentElement.classList.remove("sidebar-workspaces-precollapsed")
  const content = document.getElementById(`${sectionId}-content`)
  const header = document.querySelector(`[data-toggle="${sectionId}"]`)
  if (!content) return

  content.classList.remove("collapsed")
  header?.setAttribute("data-collapsed", "false")
}

function positionFirstRunTourCard(card, targetRect) {
  const gap = 12
  const viewportPadding = 14
  const cardRect = card.getBoundingClientRect()

  let left = targetRect.left
  let top = targetRect.bottom + gap

  if (top + cardRect.height > window.innerHeight - viewportPadding) {
    top = targetRect.top - cardRect.height - gap
  }

  if (top < viewportPadding) {
    top = viewportPadding
  }

  if (left + cardRect.width > window.innerWidth - viewportPadding) {
    left = window.innerWidth - cardRect.width - viewportPadding
  }

  if (left < viewportPadding) {
    left = viewportPadding
  }

  card.style.left = `${left}px`
  card.style.top = `${top}px`
}

function startFirstRunTour() {
  const tour = document.getElementById("first-run-tour")
  const highlight = document.getElementById("first-run-tour-highlight")
  const card = document.getElementById("first-run-tour-card")
  const count = document.getElementById("first-run-tour-count")
  const title = document.getElementById("first-run-tour-title")
  const message = document.getElementById("first-run-tour-message")
  const nextButton = document.getElementById("first-run-tour-next")
  const skipButton = document.getElementById("first-run-tour-skip")
  const prevButton = document.getElementById("first-run-tour-prev")

  const isWebviewPage = window.location.pathname.endsWith("/bookmarks.html")
  const tourStorageKey = isWebviewPage
    ? "firstRunWebviewTourComplete"
    : "firstRunTourComplete"

  if (
    !tour ||
    !highlight ||
    !card ||
    !count ||
    !title ||
    !message ||
    !nextButton ||
    !skipButton ||
    localStorage.getItem(tourStorageKey)
  ) {
    return
  }

  let stepIndex = 0
  const language = localStorage.getItem("appLanguage") || "en"
  const t = translations[language] || translations.en
  const steps = getFirstRunTourSteps(isWebviewPage).filter((step) =>
    step.dynamic || document.querySelector(step.selector),
  )

  if (!steps.length) return

  const finish = () => {
    tour.classList.add("hidden")
    setSettingsMenuOpen(false)
    localStorage.setItem(tourStorageKey, "true")
    window.removeEventListener("resize", renderStep)
    document.removeEventListener("keydown", handleKeydown)
  }

  function renderStep() {
    const step = steps[stepIndex]
    if (step.ensureSidebarOpen) ensureWebviewSidebarOpen()
    if (step.openSection) setSidebarSectionOpen(step.openSection)
    setSettingsMenuOpen(step.openSettings)
    
    if (step.openCleanup) {
      document.getElementById("smart-cleanup-button")?.click()
    } else {
      const popup = document.getElementById("smart-cleanup-popup")
      if (popup && !popup.classList.contains("hidden")) {
        popup.classList.add("hidden")
      }
    }

    if (typeof step.action === "function") {
      step.action()
    }

    requestAnimationFrame(() => {
      const target = document.querySelector(step.selector)
      if (!target) return

      target.scrollIntoView?.({
        block: "nearest",
        inline: "nearest",
        behavior: "auto",
      })

      const rect = target.getBoundingClientRect()
      const pad = 6
      highlight.style.left = `${Math.max(rect.left - pad, 8)}px`
      highlight.style.top = `${Math.max(rect.top - pad, 8)}px`
      highlight.style.width = `${rect.width + pad * 2}px`
      highlight.style.height = `${rect.height + pad * 2}px`

      count.textContent = `${stepIndex + 1}/${steps.length}`
      title.textContent = step.title
      message.textContent = step.message
      skipButton.innerHTML = (t.firstRunTourSkip || "Skip") + `<kbd>Esc</kbd>`
      
      const nextText = stepIndex === steps.length - 1
          ? t.firstRunTourDone || "Done"
          : t.firstRunTourNext || "Next"
          
      nextButton.innerHTML = nextText + `<kbd>&rarr;</kbd>`
      
      if (prevButton) {
        if (stepIndex === 0) {
          prevButton.style.display = "none"
        } else {
          prevButton.style.display = ""
          prevButton.innerHTML = `<kbd>&larr;</kbd> ` + (t.firstRunTourBack || "Back")
        }
      }

      tour.classList.remove("hidden")
      positionFirstRunTourCard(card, rect)
    })
  }

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      finish()
    } else if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault()
      nextButton.click()
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      if (prevButton && prevButton.style.display !== "none") {
        prevButton.click()
      }
    }
  }

  tour.addEventListener("click", (event) => {
    event.stopPropagation()
  })

  if (prevButton) {
    prevButton.onclick = (event) => {
      event.stopPropagation()
      if (stepIndex > 0) {
        stepIndex -= 1
        renderStep()
      }
    }
  }

  nextButton.onclick = (event) => {
    event.stopPropagation()
    if (stepIndex >= steps.length - 1) {
      finish()
      return
    }

    stepIndex += 1
    renderStep()
  }

  skipButton.onclick = (event) => {
    event.stopPropagation()
    finish()
  }
  window.addEventListener("resize", renderStep)
  document.addEventListener("keydown", handleKeydown)
  renderStep()
}

function setupRestartGuideControl() {
  const button = document.getElementById("restart-guide-option")
  if (!button || button.dataset.bound === "true") return

  button.dataset.bound = "true"
  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()

    const isWebviewPage = window.location.pathname.endsWith("/bookmarks.html")
    localStorage.removeItem(
      isWebviewPage ? "firstRunWebviewTourComplete" : "firstRunTourComplete",
    )
    setSettingsMenuOpen(false)
    requestAnimationFrame(() => startFirstRunTour())
  })
}

document.addEventListener("DOMContentLoaded", () => {
  elements = {
    searchInput: document.getElementById("search"),
    clearSearchButton: document.getElementById("clear-search"),
    folderFilter: document.getElementById("folder-filter"),
    sortFilter: document.getElementById("sort-filter"),
    createFolderButton: document.getElementById("create-folder"),
    renameFolderInput: document.getElementById("rename-folder-input"),
    renameFolderSave: document.getElementById("rename-folder-save"),
    renameFolderCancel: document.getElementById("rename-folder-cancel"),
    addToFolderButton: document.getElementById("add-to-folder"),
    deleteFolderButton: document.getElementById("delete-folder"),
    deleteBookmarksButton: document.getElementById("delete-bookmarks-button"),
    toggleCheckboxesButton: document.getElementById("toggle-checkboxes"),
    folderListDiv: document.getElementById("folder-list"),
    bookmarkCountDiv: document.getElementById("bookmark-count"),
    scrollToTopButton: document.getElementById("scroll-to-top"),
    reportBugButton: document.getElementById("report-bug"),
    clearRenameButton: document.getElementById("clear-rename"),
    addToFolderPopup: document.getElementById("add-to-folder-popup"),
    addToFolderSelect: document.getElementById("add-to-folder-select"),
    newFolderInput: document.getElementById("new-folder-input"),
    createNewFolderButton: document.getElementById("create-new-folder"),
    addToFolderSaveButton: document.getElementById("add-to-folder-save"),
    addToFolderCancelButton: document.getElementById("add-to-folder-cancel"),
    settingsButton: document.getElementById("settings-button"),
    settingsMenu: document.getElementById("settings-menu"),
    openSidePanelOption: document.getElementById("open-side-panel-option"),
    exportBookmarksOption: document.getElementById("export-bookmarks-option"),
    importBookmarksOption: document.getElementById("import-bookmarks-option"),
    languageSwitcher: document.getElementById("language-switcher"),
    themeSwitcher: document.getElementById("theme-switcher"),
    fontSwitcher: document.getElementById("font-switcher"),
    viewSwitcher: document.getElementById("view-switcher"),
    renamePopup: document.getElementById("rename-popup"),
    renameInput: document.getElementById("rename-input"),
    renameSave: document.getElementById("rename-save"),
    renameCancel: document.getElementById("rename-cancel"),
    customPopup: document.getElementById("custom-popup"),
    customPopupTitle: document.getElementById("custom-popup-title"),
    customPopupMessage: document.getElementById("custom-popup-message"),
    customPopupOk: document.getElementById("custom-popup-ok"),
    renameFolderButton: document.getElementById("rename-folder"),
    renameFolderPopup: document.getElementById("rename-folder-popup"),
    renameFolderSelect: document.getElementById("rename-folder-select"),
    renameFolderInput: document.getElementById("rename-folder-input"),
    renameFolderSave: document.getElementById("rename-folder-save"),
    renameFolderCancel: document.getElementById("rename-folder-cancel"),
    clearRenameFolder: document.getElementById("clear-rename-folder"),
    createFolderBtn: document.getElementById("create-folder"),
    createFolderPopup: document.getElementById("create-folder-popup"),
    createFolderInput: document.getElementById("create-folder-input"),
    createFolderSave: document.getElementById("create-folder-save"),
    createFolderCancel: document.getElementById("create-folder-cancel"),
    clearCreateFolder: document.getElementById("clear-create-folder"),
    showBookmarkIdsOption: document.getElementById("show-bookmark-ids-option"),
    toggleFolderListBgOption: document.getElementById("folder-list-bg-toggle"),
    tagFilterContainer: document.getElementById("tag-filter-container"),
    tagFilterToggle: document.getElementById("tag-filter-toggle"),
    tagFilterDropdown: document.getElementById("tag-filter-dropdown"),
    tagFilterOptions: document.getElementById("tag-filter-options"),
    checkHealthButton: document.getElementById("check-health-btn"),
    checkDuplicatesButton: document.getElementById("check-duplicates-btn"),
    healthSortFilter: document.getElementById("health-sort-filter"),
    organizeFoldersButton: document.getElementById("organize-folders-button"),
    organizeFoldersPopup: document.getElementById("organize-folders-popup"),
    folderContextMenu: document.getElementById("folder-context-menu"),
    contextMenuMoveFolderButton: document.getElementById(
      "context-menu-move-folder",
    ),
    viewVisitCountsOption: document.getElementById("view-visit-counts-option"),
  }

  const init = () => {
    setupBookmarkMenuBgControl()
    initCopyButtons()
    registerCustomLanguagePacks()
    renderCustomLanguageOptions(elements.languageSwitcher)
    setupCustomLanguageControls(elements)
    setupRestartGuideControl()

    // Update check logic
    chrome.storage.local.get("showUpdatePopup", (res) => {
      if (res.showUpdatePopup) {
        const updatePopup = document.getElementById("update-popup")
        const updateTitle = document.getElementById("update-popup-title")
        const updateMessage = document.getElementById("update-popup-message")
        const updateVersion = document.getElementById("update-version")
        const updateClose = document.getElementById("update-popup-close")
        const currentVersion = chrome.runtime.getManifest().version
        const language = localStorage.getItem("appLanguage") || "en"

        if (updatePopup && updateVersion && updateClose) {
          if (updateTitle)
            updateTitle.textContent = translations[language].updateTitle
          if (updateMessage) {
            updateMessage.innerHTML = `${translations[language].updateMessage} <strong id="update-version">${currentVersion}</strong>`
          } else {
            updateVersion.textContent = currentVersion
          }

          updatePopup.classList.remove("hidden")

          const closeUpdatePopup = () => {
            updatePopup.classList.add("hidden")
          }

          updateClose.addEventListener("click", closeUpdatePopup, {
            once: true,
          })

          updatePopup.addEventListener("click", (e) => {
            if (e.target === updatePopup) {
              closeUpdatePopup()
            }
          })
        }

        // Remove the flag so it doesn't show again until next update
        chrome.storage.local.remove("showUpdatePopup")
      }
    })

    // Thêm import option vào settings menu
    if (!elements.importBookmarksOption) {
      const importBookmarksOption = document.createElement("button")
      importBookmarksOption.id = "import-bookmarks-option"
      importBookmarksOption.className = "menu-item"
      importBookmarksOption.textContent =
        translations[
          localStorage.getItem("appLanguage") || "en"
        ].importBookmarks
      elements.settingsMenu.appendChild(importBookmarksOption)
      elements.importBookmarksOption = importBookmarksOption
    }

    // Khởi tạo ngôn ngữ
    const storedLanguage = localStorage.getItem("appLanguage")
    const savedLanguage =
      storedLanguage && translations[storedLanguage] ? storedLanguage : "en"
    elements.languageSwitcher.value = savedLanguage
    try {
      updateUILanguage(elements, savedLanguage)
    } catch (error) {
      console.warn("Full language update failed; applying text only:", error)
      applyLanguageText(savedLanguage)
      localStorage.setItem("appLanguage", savedLanguage)
    }

    // Khởi tạo theme, font, view
    const savedTheme = localStorage.getItem("appTheme") || "system"
    elements.themeSwitcher.value = savedTheme
    updateTheme(elements, savedTheme)

    const savedFont = localStorage.getItem("appFont") || "gohu"
    document.body.classList.add(`font-${savedFont}`)
    elements.fontSwitcher.value = savedFont

    const showFirstRunPopup = (onDone) => {
      const firstRunPopup = document.getElementById("first-run-popup")
      const firstRunFontSelect = document.getElementById(
        "first-run-font-select",
      )
      const firstRunSaveBtn = document.getElementById("first-run-save")

      if (firstRunPopup && firstRunSaveBtn) {
        firstRunPopup.classList.remove("hidden")

        firstRunSaveBtn.onclick = () => {
          const selectedFont = firstRunFontSelect.value

          // Remove all possible font classes
          const fontClasses = Array.from(document.body.classList).filter(
            (cls) => cls.startsWith("font-"),
          )
          fontClasses.forEach((cls) => document.body.classList.remove(cls))

          document.body.classList.add(`font-${selectedFont}`)
          localStorage.setItem("appFont", selectedFont)
          elements.fontSwitcher.value = selectedFont

          localStorage.setItem("firstRunComplete", "true")
          firstRunPopup.classList.add("hidden")
          chrome.storage.local.remove("showFirstRunPopup")
          if (typeof onDone === "function") onDone()
        }
      }
    }

    const showFirstRunLanguagePopup = (onDone) => {
      const languagePopup = document.getElementById("first-run-language-popup")
      const title = document.getElementById("first-run-language-title")
      const subtitle = document.getElementById("first-run-language-sub")

      if (!languagePopup) {
        if (typeof onDone === "function") onDone()
        return
      }

      const browserLanguage = navigator.language?.toLowerCase().startsWith("vi")
        ? "vi"
        : "en"
      const selectedLanguage =
        localStorage.getItem("appLanguage") || browserLanguage
      const t = translations[selectedLanguage] || translations.en

      if (title) title.textContent = t.firstRunLanguageTitle
      if (subtitle) subtitle.textContent = t.firstRunLanguageSub

      languagePopup.classList.remove("hidden")
      languagePopup
        .querySelectorAll("[data-first-run-language]")
        .forEach((button) => {
          button.onclick = () => {
            const language = button.dataset.firstRunLanguage || "en"
            localStorage.setItem("appLanguage", language)
            localStorage.setItem("firstRunLanguageComplete", "true")
            elements.languageSwitcher.value = language
            applyLanguageText(language)
            window.dispatchEvent(new CustomEvent("languageChanged"))
            languagePopup.classList.add("hidden")
            if (typeof onDone === "function") onDone()
          }
        })
    }

    // Check for first run
    chrome.storage.local.get(["showFirstRunPopup"], (data) => {
      if (data.showFirstRunPopup || !localStorage.getItem("firstRunComplete")) {
        const runWelcomeAndTour = () => {
          showFirstRunPopup(() => {
            startFirstRunTour()
          })
        }

        if (!localStorage.getItem("firstRunLanguageComplete")) {
          showFirstRunLanguagePopup(runWelcomeAndTour)
        } else {
          runWelcomeAndTour()
        }
      } else if (
        window.location.pathname.endsWith("/bookmarks.html") &&
        !localStorage.getItem("firstRunWebviewTourComplete")
      ) {
        startFirstRunTour()
      }
    })

    const savedView = localStorage.getItem("appView") || "flat"
    elements.viewSwitcher.value = savedView
    uiState.viewMode = savedView

    // Khôi phục trạng thái showBookmarkIds
    chrome.storage.local.get(["showBookmarkIds"], (data) => {
      uiState.showBookmarkIds = data.showBookmarkIds || false
      if (elements.showBookmarkIdsOption) {
        const iconClass = uiState.showBookmarkIds ? "fa-eye" : "fa-eye-slash"
        elements.showBookmarkIdsOption.innerHTML = `<i class="fas ${iconClass}"></i> ${
          uiState.showBookmarkIds
            ? translations[savedLanguage].hideBookmarkIds
            : translations[savedLanguage].showBookmarkIds
        }`
      }
    })

    // Khôi phục trạng thái folderListBg
    chrome.storage.local.get(["folderListBg"], (data) => {
      uiState.folderListBg =
        data.folderListBg !== undefined ? data.folderListBg : true
      if (elements.folderListDiv) {
        if (uiState.folderListBg) {
          elements.folderListDiv.classList.remove("no-bg")
        } else {
          elements.folderListDiv.classList.add("no-bg")
        }
      }
      if (elements.toggleFolderListBgOption) {
        elements.toggleFolderListBgOption.checked = uiState.folderListBg
      }
    })

    // Load saved states for settings sections
    const savedCollapsedStates = JSON.parse(
      localStorage.getItem("settingsSectionCollapsedStates") || "{}",
    )

    document
      .querySelectorAll("#settings-menu .dropdown-section-title")
      .forEach((title) => {
        const sectionId = title.dataset.i18n
        let shouldBeCollapsed = savedCollapsedStates[sectionId] === true

        let nextElement = title.nextElementSibling
        while (
          nextElement &&
          !nextElement.classList.contains("dropdown-section-title")
        ) {
          if (shouldBeCollapsed) {
            if (!nextElement.classList.contains("hidden")) {
              nextElement.classList.add("hidden")
            }
          } else {
            if (nextElement.classList.contains("hidden")) {
              nextElement.classList.remove("hidden")
            }
          }
          nextElement = nextElement.nextElementSibling
        }

        if (shouldBeCollapsed) {
          if (!title.classList.contains("collapsed")) {
            title.classList.add("collapsed")
          }
        } else {
          if (title.classList.contains("collapsed")) {
            title.classList.remove("collapsed")
          }
        }
      })

    // Lấy dữ liệu bookmark
    getBookmarkTree((bookmarkTreeNodes) => {
      if (bookmarkTreeNodes) {
        // Load visit counts from background script
        loadVisitCounts(() => {
          customLoadUIState(() => {
            setupBookmarkMenuBgControl()
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
            setupBookmarkChangeListeners(elements)
          })
        })
      } else {
        elements.folderListDiv.innerHTML = `<p>${translations[savedLanguage].noBookmarks}</p>`
      }
    })

    // Thiết lập event listeners
    setupEventListeners(elements)
    initCommandPalette(elements)
    initCleanupDashboard(elements)
    initWorkspaces(elements)

    // Event listener for Organize Folders button
    if (elements.organizeFoldersButton) {
      elements.organizeFoldersButton.addEventListener("click", (e) => {
        e.stopPropagation() // Prevent dropdown from closing immediately
        openOrganizeFoldersModal(elements)
        elements.settingsMenu.classList.add("hidden") // Close settings menu after opening modal
      })
    }

    // Sự kiện cho showBookmarkIdsOption
    if (elements.showBookmarkIdsOption) {
      elements.showBookmarkIdsOption.addEventListener("click", () => {
        uiState.showBookmarkIds = !uiState.showBookmarkIds
        chrome.storage.local.set({ showBookmarkIds: uiState.showBookmarkIds })
        const iconClass = uiState.showBookmarkIds ? "fa-eye" : "fa-eye-slash"
        elements.showBookmarkIdsOption.innerHTML = `<i class="fas ${iconClass}"></i> ${
          uiState.showBookmarkIds
            ? translations[savedLanguage].hideBookmarkIds
            : translations[savedLanguage].showBookmarkIds
        }`
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          }
        })
      })
    }

    // Sự kiện cho toggleFolderListBgOption (toggle switch)
    if (elements.toggleFolderListBgOption) {
      elements.toggleFolderListBgOption.addEventListener("change", (e) => {
        uiState.folderListBg = e.target.checked
        chrome.storage.local.set({ folderListBg: uiState.folderListBg })
        if (elements.folderListDiv) {
          if (uiState.folderListBg) {
            elements.folderListDiv.classList.remove("no-bg")
          } else {
            elements.folderListDiv.classList.add("no-bg")
          }
        }
      })
    }

    // Sự kiện cho open-side-panel-option
    if (elements.openSidePanelOption) {
      elements.openSidePanelOption.addEventListener("click", () => {
        if (chrome.sidePanel) {
          // Get the last focused window that is a normal browser window
          chrome.windows.getLastFocused(
            { windowTypes: ["normal"] },
            (window) => {
              if (window) {
                // Open the side panel for that window
                // It will open on the window's active tab by default
                chrome.sidePanel.open({ windowId: window.id })
              } else {
                console.error("No normal window found to open side panel.")
                alert("Could not open side panel: No active window found.")
              }
            },
          )
        } else {
          console.error("Side Panel API not available.")
          alert("Side Panel API not available in this browser.")
        }
      })
    }

    // Sự kiện cho languageSwitcher
    elements.languageSwitcher.addEventListener("change", (e) => {
      const newLanguage = e.target.value
      localStorage.setItem("appLanguage", newLanguage)
      updateUILanguage(elements, newLanguage)
      window.dispatchEvent(new CustomEvent("languageChanged")) // Dispatch custom event
      getBookmarkTree((bookmarkTreeNodes) => {
        if (bookmarkTreeNodes) {
          renderFilteredBookmarks(bookmarkTreeNodes, elements)
        }
      })
    })

    // View Visit Counts option
    if (elements.viewVisitCountsOption) {
      elements.viewVisitCountsOption.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "getVisitCounts" }, (response) => {
          if (chrome.runtime.lastError) {
            alert("Error: " + chrome.runtime.lastError.message)
            return
          }
          const visitCounts = response?.visitCounts || {}
          const count = Object.keys(visitCounts).length
          const total = Object.values(visitCounts).reduce(
            (sum, c) => sum + c,
            0,
          )

          console.log("Visit Counts:", visitCounts)
          alert(
            `Visit Counts Debug:\n\n` +
              `Tracked bookmarks: ${count}\n` +
              `Total visits: ${total}\n\n` +
              `Details in console (F12)`,
          )
        })
      })
    }
  }

  function setupBookmarkChangeListeners(elements) {
    const refreshBookmarks = debounce(() => {
      // Reload visit counts whenever bookmarks change
      loadVisitCounts(() => {
        getBookmarkTree((bookmarkTreeNodes) => {
          if (bookmarkTreeNodes) {
            renderFilteredBookmarks(bookmarkTreeNodes, elements)
          } else {
            const language = localStorage.getItem("appLanguage") || "en"
            console.error(translations[language].errorUnexpected)
          }
        })
      })
    }, 500)

    // Re-render when bookmark structure changes (add/remove/edit/move via Chrome or extension)
    chrome.bookmarks.onCreated.addListener(refreshBookmarks)
    chrome.bookmarks.onRemoved.addListener(refreshBookmarks)
    chrome.bookmarks.onChanged.addListener(refreshBookmarks)
    chrome.bookmarks.onMoved.addListener(refreshBookmarks)

    // Re-render when extension storage changes (tags, favorites, pinned, visit counts, etc.)
    // This keeps the webview tab in sync when popup or another context updates storage
    const storageChangeKeys = new Set([
      "bookmarkTags",
      "tagColors",
      "tagTextColors",
      "visitCounts",
      "favoriteBookmarks",
      "pinnedBookmarks",
    ])
    const handleStorageChange = debounce((changes) => {
      const relevantChange = Object.keys(changes).some((key) =>
        storageChangeKeys.has(key),
      )
      if (relevantChange) {
        loadVisitCounts(() => {
          getBookmarkTree((bookmarkTreeNodes) => {
            if (bookmarkTreeNodes) {
              renderFilteredBookmarks(bookmarkTreeNodes, elements)
            }
          })
        })
      }
    }, 500)
    chrome.storage.onChanged.addListener(handleStorageChange)

    const floatingToggle = document.getElementById("floating-toggle");
    if (floatingToggle) {
      const container = floatingToggle.closest(".floating-container");
      if (container && localStorage.getItem("floatingButtonsCollapsed") === "true") {
        container.classList.add("collapsed");
      }
      floatingToggle.addEventListener("click", () => {
        if (container) {
          const isCollapsed = container.classList.toggle("collapsed");
          localStorage.setItem("floatingButtonsCollapsed", isCollapsed);
        }
      });
    }

    window.addEventListener("unload", () => {
      chrome.bookmarks.onCreated.removeListener(refreshBookmarks)
      chrome.bookmarks.onRemoved.removeListener(refreshBookmarks)
      chrome.bookmarks.onChanged.removeListener(refreshBookmarks)
      chrome.bookmarks.onMoved.removeListener(refreshBookmarks)
      chrome.storage.onChanged.removeListener(handleStorageChange)
    })
  }

  init()
})

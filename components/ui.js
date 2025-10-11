// components/ui.js
import { translations, showCustomPopup } from "./utils.js"
import { flattenBookmarks, getFolders, isInFolder } from "./bookmarks.js"
import {
  saveUIState,
  uiState,
  setBookmarks,
  setFolders,
  setBookmarkTree,
} from "./state.js"
import { attachDropdownListeners } from "./controller/dropdown.js"
import { setupBookmarkActionListeners } from "./controller/bookmarkActions.js"
import {
  addTagToBookmark,
  removeTagFromBookmark,
  changeTagColor,
  getTagsForBookmark,
  getAllTags,
} from "./tag.js"
import { customSaveUIState } from "./option/option.js"

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
      console.warn(
        `${key} element not found in elements object. Attempting to fetch from DOM with selector: ${selector}`
      )
      elements[key] = document.querySelector(selector)
      if (!elements[key]) {
        console.error(`Failed to find ${key} in DOM with selector: ${selector}`)
        hasError = true
        return
      }
    }
    if (optionText && elements[key].tagName === "SELECT") {
      const option = elements[key].querySelector('option[value=""]')
      if (option) {
        option.textContent = t[optionText] || ""
      } else {
        console.warn(`Option[value=""] not found for ${key}`)
        elements[key].innerHTML = `<option value="">${
          t[optionText] || ""
        }</option>`
      }
    }
    if (placeholder && elements[key].tagName === "INPUT") {
      elements[key].placeholder = t[placeholder] || ""
    }
  })

  if (hasError) {
    showCustomPopup(
      t.errorUnexpected || "An unexpected error occurred",
      "error",
      true
    )
    return
  }
  // Cập nhật nút tag filter
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  if (tagFilterToggle) {
    tagFilterToggle.textContent =
      uiState.selectedTags.length > 0
        ? uiState.selectedTags.join(", ")
        : t.allTags
  }

  // Update other UI elements
  elements.sortFilter.innerHTML = `
    <option value="default">${t.sortDefault}</option>
    <option value="favorites">${t.sortFavorites}</option>
    <option value="old">${t.sortOld}</option>
    <option value="last-opened">${t.sortLastOpened}</option>
    <option value="a-z">${t.sortAZ}</option>
    <option value="z-a">${t.sortZA}</option>
  `
  elements.createFolderButton.textContent = t.createFolder
  elements.addToFolderButton.textContent = t.addToFolder
  elements.deleteFolderButton.textContent = t.deleteFolder
  elements.renameFolderButton.textContent = t.renameFolder
  elements.deleteBookmarksButton.textContent = t.deleteBookmarks
  elements.exportBookmarksOption.textContent = t.exportBookmarks
  elements.importBookmarksOption.textContent = t.importBookmarks
  elements.editInNewTabOption.textContent = t.editInNewTabOption
  elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
    ? t.hideCheckboxes
    : t.showCheckboxes
  elements.bookmarkCountDiv.textContent = `${t.totalBookmarks}: ${
    elements.bookmarkCountDiv.textContent.match(/\d+$/)?.[0] || 0
  }`
  elements.scrollToTopButton.title = t.scrollToTop
  elements.scrollToTopButton.setAttribute("aria-label", t.scrollToTop)
  elements.clearRenameButton.setAttribute("aria-label", t.clearRenameAria)
  elements.clearSearchButton.setAttribute("aria-label", t.clearSearchAria)
  elements.settingsButton.setAttribute("aria-label", t.settingsButtonAria)
  elements.renameInput.dataset.errorPlaceholder = t.emptyTitleError
  elements.renameFolderInput.dataset.errorPlaceholder = t.emptyFolderError
  elements.renameFolderInput.dataset.selectFolderError = t.selectFolderError

  // Update popup-specific elements with checks
  const updatePopupElement = (popup, selector, text) => {
    const element = popup.querySelector(selector)
    if (element) {
      element.textContent = text
    } else {
      console.warn(`Element ${selector} not found in popup`)
    }
  }

  updatePopupElement(elements.renamePopup, "#rename-title", t.renameTitle)
  updatePopupElement(
    elements.addToFolderPopup,
    "#add-to-folder-title",
    t.addToFolderTitle
  )
  updatePopupElement(
    elements.renameFolderPopup,
    "#rename-folder-title",
    t.renameTitle
  )
  updatePopupElement(
    elements.bookmarkDetailPopup,
    "#detail-title-label",
    t.detailTitle
  )
  updatePopupElement(
    elements.bookmarkDetailPopup,
    "#detail-url-label",
    t.detailUrl
  )
  updatePopupElement(
    elements.bookmarkDetailPopup,
    "#detail-date-added-label",
    t.detailDateAdded
  )
  updatePopupElement(
    elements.bookmarkDetailPopup,
    "#detail-tags-label",
    t.detailTags
  )
  updatePopupElement(
    elements.manageTagsPopup,
    "#manage-tags-title",
    t.manageTags
  )

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

export async function populateTagFilter(elements) {
  const tagFilterOptions = elements.tagFilterContainer?.querySelector(
    "#tag-filter-options"
  )
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  if (!tagFilterOptions || !tagFilterToggle) {
    console.error("Tag filter options or toggle not found", {
      tagFilterOptions,
      tagFilterToggle,
    })
    return
  }

  const allTags = await getAllTags()

  tagFilterOptions.innerHTML = ""
  allTags.forEach((tag) => {
    const label = document.createElement("label")
    label.style.display = "block"
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.value = tag
    checkbox.checked = uiState.selectedTags.includes(tag)

    checkbox.dataset.tag = tag // Add data-tag for debugging
    const tagText = document.createElement("span")
    tagText.textContent = tag
    tagText.style.color = uiState.tagColors[tag] || "#000000"
    label.appendChild(checkbox)
    label.appendChild(tagText)
    tagFilterOptions.appendChild(label)
  })

  tagFilterToggle.textContent =
    uiState.selectedTags.length > 0
      ? uiState.selectedTags.join(", ")
      : translations[localStorage.getItem("appLanguage") || "en"].allTags
}

// Existing functions (unchanged)
export function updateTheme(elements, theme) {
  const availableThemes = [
    "light",
    "dark",
    "github-light",
    "dracula",
    "onedark",
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
      availableThemes.forEach((themeName) => {
        element.classList.remove(`${themeName}-theme`)
      })
      element.classList.remove("light-theme", "dark-theme")
    }
  })

  let activeTheme
  switch (theme) {
    case "light":
      activeTheme = "light"
      break
    case "dark":
      activeTheme = "dark"
      break
    case "github-light":
      activeTheme = "github-light"
      break
    case "system":
      activeTheme = isDarkMode ? "dark" : "light"
      break
    case "dracula":
      activeTheme = "dracula"
      break
    case "onedark":
      activeTheme = "onedark"
      break
    default:
      activeTheme = "light"
  }

  const logoSrcMap = {
    light: "images/logo.png",
    dark: "images/logo.png",
    dracula: "images/logo_dracula.png",
    onedark: "images/logo_onedark.png",
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
    if (element) {
      element.classList.add(`${activeTheme}-theme`)
    }
  })

  document.documentElement.setAttribute("data-theme", activeTheme)

  document
    .querySelectorAll(
      ".input, .select, .button, .rename-popup, .folder-item, .folder-title, .custom-popup"
    )
    .forEach((el) => {
      availableThemes.forEach((themeName) => {
        el.classList.remove(`${themeName}-theme`)
      })
      el.classList.remove("light-theme", "dark-theme")
      el.classList.add(`${activeTheme}-theme`)
    })

  localStorage.setItem("selectedTheme", theme)

  window.dispatchEvent(
    new CustomEvent("themeChanged", {
      detail: {
        theme: activeTheme,
        originalSelection: theme,
      },
    })
  )
}

export function renderFilteredBookmarks(bookmarkTreeNodes, elements) {
  chrome.storage.local.get(["favoriteBookmarks"], (data) => {
    const favoriteBookmarks = data.favoriteBookmarks || {}

    const addFavoriteAndTagsStatus = (nodes) => {
      for (const node of nodes) {
        if (node.url) {
          node.isFavorite = !!favoriteBookmarks[node.id]
          node.tags = uiState.bookmarkTags[node.id] || []
        }
        if (node.children) {
          addFavoriteAndTagsStatus(node.children)
        }
      }
    }

    addFavoriteAndTagsStatus(bookmarkTreeNodes)

    const bookmarks = flattenBookmarks(bookmarkTreeNodes)
    const folders = getFolders(bookmarkTreeNodes)
    setBookmarkTree(bookmarkTreeNodes)
    setBookmarks(bookmarks)
    setFolders(folders)
    populateFolderFilter(folders, elements)
    populateTagFilter(elements)
    setupTagFilterListener(elements)
    updateBookmarkCount(bookmarks, elements)
    let filtered = bookmarks

    if (uiState.selectedTags.length > 0) {
      filtered = filtered.filter((bookmark) =>
        uiState.selectedTags.some((tag) => bookmark.tags.includes(tag))
      )
    }

    if (uiState.sortType === "favorites") {
      filtered = filtered.filter((bookmark) => bookmark.isFavorite)
    }

    if (
      uiState.selectedFolderId &&
      uiState.selectedFolderId !== "0" &&
      folders.some((f) => f.id === uiState.selectedFolderId)
    ) {
      filtered = filtered.filter((bookmark) =>
        isInFolder(bookmark, uiState.selectedFolderId)
      )
    } else {
      uiState.selectedFolderId = ""
    }

    if (uiState.searchQuery) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.title
            ?.toLowerCase()
            .includes(uiState.searchQuery.toLowerCase()) ||
          bookmark.url
            ?.toLowerCase()
            .includes(uiState.searchQuery.toLowerCase())
      )
    }

    if (uiState.viewMode === "tree") {
      const rootChildren = bookmarkTreeNodes[0]?.children || []
      renderTreeView(rootChildren, elements)
    } else if (uiState.viewMode === "detail") {
      renderDetailView(filtered, elements)
    } else {
      renderBookmarks(filtered, elements)
    }

    toggleFolderButtons(elements)
    customSaveUIState()
  })
}

function renderDetailView(bookmarksList, elements) {
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)
  // const language = localStorage.getItem("appLanguage") || "en"

  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      const bookmarkElement = createDetailBookmarkElement(bookmark)
      fragment.appendChild(bookmarkElement)
    }
  })

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.add("detail-view")
  elements.folderListDiv.appendChild(fragment)

  elements.searchInput.value = uiState.searchQuery
  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
  elements.sortFilter.value = uiState.sortType

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)
}

function populateFolderFilter(folders, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  elements.folderFilter.innerHTML = `<option value="">${translations[language].allBookmarks}</option>`
  folders.forEach((folder) => {
    if (folder.id !== "0") {
      const option = document.createElement("option")
      option.value = folder.id
      option.textContent = folder.title
      elements.folderFilter.appendChild(option)
    }
  })
  if (folders.some((f) => f.id === uiState.selectedFolderId)) {
    elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
}

function updateBookmarkCount(bookmarks, elements) {
  const selectedFolderId = elements.folderFilter.value
  const language = localStorage.getItem("appLanguage") || "en"
  let count
  if (selectedFolderId) {
    count = bookmarks.filter(
      (b) => b.url && isInFolder(b, selectedFolderId)
    ).length
  } else if (uiState.sortType === "favorites") {
    count = bookmarks.filter((b) => b.url && b.isFavorite).length
  } else {
    count = bookmarks.filter((b) => b.url).length
  }
  elements.bookmarkCountDiv.textContent = `${translations[language].totalBookmarks}: ${count}`
}

function toggleFolderButtons(elements) {
  const isUserCreatedFolder =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "1" &&
    uiState.selectedFolderId !== "2"
  elements.deleteFolderButton.classList.toggle("hidden", !isUserCreatedFolder)
  elements.renameFolderButton.classList.toggle("hidden", !isUserCreatedFolder)
}

function renderBookmarks(bookmarksList, elements) {
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)
  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      fragment.appendChild(createBookmarkElement(bookmark))
    }
  })

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.appendChild(fragment)

  elements.searchInput.value = uiState.searchQuery
  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
  elements.sortFilter.value = uiState.sortType

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)
}

function renderTreeView(nodes, elements, depth = 0) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    console.warn("No nodes to render in renderTreeView", { nodes, depth })
    const emptyMessage = document.createElement("div")
    emptyMessage.textContent =
      translations[language].noBookmarks || "No bookmarks found"
    emptyMessage.style.padding = "20px"
    emptyMessage.style.textAlign = "center"
    fragment.appendChild(emptyMessage)
    elements.folderListDiv.appendChild(fragment)
    return fragment
  }

  if (depth === 0) {
    elements.folderListDiv.innerHTML = ""
    elements.folderListDiv.classList.add("tree-view")

    const selectAllDiv = document.createElement("div")
    selectAllDiv.className = "select-all"
    selectAllDiv.style.display = uiState.checkboxesVisible ? "block" : "none"
    fragment.appendChild(selectAllDiv)
  }

  let nodesToRender = nodes
  if (
    depth === 0 &&
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0"
  ) {
    const selectedFolder = findNodeById(
      uiState.selectedFolderId,
      uiState.bookmarkTree
    )
    if (selectedFolder && selectedFolder.children) {
      nodesToRender = [selectedFolder]
    } else {
      console.warn(`Selected folder ${uiState.selectedFolderId} not found`)
      nodesToRender = []
    }
  }

  const folders = nodesToRender.filter((node) => node.children)
  const bookmarks = nodesToRender.filter((node) => node.url)

  const sortedBookmarks = sortBookmarks(bookmarks, uiState.sortType)
  const sortedFolders = folders.sort((a, b) =>
    (a.title || "").localeCompare(b.title || "")
  )
  const sortedNodes = [...sortedFolders, ...sortedBookmarks]

  sortedNodes.forEach((node) => {
    const folderTitle =
      node.title && node.title.trim() !== "" ? node.title : `Folder ${node.id}`

    const matchesSearch = uiState.searchQuery
      ? node.title?.toLowerCase().includes(uiState.searchQuery.toLowerCase()) ||
        node.url?.toLowerCase().includes(uiState.searchQuery.toLowerCase())
      : true

    const matchesFavorite =
      uiState.sortType === "favorites" ? node.isFavorite : true

    const matchesTag =
      uiState.selectedTags.length > 0
        ? node.tags?.some((tag) => uiState.selectedTags.includes(tag))
        : true

    if (node.children && Array.isArray(node.children)) {
      const isCollapsed = uiState.collapsedFolders.has(node.id)
      const itemCount = countFolderItems(node)

      const folderDiv = document.createElement("div")
      folderDiv.className = "folder-item"
      folderDiv.dataset.id = node.id
      folderDiv.style.marginLeft = `${depth * 20}px`

      const toggleIcon = isCollapsed ? "+" : "−"
      const folderIcon = isCollapsed ? "📁" : "📂"

      folderDiv.innerHTML = `
        <div class="folder-toggle" style="
          width: 28px; 
          height: 28px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          background: var(--bg-primary);
          border: 1px solid var(--text-primary);
          border-radius: 6px;
          cursor: pointer;
          margin-right: 8px;
          font-weight: bold;
          color: var(--text-primary);
          transition: all 0.3s ease;
        ">${toggleIcon}</div>
        <span class="folder-icon" style="margin-right: 8px; font-size: 18px;">${folderIcon}</span>
        <span class="folder-title" style="flex-grow: 1; font-weight: 600; color: var(--folder-title-color);">${folderTitle}</span>
        <span class="folder-count" style="
          background: var(--bg-secondary);
          color: var(--text-primary);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        ">${itemCount}</span>
      `

      fragment.appendChild(folderDiv)

      const childrenContainer = document.createElement("div")
      childrenContainer.className = "folder-children"
      childrenContainer.style.display = isCollapsed ? "none" : "block"
      childrenContainer.setAttribute("data-depth", depth + 1)

      if (!isCollapsed) {
        const childrenFragment = renderTreeView(
          node.children,
          elements,
          depth + 1
        )
        childrenContainer.appendChild(childrenFragment)
        // Gắn lại sự kiện và khởi tạo popup

        attachDropdownListeners(elements)
        setupBookmarkActionListeners(elements)
      }

      fragment.appendChild(childrenContainer)
    }

    if (node.url && matchesSearch && matchesFavorite && matchesTag) {
      const bookmarkElement = createEnhancedBookmarkElement(node, depth)
      fragment.appendChild(bookmarkElement)
    }
  })

  if (depth === 0) {
    elements.folderListDiv.appendChild(fragment)
    // Khởi tạo popup tại root
    attachTreeListeners(elements)
    return
  }

  return fragment
}

function createDetailBookmarkElement(bookmark) {
  const language = localStorage.getItem("appLanguage") || "en"
  let favicon
  try {
    favicon = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      bookmark.url
    )}`
  } catch (error) {
    console.error("Error generating favicon URL for", bookmark.url, error)
    favicon = "./images/default-favicon.png"
  }

  const div = document.createElement("div")
  div.className = `bookmark-item detail-bookmark-item ${
    bookmark.isFavorite ? "favorited" : ""
  }`
  div.dataset.id = bookmark.id
  div.style.cssText = ` 
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 12px 0;
    padding: 16px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 12px;
    background: var(--bg-primary);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `

  div.addEventListener("mouseenter", () => {
    div.style.transform = "translateY(-2px)"
    div.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)"
  })
  div.addEventListener("mouseleave", () => {
    div.style.transform = ""
    div.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)"
  })

  const tagsHtml = (bookmark.tags || [])
    .map(
      (tag) => `
    <span class="bookmark-tag" style="
      background-color: ${uiState.tagColors[tag] || "#ccc"};
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 8px;
      display: inline-block;
    ">
      ${tag}
    </span>
  `
    )
    .join("")

  div.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <input type="checkbox" 
             class="bookmark-checkbox" 
             data-id="${bookmark.id}" 
             ${uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""}
             style="display: ${
               uiState.checkboxesVisible ? "inline-block" : "none"
             }; transform: scale(1.2);">
      <div class="bookmark-favicon" style="
        width: 32px; 
        height: 32px; 
        border-radius: 6px; 
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
      ">
        <img src="${favicon}" 
             alt="favicon" 
             style="width: 90%; height: 90%; object-fit: cover;"
             onerror="this.style.display='none'; this.parentElement.innerHTML='';">
      </div>
      <a href="${bookmark.url}" 
         target="_blank" 
         class="bookmark-title"
         style="
           color: var(--text-primary);
           text-decoration: none;
           font-size: 8px;
           font-weight: 600;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
         "
         title="${bookmark.title || bookmark.url}">
        ${bookmark.title || bookmark.url}
      </a>
    </div>
    <div class="bookmark-url" style="
      font-size: 12px;
      color: var(--text-secondary);
      opacity: 0.8;
      margin-top: 4px;
      word-break: break-all;
    ">
      ${extractDomain(bookmark.url)}
    </div>
    <div class="bookmark-tags" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
      ${tagsHtml}
    </div>
    <div class="bookmark-details" style="
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
    ">
      <p><strong>${translations[language].detailDateAdded}:</strong> ${
    bookmark.dateAdded
      ? new Date(bookmark.dateAdded).toLocaleString()
      : translations[language].notAvailable
  }</p>
    </div>
    ${
      uiState.showBookmarkIds
        ? `<span class="bookmark-id" style="font-size: 12px; color: var(--text-secondary); opacity: 0.8;">ID: ${bookmark.id}</span>`
        : ""
    }
    <div class="dropdown-btn-group" style="position: absolute; top: 16px; right: 16px;">
      <button class="dropdown-btn ${bookmark.isFavorite ? "favorited" : ""}" 
              data-id="${bookmark.id}" 
              aria-label="Bookmark options"
              style="
                width: 32px; height: 32px; border: none; border-radius: 6px;
                background: transparent; cursor: pointer;
                transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;
                opacity: 0;
              ">
        ${
          bookmark.isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
      </button>
      <div class="dropdown-menu hidden" style="
        position: absolute; right: 0; top: 100%; margin-top: 4px;
        background: var(--bg-secondary, #2d2d2d); border: 1px solid var(--border-color, #404040);
        border-radius: 8px; min-width: 160px; padding: 4px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2); z-index: 1000;
      ">
        <button class="menu-item add-to-folder" data-id="${bookmark.id}">${
    translations[language].addToFolderOption
  }</button>
        <button class="menu-item delete-btn" data-id="${bookmark.id}">${
    translations[language].deleteBookmarkOption
  }</button>
        <button class="menu-item rename-btn" data-id="${bookmark.id}">${
    translations[language].renameBookmarkOption
  }</button>
        <button class="menu-item view-detail-btn" data-id="${bookmark.id}">${
    translations[language].viewDetail
  }</button>
        <button class="menu-item manage-tags-btn" data-id="${bookmark.id}">${
    translations[language].manageTags
  }</button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;">
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">${
    translations[language].favourite
  }</button>
      </div>
    </div>
  `

  div.addEventListener("mouseenter", () => {
    const dropdownBtn = div.querySelector(".dropdown-btn")
    if (dropdownBtn) dropdownBtn.style.opacity = "1"
  })

  div.addEventListener("mouseleave", () => {
    const dropdownBtn = div.querySelector(".dropdown-btn")
    if (dropdownBtn) dropdownBtn.style.opacity = "0"
  })

  return div
}

function createEnhancedBookmarkElement(bookmark, depth = 0) {
  const language = localStorage.getItem("appLanguage") || "en"
  let favicon
  try {
    favicon = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      bookmark.url
    )}`
  } catch (error) {
    console.error("Error generating favicon URL for", bookmark.url, error)
    favicon = "./images/default-favicon.png"
  }

  const div = document.createElement("div")
  div.className = `bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id
  div.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 3px 0;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: 10px;
    margin-left: ${depth * 12}px;
    background: var(--bg-primary);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    cursor: pointer;
  `

  div.addEventListener("mouseenter", () => {
    div.style.transform = "translateX(6px) translateY(-1px)"
    div.style.borderColor = "var(--hover-bg)"
    div.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.12)"
  })

  div.addEventListener("mouseleave", () => {
    div.style.transform = ""
    div.style.borderColor = "transparent"
    div.style.boxShadow = ""
  })

  const tagsHtml = (bookmark.tags || [])
    .map(
      (tag) => `
    <span class="bookmark-tag" style="background-color: ${
      uiState.tagColors[tag] || "#ccc"
    }; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;">
      ${tag}
    </span>
  `
    )
    .join("")

  div.innerHTML = `
    <input type="checkbox" 
           class="bookmark-checkbox" 
           data-id="${bookmark.id}" 
           ${uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""}
           style="display: ${
             uiState.checkboxesVisible ? "inline-block" : "none"
           }; transform: scale(1.2);">
    <div class="bookmark-favicon" style="
      width: 22px; 
      height: 22px; 
      border-radius: 4px; 
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
    ">
      <img src="${favicon}" 
           alt="favicon" 
           style="width: 90%; height: 90%; object-fit: cover;"
           onerror="this.style.display='none'; this.parentElement.innerHTML='';">
    </div>
    <a href="${bookmark.url}" 
       target="_blank" 
       class="bookmark-title"
       style="
         flex: 1;
         color: var(--text-primary);
         text-decoration: none;
         font-size: 10px;
         font-weight: 200;
         overflow: hidden;
         text-overflow: ellipsis;
         white-space: nowrap;
         transition: color 0.3s ease;
       "
       title="${bookmark.title || bookmark.url}">
      ${bookmark.title || bookmark.url}
    </a>
    <div class="bookmark-url" style="
      font-size: 11px;
      color: var(--text-secondary);
      opacity: 0.7;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    ">
      ${extractDomain(bookmark.url)}
    </div>
    <div class="bookmark-tags" style="display: flex; gap: 4px;">
      ${tagsHtml}
    </div>
    ${
      uiState.showBookmarkIds
        ? `<span class="bookmark-id" style="font-size: 11px; color: #888;">[${bookmark.id}]</span>`
        : ""
    }
    <div class="dropdown-btn-group" style="position: relative;">
      <button class="dropdown-btn ${bookmark.isFavorite ? "favorited" : ""}" 
              data-id="${bookmark.id}" 
              aria-label="Bookmark options"
              style="
                width: 24px; height: 24px; border: none; border-radius: 4px;
                background: transparent; cursor: pointer;
                transition: all 0.3s ease; display: flex; align-items: center; justify-content: center;
                opacity: 0;
              ">
        ${
          bookmark.isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
      </button>
      <div class="dropdown-menu hidden" style="
        position: absolute; right: 0; top: 100%; margin-top: 4px;
        background: var(--bg-secondary, #2d2d2d); border: 1px solid var(--border-color, #404040);
        border-radius: 8px; min-width: 160px; padding: 4px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2); z-index: 1000;
      ">
        <button class="menu-item add-to-folder" data-id="${bookmark.id}">${
    translations[language].addToFolderOption
  }</button>
        <button class="menu-item delete-btn" data-id="${bookmark.id}">${
    translations[language].deleteBookmarkOption
  }</button>
        <button class="menu-item rename-btn" data-id="${bookmark.id}">${
    translations[language].renameBookmarkOption
  }</button>
        <button class="menu-item view-detail-btn" data-id="${bookmark.id}">${
    translations[language].viewDetail
  }</button>
        <button class="menu-item manage-tags-btn" data-id="${bookmark.id}">${
    translations[language].manageTags
  }</button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;">
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">${
    translations[language].favourite
  }</button>
      </div>
    </div>
  `

  div.addEventListener("mouseenter", () => {
    const dropdownBtn = div.querySelector(".dropdown-btn")
    if (dropdownBtn) dropdownBtn.style.opacity = "1"
  })

  div.addEventListener("mouseleave", () => {
    const dropdownBtn = div.querySelector(".dropdown-btn")
    if (dropdownBtn) dropdownBtn.style.opacity = "0"
  })

  return div
}

function countFolderItems(node) {
  if (!node.children) return 0
  return node.children.reduce((count, child) => {
    return count + (child.url ? 1 : 0) + countFolderItems(child)
  }, 0)
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

function toggleFavorite(bookmarkId, buttonElement) {
  chrome.storage.local.get("favoriteBookmarks", (data) => {
    const favoriteBookmarks = data.favoriteBookmarks || {}

    if (favoriteBookmarks[bookmarkId]) {
      delete favoriteBookmarks[bookmarkId]
      buttonElement.classList.remove("favorited")
      buttonElement.style.color = "var(--text-secondary, #b0b0b0)"
    } else {
      favoriteBookmarks[bookmarkId] = true
      buttonElement.classList.add("favorited")
      buttonElement.style.color = "#ffd700"
    }

    chrome.storage.local.set({ favoriteBookmarks }, () => {
      const bookmarkItem = buttonElement.closest(".bookmark-item")
      bookmarkItem.classList.toggle(
        "favorited",
        !!favoriteBookmarks[bookmarkId]
      )

      if (uiState.sortType === "favorites") {
        chrome.bookmarks.getTree((tree) => {
          renderFilteredBookmarks(tree, elements)
        })
      }
    })
  })
}

function isAncestorOf(node, targetFolderId) {
  if (!node.children) return false

  for (const child of node.children) {
    if (child.id === targetFolderId) return true
    if (isAncestorOf(child, targetFolderId)) return true
  }
  return false
}

function createBookmarkElement(bookmark, depth = 0) {
  const language = localStorage.getItem("appLanguage") || "en"
  let favicon
  try {
    favicon = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      bookmark.url
    )}`
  } catch (error) {
    console.error("Error generating favicon URL for", bookmark.url, error)
    favicon = "./images/default-favicon.png"
  }
  const div = document.createElement("div")
  div.className = "bookmark-item"
  div.style.marginLeft = `${depth * 20}px`
  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${bookmark.id}" ${
    uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""
  } style="display: ${uiState.checkboxesVisible ? "inline-block" : "none"}">
    <img src="${favicon}" alt="favicon" class="favicon">
    <a href="${bookmark.url}" target="_blank" class="link">${
    bookmark.title || bookmark.url
  }</a>
    ${
      uiState.showBookmarkIds
        ? `<span class="bookmark-id">[ID: ${bookmark.id}]</span>`
        : ""
    }
    <div class="dropdown-btn-group">
      <button class="dropdown-btn ${
        bookmark.isFavorite ? "favorited" : ""
      }" data-id="${bookmark.id}" aria-label="Bookmark options">
        ${
          bookmark.isFavorite
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
      </button>
      <div class="dropdown-menu hidden">
        <button class="menu-item add-to-folder" data-id="${bookmark.id}">${
    translations[language].addToFolderOption
  }</button>
        <button class="menu-item delete-btn" data-id="${bookmark.id}">${
    translations[language].deleteBookmarkOption
  }</button>
        <button class="menu-item rename-btn" data-id="${bookmark.id}">${
    translations[language].renameBookmarkOption
  }</button>
        <button class="menu-item view-detail-btn" data-id="${bookmark.id}">${
    translations[language].viewDetail
  }</button>
        <button class="menu-item manage-tags-btn" data-id="${bookmark.id}">${
    translations[language].manageTags
  }</button>
        <hr/>
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">${
    translations[language].favourite
  }</button>
      </div>
    </div>
  `
  return div
}

function sortBookmarks(bookmarksList, sortType) {
  let sorted = [...bookmarksList]
  switch (sortType) {
    case "favorites":
      sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      break
    case "default":
    case "new":
      sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      break
    case "old":
      sorted.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
      break
    case "last-opened":
      sorted.sort((a, b) => {
        const parentA = findParentFolder(a.id, uiState.bookmarkTree) || {}
        const parentB = findParentFolder(b.id, uiState.bookmarkTree) || {}
        const dateA = parentA.dateGroupModified || a.dateAdded || 0
        const dateB = parentB.dateGroupModified || b.dateAdded || 0
        return dateB - dateA
      })
      break
    case "a-z":
      sorted.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url))
      break
    case "z-a":
      sorted.sort((a, b) => (b.title || b.url).localeCompare(a.title || b.url))
      break
    default:
      sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      break
  }
  return sorted
}

function findParentFolder(bookmarkId, nodes) {
  for (const node of nodes) {
    if (node.children) {
      if (node.children.some((child) => child.id === bookmarkId)) {
        return node
      }
      const found = findParentFolder(bookmarkId, node.children)
      if (found) return found
    }
  }
  return null
}

function attachSelectAllListener(elements) {
  const selectAllCheckbox = document.getElementById("select-all")
  if (selectAllCheckbox) {
    selectAllCheckbox.removeEventListener("change", handleSelectAll)
    selectAllCheckbox.addEventListener("change", handleSelectAll)
  } else {
    console.warn("Select All checkbox (#select-all) not found")
  }

  function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll(".bookmark-checkbox")

    if (e.target.checked) {
      checkboxes.forEach((cb) => {
        const bookmarkId = cb.dataset.id
        if (bookmarkId) {
          cb.checked = true
          uiState.selectedBookmarks.add(bookmarkId)
        } else {
          console.error("Missing data-id on checkbox:", cb)
        }
      })
    } else {
      checkboxes.forEach((cb) => {
        cb.checked = false
      })
      uiState.selectedBookmarks.clear()
    }

    elements.addToFolderButton.classList.toggle(
      "hidden",
      uiState.selectedBookmarks.size === 0
    )
    elements.deleteBookmarksButton.classList.toggle(
      "hidden",
      uiState.selectedBookmarks.size === 0
    )
  }
}

export function setupTagFilterListener(elements) {
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")
  const tagFilterDropdown = elements.tagFilterContainer?.querySelector(
    "#tag-filter-dropdown"
  )
  if (!tagFilterToggle || !tagFilterDropdown) {
    console.error("Tag filter toggle or dropdown not found", {
      tagFilterContainer: elements.tagFilterContainer,
      tagFilterToggle,
      tagFilterDropdown,
    })
    return
  }

  tagFilterToggle.addEventListener("click", (e) => {
    e.stopPropagation()

    tagFilterDropdown.classList.toggle("hidden")
  })

  document.addEventListener("click", (e) => {
    if (!elements.tagFilterContainer.contains(e.target)) {
      tagFilterDropdown.classList.add("hidden")
    }
  })

  // Clear existing listeners to prevent duplicates
  tagFilterDropdown.removeEventListener("change", handleTagChange)

  tagFilterDropdown.addEventListener("change", handleTagChange)

  function handleTagChange(e) {
    if (e.target.type === "checkbox") {
      const selectedTags = Array.from(
        tagFilterDropdown.querySelectorAll('input[type="checkbox"]:checked')
      ).map((cb) => cb.value)

      uiState.selectedTags = selectedTags // Trực tiếp cập nhật uiState

      tagFilterToggle.textContent =
        selectedTags.length > 0
          ? selectedTags.join(", ")
          : translations[localStorage.getItem("appLanguage") || "en"].allTags

      customSaveUIState()
      chrome.bookmarks.getTree((tree) => {
        renderFilteredBookmarks(tree, elements)
      })
    }
  }

  // Debug: Log all checkboxes
}

function attachTreeListeners(elements) {
  const folderListDiv = elements.folderListDiv
  // Xóa các sự kiện cũ để tránh trùng lặp
  folderListDiv.removeEventListener("click", handleFolderToggle)
  folderListDiv.removeEventListener("click", handleDropdownClick)
  folderListDiv.removeEventListener("click", handlePopupActions)

  // Gắn sự kiện toggle thư mục
  function handleFolderToggle(e) {
    const toggle = e.target.closest(".folder-toggle")
    if (toggle) {
      e.stopPropagation()
      const folderDiv = toggle.closest(".folder-item")
      const folderId = folderDiv.dataset.id
      const childrenContainer = folderDiv.nextElementSibling
      const folderIcon = folderDiv.querySelector(".folder-icon")

      if (uiState.collapsedFolders.has(folderId)) {
        uiState.collapsedFolders.delete(folderId)
        toggle.textContent = "−"
        folderIcon.textContent = "📂"
        if (childrenContainer) {
          childrenContainer.style.display = "block"
          if (childrenContainer.innerHTML === "") {
            const node = findNodeById(folderId, uiState.bookmarkTree)
            if (node && node.children) {
              const depth =
                parseInt(childrenContainer.getAttribute("data-depth")) || 1
              const childrenFragment = renderTreeView(
                node.children,
                elements,
                depth
              )
              childrenContainer.appendChild(childrenFragment)
              // Gắn lại sự kiện cho dropdown và popup trong thư mục con
              attachDropdownListeners(elements)
              setupBookmarkActionListeners(elements)
              // Khởi tạo lại popup
            }
          }
        }
      } else {
        uiState.collapsedFolders.add(folderId)
        toggle.textContent = "+"
        folderIcon.textContent = "📁"
        if (childrenContainer) {
          childrenContainer.style.display = "none"
        }
      }

      toggle.style.transform = "scale(1.1)"
      setTimeout(() => {
        toggle.style.transform = ""
      }, 150)

      customSaveUIState()
    }
  }

  // Gắn sự kiện dropdown
  function handleDropdownClick(e) {
    const dropdownBtn = e.target.closest(".dropdown-btn")
    if (dropdownBtn) {
      e.stopPropagation()
      const dropdownMenu = dropdownBtn.nextElementSibling

      if (dropdownMenu && dropdownMenu.classList.contains("dropdown-menu")) {
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          if (menu !== dropdownMenu) {
            menu.classList.add("hidden")
          }
        })
        dropdownMenu.classList.toggle("hidden")
      }
    }
  }

  // Gắn sự kiện cho các hành động popup
  function handlePopupActions(e) {
    const target = e.target.closest(".menu-item")
    if (!target) return

    e.stopPropagation()
    const bookmarkId = target.dataset.id
    const language = localStorage.getItem("appLanguage") || "en"

    if (target.classList.contains("rename-btn")) {
      const renamePopup = document.getElementById("rename-popup")
      if (renamePopup) {
        renamePopup.classList.remove("hidden")
        const renameInput = renamePopup.querySelector("#rename-input")
        const bookmark = uiState.bookmarks.find((b) => b.id === bookmarkId)
        if (bookmark && renameInput) {
          renameInput.value = bookmark.title || bookmark.url
        } else {
          console.error("Bookmark or rename input not found", {
            bookmarkId,
            bookmark,
            renameInput,
          })
          showCustomPopup(translations[language].errorUnexpected, "error", true)
        }
      } else {
        console.error("Rename popup not found")
        showCustomPopup(translations[language].errorUnexpected, "error", true)
      }
    } else if (target.classList.contains("add-to-folder")) {
      const addToFolderPopup = document.getElementById("add-to-folder-popup")
      if (addToFolderPopup) {
        addToFolderPopup.classList.remove("hidden")
      } else {
        console.error("Add to folder popup not found")
        showCustomPopup(translations[language].errorUnexpected, "error", true)
      }
    } else if (target.classList.contains("delete-btn")) {
      showCustomPopup(
        translations[language].confirmDeleteBookmark,
        "confirm",
        true,
        () => {
          chrome.bookmarks.remove(bookmarkId, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error deleting bookmark:",
                chrome.runtime.lastError
              )
              showCustomPopup(
                translations[language].errorUnexpected,
                "error",
                true
              )
            } else {
              chrome.bookmarks.getTree((tree) => {
                renderFilteredBookmarks(tree, elements)
              })
            }
          })
        }
      )
    } else if (target.classList.contains("favorite-btn")) {
      toggleFavorite(bookmarkId, target)
    }
  }

  // Gắn các sự kiện
  folderListDiv.addEventListener("click", handleFolderToggle)
  folderListDiv.addEventListener("click", handleDropdownClick)
  folderListDiv.addEventListener("click", handlePopupActions)

  // Đóng dropdown khi click bên ngoài
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu")
    ) {
      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.classList.add("hidden")
      })
    }
  })

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)
}

document.querySelectorAll(".close-modal").forEach((btn) => {
  btn.onclick = () => {
    btn.closest(".rename-popup").classList.add("hidden")
  }
})

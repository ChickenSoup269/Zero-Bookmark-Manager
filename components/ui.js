import { translations, showCustomPopup } from "./utils/utils.js"
import { flattenBookmarks, getFolders, isInFolder } from "./bookmarks.js"
import { uiState, setBookmarks, setFolders, setBookmarkTree } from "./state.js"
import { attachDropdownListeners } from "./controller/dropdown.js"
import { setupBookmarkActionListeners } from "./controller/bookmarkActions.js"
import { getAllTags } from "./tag.js"
import { customSaveUIState } from "./option/option.js"

// ==========================================
// HELPER FUNCTIONS (DÙNG CHUNG ĐỂ TRÁNH LẶP CODE)
// ==========================================

function getFaviconUrl(url) {
  try {
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      url
    )}`
  } catch {
    return "./images/default-favicon.png"
  }
}

function createTagsHTML(tags, styleOverride = "") {
  if (!tags || tags.length === 0) return ""
  return tags
    .map(
      (tag) => `
    <span class="bookmark-tag" style="
      background-color: ${uiState.tagColors[tag] || "#ccc"};
      color: white; 
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
    )
    .join("")
}

function createDropdownHTML(bookmark, language) {
  const t = translations[language] || translations.en
  const isFav = bookmark.isFavorite
  const isPinned = bookmark.isPinned // Biến này sẽ được lấy từ storage

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
      <div class="dropdown-menu hidden" style="
        position: absolute; right: 0; top: 100%; margin-top: 4px;
        background: var(--bg-secondary, #2d2d2d); border: 1px solid var(--border-color, #404040);
        border-radius: 8px; min-width: 160px; padding: 4px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2); z-index: 1000;
      ">
        <button class="menu-item pin-btn" data-id="${bookmark.id}">
            ${
              isPinned
                ? t.unpin || "Unpin from Top"
                : t.pinToTop || "Pin to Top"
            }
        </button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;"/>
        <button class="menu-item add-to-folder" data-id="${bookmark.id}">${
    t.addToFolderOption || "Add to Folder"
  }</button>
        <button class="menu-item delete-btn" data-id="${bookmark.id}">${
    t.deleteBookmarkOption || "Delete"
  }</button>
        <button class="menu-item rename-btn" data-id="${bookmark.id}">${
    t.renameBookmarkOption || "Rename"
  }</button>
        <button class="menu-item view-detail-btn" data-id="${bookmark.id}">${
    t.viewDetail || "Details"
  }</button>
        <button class="menu-item manage-tags-btn" data-id="${bookmark.id}">${
    t.manageTags || "Tags"
  }</button>
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;"/>
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">
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
  chrome.storage.local.get(["bookmarkAccessCounts"], (data) => {
    const counts = data.bookmarkAccessCounts || {}
    counts[bookmarkId] = (counts[bookmarkId] || 0) + 1
    chrome.storage.local.set({ bookmarkAccessCounts: counts }, () => {
      if (uiState.sortType === "most-visited") {
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements)
        )
      }
    })
  })
}

function attachDropdownToggle(element) {
  const btn = element.querySelector(".dropdown-btn")
  const menu = element.querySelector(".dropdown-menu")

  if (btn && menu) {
    // Toggle menu
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const isHidden = menu.classList.contains("hidden")
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      if (isHidden) menu.classList.remove("hidden")
    })

    // Close when clicking outside is handled globally in attachTreeListeners

    // Hover effects for visibility
    element.addEventListener("mouseenter", () => {
      if (
        element.classList.contains("detail-bookmark-item") ||
        element.classList.contains("bookmark-item")
      ) {
        btn.style.opacity = "1"
      }
    })
    element.addEventListener("mouseleave", () => {
      if (
        (element.classList.contains("detail-bookmark-item") ||
          element.classList.contains("bookmark-item")) &&
        menu.classList.contains("hidden")
      ) {
        btn.style.opacity = "0"
      }
    })
  }
}

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
      true
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
    <option value="favorites">${t.sortFavorites}</option>
    <option value="most-visited">${t.sortMostVisited || "Most Visited"}</option>
    <option value="old">${t.sortOld}</option>
    <option value="last-opened">${t.sortLastOpened}</option>
    <option value="a-z">${t.sortAZ}</option>
    <option value="z-a">${t.sortZA}</option>
  `
  // Update texts
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

  // Update attributes
  elements.scrollToTopButton.title = t.scrollToTop
  elements.scrollToTopButton.setAttribute("aria-label", t.scrollToTop)
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
}

export async function populateTagFilter(elements) {
  const tagFilterOptions = elements.tagFilterContainer?.querySelector(
    "#tag-filter-options"
  )
  const tagFilterToggle =
    elements.tagFilterContainer?.querySelector("#tag-filter-toggle")

  if (!tagFilterOptions || !tagFilterToggle) return

  const allTags = await getAllTags()
  tagFilterOptions.innerHTML = ""
  allTags.forEach((tag) => {
    const label = document.createElement("label")
    label.style.display = "block"
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.value = tag
    checkbox.checked = uiState.selectedTags.includes(tag)
    checkbox.dataset.tag = tag

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

export function updateTheme(elements, theme) {
  const availableThemes = ["light", "dark", "dracula", "onedark"]
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
        element.classList.remove(`${themeName}-theme`)
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
    if (element) element.classList.add(`${activeTheme}-theme`)
  })

  document.documentElement.setAttribute("data-theme", activeTheme)

  document
    .querySelectorAll(
      ".input, .select, .button, .rename-popup, .folder-item, .folder-title, .custom-popup"
    )
    .forEach((el) => {
      availableThemes.forEach((themeName) =>
        el.classList.remove(`${themeName}-theme`)
      )
      el.classList.remove("light-theme", "dark-theme")
      el.classList.add(`${activeTheme}-theme`)
    })

  localStorage.setItem("selectedTheme", theme)
  window.dispatchEvent(
    new CustomEvent("themeChanged", {
      detail: { theme: activeTheme, originalSelection: theme },
    })
  )
}

export function renderFilteredBookmarks(bookmarkTreeNodes, elements) {
  // Thêm 'pinnedBookmarks' vào danh sách cần lấy
  chrome.storage.local.get(
    ["favoriteBookmarks", "bookmarkAccessCounts", "pinnedBookmarks"],
    (data) => {
      const favoriteBookmarks = data.favoriteBookmarks || {}
      const bookmarkAccessCounts = data.bookmarkAccessCounts || {}
      const pinnedBookmarks = data.pinnedBookmarks || {} // Lấy danh sách đã ghim

      const addStatus = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            node.isFavorite = !!favoriteBookmarks[node.id]
            node.isPinned = !!pinnedBookmarks[node.id] // Gán trạng thái Pin
            node.tags = uiState.bookmarkTags[node.id] || []
            node.accessCount = bookmarkAccessCounts[node.id] || 0
          }
          if (node.children) addStatus(node.children)
        }
      }

      addStatus(bookmarkTreeNodes)

      const bookmarks = flattenBookmarks(bookmarkTreeNodes)
      const folders = getFolders(bookmarkTreeNodes)

      setBookmarkTree(bookmarkTreeNodes)
      setBookmarks(bookmarks)
      setFolders(folders)
      populateTagFilter(elements)
      populateFolderFilter(folders, elements)
      setupTagFilterListener(elements)
      updateBookmarkCount(bookmarks, elements)

      // ... (Phần filter giữ nguyên như cũ) ...
      let filtered = bookmarks.filter((bookmark) => bookmark.url)

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
      } else if (uiState.selectedFolderId && uiState.selectedFolderId !== "0") {
        uiState.selectedFolderId = ""
        elements.folderFilter.value = ""
      }
      if (uiState.searchQuery) {
        const query = uiState.searchQuery.toLowerCase()
        filtered = filtered.filter(
          (bookmark) =>
            bookmark.title?.toLowerCase().includes(query) ||
            bookmark.url?.toLowerCase().includes(query)
        )
      }

      // Render Views
      if (uiState.viewMode === "tree") {
        const rootChildren = bookmarkTreeNodes[0]?.children || []
        renderTreeView(rootChildren, elements)
      } else if (uiState.viewMode === "detail") {
        renderDetailView(filtered, elements)
      } else if (uiState.viewMode === "card") {
        renderCardView(bookmarkTreeNodes, filtered, elements)
      } else {
        renderBookmarks(filtered, elements)
      }

      toggleFolderButtons(elements)
      customSaveUIState()
    }
  )
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

  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url) {
      fragment.appendChild(
        createDetailBookmarkElement(bookmark, language, elements)
      )
    }
  })

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove("tree-view", "card-view")
  elements.folderListDiv.classList.add("detail-view")
  elements.folderListDiv.appendChild(fragment)

  commonPostRenderOps(elements)
}

function renderCardView(bookmarkTreeNodes, filteredBookmarks, elements) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"
  const folders = getFolders(bookmarkTreeNodes)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove("detail-view", "tree-view")
  elements.folderListDiv.classList.add("card-view")

  // Check if inside a folder
  const isViewingSpecificFolder =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "0" &&
    folders.some((f) => f.id === uiState.selectedFolderId)

  if (isViewingSpecificFolder) {
    const selectedFolder = findNodeById(
      uiState.selectedFolderId,
      bookmarkTreeNodes
    )
    if (selectedFolder && selectedFolder.children) {
      // Filter direct children
      const folderBookmarks = filteredBookmarks.filter((bookmark) => {
        return (
          bookmark.parentId === selectedFolder.id &&
          (!uiState.searchQuery ||
            bookmark.title
              ?.toLowerCase()
              .includes(uiState.searchQuery.toLowerCase()) ||
            bookmark.url
              ?.toLowerCase()
              .includes(uiState.searchQuery.toLowerCase())) &&
          (uiState.sortType !== "favorites" || bookmark.isFavorite) &&
          (uiState.selectedTags.length === 0 ||
            bookmark.tags?.some((tag) => uiState.selectedTags.includes(tag)))
        )
      })
      const sortedBookmarks = sortBookmarks(folderBookmarks, uiState.sortType)

      // Back Button
      const backButton = document.createElement("button")
      backButton.className = "back-button"
      backButton.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 8px 16px; margin: 10px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 500;`
      backButton.innerHTML = `<span style="font-size: 16px;">←</span> ${
        translations[language].back || "Back"
      }`
      backButton.addEventListener("click", () => {
        uiState.selectedFolderId = ""
        elements.folderFilter.value = ""
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements)
        )
      })
      fragment.appendChild(backButton)

      // Render Bookmarks
      elements.folderListDiv.classList.remove("card-view") // Use list layout for items inside
      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          el.draggable = true
          el.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", bookmark.id)
            e.dataTransfer.setData("type", "bookmark")
            el.classList.add("dragging")
          })
          el.addEventListener("dragend", () => el.classList.remove("dragging"))
          fragment.appendChild(el)
        }
      })
    } else {
      uiState.selectedFolderId = ""
      elements.folderFilter.value = ""
    }
  } else {
    // Render Folder Cards
    folders.forEach((folder) => {
      if (folder.id === "0") return

      const folderBookmarks = filteredBookmarks.filter(
        (bookmark) =>
          isInFolder(bookmark, folder.id) &&
          (!uiState.searchQuery ||
            bookmark.title
              ?.toLowerCase()
              .includes(uiState.searchQuery.toLowerCase()) ||
            bookmark.url
              ?.toLowerCase()
              .includes(uiState.searchQuery.toLowerCase())) &&
          (uiState.sortType !== "favorites" || bookmark.isFavorite) &&
          (uiState.selectedTags.length === 0 ||
            bookmark.tags?.some((tag) => uiState.selectedTags.includes(tag)))
      )
      const sortedBookmarks = sortBookmarks(folderBookmarks, uiState.sortType)

      const folderCard = document.createElement("div")
      folderCard.className = "folder-card"
      folderCard.dataset.folderId = folder.id
      folderCard.draggable = true
      folderCard.innerHTML = `
            <div class="folder-content">
                <span class="folder-icon">📂</span>
                <span class="folder-title">${
                  folder.title?.trim() || `Folder ${folder.id}`
                }</span>
                <span class="folder-count">${folderBookmarks.length}</span>
            </div>
            <div class="bookmarks-container"></div>
        `

      // Folder Click
      folderCard.addEventListener("click", (e) => {
        if (
          e.target.closest(
            ".bookmarks-container, .dropdown-btn, .bookmark-item"
          )
        )
          return
        uiState.selectedFolderId = folder.id
        elements.folderFilter.value = folder.id
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements)
        )
      })

      // Folder Drag Events
      folderCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", folder.id)
        e.dataTransfer.setData("type", "folder")
        folderCard.classList.add("folder-dragging")
      })
      folderCard.addEventListener("dragend", () =>
        folderCard.classList.remove("folder-dragging")
      )
      folderCard.addEventListener("dragover", (e) => {
        e.preventDefault()
        folderCard.classList.add("folder-drag-over")
      })
      folderCard.addEventListener("dragleave", () =>
        folderCard.classList.remove("folder-drag-over")
      )
      folderCard.addEventListener("drop", (e) =>
        handleFolderDrop(
          e,
          folder,
          folderCard,
          bookmarkTreeNodes,
          language,
          elements
        )
      )

      const bookmarksContainer = folderCard.querySelector(
        ".bookmarks-container"
      )
      sortedBookmarks.forEach((bookmark) => {
        if (bookmark.url) {
          const el = createSimpleBookmarkElement(bookmark, language, elements)
          el.draggable = true
          el.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", bookmark.id)
            e.dataTransfer.setData("type", "bookmark")
            el.classList.add("dragging")
          })
          el.addEventListener("dragend", () => el.classList.remove("dragging"))
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
  elements
) {
  e.preventDefault()
  const draggedType = e.dataTransfer.getData("type")
  const draggedId = e.dataTransfer.getData("text/plain")
  const targetFolderId = folderCard.dataset.folderId
  folderCard.classList.remove("folder-drag-over")

  if (draggedType === "bookmark" && draggedId && targetFolderId) {
    chrome.bookmarks.move(draggedId, { parentId: targetFolderId }, () => {
      if (chrome.runtime.lastError)
        showCustomPopup(translations[language].errorUnexpected, "error", true)
      else
        chrome.bookmarks.getTree((tree) =>
          renderFilteredBookmarks(tree, elements)
        )
    })
  } else if (
    draggedType === "folder" &&
    draggedId !== targetFolderId &&
    !isDescendant(draggedId, targetFolderId, bookmarkTreeNodes)
  ) {
    chrome.bookmarks.get(draggedId, (nodes) => {
      const draggedFolder = nodes[0]
      const targetIndex = uiState.folders.findIndex(
        (f) => f.id === targetFolderId
      ) // simplified logic for index
      // Complex sorting logic for drop position omitted for brevity, defaulting to append or move
      chrome.bookmarks.move(
        draggedId,
        { parentId: draggedFolder.parentId },
        () => {
          // Simplified move
          chrome.bookmarks.getTree((tree) =>
            renderFilteredBookmarks(tree, elements)
          )
        }
      )
    })
  }
}

function createSimpleBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id
  div.innerHTML = `
    <div class="bookmark-content">
      <div class="bookmark-favicon"><img src="${favicon}" alt="icon" onerror="this.style.display='none';"></div>
      <a href="${bookmark.url}" target="_blank" class="card-bookmark-title">${
    bookmark.title || bookmark.url
  }</a>
      ${createDropdownHTML(bookmark, language)}
    </div>
  `

  div
    .querySelector(".card-bookmark-title")
    .addEventListener("click", () =>
      handleBookmarkLinkClick(bookmark.id, elements)
    )
  attachDropdownToggle(div)
  return div
}

function createDetailBookmarkElement(bookmark, language, elements) {
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item detail-bookmark-item ${
    bookmark.isFavorite ? "favorited" : ""
  }`
  div.dataset.id = bookmark.id
  div.style.cssText = `display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-tertiary); box-shadow: var(--shadow-sm);`

  const tagsHtml = createTagsHTML(bookmark.tags)

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div class="bookmark-favicon" style="width:32px;height:32px;border-radius:6px;overflow:hidden;background:var(--bg-secondary);border:1px solid var(--border-color);display:flex;justify-content:center;align-items:center;">
        <img src="${favicon}" style="width:100%;height:100%;object-fit:contain;">
      </div>
      <a href="${
        bookmark.url
      }" target="_blank" style="flex:1;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${bookmark.title || bookmark.url}
      </a>
      ${createDropdownHTML(bookmark, language)}
    </div>
    <div style="font-size:13px;color:var(--text-muted);opacity:0.85;">${extractDomain(
      bookmark.url
    )}</div>
    <button class="view-detail-btn" style="background:var(--accent-color);color:var(--bg-primary);border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-weight:600;margin-top:8px;">
      ${translations[language].viewDetail}
    </button>
  `

  // Inline modal logic (Keep existing logic)
  div.querySelector(".view-detail-btn").addEventListener("click", () => {
    const overlay = document.createElement("div")
    overlay.className = "bookmark-modal-overlay"
    overlay.innerHTML = `
      <div class="bookmark-modal">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${favicon}" class="modal-favicon" alt="icon">
            <h3 class="modal-title">${bookmark.title || bookmark.url}</h3>
          </div>
          <div class="modal-actions"><button class="modal-fullscreen">⤢</button><button class="modal-close">&times;</button></div>
        </div>
       <div class="modal-info">
          <div class="modal-meta">
            <span><strong>${translations[language].detailDateAdded}:</strong> ${
      bookmark.dateAdded
        ? new Date(bookmark.dateAdded).toLocaleString()
        : translations[language].notAvailable
    }</span>
            <span class="separator">|</span>
            <span><strong>${translations[language].detailFolder}:</strong> ${
      findParentFolder(bookmark.id, uiState.bookmarkTree)?.title ||
      translations[language].noFolder
    }</span>
          </div>
          ${
            tagsHtml
              ? `<div class="modal-tags"><strong>${translations[language].manageTags}:</strong> ${tagsHtml}</div>`
              : ""
          } 
          ${
            uiState.showBookmarkIds
              ? `<div class="modal-bookmark-id" style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:right;">ID: ${bookmark.id}</div>`
              : ""
          }
      </div>
        <iframe src="${
          bookmark.url
        }" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
      </div>`
    document.body.appendChild(overlay)
    overlay
      .querySelector(".modal-close")
      .addEventListener("click", () => overlay.remove())
    overlay
      .querySelector(".modal-fullscreen")
      .addEventListener("click", () =>
        overlay.querySelector(".bookmark-modal").classList.toggle("fullscreen")
      )
    overlay.addEventListener("click", (evt) => {
      if (evt.target === overlay) overlay.remove()
    })
  })

  attachDropdownToggle(div)
  return div
}

function renderBookmarks(bookmarksList, elements) {
  const fragment = document.createDocumentFragment()
  const sortedBookmarks = sortBookmarks(bookmarksList, uiState.sortType)

  elements.folderListDiv.innerHTML = ""
  elements.folderListDiv.classList.remove(
    "tree-view",
    "card-view",
    "detail-view"
  )

  sortedBookmarks.forEach((bookmark) => {
    if (bookmark.url)
      fragment.appendChild(createBookmarkElement(bookmark, 0, elements))
  })

  elements.folderListDiv.appendChild(fragment)
  commonPostRenderOps(elements)
}

function renderTreeView(nodes, elements, depth = 0) {
  const fragment = document.createDocumentFragment()
  const language = localStorage.getItem("appLanguage") || "en"

  if (depth === 0) {
    elements.folderListDiv.innerHTML = ""
    elements.folderListDiv.classList.add("tree-view")
    if (uiState.checkboxesVisible) {
      const selectAllDiv = document.createElement("div")
      selectAllDiv.className = "select-all"
      fragment.appendChild(selectAllDiv)
    }
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
    nodesToRender =
      selectedFolder && selectedFolder.children ? [selectedFolder] : []
  }

  const folders = nodesToRender
    .filter((node) => node.children)
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
  const bookmarks = nodesToRender.filter((node) => node.url)
  const sortedBookmarks = sortBookmarks(bookmarks, uiState.sortType)

  ;[...folders, ...sortedBookmarks].forEach((node) => {
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

    if (node.children) {
      // Folder Item
      const isCollapsed = uiState.collapsedFolders.has(node.id)
      const folderDiv = document.createElement("div")
      folderDiv.className = "folder-item"
      folderDiv.dataset.id = node.id
      folderDiv.style.marginLeft = `${depth * 20}px`
      folderDiv.innerHTML = `
        <div class="folder-toggle" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid var(--text-primary);border-radius:6px;cursor:pointer;margin-right:8px;font-weight:bold;">${
          isCollapsed ? "+" : "−"
        }</div>
        <span class="folder-icon" style="margin-right:8px;font-size:18px;">${
          isCollapsed ? "📁" : "📂"
        }</span>
        <span class="folder-title" style="flex-grow:1;font-weight:600;">${
          node.title || `Folder ${node.id}`
        }</span>
        <span class="folder-count" style="background:var(--bg-secondary);padding:2px 8px;border-radius:12px;font-size:12px;">${countFolderItems(
          node
        )}</span>
      `

      // Folder Drag Events (Simplified)
      folderDiv.addEventListener("dragover", (e) => {
        e.preventDefault()
        folderDiv.style.background = "var(--hover-bg)"
        folderDiv.style.border = "2px dashed var(--accent-color)"
      })
      folderDiv.addEventListener("dragleave", () => {
        folderDiv.style.background = "transparent"
        folderDiv.style.border = "none"
      })
      folderDiv.addEventListener("drop", (e) => {
        e.preventDefault()
        folderDiv.style.background = "transparent"
        folderDiv.style.border = "none"
        const bookmarkId = e.dataTransfer.getData("text/plain")
        if (bookmarkId)
          chrome.bookmarks.move(bookmarkId, { parentId: node.id }, () =>
            chrome.bookmarks.getTree((tree) =>
              renderFilteredBookmarks(tree, elements)
            )
          )
      })

      fragment.appendChild(folderDiv)

      const childrenContainer = document.createElement("div")
      childrenContainer.className = "folder-children"
      childrenContainer.style.display = isCollapsed ? "none" : "block"
      childrenContainer.setAttribute("data-depth", depth + 1)
      if (!isCollapsed)
        childrenContainer.appendChild(
          renderTreeView(node.children, elements, depth + 1)
        )
      fragment.appendChild(childrenContainer)
    } else if (node.url && matchesSearch && matchesFavorite && matchesTag) {
      fragment.appendChild(createEnhancedBookmarkElement(node, depth, elements))
    }
  })

  if (depth === 0) {
    elements.folderListDiv.appendChild(fragment)
    attachTreeListeners(elements)
  }
  return fragment
}

function createEnhancedBookmarkElement(bookmark, depth = 0, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = `bookmark-item ${bookmark.isFavorite ? "favorited" : ""}`
  div.dataset.id = bookmark.id
  div.draggable = true
  div.style.cssText = `display: flex; align-items: center; gap: 8px; margin: 7px 0; padding: 12px 16px; border: 1px solid transparent; box-shadow: var(--shadow-sm); margin-left: ${
    depth * 20
  }px;`

  div.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", bookmark.id)
    div.style.opacity = "0.5"
  })
  div.addEventListener("dragend", () => (div.style.opacity = "1"))

  const tagsHtml = createTagsHTML(bookmark.tags)
  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""

  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${
      bookmark.id
    }" ${isChecked} style="display: ${checkboxDisplay}; transform: scale(1.2);">
    <div class="bookmark-favicon" style="width: 22px; height: 22px; border-radius: 4px; overflow: hidden; background: white; display: flex; justify-content: center; align-items: center;">
      <img src="${favicon}" style="width: 90%; height: 90%; object-fit: cover;" onerror="this.style.display='none';">
    </div>
    <a href="${
      bookmark.url
    }" target="_blank" class="bookmark-title" style="flex: 1; color: var(--text-primary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
    bookmark.title
  }">
      ${bookmark.title || bookmark.url}
    </a>
    <div class="bookmark-url" style="font-size: 11px; color: var(--text-secondary); opacity: 0.7; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${extractDomain(
      bookmark.url
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
      handleBookmarkLinkClick(bookmark.id, elements)
    )
  attachDropdownToggle(div)
  return div
}

function createBookmarkElement(bookmark, depth = 0, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const favicon = getFaviconUrl(bookmark.url)
  const div = document.createElement("div")
  div.className = "bookmark-item"
  div.style.marginLeft = `${depth * 20}px`

  const checkboxDisplay = uiState.checkboxesVisible ? "inline-block" : "none"
  const isChecked = uiState.selectedBookmarks.has(bookmark.id) ? "checked" : ""

  div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-id="${
      bookmark.id
    }" ${isChecked} style="display: ${checkboxDisplay}">
    <img src="${favicon}" alt="fav" class="favicon">
    <a href="${bookmark.url}" target="_blank" class="link">${
    bookmark.title || bookmark.url
  }</a>
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
      handleBookmarkLinkClick(bookmark.id, elements)
    )
  attachDropdownToggle(div)
  return div
}

// ==========================================
// UTILITY & EVENT FUNCTIONS
// ==========================================

function commonPostRenderOps(elements) {
  // Reset search inputs and filters state
  elements.searchInput.value = uiState.searchQuery || ""
  if (uiState.folders.some((f) => f.id === uiState.selectedFolderId)) {
    elements.folderFilter.value = uiState.selectedFolderId
  } else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
  elements.sortFilter.value = uiState.sortType || "default"

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)

  // --- THÊM ĐOẠN NÀY ĐỂ KÍCH HOẠT NÚT PIN ---
  // Gắn thủ công sự kiện cho nút Pin vì nó chưa được xử lý trong controller
  const pinButtons = elements.folderListDiv.querySelectorAll(".pin-btn")
  pinButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation() // Ngăn sự kiện nổi bọt
      const bookmarkId = btn.getAttribute("data-id")
      togglePin(bookmarkId, elements)

      // Đóng dropdown menu sau khi click
      const dropdownMenu = btn.closest(".dropdown-menu")
      if (dropdownMenu) dropdownMenu.classList.add("hidden")
    })
  })
  // ------------------------------------------
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
        tagFilterDropdown.querySelectorAll('input[type="checkbox"]:checked')
      ).map((cb) => cb.value)
      tagFilterToggle.textContent =
        uiState.selectedTags.length > 0
          ? uiState.selectedTags.join(", ")
          : translations[localStorage.getItem("appLanguage") || "en"].allTags
      customSaveUIState()
      chrome.bookmarks.getTree((tree) =>
        renderFilteredBookmarks(tree, elements)
      )
    }
  }
}

export function attachTreeListeners(elements) {
  const folderListDiv = elements.folderListDiv
  // Remove old listeners to prevent duplicates if any
  const clone = folderListDiv.cloneNode(true)
  folderListDiv.replaceWith(clone)
  elements.folderListDiv = clone // Cập nhật lại tham chiếu mới

  // Re-attach specific handlers
  clone.onclick = (e) => {
    // 1. Xử lý nút Pin (THÊM ĐOẠN NÀY)
    const pinBtn = e.target.closest(".pin-btn")
    if (pinBtn) {
      e.stopPropagation()
      const bookmarkId = pinBtn.dataset.id
      togglePin(bookmarkId, elements)
      // Đóng menu sau khi pin
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
      return
    }

    // 2. Folder Toggle
    const toggle = e.target.closest(".folder-toggle")
    if (toggle) {
      e.stopPropagation()
      const folderDiv = toggle.closest(".folder-item")
      const folderId = folderDiv.dataset.id
      const childrenContainer = folderDiv.nextElementSibling

      if (uiState.collapsedFolders.has(folderId)) {
        uiState.collapsedFolders.delete(folderId)
        toggle.textContent = "−"
        folderDiv.querySelector(".folder-icon").textContent = "📂"
        if (childrenContainer) {
          childrenContainer.style.display = "block"
          if (childrenContainer.innerHTML === "") {
            // Lazy load
            const node = findNodeById(folderId, uiState.bookmarkTree)
            if (node && node.children)
              childrenContainer.appendChild(
                renderTreeView(
                  node.children,
                  elements,
                  parseInt(childrenContainer.getAttribute("data-depth")) || 1
                )
              )
          }
        }
      } else {
        uiState.collapsedFolders.add(folderId)
        toggle.textContent = "+"
        folderDiv.querySelector(".folder-icon").textContent = "📁"
        if (childrenContainer) childrenContainer.style.display = "none"
      }
      customSaveUIState()
      return
    }

    // 3. Dropdown handling
    // Dropdown toggle is handled by attachDropdownToggle attached to individual items.
    // Here we just handle clicking outside to close.
    if (
      !e.target.closest(".dropdown-btn") &&
      !e.target.closest(".dropdown-menu")
    ) {
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((m) => m.classList.add("hidden"))
    }
  }

  // Re-attach other listeners for the cloned element
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
  if (folders.some((f) => f.id === uiState.selectedFolderId))
    elements.folderFilter.value = uiState.selectedFolderId
  else {
    uiState.selectedFolderId = ""
    elements.folderFilter.value = ""
  }
}

function updateBookmarkCount(bookmarks, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  let count = bookmarks.filter((b) => b.url).length
  if (elements.folderFilter.value)
    count = bookmarks.filter(
      (b) => b.url && isInFolder(b, elements.folderFilter.value)
    ).length
  else if (uiState.sortType === "favorites")
    count = bookmarks.filter((b) => b.url && b.isFavorite).length

  elements.bookmarkCountDiv.textContent = `${translations[language].totalBookmarks}: ${count}`
}

function toggleFolderButtons(elements) {
  const isUserCreated =
    uiState.selectedFolderId &&
    uiState.selectedFolderId !== "1" &&
    uiState.selectedFolderId !== "2"
  elements.deleteFolderButton.classList.toggle("hidden", !isUserCreated)
  elements.renameFolderButton.classList.toggle("hidden", !isUserCreated)
}

function sortBookmarks(list, type) {
  // Tách riêng danh sách đã Pin và chưa Pin
  const pinned = list.filter((b) => b.isPinned)
  const unpinned = list.filter((b) => !b.isPinned)

  // Hàm sort nội bộ cho các item chưa pin
  const sortFn = (a, b) => {
    switch (type) {
      case "favorites":
        return (b.dateAdded || 0) - (a.dateAdded || 0) // Logic cũ: favorites chỉ là bộ lọc, ở đây sort theo ngày
      case "default":
      case "new":
        return (b.dateAdded || 0) - (a.dateAdded || 0)
      case "old":
        return (a.dateAdded || 0) - (b.dateAdded || 0)
      case "a-z":
        return (a.title || a.url).localeCompare(b.title || b.url)
      case "z-a":
        return (b.title || b.url).localeCompare(a.title || b.url)
      case "most-visited":
        return (b.accessCount || 0) - (a.accessCount || 0)
      default:
        return (b.dateAdded || 0) - (a.dateAdded || 0)
    }
  }

  // Sort riêng 2 nhóm
  pinned.sort(sortFn)
  unpinned.sort(sortFn)

  // Gộp lại: Pinned luôn ở trên cùng
  return [...pinned, ...unpinned]
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

// Global listener for closing modals
document.querySelectorAll(".close-modal").forEach((btn) => {
  btn.onclick = () => btn.closest(".rename-popup")?.classList.add("hidden")
})

export function togglePin(bookmarkId, elements) {
  chrome.storage.local.get("pinnedBookmarks", (data) => {
    const pinnedBookmarks = data.pinnedBookmarks || {}

    if (pinnedBookmarks[bookmarkId]) {
      delete pinnedBookmarks[bookmarkId]
    } else {
      pinnedBookmarks[bookmarkId] = true
    }

    chrome.storage.local.set({ pinnedBookmarks }, () => {
      // Re-render để cập nhật vị trí
      chrome.bookmarks.getTree((tree) =>
        renderFilteredBookmarks(tree, elements)
      )

      // Hiển thị thông báo nhỏ (Optional)
      const language = localStorage.getItem("appLanguage") || "en"
      const msg = pinnedBookmarks[bookmarkId]
        ? translations[language].pinSuccess || "Pinned to top"
        : translations[language].unpinSuccess || "Unpinned"
      showCustomPopup(msg, "success", false)
    })
  })
}

// Function to handle toggling favorite (used by action listeners)
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
        // Logic to refresh UI if needed
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

// components/ui.js
import { translations } from "./utils.js"
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

export function updateUILanguage(elements, language) {
  const t = translations[language] || translations.en
  elements.folderFilter.querySelector('option[value=""]').textContent =
    t.allBookmarks
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
  elements.renameFolderOption.textContent = t.renameFolder
  elements.editInNewTabOption.textContent = t.editInNewTabOption
  elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
    ? t.hideCheckboxes
    : t.showCheckboxes
  elements.searchInput.placeholder = t.searchPlaceholder
  elements.renamePopup.querySelector("#rename-title").textContent =
    t.renameTitle
  elements.renameInput.placeholder = t.renamePlaceholder
  elements.addToFolderPopup.querySelector("#add-to-folder-title").textContent =
    t.addToFolderTitle
  elements.addToFolderSelect.querySelector('option[value=""]').textContent =
    t.selectFolder
  elements.addToFolderSaveButton.textContent = t.save
  elements.addToFolderCancelButton.textContent = t.cancel
  elements.bookmarkCountDiv.textContent = `${t.totalBookmarks}: ${
    elements.bookmarkCountDiv.textContent.match(/\d+$/)?.[0] || 0
  }`
  elements.scrollToTopButton.title = t.scrollToTop
  elements.scrollToTopButton.setAttribute("aria-label", t.scrollToTop)
  elements.clearRenameButton.setAttribute("aria-label", t.clearRenameAria)
  elements.clearSearchButton.setAttribute("aria-label", t.clearSearchAria)
  elements.settingsButton.setAttribute("aria-label", t.settingsButtonAria)
  elements.renameInput.dataset.errorPlaceholder = t.emptyTitleError
  elements.renameFolderPopup.querySelector("#rename-folder-title").textContent =
    t.renameTitle
  elements.renameFolderSelect.querySelector('option[value=""]').textContent =
    t.selectFolder
  elements.renameFolderInput.placeholder = t.renamePlaceholder
  elements.renameFolderInput.dataset.errorPlaceholder = t.emptyFolderError
  elements.renameFolderInput.dataset.selectFolderError = t.selectFolderError
  localStorage.setItem("appLanguage", language)
}

export function updateTheme(elements, theme) {
  // Define all available themes
  const availableThemes = ["light", "dark", "dracula", "onedark"]

  // Handle system theme detection for light/dark
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  // Clear all theme classes first
  const elementsToUpdate = [
    document.body,
    elements.folderListDiv,
    elements.bookmarkCountDiv,
  ]

  // Remove all existing theme classes
  elementsToUpdate.forEach((element) => {
    if (element) {
      availableThemes.forEach((themeName) => {
        element.classList.remove(`${themeName}-theme`)
      })
      // Remove old light/dark classes
      element.classList.remove("light-theme", "dark-theme")
    }
  })

  // Apply new theme based on selection
  let activeTheme
  switch (theme) {
    case "light":
      activeTheme = "light"
      break
    case "dark":
      activeTheme = "dark"
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

  // Nếu đang chạy trong extension, dùng chrome.runtime.getURL:
  const getAsset = (path) =>
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(path)
      : path

  document.querySelectorAll(".logo").forEach((el) => {
    const src = logoSrcMap[activeTheme] ?? logoSrcMap["light"]
    el.src = getAsset(src)
    // đảm bảo alt luôn có
    if (!el.alt) el.alt = "App logo"
  })

  // Apply theme classes
  elementsToUpdate.forEach((element) => {
    if (element) {
      element.classList.add(`${activeTheme}-theme`)
    }
  })

  // Set data-theme attribute on document root for CSS variables
  document.documentElement.setAttribute("data-theme", activeTheme)

  // Update all UI elements with theme classes
  document
    .querySelectorAll(
      ".input, .select, .button, .rename-popup, .folder-item, .folder-title, .custom-popup"
    )
    .forEach((el) => {
      // Remove all theme classes
      availableThemes.forEach((themeName) => {
        el.classList.remove(`${themeName}-theme`)
      })
      el.classList.remove("light-theme", "dark-theme")

      // Add new theme class
      el.classList.add(`${activeTheme}-theme`)
    })

  // Store current theme in localStorage
  localStorage.setItem("selectedTheme", theme)

  // Trigger custom event for theme change
  window.dispatchEvent(
    new CustomEvent("themeChanged", {
      detail: {
        theme: activeTheme,
        originalSelection: theme,
      },
    })
  )
}

function detectViewContext() {
  // Check if running in a Chrome extension popup (small window)
  const isPopup = window.innerWidth <= 800 && window.innerHeight <= 800 // Adjust thresholds as needed
  const isExtension = typeof chrome !== "undefined" && chrome.runtime?.getURL

  if (!isPopup && isExtension) {
    document.documentElement.classList.add("webview-mode")

    return "webview"
  } else {
    document.documentElement.classList.remove("webview-mode")

    return "popup"
  }
}

export function restoreUIState(elements, callback) {
  detectViewContext() // Detect context and apply class early

  chrome.storage.local.get(["uiState", "checkboxesVisible"], (data) => {
    if (chrome.runtime.lastError) {
      console.error("Error restoring state:", chrome.runtime.lastError)
      callback()
      return
    }
    if (data.uiState) {
      uiState.searchQuery = data.uiState.searchQuery || ""
      uiState.selectedFolderId = data.uiState.selectedFolderId || ""
      uiState.sortType = data.uiState.sortType || "default"
      uiState.viewMode = data.uiState.viewMode || "flat"
      uiState.collapsedFolders = new Set(data.uiState.collapsedFolders || [])
      // Remove root and default folders from collapsedFolders
      ;["0", "1", "2"].forEach((id) => {
        if (uiState.collapsedFolders.has(id)) {
          uiState.collapsedFolders.delete(id)
        }
      })
    }
    uiState.checkboxesVisible = data.checkboxesVisible || false
    const savedLanguage = localStorage.getItem("appLanguage") || "en"
    elements.languageSwitcher.value = savedLanguage
    elements.viewSwitcher.value = uiState.viewMode
    elements.folderFilter.value = uiState.selectedFolderId
    elements.sortFilter.value = uiState.sortType
    elements.searchInput.value = uiState.searchQuery
    updateUILanguage(elements, savedLanguage)
    elements.toggleCheckboxesButton.textContent = uiState.checkboxesVisible
      ? translations[savedLanguage].hideCheckboxes
      : translations[savedLanguage].showCheckboxes
    document
      .querySelectorAll(".bookmark-checkbox, #select-all")
      .forEach((checkbox) => {
        checkbox.style.display = uiState.checkboxesVisible
          ? "inline-block"
          : "none"
      })
    const selectAllContainer = document.querySelector(".select-all")
    if (selectAllContainer) {
      selectAllContainer.style.display = uiState.checkboxesVisible
        ? "block"
        : "none"
    } else {
      console.warn("Select All container (.select-all) not found")
    }
    callback()
  })
}

export function renderFilteredBookmarks(bookmarkTreeNodes, elements) {
  chrome.storage.local.get("favoriteBookmarks", (data) => {
    const favoriteBookmarks = data.favoriteBookmarks || {}

    const addFavoriteStatus = (nodes) => {
      for (const node of nodes) {
        if (node.url) {
          node.isFavorite = !!favoriteBookmarks[node.id]
        }
        if (node.children) {
          addFavoriteStatus(node.children)
        }
      }
    }

    addFavoriteStatus(bookmarkTreeNodes)

    const bookmarks = flattenBookmarks(bookmarkTreeNodes)
    const folders = getFolders(bookmarkTreeNodes)
    setBookmarkTree(bookmarkTreeNodes)
    setBookmarks(bookmarks)
    setFolders(folders)
    populateFolderFilter(folders, elements)
    updateBookmarkCount(bookmarks, elements)
    let filtered = bookmarks

    if (uiState.sortType === "favorites") {
      filtered = filtered.filter((bookmark) => bookmark.isFavorite)
    }

    if (
      uiState.selectedFolderId &&
      uiState.selectedFolderId !== "0" && // Bỏ qua thư mục gốc
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
    } else {
      renderBookmarks(filtered, elements)
    }

    toggleFolderButtons(elements)
    saveUIState()
  })
}

function populateFolderFilter(folders, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  elements.folderFilter.innerHTML = `<option value="">${translations[language].allBookmarks}</option>`
  folders.forEach((folder) => {
    if (folder.id !== "0") {
      // Bỏ qua thư mục gốc
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
    return fragment
  }

  // Root: clear container + add select-all
  if (depth === 0) {
    elements.folderListDiv.innerHTML = ""
    elements.folderListDiv.classList.add("tree-view")

    const selectAllDiv = document.createElement("div")
    selectAllDiv.className = "select-all"
    selectAllDiv.style.display = uiState.checkboxesVisible ? "block" : "none"
    fragment.appendChild(selectAllDiv)
  }

  // If a folder is selected, only render that folder's contents
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

  // Separate folders and bookmarks
  const folders = nodesToRender.filter((node) => node.children)
  const bookmarks = nodesToRender.filter((node) => node.url)

  // Sort bookmarks using sortBookmarks
  const sortedBookmarks = sortBookmarks(bookmarks, uiState.sortType)

  // Sort folders alphabetically
  const sortedFolders = folders.sort((a, b) =>
    (a.title || "").localeCompare(b.title || "")
  )
  const sortedNodes = [...sortedFolders, ...sortedBookmarks]

  sortedNodes.forEach((node) => {
    const folderTitle =
      node.title && node.title.trim() !== "" ? node.title : `Folder ${node.id}`

    // Search filter
    const matchesSearch = uiState.searchQuery
      ? node.title?.toLowerCase().includes(uiState.searchQuery.toLowerCase()) ||
        node.url?.toLowerCase().includes(uiState.searchQuery.toLowerCase())
      : true

    // Favorites filter
    const matchesFavorite =
      uiState.sortType === "favorites" ? node.isFavorite : true

    // --- Folder ---
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

      // Children container
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
      }

      fragment.appendChild(childrenContainer)
    }

    // --- Bookmark ---
    if (node.url && matchesSearch && matchesFavorite) {
      const bookmarkElement = createEnhancedBookmarkElement(node, depth)
      fragment.appendChild(bookmarkElement)
    }
  })

  // Attach listeners at root
  if (depth === 0) {
    elements.folderListDiv.appendChild(fragment)
    attachTreeListeners(elements)
  }

  return fragment
}

// Enhanced bookmark element creation
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

  // Add hover effect with CSS
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
        <hr style="border: none; border-top: 1px solid var(--border-color, #404040); margin: 4px 0;">
        <button class="menu-item favorite-btn" data-id="${bookmark.id}">${
    translations[language].favourite
  }</button>
      </div>
    </div>
  `

  // Show dropdown button on hover
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

// Attach tree-specific event listeners
function attachTreeListeners(elements) {
  // Toggle expand/collapse
  document.querySelectorAll(".folder-toggle").forEach((toggle) => {
    toggle.onclick = (e) => {
      e.stopPropagation()
      const folderDiv = e.target.closest(".folder-item")
      const folderId = folderDiv.dataset.id
      const childrenContainer = folderDiv.nextElementSibling
      const folderIcon = folderDiv.querySelector(".folder-icon")

      if (uiState.collapsedFolders.has(folderId)) {
        // Expand
        uiState.collapsedFolders.delete(folderId)
        e.target.textContent = "−"
        folderIcon.textContent = "📂"

        if (childrenContainer) {
          childrenContainer.style.display = "block"
          // Re-render children if needed
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
            }
          }
        }
      } else {
        // Collapse
        uiState.collapsedFolders.add(folderId)
        e.target.textContent = "+"
        folderIcon.textContent = "📁"

        if (childrenContainer) {
          childrenContainer.style.display = "none"
        }
      }

      // Add smooth transition
      e.target.style.transform = "scale(1.1)"
      setTimeout(() => {
        e.target.style.transform = ""
      }, 150)

      saveUIState()
    }

    // Hover effects for toggle
    toggle.addEventListener("mouseenter", () => {
      toggle.style.background = "var(--text-primary)"
      toggle.style.color = "var(--bg-primary)"
      toggle.style.transform = "scale(1.05)"
    })

    toggle.addEventListener("mouseleave", () => {
      toggle.style.background = "var(--bg-primary)"
      toggle.style.color = "var(--text-primary)"
      toggle.style.transform = ""
    })
  })

  // Favorite button handlers in dropdown
  document.querySelectorAll(".menu-item.favorite-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const bookmarkId = btn.dataset.id
      toggleFavorite(bookmarkId, btn)
      // Hide dropdown after action
      const dropdown = btn.closest(".dropdown-menu")
      if (dropdown) dropdown.classList.add("hidden")
    }
  })

  attachSelectAllListener(elements)
  attachDropdownListeners(elements)
  setupBookmarkActionListeners(elements)
}

// Helper functions
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
      // Update bookmark item styling
      const bookmarkItem = buttonElement.closest(".bookmark-item")
      bookmarkItem.classList.toggle(
        "favorited",
        !!favoriteBookmarks[bookmarkId]
      )

      // Refresh tree if in favorites view
      if (uiState.sortType === "favorites") {
        chrome.bookmarks.getTree((tree) => {
          renderFilteredBookmarks(tree, elements)
        })
      }
    })
  })
}

// Check if node is ancestor of target folder
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
      // Favorites are already filtered, but sort by dateAdded (newest first) for consistency
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

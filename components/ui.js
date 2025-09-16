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
    <option value="new">${t.sortNew}</option>
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
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.body.classList.toggle("light-theme", !isDarkMode)
  document.body.classList.toggle("dark-theme", isDarkMode)
  elements.folderListDiv.classList.toggle("light-theme", !isDarkMode)
  elements.folderListDiv.classList.toggle("dark-theme", isDarkMode)
  elements.bookmarkCountDiv.classList.toggle("light-theme", !isDarkMode)
  elements.bookmarkCountDiv.classList.toggle("dark-theme", isDarkMode)
  document
    .querySelectorAll(
      ".input, .select, .button, .rename-popup, .folder-item, .folder-title"
    )
    .forEach((el) => {
      el.classList.toggle("light-theme", !isDarkMode)
      el.classList.toggle("dark-theme", isDarkMode)
    })
}

export function restoreUIState(elements, callback) {
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
      // Loại bỏ root và folder mặc định khỏi collapsedFolders
      ;["0", "1", "2"].forEach((id) => {
        if (uiState.collapsedFolders.has(id)) {
          uiState.collapsedFolders.delete(id)
          console.log(`Removed folder ${id} from collapsedFolders`)
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
  const bookmarks = flattenBookmarks(bookmarkTreeNodes)
  const folders = getFolders(bookmarkTreeNodes)
  setBookmarkTree(bookmarkTreeNodes)
  setBookmarks(bookmarks)
  setFolders(folders)
  populateFolderFilter(folders, elements)
  updateBookmarkCount(bookmarks, elements)
  let filtered = bookmarks

  if (
    uiState.selectedFolderId &&
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
        bookmark.url?.toLowerCase().includes(uiState.searchQuery.toLowerCase())
    )
  }

  if (uiState.viewMode === "tree") {
    // Start from root's children to skip untitled root
    const rootChildren = bookmarkTreeNodes[0]?.children || []
    renderTreeView(rootChildren, elements)
  } else {
    renderBookmarks(filtered, elements)
  }

  toggleFolderButtons(elements)
  saveUIState()
}

function populateFolderFilter(folders, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  elements.folderFilter.innerHTML = `<option value="">${translations[language].allBookmarks}</option>`
  folders.forEach((folder) => {
    const option = document.createElement("option")
    option.value = folder.id
    option.textContent = folder.title
    elements.folderFilter.appendChild(option)
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
  const language = localStorage.getItem("appLanguage") || "en"
  const fragment = document.createDocumentFragment()
  const selectAllDiv = document.createElement("div")
  selectAllDiv.className = "select-all"
  selectAllDiv.style.display = uiState.checkboxesVisible ? "block" : "none"

  fragment.appendChild(selectAllDiv)

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
  const language = localStorage.getItem("appLanguage") || "en"
  const fragment = document.createDocumentFragment()

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    console.warn("No nodes to render in renderTreeView", { nodes, depth })
    return fragment
  }

  // Clear container + thêm select-all chỉ khi ở cấp root
  if (depth === 0) {
    elements.folderListDiv.innerHTML = ""

    const selectAllDiv = document.createElement("div")
    selectAllDiv.className = "select-all"
    selectAllDiv.style.display = uiState.checkboxesVisible ? "block" : "none"
    fragment.appendChild(selectAllDiv)

    // Sort lại Other Bookmarks: folder trước, bookmark sau (chỉ áp dụng cho ID '1' như trước)
    nodes = nodes.map((n) => {
      if (n.id === "1" && n.children) {
        n.children.sort((a, b) => {
          const aIsFolder = !!a.children
          const bIsFolder = !!b.children
          if (aIsFolder && !bIsFolder) return -1
          if (!aIsFolder && bIsFolder) return 1
          return a.title.localeCompare(b.title)
        })
      }
      return n
    })
  }

  // Sắp xếp node tại cấp độ hiện tại: folder trước, bookmark sau
  const sortedNodes = [...nodes].sort((a, b) => {
    const aIsFolder = !!a.children
    const bIsFolder = !!b.children
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    return a.title.localeCompare(b.title) // Sắp xếp alphabet trong cùng loại
  })

  sortedNodes.forEach((node) => {
    const folderTitle =
      node.title && node.title.trim() !== "" ? node.title : `Folder ${node.id}`

    const matchesSearch = uiState.searchQuery
      ? node.title?.toLowerCase().includes(uiState.searchQuery.toLowerCase()) ||
        node.url?.toLowerCase().includes(uiState.searchQuery.toLowerCase())
      : true

    const matchesFolder = uiState.selectedFolderId
      ? isInFolder(node, uiState.selectedFolderId) ||
        isAncestorOf(node, uiState.selectedFolderId)
      : true

    // Nếu là bookmark
    if (node.url && matchesSearch && matchesFolder) {
      const bookmarkElement = createBookmarkElement(node, depth)
      bookmarkElement.style.marginLeft = `${depth * 5}px`
      fragment.appendChild(bookmarkElement)
    }

    // Nếu là folder
    if (node.children && Array.isArray(node.children)) {
      let isCollapsed = uiState.collapsedFolders.has(node.id)

      const hasMatchingChildren = node.children.some((child) => {
        const childMatchesSearch = uiState.searchQuery
          ? child.title
              ?.toLowerCase()
              .includes(uiState.searchQuery.toLowerCase()) ||
            child.url?.toLowerCase().includes(uiState.searchQuery.toLowerCase())
          : true
        const childMatchesFolder = uiState.selectedFolderId
          ? isInFolder(child, uiState.selectedFolderId)
          : true
        return childMatchesSearch && childMatchesFolder
      })

      if (matchesSearch || matchesFolder || hasMatchingChildren) {
        const folderDiv = document.createElement("div")
        folderDiv.className = "folder-item"
        folderDiv.dataset.id = node.id
        folderDiv.style.marginLeft = `${depth * 5}px`

        const toggleHTML = `<span class="folder-toggle" style="cursor: pointer; margin-right: 5px;">${
          isCollapsed ? "+" : "-"
        }</span>`

        folderDiv.innerHTML = `${toggleHTML}<span class="folder-title">${folderTitle}</span>`
        fragment.appendChild(folderDiv)

        const childrenContainer = document.createElement("div")
        childrenContainer.className = "folder-children"
        childrenContainer.style.marginLeft = `${(depth + 1) * 5}px`
        childrenContainer.style.display = isCollapsed ? "none" : "block"

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
    }
  })

  if (depth === 0) {
    elements.folderListDiv.appendChild(fragment)

    document.querySelectorAll(".folder-toggle").forEach((toggle) => {
      toggle.onclick = (e) => {
        const folderId = e.target.parentElement.dataset.id
        const childrenContainer = e.target.parentElement.nextElementSibling

        if (uiState.collapsedFolders.has(folderId)) {
          uiState.collapsedFolders.delete(folderId)
          e.target.textContent = "-"
          if (childrenContainer) childrenContainer.style.display = "block"
        } else {
          uiState.collapsedFolders.add(folderId)
          e.target.textContent = "+"
          if (childrenContainer) childrenContainer.style.display = "none"
        }
      }
    })

    attachSelectAllListener(elements)
    attachDropdownListeners(elements)
    setupBookmarkActionListeners(elements)
  }

  return fragment
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
    <div class="dropdown-btn-group">
      <button class="dropdown-btn" aria-label="Bookmark options">⋮</button>
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
      </div>
    </div>
  `
  return div
}

function sortBookmarks(bookmarksList, sortType) {
  let sorted = [...bookmarksList]
  switch (sortType) {
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

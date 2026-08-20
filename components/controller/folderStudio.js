// components/controller/folderStudio.js
import {
  translations,
  showCustomPopup,
  showCustomConfirm,
  showCustomPrompt,
  escapeHtml,
} from "../utils/utils.js"
import { uiState } from "../state.js"
import { renderFilteredBookmarks, showMoveFolderToFolderPopup } from "../ui.js"
import { handleDeleteFolder } from "./deleteFolder.js"
import { registerUndo, snapshotBookmarks, restoreDeletedBookmarks } from "../undo.js"

let currentSelectedFolderId = null
let currentActiveTab = "tree"
let folderTreeData = []
let collapsedFolderIds = new Set()
let searchQuery = ""

function getLang() {
  const language = localStorage.getItem("appLanguage") || "en"
  return { language, t: translations[language] || translations.en }
}

function countDirectBookmarks(node) {
  if (!node || !node.children) return 0
  return node.children.filter((c) => c.url).length
}

function countTotalBookmarks(node) {
  if (!node) return 0
  let count = 0
  if (node.url) count++
  if (node.children) {
    node.children.forEach((c) => {
      count += countTotalBookmarks(c)
    })
  }
  return count
}

function findNode(id, nodes) {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(id, node.children)
      if (found) return found
    }
  }
  return null
}

function getFolderPath(id, nodes, path = []) {
  if (!id || id === "0") return path
  const node = findNode(id, nodes)
  if (!node) return path
  path.unshift(node.title || (node.id === "1" ? "Bookmarks Bar" : "Folder"))
  return getFolderPath(node.parentId, nodes, path)
}

function isDescendant(nodeId, targetId, tree) {
  if (nodeId === targetId) return true
  const node = findNode(nodeId, tree)
  if (!node || !node.children) return false
  function check(curr) {
    if (curr.id === targetId) return true
    return curr.children ? curr.children.some((c) => check(c)) : false
  }
  return check(node)
}

async function restoreTree(node, parentId, storageData = {}) {
  return new Promise((resolve) => {
    chrome.bookmarks.create(
      {
        parentId: parentId,
        index: node.index,
        title: node.title,
        url: node.url,
      },
      async (created) => {
        if (node.url) {
          let changed = false
          if (storageData.bookmarkTags?.[node.id]) {
            storageData.bookmarkTags[created.id] = storageData.bookmarkTags[node.id]
            changed = true
          }
          if (storageData.favoriteBookmarks?.[node.id]) {
            storageData.favoriteBookmarks[created.id] = true
            changed = true
          }
          if (storageData.pinnedBookmarks?.[node.id]) {
            storageData.pinnedBookmarks[created.id] = true
            changed = true
          }
          if (changed) {
            await chrome.storage.local.set({
              bookmarkTags: storageData.bookmarkTags,
              favoriteBookmarks: storageData.favoriteBookmarks,
              pinnedBookmarks: storageData.pinnedBookmarks,
            })
          }
        }

        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            await restoreTree(child, created.id, storageData)
          }
        }
        resolve(created)
      },
    )
  })
}

export function openFolderStudio(elements) {
  const popup = document.getElementById("organize-folders-popup")
  const container = document.getElementById("organize-folders-tree-view")
  const closeBtn = document.getElementById("organize-folders-close")
  const titleEl = document.getElementById("organize-folders-title")

  if (!popup || !container) return

  const { t } = getLang()
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-folder-tree" style="margin-right: 8px; color: var(--accent-color, #3B82F6);"></i>${t.folderStudioTitle || "Folder Studio & Organizer"}`
  }
  if (closeBtn) {
    closeBtn.textContent = t.cancel || "Close"
  }

  currentActiveTab = "tree"
  searchQuery = ""

  window.BookmarkCache.getTree((tree) => {
    folderTreeData = tree
    uiState.bookmarkTree = tree

    const rootFolders = tree[0]?.children || []
    if (!currentSelectedFolderId || !findNode(currentSelectedFolderId, tree)) {
      currentSelectedFolderId = rootFolders[0]?.id || "1"
    }

    renderStudioShell(popup, container, elements)
    popup.classList.remove("hidden")
  })

  const closeXBtn = popup.querySelector("#organize-folders-close-x")
  const fullscreenBtn = popup.querySelector("#organize-folders-fullscreen-btn")
  const popupContent = popup.querySelector(".organize-folders-popup-content")

  const closePopup = () => {
    popup.classList.add("hidden")
    window.BookmarkCache.getTree((tree) => {
      renderFilteredBookmarks(tree, elements)
    })
  }

  if (closeBtn) closeBtn.onclick = closePopup
  if (closeXBtn) closeXBtn.onclick = closePopup

  if (fullscreenBtn && popupContent) {
    const isWebview = window.location.pathname.endsWith("/bookmarks.html")
    fullscreenBtn.title = isWebview
      ? (t.fullscreen || "Fullscreen")
      : (t.openInFullTab || "Open in Full Tab")

    fullscreenBtn.onclick = () => {
      if (isWebview) {
        const isFullscreen = popupContent.classList.toggle("is-fullscreen")
        const icon = fullscreenBtn.querySelector("i")
        if (icon) {
          icon.className = isFullscreen ? "fas fa-compress" : "fas fa-expand"
        }
        fullscreenBtn.title = isFullscreen
          ? t.exitFullscreen || "Exit Fullscreen"
          : t.fullscreen || "Fullscreen"
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL("bookmarks.html?open=folderStudio"),
        })
      }
    }
  }

  popup.onclick = (e) => {
    if (e.target === popup) closePopup()
  }
}

function renderStudioShell(popup, container, elements) {
  const { t } = getLang()

  container.innerHTML = `
    <div class="folder-studio-container">
      <div class="folder-studio-tabs">
        <button type="button" class="studio-tab-btn ${currentActiveTab === "tree" ? "active" : ""}" data-tab="tree">
          <i class="fas fa-sitemap"></i>
          <span>${t.tabTreeStudio || "Hierarchy Studio"}</span>
        </button>
        <button type="button" class="studio-tab-btn ${currentActiveTab === "merge" ? "active" : ""}" data-tab="merge">
          <i class="fas fa-code-merge"></i>
          <span>${t.tabMergeDuplicates || "Merge Duplicates"}</span>
        </button>
        <button type="button" class="studio-tab-btn ${currentActiveTab === "sort" ? "active" : ""}" data-tab="sort">
          <i class="fas fa-arrow-down-a-z"></i>
          <span>${t.tabAutoSort || "Auto Sort"}</span>
        </button>
        <button type="button" class="studio-tab-btn ${currentActiveTab === "clean" ? "active" : ""}" data-tab="clean">
          <i class="fas fa-broom"></i>
          <span>${t.tabCleanEmpty || "Clean Empty"}</span>
        </button>
      </div>

      <div class="folder-studio-body" id="folder-studio-body"></div>
    </div>
  `

  container.querySelectorAll(".studio-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentActiveTab = btn.dataset.tab
      container
        .querySelectorAll(".studio-tab-btn")
        .forEach((b) => b.classList.toggle("active", b === btn))
      renderActiveTabContent(elements)
    })
  })

  renderActiveTabContent(elements)
}

function renderActiveTabContent(elements) {
  const body = document.getElementById("folder-studio-body")
  if (!body) return

  if (currentActiveTab === "tree") {
    renderTreeStudioView(body, elements)
  } else if (currentActiveTab === "merge") {
    renderMergeDuplicatesView(body, elements)
  } else if (currentActiveTab === "sort") {
    renderAutoSortView(body, elements)
  } else if (currentActiveTab === "clean") {
    renderCleanEmptyView(body, elements)
  }
}

// ==========================================
// 1. TAB: HIERARCHY TREE STUDIO (SPLIT-VIEW)
// ==========================================
function renderTreeStudioView(body, elements) {
  const { t } = getLang()

  body.innerHTML = `
    <div class="studio-split-view">
      <div class="studio-left-pane">
        <div class="studio-tree-toolbar">
          <div class="studio-search-wrapper">
            <i class="fas fa-search"></i>
            <input type="text" id="studio-folder-search" placeholder="${t.searchFoldersPh || "Filter folders by name..."}" value="${searchQuery}">
            ${searchQuery ? '<button type="button" id="clear-studio-search" class="icon-button"><i class="fas fa-times"></i></button>' : ""}
          </div>
          <div class="studio-toolbar-actions">
            <button type="button" class="studio-mini-btn" id="studio-expand-all" title="${t.expandAll || "Expand All"}">
              <i class="fas fa-angles-down"></i>
            </button>
            <button type="button" class="studio-mini-btn" id="studio-collapse-all" title="${t.collapseAll || "Collapse All"}">
              <i class="fas fa-angles-up"></i>
            </button>
          </div>
        </div>
        <div class="studio-tree-scroll" id="studio-tree-scroll"></div>
      </div>

      <div class="studio-right-pane" id="studio-inspector-pane"></div>
    </div>
  `

  const searchInput = body.querySelector("#studio-folder-search")
  const clearSearchBtn = body.querySelector("#clear-studio-search")
  const expandAllBtn = body.querySelector("#studio-expand-all")
  const collapseAllBtn = body.querySelector("#studio-collapse-all")
  const treeScroll = body.querySelector("#studio-tree-scroll")

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim()
      renderTreeNodes(treeScroll, elements)
    })
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchQuery = ""
      renderTreeStudioView(body, elements)
    })
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      collapsedFolderIds.clear()
      renderTreeNodes(treeScroll, elements)
    })
  }

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", () => {
      function collect(nodes) {
        nodes.forEach((n) => {
          if (n.children) {
            collapsedFolderIds.add(n.id)
            collect(n.children)
          }
        })
      }
      collect(folderTreeData)
      renderTreeNodes(treeScroll, elements)
    })
  }

  renderTreeNodes(treeScroll, elements)
  renderInspector(body.querySelector("#studio-inspector-pane"), elements)
}

function renderTreeNodes(container, elements) {
  if (!container) return
  container.innerHTML = ""

  const rootNodes = folderTreeData[0]?.children || []

  function buildFolderTree(node, depth = 0) {
    if (!node.children) return null

    const isRootFolder = node.id === "1" || node.id === "2" || node.id === "3"
    const directCount = countDirectBookmarks(node)
    const totalCount = countTotalBookmarks(node)
    const hasChildrenFolders = node.children.some((c) => c.children)
    const isCollapsed = collapsedFolderIds.has(node.id)
    const isSelected = currentSelectedFolderId === node.id

    const matchSearch =
      !searchQuery ||
      node.title.toLowerCase().includes(searchQuery) ||
      (node.children &&
        node.children.some(
          (c) => c.title && c.title.toLowerCase().includes(searchQuery),
        ))

    if (!matchSearch && depth > 0) return null

    const itemEl = document.createElement("div")
    itemEl.className = `studio-tree-node ${isSelected ? "selected" : ""}`
    itemEl.style.paddingLeft = `${depth * 16 + 8}px`
    itemEl.dataset.folderId = node.id
    itemEl.draggable = !isRootFolder

    itemEl.innerHTML = `
      <span class="studio-toggle-arrow ${hasChildrenFolders ? (isCollapsed ? "collapsed" : "expanded") : "empty"}">
        ${hasChildrenFolders ? '<i class="fas fa-caret-down"></i>' : ""}
      </span>
      <i class="fas ${isCollapsed ? "fa-folder" : "fa-folder-open"} studio-folder-icon"></i>
      <span class="studio-folder-name" data-tooltip="${escapeHtml(node.title || (node.id === "1" ? "Bookmarks Bar" : "Other Bookmarks"))}">${escapeHtml(node.title || (node.id === "1" ? "Bookmarks Bar" : "Other Bookmarks"))}</span>
      <span class="studio-count-badge" title="${directCount} direct, ${totalCount} total bookmarks">${directCount}</span>
    `

    const toggleArrow = itemEl.querySelector(".studio-toggle-arrow")
    if (hasChildrenFolders && toggleArrow) {
      toggleArrow.addEventListener("click", (e) => {
        e.stopPropagation()
        if (collapsedFolderIds.has(node.id)) {
          collapsedFolderIds.delete(node.id)
        } else {
          collapsedFolderIds.add(node.id)
        }
        renderTreeNodes(container, elements)
      })
    }

    itemEl.addEventListener("click", () => {
      currentSelectedFolderId = node.id
      container
        .querySelectorAll(".studio-tree-node")
        .forEach((el) => el.classList.toggle("selected", el === itemEl))
      renderInspector(document.getElementById("studio-inspector-pane"), elements)
    })

    itemEl.addEventListener("contextmenu", (e) => {
      showStudioFolderContextMenu(e, node, elements)
    })

    // Drag & Drop
    if (!isRootFolder) {
      itemEl.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", node.id)
        itemEl.classList.add("dragging")
      })
      itemEl.addEventListener("dragend", () => {
        itemEl.classList.remove("dragging")
      })
    }

    itemEl.addEventListener("dragover", (e) => {
      e.preventDefault()
      const draggedId = e.dataTransfer.getData("text/plain")
      if (
        draggedId &&
        draggedId !== node.id &&
        !isDescendant(draggedId, node.id, folderTreeData)
      ) {
        itemEl.classList.add("drag-over")
      }
    })

    itemEl.addEventListener("dragleave", () => {
      itemEl.classList.remove("drag-over")
    })

    itemEl.addEventListener("drop", (e) => {
      e.preventDefault()
      itemEl.classList.remove("drag-over")
      const draggedId = e.dataTransfer.getData("text/plain")
      if (
        draggedId &&
        draggedId !== node.id &&
        !isDescendant(draggedId, node.id, folderTreeData)
      ) {
        const draggedNode = findNode(draggedId, folderTreeData)
        const oldParentId = draggedNode?.parentId
        const oldIndex = draggedNode?.index

        const { t } = getLang()
        showCustomConfirm(
          `Move folder "${draggedNode?.title || "Folder"}" into "${node.title || "Folder"}"?`,
          () => {
            chrome.bookmarks.move(draggedId, { parentId: node.id }, () => {
              reloadTreeAndRefresh(elements)

              registerUndo({
                message: `Moved "${draggedNode?.title || "Folder"}"`,
                actionLabel: t.undoAction || "Undo",
                elements: elements,
                undo: async () => {
                  if (oldParentId) {
                    await new Promise((res) => {
                      chrome.bookmarks.move(
                        draggedId,
                        { parentId: oldParentId, index: oldIndex },
                        res,
                      )
                    })
                    reloadTreeAndRefresh(elements)
                  }
                },
              })
            })
          },
        )
      }
    })

    container.appendChild(itemEl)

    if (!isCollapsed && node.children) {
      node.children.forEach((child) => {
        if (child.children) {
          buildFolderTree(child, depth + 1)
        }
      })
    }
  }

  rootNodes.forEach((root) => buildFolderTree(root, 0))
}

function showStudioFolderContextMenu(e, node, elements) {
  e.preventDefault()
  e.stopPropagation()

  currentSelectedFolderId = node.id
  document
    .querySelectorAll(".studio-tree-node")
    .forEach((el) => el.classList.toggle("selected", el.dataset.folderId === node.id))
  renderInspector(document.getElementById("studio-inspector-pane"), elements)

  const existingMenu = document.querySelector(".sidebar-folder-context-menu")
  if (existingMenu) {
    existingMenu.remove()
  }

  const contextMenu = document.createElement("div")
  contextMenu.className = "sidebar-folder-context-menu"
  contextMenu.style.zIndex = "35000"

  const { t } = getLang()
  const isDefaultFolder =
    node.id === "1" || node.id === "2" || node.id === "3" || node.id === "0"

  contextMenu.innerHTML = `
    <div class="context-menu-item" data-action="new-subfolder">
      <i class="fas fa-folder-plus"></i>
      <span>${t.newSubfolder || "New Subfolder"}</span>
    </div>
    <div class="context-menu-item" data-action="move-to-folder">
      <i class="fas fa-folder-open"></i>
      <span>${t.moveToFolder || "Move to Folder"}</span>
    </div>
    ${
      !isDefaultFolder
        ? `
    <div class="context-menu-item" data-action="rename-folder">
      <i class="fas fa-edit"></i>
      <span>${t.renameFolder || "Rename Folder"}</span>
    </div>
    <div class="context-menu-item delete" data-action="delete-folder" style="color: var(--danger-color, #e74c3c);">
      <i class="fas fa-trash"></i>
      <span>${t.deleteFolder || "Delete Folder"}</span>
    </div>
    `
        : ""
    }
  `

  contextMenu.style.position = "fixed"
  let x = e.clientX
  let y = e.clientY
  contextMenu.style.left = `${x}px`
  contextMenu.style.top = `${y}px`

  document.body.appendChild(contextMenu)

  const menuRect = contextMenu.getBoundingClientRect()
  if (x + menuRect.width > window.innerWidth) {
    contextMenu.style.left = `${Math.max(10, window.innerWidth - menuRect.width - 10)}px`
  }
  if (y + menuRect.height > window.innerHeight) {
    contextMenu.style.top = `${Math.max(10, window.innerHeight - menuRect.height - 10)}px`
  }

  contextMenu.addEventListener("click", (menuEvent) => {
    menuEvent.stopPropagation()
    const action = menuEvent.target.closest(".context-menu-item")?.dataset.action

    if (action === "new-subfolder") {
      showCustomPrompt(
        t.promptNewSubfolder || `Create new subfolder inside "${node.title || "Folder"}":`,
        (name) => {
          if (!name || !name.trim()) return
          chrome.bookmarks.create(
            { parentId: node.id, title: name.trim() },
            (newFolder) => {
              collapsedFolderIds.delete(node.id)
              currentSelectedFolderId = newFolder.id
              reloadTreeAndRefresh(elements)
              showCustomPopup(
                t.subfolderCreated || "Subfolder created successfully.",
                "success",
                true,
              )
            },
          )
        },
      )
    } else if (action === "rename-folder") {
      showCustomPrompt(
        t.renameFolder || "Rename Folder",
        node.title || "",
      ).then((newName) => {
        if (newName && newName.trim() && newName.trim() !== node.title) {
          chrome.bookmarks.update(
            node.id,
            { title: newName.trim() },
            () => {
              reloadTreeAndRefresh(elements)
              showCustomPopup(
                t.renameSuccess || "Folder renamed successfully!",
                "success",
                true,
              )
            },
          )
        }
      })
    } else if (action === "move-to-folder") {
      const popupElements = {
        addToFolderPopup: document.getElementById("add-to-folder-popup"),
        addToFolderSelect: document.getElementById("add-to-folder-select"),
        addToFolderSaveButton: document.getElementById("add-to-folder-save"),
        addToFolderCancelButton: document.getElementById("add-to-folder-cancel"),
      }
      if (popupElements.addToFolderPopup) {
        showMoveFolderToFolderPopup(popupElements, node.id)
      } else {
        showMoveFolderToFolderPopup(elements, node.id)
      }
    } else if (action === "delete-folder") {
      handleDeleteFolder(node.id, elements)
      setTimeout(() => reloadTreeAndRefresh(elements), 300)
    }

    contextMenu.remove()
  })

  const closeMenu = (event) => {
    if (!contextMenu.contains(event.target)) {
      contextMenu.remove()
      document.removeEventListener("click", closeMenu)
      document.removeEventListener("contextmenu", closeMenu)
    }
  }

  setTimeout(() => {
    document.addEventListener("click", closeMenu)
    document.addEventListener("contextmenu", closeMenu)
  }, 0)
}

function renderInspector(container, elements) {
  if (!container) return
  const { t } = getLang()

  const node = findNode(currentSelectedFolderId, folderTreeData)
  if (!node) {
    container.innerHTML = `
      <div class="studio-inspector-empty">
        <i class="fas fa-folder-open"></i>
        <p>${t.noFolderSelected || "Select a folder from the tree to view details"}</p>
      </div>
    `
    return
  }

  const isRoot =
    node.id === "1" || node.id === "2" || node.id === "3" || node.id === "0"
  const directBookmarks = (node.children || []).filter((c) => c.url)
  const subFolders = (node.children || []).filter((c) => c.children)
  const path = getFolderPath(node.id, folderTreeData)

  container.innerHTML = `
    <div class="studio-inspector-header">
      <div class="studio-inspector-title-row">
        <div class="studio-inspector-title">
          <i class="fas fa-folder-open"></i>
          <input type="text" id="inspector-folder-name" value="${node.title || ""}" ${isRoot ? "disabled" : ""} />
        </div>
        ${!isRoot ? '<button type="button" class="studio-btn primary-btn small" id="inspector-save-name"><i class="fas fa-check"></i></button>' : ""}
      </div>
      <div class="studio-breadcrumb-trail">
        ${path.map((p, idx) => `<span class="crumb-step">${p}</span>${idx < path.length - 1 ? '<i class="fas fa-chevron-right crumb-sep"></i>' : ""}`).join("")}
      </div>
    </div>

    <div class="studio-inspector-actions">
      <button type="button" class="studio-btn primary-btn" id="inspector-add-subfolder">
        <i class="fas fa-folder-plus"></i>
        <span>${t.newSubfolder || "New Subfolder"}</span>
      </button>
      ${
        !isRoot
          ? `
        <button type="button" class="studio-btn danger-btn" id="inspector-delete-folder">
          <i class="fas fa-trash"></i>
          <span>${t.safeDeleteFolder || "Delete Folder"}</span>
        </button>
      `
          : ""
      }
    </div>

    <div class="studio-inspector-content">
      <div class="studio-content-header">
        <h4>${t.folderBookmarks || "Bookmarks in this folder"} (${directBookmarks.length})</h4>
        <span class="subfolder-count-label">${subFolders.length} subfolders</span>
      </div>

      <div class="studio-bookmark-list">
        ${
          directBookmarks.length === 0
            ? `<div class="studio-empty-list"><p>${t.noBookmarksInFolder || "No bookmarks in this folder"}</p></div>`
            : directBookmarks
                .map((b) => {
                  let hostname = ""
                  try {
                    hostname = new URL(b.url).hostname
                  } catch (e) {
                    hostname = b.url
                  }
                  return `
            <div class="studio-bookmark-row" data-id="${b.id}">
              <img src="https://www.google.com/s2/favicons?sz=32&domain=${hostname}" class="studio-favicon" onerror="this.style.display='none'" />
              <div class="studio-bm-info">
                <a href="${b.url}" target="_blank" class="studio-bm-title" title="${b.title || b.url}">${b.title || b.url}</a>
                <span class="studio-bm-url" title="${b.url}">${b.url}</span>
              </div>
              <button type="button" class="studio-bm-delete-btn" title="${t.delete || "Delete"}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `
                })
                .join("")
        }
      </div>
    </div>
  `

  // Inline rename with confirmation & undo
  const nameInput = container.querySelector("#inspector-folder-name")
  const saveNameBtn = container.querySelector("#inspector-save-name")
  if (nameInput && saveNameBtn && !isRoot) {
    const handleRename = () => {
      const newName = nameInput.value.trim()
      const oldName = node.title
      if (newName && newName !== oldName) {
        showCustomConfirm(
          `Are you sure you want to rename folder "${oldName}" to "${newName}"?`,
          () => {
            chrome.bookmarks.update(node.id, { title: newName }, () => {
              reloadTreeAndRefresh(elements)

              registerUndo({
                message: `Renamed folder "${newName}"`,
                actionLabel: t.undoAction || "Undo",
                elements: elements,
                undo: async () => {
                  await new Promise((res) => {
                    chrome.bookmarks.update(node.id, { title: oldName }, res)
                  })
                  reloadTreeAndRefresh(elements)
                },
              })
            })
          },
          () => {
            nameInput.value = oldName
          },
        )
      }
    }
    saveNameBtn.addEventListener("click", handleRename)
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleRename()
    })
  }

  // Add Subfolder with prompt, confirm & undo
  const addSubfolderBtn = container.querySelector("#inspector-add-subfolder")
  if (addSubfolderBtn) {
    addSubfolderBtn.addEventListener("click", async () => {
      const folderName = await showCustomPrompt(
        t.newFolderPlaceholder || "Enter folder name:",
      )
      if (folderName && folderName.trim()) {
        const name = folderName.trim()
        showCustomConfirm(
          `Create new subfolder "${name}" inside "${node.title || "Folder"}"?`,
          () => {
            chrome.bookmarks.create(
              { parentId: node.id, title: name },
              (created) => {
                reloadTreeAndRefresh(elements)

                registerUndo({
                  message: `Created subfolder "${name}"`,
                  actionLabel: t.undoAction || "Undo",
                  elements: elements,
                  undo: async () => {
                    await new Promise((res) => {
                      chrome.bookmarks.removeTree(created.id, res)
                    })
                    reloadTreeAndRefresh(elements)
                  },
                })
              },
            )
          },
        )
      }
    })
  }

  // Delete Folder with confirmation & full undo
  const deleteFolderBtn = container.querySelector("#inspector-delete-folder")
  if (deleteFolderBtn && !isRoot) {
    deleteFolderBtn.addEventListener("click", async () => {
      const totalItems = countTotalBookmarks(node)
      const folderNode = (await new Promise((res) =>
        chrome.bookmarks.getSubTree(node.id, (sub) => res(sub?.[0])),
      )) || node

      const storageData = await chrome.storage.local.get([
        "bookmarkTags",
        "favoriteBookmarks",
        "pinnedBookmarks",
      ])
      storageData.bookmarkTags = storageData.bookmarkTags || {}
      storageData.favoriteBookmarks = storageData.favoriteBookmarks || {}
      storageData.pinnedBookmarks = storageData.pinnedBookmarks || {}

      if (totalItems === 0) {
        showCustomConfirm(
          t.deleteFolderConfirm || `Delete empty folder "${node.title}"?`,
          () => {
            chrome.bookmarks.removeTree(node.id, () => {
              currentSelectedFolderId = node.parentId || "1"
              reloadTreeAndRefresh(elements)

              registerUndo({
                message: `Deleted folder "${node.title}"`,
                actionLabel: t.undoAction || "Undo",
                elements: elements,
                undo: async () => {
                  await restoreTree(folderNode, folderNode.parentId, storageData)
                  reloadTreeAndRefresh(elements)
                },
              })
            })
          },
        )
        return
      }

      showCustomConfirm(
        `Are you sure you want to delete folder "${node.title}" and all its ${totalItems} bookmarks?`,
        () => {
          chrome.bookmarks.removeTree(node.id, () => {
            currentSelectedFolderId = node.parentId || "1"
            reloadTreeAndRefresh(elements)

            registerUndo({
              message: `Deleted folder "${node.title}" (${totalItems} bookmarks)`,
              actionLabel: t.undoAction || "Undo",
              elements: elements,
              undo: async () => {
                await restoreTree(folderNode, folderNode.parentId, storageData)
                reloadTreeAndRefresh(elements)
              },
            })
          })
        },
      )
    })
  }

  // Delete individual bookmark with confirmation & undo
  container.querySelectorAll(".studio-bookmark-row").forEach((row) => {
    const delBtn = row.querySelector(".studio-bm-delete-btn")
    const bmId = row.dataset.id
    if (delBtn && bmId) {
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const bmNode = findNode(bmId, folderTreeData)
        const bmTitle = bmNode?.title || "Bookmark"

        showCustomConfirm(
          `Are you sure you want to delete bookmark "${bmTitle}"?`,
          async () => {
            const snapshots = await snapshotBookmarks([bmId])
            chrome.bookmarks.remove(bmId, () => {
              reloadTreeAndRefresh(elements)

              registerUndo({
                message: `Deleted "${bmTitle}"`,
                actionLabel: t.undoAction || "Undo",
                elements: elements,
                undo: async () => {
                  await restoreDeletedBookmarks(snapshots)
                  reloadTreeAndRefresh(elements)
                },
              })
            })
          },
        )
      })
    }
  })
}

// ==========================================
// 2. TAB: MERGE DUPLICATE FOLDERS
// ==========================================
function renderMergeDuplicatesView(body, elements) {
  const { t } = getLang()

  // Collect all folders
  const allFolders = []
  function collect(nodes) {
    nodes.forEach((n) => {
      if (
        n.children &&
        n.id !== "0" &&
        n.id !== "1" &&
        n.id !== "2" &&
        n.id !== "3"
      ) {
        allFolders.push({
          id: n.id,
          title: (n.title || "").trim(),
          parentId: n.parentId,
          node: n,
          path: getFolderPath(n.id, folderTreeData).join(" / "),
          bookmarksCount: countDirectBookmarks(n),
        })
      }
      if (n.children) collect(n.children)
    })
  }
  collect(folderTreeData)

  // Group by lowercase title
  const groups = {}
  allFolders.forEach((f) => {
    if (!f.title) return
    const key = f.title.toLowerCase()
    groups[key] = groups[key] || []
    groups[key].push(f)
  })

  const duplicateGroups = Object.entries(groups).filter(
    ([_, list]) => list.length > 1,
  )

  body.innerHTML = `
    <div class="studio-single-pane">
      <div class="studio-pane-header">
        <div>
          <h3>${t.tabMergeDuplicates || "Merge Duplicates"}</h3>
          <p>${t.mergeFoldersDesc || "Find and merge duplicate folders across branches into one single folder."}</p>
        </div>
      </div>

      <div class="studio-merge-list">
        ${
          duplicateGroups.length === 0
            ? `
          <div class="studio-success-state">
            <i class="fas fa-circle-check" style="font-size: 2.5rem; color: #10B981; margin-bottom: 12px;"></i>
            <h4>${t.noDuplicateFoldersFound || "No duplicate folders found! Your folder structure is tidy."}</h4>
          </div>
        `
            : duplicateGroups
                .map(([name, folders]) => {
                  return `
              <div class="studio-duplicate-card" data-name="${name}">
                <div class="studio-duplicate-card-header">
                  <div class="studio-dup-title">
                    <i class="fas fa-folder-tree"></i>
                    <strong>"${folders[0].title}"</strong>
                    <span class="studio-dup-badge">${folders.length} ${t.duplicateGroupFound || "folders with this name"}</span>
                  </div>
                </div>
                <div class="studio-dup-candidates">
                  ${folders
                    .map(
                      (f, idx) => `
                    <div class="studio-candidate-row">
                      <input type="radio" name="target-${name}" id="target-${f.id}" value="${f.id}" ${idx === 0 ? "checked" : ""} />
                      <label for="target-${f.id}">
                        <span class="cand-path">${f.path}</span>
                        <span class="cand-count">(${f.bookmarksCount} bookmarks)</span>
                      </label>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
                <div class="studio-card-footer">
                  <button type="button" class="studio-btn primary-btn btn-run-merge" data-group="${name}">
                    <i class="fas fa-code-merge"></i>
                    <span>${t.mergeIntoThis || "Merge into selected destination"}</span>
                  </button>
                </div>
              </div>
            `
                })
                .join("")
        }
      </div>
    </div>
  `

  body.querySelectorAll(".btn-run-merge").forEach((btn) => {
    btn.addEventListener("click", () => {
      const groupName = btn.dataset.group
      const checkedRadio = body.querySelector(
        `input[name="target-${groupName}"]:checked`,
      )
      if (!checkedRadio) return

      const targetId = checkedRadio.value
      const folderList = groups[groupName]
      const targetFolder = folderList.find((f) => f.id === targetId)
      const sourceFolders = folderList.filter((f) => f.id !== targetId)

      showCustomConfirm(
        `Merge ${sourceFolders.length} duplicate folder(s) into "${targetFolder?.path}"? All bookmarks will be moved and duplicate folders removed.`,
        async () => {
          // Snapshot source folder tree structures and storage data
          const snapshots = []
          for (const src of sourceFolders) {
            const subTree = await new Promise((res) =>
              chrome.bookmarks.getSubTree(src.id, (tree) => res(tree?.[0])),
            )
            if (subTree) snapshots.push(subTree)
          }

          const storageData = await chrome.storage.local.get([
            "bookmarkTags",
            "favoriteBookmarks",
            "pinnedBookmarks",
          ])

          // Move all bookmarks from sources to target, then delete source folders
          const moveOps = []
          sourceFolders.forEach((src) => {
            const children = src.node.children || []
            children.forEach((c) => {
              moveOps.push(
                new Promise((res) => {
                  chrome.bookmarks.move(c.id, { parentId: targetId }, res)
                }),
              )
            })
          })

          Promise.all(moveOps).then(() => {
            const removeOps = sourceFolders.map(
              (src) =>
                new Promise((res) => {
                  chrome.bookmarks.removeTree(src.id, res)
                }),
            )

            Promise.all(removeOps).then(() => {
              showCustomPopup(
                t.mergeSuccess || "Folders merged successfully!",
                "success",
              )
              reloadTreeAndRefresh(elements)

              registerUndo({
                message: `Merged duplicate folders "${groupName}"`,
                actionLabel: t.undoAction || "Undo",
                elements: elements,
                undo: async () => {
                  for (const snap of snapshots) {
                    await restoreTree(snap, snap.parentId, storageData)
                  }
                  reloadTreeAndRefresh(elements)
                },
              })
            })
          })
        },
      )
    })
  })
}

// ==========================================
// 3. TAB: AUTO SORT FOLDERS & BOOKMARKS
// ==========================================
function renderAutoSortView(body, elements) {
  const { t } = getLang()

  body.innerHTML = `
    <div class="studio-single-pane">
      <div class="studio-pane-header">
        <div>
          <h3>${t.tabAutoSort || "Auto Sort"}</h3>
          <p>${t.autoSortDesc || "Sort folders and bookmarks in alphabetical order or by items count."}</p>
        </div>
      </div>

      <div class="studio-sort-grid">
        <div class="studio-sort-card">
          <div class="sort-card-icon"><i class="fas fa-arrow-down-a-z"></i></div>
          <h4>${t.sortAlphabeticalAZ || "Sort A → Z (Alphabetical)"}</h4>
          <p>Sorts all items inside folders alphabetically from A to Z (folders prioritized first).</p>
          <button type="button" class="studio-btn primary-btn btn-apply-sort" data-sort="az">
            <span>Apply A → Z</span>
          </button>
        </div>

        <div class="studio-sort-card">
          <div class="sort-card-icon"><i class="fas fa-arrow-down-z-a"></i></div>
          <h4>${t.sortAlphabeticalZA || "Sort Z → A (Reverse)"}</h4>
          <p>Sorts all items inside folders in reverse alphabetical order from Z to A.</p>
          <button type="button" class="studio-btn primary-btn btn-apply-sort" data-sort="za">
            <span>Apply Z → A</span>
          </button>
        </div>

        <div class="studio-sort-card">
          <div class="sort-card-icon"><i class="fas fa-arrow-down-wide-short"></i></div>
          <h4>${t.sortByItemCount || "Sort by Item Count"}</h4>
          <p>Sorts subfolders putting folders with the most bookmarks at the top.</p>
          <button type="button" class="studio-btn primary-btn btn-apply-sort" data-sort="count">
            <span>Apply By Count</span>
          </button>
        </div>
      </div>
    </div>
  `

  body.querySelectorAll(".btn-apply-sort").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.sort
      const modeLabel =
        mode === "az" ? "A → Z" : mode === "za" ? "Z → A" : "Item Count"

      showCustomConfirm(
        `Are you sure you want to sort all folders by ${modeLabel}?`,
        async () => {
          btn.disabled = true
          btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sorting...`

          // Snapshot original child orders
          const originalOrder = []
          function captureOrder(node) {
            if (node.children) {
              originalOrder.push({
                parentId: node.id,
                childIds: node.children.map((c) => c.id),
              })
              node.children.forEach(captureOrder)
            }
          }
          captureOrder(folderTreeData[0])

          await sortAllFolderNodes(folderTreeData[0], mode)

          showCustomPopup(
            t.sortSuccess || "Folders sorted successfully!",
            "success",
          )
          reloadTreeAndRefresh(elements)

          registerUndo({
            message: `Sorted folders (${modeLabel})`,
            actionLabel: t.undoAction || "Undo",
            elements: elements,
            undo: async () => {
              for (const item of originalOrder) {
                for (let i = 0; i < item.childIds.length; i++) {
                  await new Promise((res) => {
                    chrome.bookmarks.move(
                      item.childIds[i],
                      { index: i },
                      () => res(),
                    )
                  })
                }
              }
              reloadTreeAndRefresh(elements)
            },
          })
        },
      )
    })
  })
}

async function sortAllFolderNodes(parentNode, mode) {
  if (!parentNode || !parentNode.children) return

  const children = parentNode.children.slice()

  children.sort((a, b) => {
    const aIsFolder = !a.url
    const bIsFolder = !b.url
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1

    if (mode === "az") {
      return (a.title || "").localeCompare(b.title || "")
    } else if (mode === "za") {
      return (b.title || "").localeCompare(a.title || "")
    } else if (mode === "count") {
      const countA = countTotalBookmarks(a)
      const countB = countTotalBookmarks(b)
      return countB - countA
    }
    return 0
  })

  // Reorder in Chrome Bookmarks
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.index !== i) {
      await new Promise((res) => {
        chrome.bookmarks.move(child.id, { index: i }, () => res())
      })
    }
    if (child.children) {
      await sortAllFolderNodes(child, mode)
    }
  }
}

// ==========================================
// 4. TAB: CLEAN EMPTY FOLDERS
// ==========================================
function renderCleanEmptyView(body, elements) {
  const { t } = getLang()

  const emptyFolders = []
  function findEmpty(nodes) {
    nodes.forEach((n) => {
      if (
        n.children &&
        n.id !== "0" &&
        n.id !== "1" &&
        n.id !== "2" &&
        n.id !== "3"
      ) {
        const total = countTotalBookmarks(n)
        if (total === 0) {
          emptyFolders.push({
            id: n.id,
            title: n.title || "Untitled Folder",
            parentId: n.parentId,
            index: n.index,
            path: getFolderPath(n.id, folderTreeData).join(" / "),
          })
        }
      }
      if (n.children) findEmpty(n.children)
    })
  }
  findEmpty(folderTreeData)

  body.innerHTML = `
    <div class="studio-single-pane">
      <div class="studio-pane-header">
        <div>
          <h3>${t.tabCleanEmpty || "Clean Empty"}</h3>
          <p>${t.emptyFoldersDesc || "Quickly find and remove all empty folders that contain no bookmarks or subfolders."}</p>
        </div>
        ${
          emptyFolders.length > 0
            ? `
          <button type="button" class="studio-btn danger-btn" id="btn-clean-all-empty">
            <i class="fas fa-trash-can"></i>
            <span>${t.cleanAllEmptyBtn || "Delete All Empty Folders"} (${emptyFolders.length})</span>
          </button>
        `
            : ""
        }
      </div>

      <div class="studio-empty-folders-list">
        ${
          emptyFolders.length === 0
            ? `
          <div class="studio-success-state">
            <i class="fas fa-circle-check" style="font-size: 2.5rem; color: #10B981; margin-bottom: 12px;"></i>
            <h4>${t.noDuplicateFoldersFound || "No empty folders found! Everything is clean."}</h4>
          </div>
        `
            : `
          <div class="studio-empty-items-grid">
            ${emptyFolders
              .map(
                (f) => `
              <div class="studio-empty-item-card" data-id="${f.id}">
                <div class="empty-item-info">
                  <i class="far fa-folder-open"></i>
                  <div>
                    <strong>${f.title}</strong>
                    <span>${f.path}</span>
                  </div>
                </div>
                <button type="button" class="studio-btn danger-btn small btn-delete-single-empty" data-id="${f.id}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `,
              )
              .join("")}
          </div>
        `
        }
      </div>
    </div>
  `

  const cleanAllBtn = body.querySelector("#btn-clean-all-empty")
  if (cleanAllBtn) {
    cleanAllBtn.addEventListener("click", () => {
      showCustomConfirm(
        `Are you sure you want to delete all ${emptyFolders.length} empty folders?`,
        () => {
          const folderSnapshots = [...emptyFolders]
          const deleteOps = emptyFolders.map(
            (f) =>
              new Promise((res) => {
                chrome.bookmarks.removeTree(f.id, res)
              }),
          )

          Promise.all(deleteOps).then(() => {
            showCustomPopup(
              t.cleanEmptySuccess || "Empty folders cleaned successfully!",
              "success",
            )
            reloadTreeAndRefresh(elements)

            registerUndo({
              message: `Deleted ${folderSnapshots.length} empty folders`,
              actionLabel: t.undoAction || "Undo",
              elements: elements,
              undo: async () => {
                for (const f of folderSnapshots) {
                  await new Promise((res) => {
                    chrome.bookmarks.create(
                      { parentId: f.parentId, title: f.title, index: f.index },
                      res,
                    )
                  })
                }
                reloadTreeAndRefresh(elements)
              },
            })
          })
        },
      )
    })
  }

  body.querySelectorAll(".btn-delete-single-empty").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fId = btn.dataset.id
      const fNode = emptyFolders.find((f) => f.id === fId)
      if (!fNode) return

      showCustomConfirm(`Delete empty folder "${fNode.title}"?`, () => {
        chrome.bookmarks.remove(fId, () => {
          reloadTreeAndRefresh(elements)

          registerUndo({
            message: `Deleted empty folder "${fNode.title}"`,
            actionLabel: t.undoAction || "Undo",
            elements: elements,
            undo: async () => {
              await new Promise((res) => {
                chrome.bookmarks.create(
                  {
                    parentId: fNode.parentId,
                    title: fNode.title,
                    index: fNode.index,
                  },
                  res,
                )
              })
              reloadTreeAndRefresh(elements)
            },
          })
        })
      })
    })
  })
}

function reloadTreeAndRefresh(elements) {
  window.BookmarkCache.getTree((tree) => {
    folderTreeData = tree
    uiState.bookmarkTree = tree
    renderActiveTabContent(elements)
    if (elements) {
      renderFilteredBookmarks(tree, elements)
    }
  })
}

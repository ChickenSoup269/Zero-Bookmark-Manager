const form = document.getElementById("quick-save-form")
const titleInput = document.getElementById("title")
const urlInput = document.getElementById("url")
// Removed folderSelect
const tagsHiddenInput = document.getElementById("tags")
const tagsInput = document.getElementById("tags-input")
const tagsContainer = document.getElementById("tags-container")
const notesInput = document.getElementById("notes")
const saveButton = document.getElementById("save")
const statusBox = document.getElementById("status")
const openDashboardButton = document.getElementById("open-dashboard")
const quickOpenActionSelect = document.getElementById("quick-open-action")

// Hide header and adjust padding if embedded in the main dashboard
const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "true";
if (isEmbedded) {
    document.body.classList.add("embedded");
    const header = document.querySelector(".quick-save-header");
    if (header) header.style.display = "none";
    const actionGroup = document.getElementById("quick-open-action-group");
    if (actionGroup && actionGroup.parentElement) {
        actionGroup.parentElement.style.display = "none";
    }

    // Auto resize iframe height based on content to avoid internal scrollbar and jumping
    let lastHeight = 0;
    const updateHeight = () => {
        if (window.parent) {
            const frame = window.parent.document.getElementById("quick-save-frame");
            const shell = document.querySelector(".quick-save-shell");
            if (frame && shell) {
                // Get the actual height of the content plus some padding buffer
                const newHeight = shell.offsetHeight + 24; 
                if (Math.abs(newHeight - lastHeight) > 2) {
                    lastHeight = newHeight;
                    frame.style.height = newHeight + "px";
                }
            }
        }
    };
    
    // Use ResizeObserver on the content container instead of body to prevent layout thrashing
    const shell = document.querySelector(".quick-save-shell");
    if (shell) {
        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(shell);
    }
    
    window.addEventListener("load", updateHeight);
    setTimeout(updateHeight, 100);
}

const qsTranslations = {
  en: {
    qsTitle: "Quick Save",
    qsDesc: "Save the current page with tags and notes.",
    qsAction: "Click Extension Action",
    btnQuickSave: "Quick Save",
    btnPopup: "Popup",
    btnPanel: "Panel",
    btnFull: "Full",
    lblTitle: "Title",
    lblUrl: "URL",
    lblFolder: "Folder",
    lblTags: "Tags",
    btnSuggestText: "Suggest",
    phTags: "Type and press Enter...",
    lblNotes: "Notes",
    phNotes: "Why this page matters, what to revisit, or any context you need later.",
    btnSaveBookmark: "Save Bookmark",
    statusNoSourceTab: "No source tab specified.",
    phNewFolder: "New folder name...",
    phSearchFolder: "Search folders...",
    lblSelectFolder: "Select Folder",
    statusErrorContext: "Cannot save special browser pages.",
    statusNoPage: "No active page found to save.",
    statusAlreadySaved: "Bookmark already exists.",
    statusSaving: "Saving bookmark...",
    statusErrorSave: "Error saving bookmark.",
    statusErrorMeta: "Error saving tags/notes.",
    statusUpdatedSuccess: "Updated successfully! ({0} tags)",
    statusSavedSuccess: "Saved successfully! ({0} tags)"
  },
  vi: {
    qsTitle: "Lưu Nhanh",
    qsDesc: "Lưu trang hiện tại kèm theo thẻ và ghi chú.",
    qsAction: "Hành động mở Extension",
    btnQuickSave: "Lưu Nhanh",
    btnPopup: "Cửa sổ Popup",
    btnPanel: "Bảng bên",
    btnFull: "Toàn trang",
    lblTitle: "Tiêu đề",
    lblUrl: "Đường dẫn",
    lblFolder: "Thư mục",
    lblTags: "Thẻ (Tags)",
    btnSuggestText: "Gợi ý",
    phTags: "Nhập và nhấn Enter...",
    lblNotes: "Ghi chú",
    phNotes: "Tại sao trang này quan trọng, cần xem lại gì, hoặc bất kỳ ngữ cảnh nào cần lưu lại.",
    btnSaveBookmark: "Lưu Bookmark",
    statusNoSourceTab: "Không tìm thấy tab nguồn.",
    phNewFolder: "Tên thư mục mới...",
    phSearchFolder: "Tìm kiếm thư mục...",
    lblSelectFolder: "Chọn thư mục",
    statusErrorContext: "Không thể lưu các trang hệ thống của trình duyệt.",
    statusNoPage: "Không tìm thấy trang nào để lưu.",
    statusAlreadySaved: "Trang này đã được lưu từ trước.",
    statusSaving: "Đang lưu bookmark...",
    statusErrorSave: "Lỗi khi lưu bookmark.",
    statusErrorMeta: "Lỗi khi lưu thẻ/ghi chú.",
    statusUpdatedSuccess: "Đã cập nhật thành công! ({0} thẻ)",
    statusSavedSuccess: "Đã lưu thành công! ({0} thẻ)"
  }
};

let currentTab = null
let existingBookmark = null
let preferredFolderId = "1"
let currentTags = []

const AVAILABLE_THEMES = [
  "light",
  "dark",
  "dracula",
  "onedark",
  "tokyonight",
  "nord",
  "synthwave",
  "gruvbox",
  "catppuccin",
  "nightowl",
  "nord-light",
  "gruvbox-light",
  "catppuccin-light",
  "nightowl-light",
  "monokai",
  "winter-is-coming",
  "github-blue",
  "github-light",
  "tet",
]

function resolveActiveTheme(theme) {
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  if (theme === "system") return isDarkMode ? "dark" : "light"
  return AVAILABLE_THEMES.includes(theme) ? theme : "light"
}

function applyTheme(theme) {
  const activeTheme = resolveActiveTheme(theme)

  AVAILABLE_THEMES.forEach((themeName) => {
    document.body.classList.remove(`${themeName}-theme`)
  })
  document.body.classList.remove("light-theme", "dark-theme")
  document.body.classList.add(`${activeTheme}-theme`)
  document.documentElement.setAttribute("data-theme", activeTheme)

  const lightThemes = new Set([
    "light",
    "github-light",
    "nord-light",
    "gruvbox-light",
    "catppuccin-light",
    "nightowl-light",
  ])
  document.documentElement.style.colorScheme = lightThemes.has(activeTheme)
    ? "light"
    : "dark"
}

function initTheme() {
  applyTheme(localStorage.getItem("appTheme") || "system")

  window.addEventListener("storage", (event) => {
    if (event.key === "appTheme") {
      applyTheme(event.newValue || "system")
    }
  })

  window.addEventListener("themeChanged", (event) => {
    const selection =
      event.detail?.originalSelection || event.detail?.theme || "system"
    applyTheme(selection)
  })

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if ((localStorage.getItem("appTheme") || "system") === "system") {
        applyTheme("system")
      }
    })
}

function getSourceTabId() {
  const params = new URLSearchParams(window.location.search)
  const tabId = Number.parseInt(params.get("tabId") || "", 10)
  return Number.isFinite(tabId) ? tabId : null
}

function showStatus(message, type = "") {
  statusBox.textContent = message
  statusBox.className = `status ${type}`.trim()
  statusBox.classList.remove("hidden")
}

function parseTags(value) {
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function flattenFolders(nodes, prefix = "", folders = []) {
  const folderNodes = nodes.filter(n => n.children)
  folderNodes.forEach((node, index) => {
    const isLast = index === folderNodes.length - 1
    let currentPrefix = prefix
    let nextPrefix = prefix
    
    if (node.id !== "0") {
      currentPrefix = prefix + (isLast ? "└─ " : "├─ ")
      nextPrefix = prefix + (isLast ? "\u00A0\u00A0\u00A0" : "│\u00A0\u00A0")
    }
    
    folders.push({ id: node.id, title: node.title || "Bookmarks", prefix: currentPrefix })
    flattenFolders(node.children, nextPrefix, folders)
  })
  return folders
}

function fillFolders() {
  chrome.bookmarks.getTree((tree) => {
    const folders = flattenFolders(tree)
    const folderList = document.getElementById("folder-list")
    folderList.innerHTML = ""
    
    folders
      .filter((folder) => folder.id !== "0")
      .forEach((folder) => {
        const item = document.createElement("div")
        item.className = "folder-tree-item"
        if (folder.id === preferredFolderId) {
          item.classList.add("active")
        }
        
        const icon = document.createElement("i")
        icon.className = "fas fa-folder"
        
        const text = document.createTextNode(folder.title)
        
        if (folder.prefix) {
          const prefixSpan = document.createElement("span")
          prefixSpan.style.fontFamily = "monospace"
          prefixSpan.style.whiteSpace = "pre"
          prefixSpan.textContent = folder.prefix
          item.appendChild(prefixSpan)
        }
        item.appendChild(icon)
        item.appendChild(text)
        
        item.addEventListener("click", () => {
          document.querySelectorAll(".folder-tree-item").forEach(el => el.classList.remove("active"))
          item.classList.add("active")
          preferredFolderId = folder.id
          fillFolders()
          if (typeof toggleFolderView === "function") {
            toggleFolderView(false)
          }
        })
        
        folderList.appendChild(item)
      })

    const bookmarksBar = folders.find((folder) => folder.id === "1")
    if (bookmarksBar && preferredFolderId === "1") {
      preferredFolderId = bookmarksBar.id
      const barItem = Array.from(folderList.children).find(el => el.textContent.includes(bookmarksBar.title))
      if (barItem && !folderList.querySelector(".active")) {
        barItem.classList.add("active")
      }
    }
    
    // Update the button text to show selected folder
    const activeItem = folderList.querySelector(".active")
    const selectedDisplayName = document.getElementById("selected-folder-name-display")
    if (activeItem && selectedDisplayName) {
      // Find the text node inside the active item (skip prefix span and icon)
      const textNode = Array.from(activeItem.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0)
      if (textNode) {
        selectedDisplayName.textContent = textNode.textContent
      } else {
        selectedDisplayName.textContent = activeItem.textContent.trim()
      }
    }
    
    // Auto scroll to active item
    if (activeItem) {
      setTimeout(() => activeItem.scrollIntoView({ block: "nearest" }), 10)
    }
  })
}

function fillExistingMetadata(bookmarkId) {
  chrome.storage.local.get(["bookmarkTags", "bookmarkNotes", "tagColors", "tagTextColors"], (data) => {
    const tags = data.bookmarkTags?.[bookmarkId] || []
    const note = data.bookmarkNotes?.[bookmarkId] || ""
    if (data.tagColors) tagColorsCache = data.tagColors
    if (data.tagTextColors) tagTextColorsCache = data.tagTextColors
    currentTags = [...tags]
    renderTags()
    notesInput.value = note
  })
}

function populateFromTab(tab) {
  if (chrome.runtime.lastError || !tab?.url) {
    showStatus(tStatus("statusNoPage"), "error")
    saveButton.disabled = true
    return
  }

  currentTab = tab
  titleInput.value = tab.title || tab.url
  urlInput.value = tab.url

  if (/^(chrome|edge|about|chrome-extension):\/\//i.test(tab.url)) {
    showStatus(
      tStatus("statusErrorContext"),
      "error",
    )
    saveButton.disabled = true
    return
  }

  chrome.bookmarks.search({ url: tab.url }, (matches) => {
    existingBookmark = matches?.[0] || null
    if (existingBookmark) {
      titleInput.value = existingBookmark.title || titleInput.value
      if (existingBookmark.parentId) {
        preferredFolderId = existingBookmark.parentId
        fillFolders()
      }
      fillExistingMetadata(existingBookmark.id)
      showStatus(
        tStatus("statusAlreadySaved"),
        "success",
      )
    }
  })
}

function loadCurrentTab() {
  const tabId = getSourceTabId()
  if (!tabId) {
    showStatus(tStatus("statusNoSourceTab"), "error")
    saveButton.disabled = true
    return
  }

  chrome.tabs.get(tabId, populateFromTab)
}

function saveMetadata(bookmarkId, tags, note, callback) {
  chrome.storage.local.get(["bookmarkTags", "bookmarkNotes", "tagColors", "tagTextColors"], (data) => {
    const bookmarkTags = data.bookmarkTags || {}
    const bookmarkNotes = data.bookmarkNotes || {}
    const tagColors = data.tagColors || {}
    const tagTextColors = data.tagTextColors || {}

    if (tags.length) {
      bookmarkTags[bookmarkId] = tags
      tags.forEach((tag) => {
        if (!tagColors[tag]) tagColors[tag] = "#3B82F6"
        if (!tagTextColors[tag]) tagTextColors[tag] = "#FFFFFF"
      })
    } else {
      delete bookmarkTags[bookmarkId]
    }

    if (note) {
      bookmarkNotes[bookmarkId] = note
    } else {
      delete bookmarkNotes[bookmarkId]
    }

    chrome.storage.local.set(
      { bookmarkTags, bookmarkNotes, tagColors, tagTextColors },
      callback,
    )
  })
}

function saveBookmark(event) {
  event.preventDefault()
  const title = titleInput.value.trim() || urlInput.value.trim()
  const url = urlInput.value.trim()
  const parentId = preferredFolderId || "1"
  const newFolderInput = document.getElementById("new-folder-input")
  const newFolderName = newFolderInput && !newFolderInput.classList.contains("hidden") ? newFolderInput.value.trim() : ""
  const tags = parseTags(tagsHiddenInput.value)
  const note = notesInput.value.trim()

  saveButton.disabled = true
  showStatus(tStatus("statusSaving"), "success")

  function finish(bookmark, isUpdate) {
    if (!bookmark) {
      showStatus(tStatus("statusErrorSave"), "error")
      saveButton.disabled = false
      return
    }

    saveMetadata(bookmark.id, tags, note, () => {
      if (chrome.runtime.lastError) {
        showStatus(tStatus("statusErrorMeta"), "error")
      } else {
        const verbKey = isUpdate ? "statusUpdatedSuccess" : "statusSavedSuccess"
        showStatus(tStatus(verbKey, currentTags.length))
        
        // Close window after 2 seconds
        setTimeout(() => {
          window.close()
        }, 2000)
      }
      saveButton.disabled = false
    })
  }

  function proceedSaving(finalParentId) {
    if (existingBookmark) {
      chrome.bookmarks.update(existingBookmark.id, { title, url }, (updated) => {
        if (updated.parentId !== finalParentId) {
          chrome.bookmarks.move(updated.id, { parentId: finalParentId }, (moved) => finish(moved || updated, true))
        } else {
          finish(updated, true)
        }
      })
    } else {
      chrome.bookmarks.create({ parentId: finalParentId, title, url }, (created) => finish(created, false))
    }
  }

  if (newFolderName) {
    chrome.bookmarks.create({ parentId, title: newFolderName }, (newFolder) => {
      proceedSaving(newFolder.id)
    })
  } else {
    proceedSaving(parentId)
  }
}

openDashboardButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") })
})

// Initialize quick open action setting
chrome.storage.local.get(["quickOpenAction"], (result) => {
  const action = result.quickOpenAction || "quickSave"
  const btns = document.querySelectorAll(".quick-action-btn");
  btns.forEach(btn => {
    if (btn.dataset.value === action) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    
    // Add click event listener to each button
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      chrome.storage.local.set({ quickOpenAction: btn.dataset.value });
    });
  });
})

let tagColorsCache = {}
let tagTextColorsCache = {}
let allAvailableTags = []
let activeSuggestionIndex = -1
const customTagSuggestions = document.getElementById("custom-tag-suggestions")

function loadTags() {
  chrome.storage.local.get(["bookmarkTags", "tagColors", "tagTextColors"], (result) => {
    const bookmarkTags = result.bookmarkTags || {}
    tagColorsCache = result.tagColors || {}
    tagTextColorsCache = result.tagTextColors || {}
    const allTags = new Set()
    Object.values(bookmarkTags).forEach((tags) => {
      tags.forEach((tag) => allTags.add(tag))
    })
    allAvailableTags = Array.from(allTags).sort()
  })
}

function showSuggestions(query) {
  if (!customTagSuggestions) return;
  const filtered = allAvailableTags.filter(t => t.toLowerCase().includes(query.toLowerCase()) && !currentTags.includes(t))
  if (filtered.length === 0) {
    customTagSuggestions.classList.add("hidden")
    return
  }
  
  customTagSuggestions.innerHTML = ""
  filtered.forEach((tag) => {
    const item = document.createElement("div")
    item.className = "suggestion-item"
    
    const dot = document.createElement("span")
    dot.className = "suggestion-color-dot"
    dot.style.backgroundColor = tagColorsCache[tag] || "var(--accent-color)"
    
    const text = document.createElement("span")
    text.textContent = tag
    
    item.appendChild(dot)
    item.appendChild(text)
    
    item.addEventListener("mousedown", (e) => {
      e.preventDefault() // prevent input blur
      addTag(tag)
    })
    
    customTagSuggestions.appendChild(item)
  })
  
  customTagSuggestions.classList.remove("hidden")
  activeSuggestionIndex = -1
}

function addTag(tag) {
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag)
    tagsInput.value = ""
    renderTags()
    if (customTagSuggestions) customTagSuggestions.classList.add("hidden")
  }
}

function renderTags() {
  tagsContainer.querySelectorAll(".tag-chip").forEach(c => c.remove())
  currentTags.forEach((tag, index) => {
    const chip = document.createElement("div")
    chip.className = "tag-chip"
    
    // Apply custom colors if they exist
    const bgColor = tagColorsCache[tag]
    const textColor = tagTextColorsCache[tag]
    if (bgColor) chip.style.backgroundColor = bgColor
    if (textColor) chip.style.color = textColor

    chip.innerHTML = `<span>${tag}</span><span class="remove" data-index="${index}">&times;</span>`
    tagsContainer.insertBefore(chip, tagsInput)
  })
  tagsHiddenInput.value = currentTags.join(",")
}

tagsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove")) {
    currentTags.splice(e.target.getAttribute("data-index"), 1)
    renderTags()
  } else {
    tagsInput.focus()
  }
})

tagsInput.addEventListener("input", (e) => {
  showSuggestions(e.target.value.trim().replace(/,/g, ""))
})

tagsInput.addEventListener("focus", (e) => {
  showSuggestions(e.target.value.trim().replace(/,/g, ""))
})

tagsInput.addEventListener("blur", () => {
  if (customTagSuggestions) customTagSuggestions.classList.add("hidden")
})

if (customTagSuggestions) {
  customTagSuggestions.addEventListener("mousedown", (e) => {
    e.preventDefault() // prevent blur when clicking scrollbar
  })
}

tagsInput.addEventListener("keydown", (e) => {
  const items = customTagSuggestions ? customTagSuggestions.querySelectorAll(".suggestion-item") : []
  
  if (e.key === "ArrowDown") {
    e.preventDefault()
    if (customTagSuggestions && !customTagSuggestions.classList.contains("hidden") && items.length > 0) {
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length
      updateActiveSuggestion(items)
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    if (customTagSuggestions && !customTagSuggestions.classList.contains("hidden") && items.length > 0) {
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length
      updateActiveSuggestion(items)
    }
  } else if (e.key === "Enter" || e.key === ",") {
    e.preventDefault()
    if (customTagSuggestions && !customTagSuggestions.classList.contains("hidden") && activeSuggestionIndex >= 0) {
      addTag(items[activeSuggestionIndex].querySelector("span:last-child").textContent)
    } else {
      addTag(tagsInput.value.trim().replace(/,/g, ""))
    }
  } else if (e.key === "Backspace" && !tagsInput.value && currentTags.length) {
    currentTags.pop()
    renderTags()
  }
})

function updateActiveSuggestion(items) {
  items.forEach((item, index) => {
    if (index === activeSuggestionIndex) {
      item.classList.add("active")
      item.scrollIntoView({ block: "nearest" })
    } else {
      item.classList.remove("active")
    }
  })
}

form.addEventListener("submit", (e) => {
  // If user hasn't pressed enter on a typed tag, add it
  const pendingTag = tagsInput.value.trim().replace(/,/g, "")
  if (pendingTag && !currentTags.includes(pendingTag)) {
    currentTags.push(pendingTag)
    renderTags()
  }
  saveBookmark(e)
})

initTheme()
fillFolders()
loadCurrentTab()
loadTags()

const newFolderInput = document.getElementById("new-folder-input")
const openFolderBtn = document.getElementById("open-folder-view-btn")
const closeFolderBtn = document.getElementById("close-folder-view-btn")
const folderView = document.getElementById("folder-selection-view")

function toggleFolderView(show) {
  if (show) {
    form.classList.add("hidden")
    folderView.classList.remove("hidden")
    // Use requestAnimationFrame to let DOM update before scrolling/focusing
    requestAnimationFrame(() => {
      fillFolders() // Ensure it is updated and scrolled to active
      const searchInput = document.getElementById("folder-search-input")
      if (searchInput) searchInput.focus()
    })
  } else {
    folderView.classList.add("hidden")
    form.classList.remove("hidden")
  }
}

if (openFolderBtn) openFolderBtn.addEventListener("click", () => toggleFolderView(true))
if (closeFolderBtn) closeFolderBtn.addEventListener("click", () => toggleFolderView(false))

const createFolderBtn = document.getElementById("create-folder-btn")

if (createFolderBtn && newFolderInput) {
  createFolderBtn.addEventListener("click", () => {
    const parentId = preferredFolderId || "1"
    const title = newFolderInput.value.trim()
    if (!title) {
      newFolderInput.focus()
      return
    }
    
    // Create folder and update UI
    chrome.bookmarks.create({ parentId, title }, (newFolder) => {
      preferredFolderId = newFolder.id
      newFolderInput.value = ""
      fillFolders()
      toggleFolderView(false) // Close the view after creating
    })
  })
}

const folderSearchInput = document.getElementById("folder-search-input")
if (folderSearchInput) {
  folderSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase()
    const items = document.querySelectorAll(".folder-tree-item")
    items.forEach(item => {
      if (item.textContent.toLowerCase().includes(query)) {
        item.style.display = "flex"
      } else {
        item.style.display = "none"
      }
    })
  })
}
const suggestTagBtn = document.getElementById("suggest-tag-btn")
if (suggestTagBtn) {
  suggestTagBtn.addEventListener("click", async () => {
    if (!currentTab || !currentTab.url) return;
    
    suggestTagBtn.disabled = true;
    const suggestTagIcon = document.getElementById("suggest-tag-icon");
    const suggestTagText = document.getElementById("suggest-tag-text");
    
    if (suggestTagIcon) suggestTagIcon.className = "fas fa-spinner fa-spin";
    if (suggestTagText) suggestTagText.textContent = "...";
    
    let suggestedTag = "";
    
    try {
      const data = await new Promise(resolve => chrome.storage.local.get(["aiConfig"], resolve));
      const config = data.aiConfig || { model: "gemini", apiKey: "" };
      
      if (config.apiKey && config.model === "gemini") {
        const modelName = config.modelName || "gemini-1.5-flash";
        let apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/$modelName:generateContent?key=${config.apiKey}";
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "You are a categorization assistant. Return exactly ONE short tag (max 2 words) for the bookmark.\nTitle: \"${currentTab.title}\", URL: \"${currentTab.url}\"" }] }]
          })
        });
        
        if (response.ok) {
          const resData = await response.json();
          if (resData.candidates && resData.candidates[0].content.parts[0].text) {
            suggestedTag = resData.candidates[0].content.parts[0].text.trim().replace(/['"]/g, '').substring(0, 20);
          }
        }
      } else if (config.model === "local" && typeof self.ai !== "undefined" && self.ai.languageModel) {
          const session = await self.ai.languageModel.create({
              systemPrompt: "You are a categorization assistant. Return exactly ONE short tag (max 2 words) for the bookmark."
          });
          const result = await session.prompt("Title: \"${currentTab.title}\", URL: \"${currentTab.url}\"");
          if (result) {
              suggestedTag = result.trim().replace(/['"]/g, '').substring(0, 20);
          }
      }
    } catch (e) {
      console.error("AI Categorize failed", e);
    }
    
    if (!suggestedTag) {
      try {
        const urlObj = new URL(currentTab.url);
        let hostname = urlObj.hostname.replace("www.", "");
        suggestedTag = hostname.split(".")[0];
      } catch(e) {}
    }
    
    if (suggestedTag) {
      suggestedTag = suggestedTag.charAt(0).toUpperCase() + suggestedTag.slice(1).toLowerCase();
      addTag(suggestedTag);
    }
    
    suggestTagBtn.disabled = false;
    if (suggestTagIcon) suggestTagIcon.className = "fas fa-wand-magic-sparkles";
    if (suggestTagText) {
      const lang = localStorage.getItem("appLanguage") || "en";
      suggestTagText.textContent = qsTranslations[lang]?.btnSuggestText || "Suggest";
    }
  });
}

function applyTranslations() {
  const lang = localStorage.getItem("appLanguage") || "en";
  const t = qsTranslations[lang] || qsTranslations.en;
  
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      el.textContent = t[key];
    }
  });
  
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) {
      el.setAttribute("placeholder", t[key]);
    }
  });
}
document.addEventListener("DOMContentLoaded", applyTranslations);
applyTranslations(); // Run immediately in case DOM is already loaded

function tStatus(key, ...args) {
  const lang = localStorage.getItem("appLanguage") || "en";
  const t = qsTranslations[lang] || qsTranslations.en;
  let text = t[key] || key;
  args.forEach((arg, index) => {
    text = text.replace("{" + index + "}", arg);
  });
  return text;
}

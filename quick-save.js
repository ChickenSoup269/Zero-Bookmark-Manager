const form = document.getElementById("quick-save-form");
const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
// Removed folderSelect
const tagsHiddenInput = document.getElementById("tags");
const tagsInput = document.getElementById("tags-input");
const tagsContainer = document.getElementById("tags-container");
const notesInput = document.getElementById("notes");
const saveButton = document.getElementById("save");
const statusBox = document.getElementById("status");
const openDashboardButton = document.getElementById("open-dashboard");
const quickOpenActionSelect = document.getElementById("quick-open-action");

const multiSaveToggle = document.getElementById("multi-save-toggle");
const singleSaveFields = document.getElementById("single-save-fields");
const multiSaveFields = document.getElementById("multi-save-fields");
const multiSaveTabList = document.getElementById("multi-save-tab-list");
const multiSaveCount = document.getElementById("multi-save-count");

// Hide header and adjust padding if embedded in the main dashboard
const isEmbedded =
  new URLSearchParams(window.location.search).get("embedded") === "true";
if (isEmbedded) {
  document.body.classList.add("embedded");
  const header = document.querySelector(".quick-save-header");
  if (header) header.style.display = "none";
  const actionGroup = document.getElementById("quick-open-action-group");
  if (actionGroup && actionGroup.parentElement) {
    actionGroup.parentElement.style.display = "none";
  }

  // Auto resize disabled - managed by CSS flex
  let lastHeight = 0;
  const updateHeight = () => {
    window.requestAnimationFrame(() => {
      const shell = document.querySelector(".quick-save-shell");
      if (shell && window.parent) {
        const newHeight = shell.offsetHeight + 24;
        if (Math.abs(newHeight - lastHeight) > 2) {
          lastHeight = newHeight;
          // Send message to parent to resize iframe (safest method)
          window.parent.postMessage(
            { type: "resizeIframe", height: newHeight },
            "*",
          );

          // Also try direct DOM access as fallback
          try {
            const frame =
              window.parent.document.getElementById("quick-save-frame");
            if (frame) frame.style.height = newHeight + "px";
          } catch (e) {}
        }
      }
    });
  };
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
    phNotes:
      "Why this page matters, what to revisit, or any context you need later.",
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
    statusSavedSuccess: "Saved successfully! ({0} tags)",
    btnDone: "Done",
    phQuickNewFolder: "Or type new folder (Other Bookmarks)...",
    lblSuggestedTags: "Suggested:",
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
    phNotes:
      "Tại sao trang này quan trọng, cần xem lại gì, hoặc bất kỳ ngữ cảnh nào cần lưu lại.",
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
    statusSavedSuccess: "Đã lưu thành công! ({0} thẻ)",
    btnDone: "Xong",
    phQuickNewFolder: "Hoặc tạo mới thư mục (vào Other Bookmarks)...",
    lblSuggestedTags: "Gợi ý:",
  },
};

let currentTab = null;
let allOpenTabs = [];
let existingBookmark = null;
let preferredFolderId = "1";
let currentTags = [];
let isMultiSaveMode = false;

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
];

function resolveActiveTheme(theme) {
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (theme === "system") return isDarkMode ? "dark" : "light";
  return AVAILABLE_THEMES.includes(theme) ? theme : "light";
}

function applyTheme(theme) {
  const activeTheme = resolveActiveTheme(theme);

  AVAILABLE_THEMES.forEach((themeName) => {
    document.body.classList.remove(`${themeName}-theme`);
  });
  document.body.classList.remove("light-theme", "dark-theme");
  document.body.classList.add(`${activeTheme}-theme`);
  document.documentElement.setAttribute("data-theme", activeTheme);

  const lightThemes = new Set([
    "light",
    "github-light",
    "nord-light",
    "gruvbox-light",
    "catppuccin-light",
    "nightowl-light",
  ]);
  document.documentElement.style.colorScheme = lightThemes.has(activeTheme)
    ? "light"
    : "dark";
}

function initTheme() {
  applyTheme(localStorage.getItem("appTheme") || "system");

  window.addEventListener("storage", (event) => {
    if (event.key === "appTheme") {
      applyTheme(event.newValue || "system");
    }
  });

  window.addEventListener("themeChanged", (event) => {
    const selection =
      event.detail?.originalSelection || event.detail?.theme || "system";
    applyTheme(selection);
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if ((localStorage.getItem("appTheme") || "system") === "system") {
        applyTheme("system");
      }
    });
}

function getSourceTabId() {
  const params = new URLSearchParams(window.location.search);
  const tabId = Number.parseInt(params.get("tabId") || "", 10);
  return Number.isFinite(tabId) ? tabId : null;
}

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
  statusBox.classList.remove("hidden");
  setTimeout(() => {
    statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 50);
}

function parseTags(value) {
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function flattenFolders(nodes, prefix = "", folders = []) {
  const folderNodes = nodes.filter((n) => n.children);
  folderNodes.forEach((node, index) => {
    const isLast = index === folderNodes.length - 1;
    let currentPrefix = prefix;
    let nextPrefix = prefix;

    if (node.id !== "0") {
      currentPrefix = prefix + (isLast ? "└─ " : "├─ ");
      nextPrefix = prefix + (isLast ? "\u00A0\u00A0\u00A0" : "│\u00A0\u00A0");
    }

    folders.push({
      id: node.id,
      title: node.title || "Bookmarks",
      prefix: currentPrefix,
    });
    flattenFolders(node.children, nextPrefix, folders);
  });
  return folders;
}

function fillFolders() {
  chrome.bookmarks.getTree((tree) => {
    const folders = flattenFolders(tree);
    const folderList = document.getElementById("folder-list");
    folderList.innerHTML = "";

    folders
      .filter((folder) => folder.id !== "0")
      .forEach((folder) => {
        const item = document.createElement("div");
        item.className = "folder-tree-item";
        if (folder.id === preferredFolderId) {
          item.classList.add("active");
        }

        const icon = document.createElement("i");
        icon.className = "fas fa-folder";

        const text = document.createTextNode(folder.title);

        if (folder.prefix) {
          const prefixSpan = document.createElement("span");
          prefixSpan.style.fontFamily = "monospace";
          prefixSpan.style.whiteSpace = "pre";
          prefixSpan.textContent = folder.prefix;
          item.appendChild(prefixSpan);
        }
        item.appendChild(icon);
        item.appendChild(text);

        item.addEventListener("click", () => {
          document
            .querySelectorAll(".folder-tree-item")
            .forEach((el) => el.classList.remove("active"));
          item.classList.add("active");
          preferredFolderId = folder.id;

          const selectedDisplayName = document.getElementById(
            "selected-folder-name-display",
          );
          if (selectedDisplayName) {
            selectedDisplayName.textContent = folder.title;
          }
        });

        item.addEventListener("dblclick", () => {
          if (typeof toggleFolderView === "function") {
            toggleFolderView(false);
          }
        });

        folderList.appendChild(item);
      });

    const bookmarksBar = folders.find((folder) => folder.id === "1");
    if (bookmarksBar && preferredFolderId === "1") {
      preferredFolderId = bookmarksBar.id;
      const barItem = Array.from(folderList.children).find((el) =>
        el.textContent.includes(bookmarksBar.title),
      );
      if (barItem && !folderList.querySelector(".active")) {
        barItem.classList.add("active");
      }
    }

    // Update the button text to show selected folder
    const activeItem = folderList.querySelector(".active");
    const selectedDisplayName = document.getElementById(
      "selected-folder-name-display",
    );
    if (activeItem && selectedDisplayName) {
      // Find the text node inside the active item (skip prefix span and icon)
      const textNode = Array.from(activeItem.childNodes).find(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node.textContent.trim().length > 0,
      );
      if (textNode) {
        selectedDisplayName.textContent = textNode.textContent;
      } else {
        selectedDisplayName.textContent = activeItem.textContent.trim();
      }
    }

    // Auto scroll to active item
    if (activeItem) {
      setTimeout(() => activeItem.scrollIntoView({ block: "nearest" }), 10);
    }
  });
}

function updateSelectedFolderDisplay() {
  const selectedDisplayName = document.getElementById(
    "selected-folder-name-display",
  );
  if (!selectedDisplayName) return;

  if (preferredFolderId === "1") {
    // "1" is typically "Bookmarks Bar", but let's fetch it anyway
    chrome.bookmarks.get(preferredFolderId, (results) => {
      if (results && results.length > 0) {
        selectedDisplayName.textContent = results[0].title || "Bookmarks Bar";
      }
    });
  } else {
    chrome.bookmarks.get(preferredFolderId, (results) => {
      if (results && results.length > 0) {
        selectedDisplayName.textContent = results[0].title || "Bookmarks";
      }
    });
  }
}

function fillExistingMetadata(bookmarkId) {
  chrome.storage.local.get(
    ["bookmarkTags", "bookmarkNotes", "tagColors", "tagTextColors"],
    (data) => {
      const tags = data.bookmarkTags?.[bookmarkId] || [];
      const note = data.bookmarkNotes?.[bookmarkId] || "";
      if (data.tagColors) tagColorsCache = data.tagColors;
      if (data.tagTextColors) tagTextColorsCache = data.tagTextColors;
      currentTags = [...tags];
      renderTags();
      notesInput.value = note;
    },
  );
}

function populateFromTab(tab) {
  if (chrome.runtime.lastError || !tab?.url) {
    showStatus(tStatus("statusNoPage"), "error");
    saveButton.disabled = true;
    return;
  }

  currentTab = tab;
  titleInput.value = tab.title || tab.url;
  urlInput.value = tab.url;

  if (/^(chrome|edge|about|chrome-extension):\/\//i.test(tab.url)) {
    showStatus(tStatus("statusErrorContext"), "error");
    saveButton.disabled = true;
    return;
  }

  chrome.bookmarks.search({ url: tab.url }, (matches) => {
    existingBookmark = matches?.[0] || null;
    if (existingBookmark) {
      titleInput.value = existingBookmark.title || titleInput.value;
      if (existingBookmark.parentId) {
        preferredFolderId = existingBookmark.parentId;
        updateSelectedFolderDisplay();
      }
      fillExistingMetadata(existingBookmark.id);
      showStatus(tStatus("statusAlreadySaved"), "success");
    }
    renderQuickSuggestedTags();
  });
}

function loadCurrentTab() {
  const tabId = getSourceTabId();

  // Real-time tab tracking for embedded views (Side Panel / Dashboard)
  if (isEmbedded && chrome.tabs) {
    const handleTabSwitch = (tab) => {
      if (
        tab &&
        tab.url &&
        !/^(chrome|edge|about|chrome-extension):\/\//i.test(tab.url)
      ) {
        // Reset form for new tab
        currentTags = [];
        renderTags();
        notesInput.value = "";
        existingBookmark = null;
        saveButton.disabled = false;
        if (statusBox) {
          statusBox.className = "status-box hidden";
          statusBox.textContent = "";
        }
        populateFromTab(tab);
      }
    };

    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, handleTabSwitch);
    });

    chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo, tab) => {
      if (tab.active && (changeInfo.status === "complete" || changeInfo.title || changeInfo.url)) {
        handleTabSwitch(tab);
      }
      if (isMultiSaveMode) {
        fetchAllTabsBackground();
      }
    });

    chrome.tabs.onCreated.addListener(() => {
      if (isMultiSaveMode) fetchAllTabsBackground();
    });

    chrome.tabs.onRemoved.addListener(() => {
      if (isMultiSaveMode) fetchAllTabsBackground();
    });
  }

  const filterValidTabs = (tabs) => {
    if (!tabs) return [];
    return tabs.filter(t => t.url && !/^(chrome|edge|about|chrome-extension):\/\//i.test(t.url));
  };

  const fetchAllTabsBackground = () => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const validTabs = filterValidTabs(tabs);
      if (validTabs.length > 0) {
        allOpenTabs = validTabs;
      } else {
        chrome.windows.getLastFocused({ windowTypes: ["normal"] }, function (win) {
          if (win && win.id) {
            chrome.tabs.query({ windowId: win.id }, (winTabs) => {
              allOpenTabs = filterValidTabs(winTabs);
              if (isMultiSaveMode) renderMultiTabList();
            });
          } else {
            chrome.tabs.query({}, (allTabs) => {
              allOpenTabs = filterValidTabs(allTabs);
              if (isMultiSaveMode) renderMultiTabList();
            });
          }
        });
        return;
      }
      if (isMultiSaveMode) {
        renderMultiTabList();
      }
    });
  };

  if (tabId) {
    chrome.tabs.get(tabId, populateFromTab);
    setTimeout(fetchAllTabsBackground, 50);
  } else {
    // FAST PATH: Get active tab instantly for immediate UI rendering
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      if (activeTabs && activeTabs.length > 0) {
        const validActiveTabs = filterValidTabs(activeTabs);
        if (validActiveTabs.length > 0) {
          populateFromTab(validActiveTabs[0]);
        } else {
          populateFromTab(activeTabs[0]); // will trigger invalid context logic
        }
      } else {
        // Fallback to getLastFocused if popup opened from another window type
        chrome.windows.getLastFocused({ windowTypes: ["normal"] }, function (win) {
          if (win && win.id) {
            chrome.tabs.query({ active: true, windowId: win.id }, (winTabs) => {
               if (winTabs && winTabs.length > 0) {
                 const validWinTabs = filterValidTabs(winTabs);
                 populateFromTab(validWinTabs.length > 0 ? validWinTabs[0] : winTabs[0]);
               }
            });
          }
        });
      }
      
      // Defer heavy fetching of all tabs and rendering to background
      setTimeout(fetchAllTabsBackground, 50);
    });
  }
}

function renderMultiTabList() {
  if (!multiSaveTabList) return;
  multiSaveTabList.innerHTML = "";
  
  if (allOpenTabs.length === 0) {
    multiSaveTabList.innerHTML = `<div style="padding: 8px; color: var(--text-secondary); text-align: center; font-size: 0.85rem;">No savable tabs found.</div>`;
    if (multiSaveCount) multiSaveCount.textContent = "0";
    return;
  }

  allOpenTabs.forEach((tab, index) => {
    const item = document.createElement("label");
    item.className = "multi-tab-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = index;
    
    const icon = document.createElement("img");
    icon.src = tab.favIconUrl || "images/default-favicon.png";
    icon.onerror = function () {
      this.onerror = null;
      this.src = "images/default-favicon.png";
    };
    
    const info = document.createElement("div");
    info.className = "tab-info";
    
    const title = document.createElement("div");
    title.className = "tab-title";
    title.textContent = tab.title || tab.url;
    title.title = tab.title || tab.url;
    
    const url = document.createElement("div");
    url.className = "tab-url";
    url.textContent = tab.url;
    url.title = tab.url;
    
    info.appendChild(title);
    info.appendChild(url);
    
    item.appendChild(checkbox);
    item.appendChild(icon);
    item.appendChild(info);
    
    checkbox.addEventListener("change", updateMultiSaveCount);
    
    multiSaveTabList.appendChild(item);
  });
  
  updateMultiSaveCount();
}

function updateMultiSaveCount() {
  if (!multiSaveCount || !multiSaveTabList) return;
  const checked = multiSaveTabList.querySelectorAll('input[type="checkbox"]:checked').length;
  multiSaveCount.textContent = checked.toString();
  
  if (isMultiSaveMode) {
    saveButton.disabled = checked === 0;
  }
}

if (multiSaveToggle) {
  multiSaveToggle.addEventListener("change", (e) => {
    isMultiSaveMode = e.target.checked;
    const quickNewFolderInput = document.getElementById("quick-new-folder-input");
    
    if (isMultiSaveMode) {
      singleSaveFields.classList.add("hidden");
      multiSaveFields.classList.remove("hidden");
      
      if (multiSaveTabList && multiSaveTabList.children.length === 0) {
        renderMultiTabList();
      } else {
        updateMultiSaveCount();
      }
      
      if (quickNewFolderInput && !quickNewFolderInput.value.trim()) {
        const now = new Date();
        const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        quickNewFolderInput.value = "Saved Tabs - " + dateStr;
      }
    } else {
      singleSaveFields.classList.remove("hidden");
      multiSaveFields.classList.add("hidden");
      saveButton.disabled = !currentTab || !currentTab.url;
      
      if (quickNewFolderInput && quickNewFolderInput.value.startsWith("Saved Tabs - ")) {
        quickNewFolderInput.value = "";
      }
    }
  });
}

function saveMetadata(bookmarkId, tags, note, callback) {
  chrome.storage.local.get(
    ["bookmarkTags", "bookmarkNotes", "tagColors", "tagTextColors"],
    (data) => {
      const bookmarkTags = data.bookmarkTags || {};
      const bookmarkNotes = data.bookmarkNotes || {};
      const tagColors = data.tagColors || {};
      const tagTextColors = data.tagTextColors || {};

      if (tags.length) {
        bookmarkTags[bookmarkId] = tags;
        tags.forEach((tag) => {
          tagColors[tag] = tagColorsCache[tag] || tagColors[tag] || "#3B82F6";
          tagTextColors[tag] =
            tagTextColorsCache[tag] || tagTextColors[tag] || "#FFFFFF";
        });
      } else {
        delete bookmarkTags[bookmarkId];
      }

      if (note) {
        bookmarkNotes[bookmarkId] = note;
      } else {
        delete bookmarkNotes[bookmarkId];
      }

      chrome.storage.local.set(
        { bookmarkTags, bookmarkNotes, tagColors, tagTextColors },
        callback,
      );
    },
  );
}

function saveBookmark(event) {
  event.preventDefault();
  const parentId = preferredFolderId || "1";
  const tags = parseTags(tagsHiddenInput.value);
  const note = notesInput.value.trim();

  const originalButtonHtml = saveButton.innerHTML;
  saveButton.disabled = true;
  showStatus(tStatus("statusSaving"), "success");
  
  let tabsToSave = [];
  
  if (isMultiSaveMode) {
    const checkboxes = multiSaveTabList.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.dataset.index, 10);
      if (allOpenTabs[idx]) {
        tabsToSave.push({
          title: allOpenTabs[idx].title || allOpenTabs[idx].url,
          url: allOpenTabs[idx].url
        });
      }
    });
  } else {
    tabsToSave.push({
      title: titleInput.value.trim() || urlInput.value.trim(),
      url: urlInput.value.trim()
    });
  }
  
  if (tabsToSave.length === 0) {
    showStatus(tStatus("statusNoSourceTab"), "error");
    saveButton.disabled = false;
    saveButton.innerHTML = originalButtonHtml;
    return;
  }

  let savedCount = 0;
  let errorCount = 0;

  function finishAll() {
    if (errorCount > 0 && savedCount === 0) {
      showStatus(tStatus("statusErrorSave"), "error");
      saveButton.disabled = false;
      saveButton.innerHTML = originalButtonHtml;
      return;
    }
    
    const text = isMultiSaveMode ? `Saved ${savedCount} bookmarks!` : tStatus(existingBookmark && !isMultiSaveMode ? "statusUpdatedSuccess" : "statusSavedSuccess", currentTags.length);
    showStatus(text);
    saveButton.innerHTML = `<i class="fas fa-check"></i> ${text}`;

    setTimeout(() => {
      if (isEmbedded && window.parent && window.parent !== window) {
        try { window.parent.close(); } catch (e) {}
      } else {
        window.close();
      }
      setTimeout(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonHtml;
      }, 500);
    }, 2000);
  }

  function proceedSaving(finalParentId) {
    let pending = tabsToSave.length;
    
    tabsToSave.forEach(tabData => {
      // For multi-save we just create. We could check existing but it gets complex.
      // For single save, we use existingBookmark logic.
      if (!isMultiSaveMode && existingBookmark) {
        chrome.bookmarks.update(
          existingBookmark.id,
          { title: tabData.title, url: tabData.url },
          (updated) => {
            if (chrome.runtime.lastError || !updated) {
              errorCount++;
              checkDone();
            } else if (updated.parentId !== finalParentId) {
              chrome.bookmarks.move(
                updated.id,
                { parentId: finalParentId },
                (moved) => {
                  savedCount++;
                  saveMetadata(moved ? moved.id : updated.id, tags, note, checkDone);
                }
              );
            } else {
              savedCount++;
              saveMetadata(updated.id, tags, note, checkDone);
            }
          }
        );
      } else {
        chrome.bookmarks.create(
          { parentId: finalParentId, title: tabData.title, url: tabData.url },
          (created) => {
            if (chrome.runtime.lastError || !created) {
              errorCount++;
              checkDone();
            } else {
              savedCount++;
              saveMetadata(created.id, tags, note, checkDone);
            }
          }
        );
      }
      
      function checkDone() {
        pending--;
        if (pending === 0) finishAll();
      }
    });
  }

  const quickNewFolderInput = document.getElementById("quick-new-folder-input");
  const quickNewFolderName = quickNewFolderInput
    ? quickNewFolderInput.value.trim()
    : "";

  if (quickNewFolderName) {
    // Default to 'Other Bookmarks' (ID "2") as requested
    chrome.bookmarks.create(
      { parentId: "2", title: quickNewFolderName },
      (newFolder) => {
        if (chrome.runtime.lastError || !newFolder) {
          console.error(chrome.runtime.lastError);
          showStatus("Error creating folder", "error");
          saveButton.disabled = false;
          saveButton.innerHTML = originalButtonHtml;
          return;
        }
        proceedSaving(newFolder.id);
      },
    );
  } else {
    proceedSaving(parentId);
  }
}

openDashboardButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("bookmarks.html") });
});

// Initialize quick open action setting
chrome.storage.local.get(["quickOpenAction"], (result) => {
  const action = result.quickOpenAction || "popup";
  const btns = document.querySelectorAll(".quick-action-btn");
  btns.forEach((btn) => {
    if (btn.dataset.value === action) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    // Add click event listener to each button
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      chrome.storage.local.set({ quickOpenAction: btn.dataset.value });
    });
  });
});

let tagColorsCache = {};
let tagTextColorsCache = {};
let allAvailableTags = [];
let activeSuggestionIndex = -1;
const customTagSuggestions = document.getElementById("custom-tag-suggestions");

const COMMON_TECH_TAGS = [
  "JavaScript", "TypeScript", "React", "Vue", "Angular", "Node.js", "Python",
  "Go", "Rust", "Java", "Docker", "Kubernetes", "AWS", "GitHub", "Git",
  "CSS", "HTML", "UI/UX", "Design", "Figma", "AI", "ChatGPT", "MachineLearning",
  "Docs", "Tutorial", "Guide", "Tools", "News", "Blog", "Podcast", "Video",
  "Music", "Movie", "Shopping", "Finance", "Crypto", "Game", "Social", "Work",
  "Study", "Reference", "API", "Book", "Linux"
];

function extractSmartTagSuggestions(title = "", url = "") {
  const suggestions = new Set();
  
  if (url) {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.toLowerCase().replace(/^www\./, "");
      const hostParts = host.split(".");
      const mainDomain = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : hostParts[0];

      const domainMap = {
        github: "GitHub",
        gitlab: "GitLab",
        stackoverflow: "Dev",
        stackexchange: "Dev",
        youtube: "Video",
        youtu: "Video",
        medium: "Blog",
        dev: "Blog",
        reddit: "Community",
        figma: "Design",
        dribbble: "Design",
        behance: "Design",
        twitter: "Social",
        x: "Social",
        linkedin: "Social",
        facebook: "Social",
        wikipedia: "Reference",
        npm: "JavaScript",
        pypi: "Python",
        news: "News",
        vimeo: "Video",
        spotify: "Music",
        chatgpt: "AI",
        openai: "AI",
        anthropic: "AI",
        claude: "AI",
        huggingface: "AI",
        kaggle: "DataScience",
        notion: "Productivity",
        trello: "Productivity",
      };

      if (domainMap[mainDomain]) {
        suggestions.add(domainMap[mainDomain]);
      } else if (mainDomain && mainDomain.length > 2 && mainDomain.length <= 15) {
        suggestions.add(mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1));
      }

      if (host.includes("docs.") || url.includes("/docs") || url.includes("/documentation")) {
        suggestions.add("Docs");
      }
      if (host.includes("blog.") || url.includes("/blog")) {
        suggestions.add("Blog");
      }
      if (host.includes("api.") || url.includes("/api")) {
        suggestions.add("API");
      }
    } catch (e) {}
  }

  if (title) {
    COMMON_TECH_TAGS.forEach((tag) => {
      const regex = new RegExp(`\\b${tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      if (regex.test(title)) {
        suggestions.add(tag);
      }
    });

    allAvailableTags.forEach((tag) => {
      if (tag && tag.length >= 2) {
        const regex = new RegExp(`\\b${tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
        if (regex.test(title)) {
          suggestions.add(tag);
        }
      }
    });
  }

  return Array.from(suggestions).filter((t) => !currentTags.includes(t)).slice(0, 6);
}

function renderQuickSuggestedTags() {
  const container = document.getElementById("suggested-tags-container");
  const list = document.getElementById("suggested-tags-list");
  if (!container || !list) return;

  const currentUrl = urlInput ? urlInput.value : (currentTab?.url || "");
  const currentTitle = titleInput ? titleInput.value : (currentTab?.title || "");

  const suggestions = extractSmartTagSuggestions(currentTitle, currentUrl);
  
  if (suggestions.length === 0) {
    container.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  list.innerHTML = "";
  suggestions.forEach((tag) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "suggested-tag-pill";
    pill.innerHTML = `<i class="fas fa-plus" style="font-size: 0.65em;"></i> <span>${tag}</span>`;
    pill.title = `Add tag: ${tag}`;
    pill.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addTag(tag);
    });
    list.appendChild(pill);
  });

  container.classList.remove("hidden");
}

function loadTags() {
  chrome.storage.local.get(
    ["bookmarkTags", "tagColors", "tagTextColors"],
    (result) => {
      const bookmarkTags = result.bookmarkTags || {};
      tagColorsCache = result.tagColors || {};
      tagTextColorsCache = result.tagTextColors || {};
      const allTags = new Set();
      Object.values(bookmarkTags).forEach((tags) => {
        tags.forEach((tag) => allTags.add(tag));
      });
      allAvailableTags = Array.from(allTags).sort();
      renderQuickSuggestedTags();
    },
  );
}

// Keep tags and colors in real-time sync with storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.bookmarkTags || changes.tagColors || changes.tagTextColors) {
      loadTags();
    }
  }
});

function showSuggestions(query) {
  if (!customTagSuggestions) return;
  
  let filtered = [];
  if (!query) {
    filtered = allAvailableTags.filter((t) => !currentTags.includes(t)).slice(0, 8);
    if (filtered.length === 0) {
      customTagSuggestions.classList.add("hidden");
      return;
    }
  } else {
    filtered = allAvailableTags.filter(
      (t) =>
        t.toLowerCase().includes(query.toLowerCase()) && !currentTags.includes(t),
    );
  }

  customTagSuggestions.innerHTML = "";

  // If typing a new tag that doesn't exactly match any available tag, show create option
  if (query && !filtered.some((t) => t.toLowerCase() === query.toLowerCase())) {
    const createItem = document.createElement("div");
    createItem.className = "suggestion-item";
    createItem.style.fontWeight = "600";
    
    const icon = document.createElement("i");
    icon.className = "fas fa-plus-circle";
    icon.style.color = "var(--accent-color)";
    icon.style.fontSize = "0.9rem";
    
    const text = document.createElement("span");
    text.textContent = `Create tag "${query}"`;
    
    createItem.appendChild(icon);
    createItem.appendChild(text);
    
    createItem.addEventListener("mousedown", (e) => {
      e.preventDefault();
      addTag(query);
    });
    
    customTagSuggestions.appendChild(createItem);
  }

  filtered.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";

    const dot = document.createElement("span");
    dot.className = "suggestion-color-dot";
    dot.style.backgroundColor = tagColorsCache[tag] || "var(--accent-color)";

    const text = document.createElement("span");
    text.textContent = tag;

    item.appendChild(dot);
    item.appendChild(text);

    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent input blur
      addTag(tag);
    });

    customTagSuggestions.appendChild(item);
  });

  customTagSuggestions.classList.remove("hidden");
  activeSuggestionIndex = -1;
}

let nextTagColor = "#3B82F6";

function addTag(tag) {
  if (!tag) return;
  const cleanTag = tag.trim().replace(/^#/, "");
  if (cleanTag && !currentTags.includes(cleanTag)) {
    currentTags.push(cleanTag);

    // Apply selected color if not already cached
    if (!tagColorsCache[cleanTag]) {
      tagColorsCache[cleanTag] = nextTagColor;
      tagTextColorsCache[cleanTag] = getContrastYIQ(nextTagColor);
    }

    tagsInput.value = "";
    renderTags();
    renderQuickSuggestedTags();
    if (customTagSuggestions) customTagSuggestions.classList.add("hidden");
  }
}

const CUSTOM_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#78716C",
  "#64748B",
  "#111827",
  "#FFFFFF",
];

let globalColorPalette = null;
let currentEditingTag = null;

function showColorPalette(tag, chipElement) {
  if (!globalColorPalette) {
    globalColorPalette = document.createElement("div");
    globalColorPalette.className = "custom-tag-suggestions";
    globalColorPalette.style.display = "flex";
    globalColorPalette.style.flexDirection = "row";
    globalColorPalette.style.flexWrap = "wrap";
    globalColorPalette.style.padding = "8px";
    globalColorPalette.style.gap = "6px";
    globalColorPalette.style.width = "200px";
    globalColorPalette.style.zIndex = "1000";

    CUSTOM_COLORS.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "24px";
      btn.style.height = "24px";
      btn.style.borderRadius = "50%";
      btn.style.border = "1px solid var(--border-color)";
      btn.style.backgroundColor = color;
      btn.style.cursor = "pointer";

      btn.addEventListener("mouseover", () => {
        btn.style.transform = "scale(1.1)";
      });
      btn.addEventListener("mouseout", () => {
        btn.style.transform = "scale(1)";
      });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentEditingTag && currentEditingTag.tag) {
          tagColorsCache[currentEditingTag.tag] = color;
          tagTextColorsCache[currentEditingTag.tag] = getContrastYIQ(color);
          currentEditingTag.chip.style.backgroundColor = color;
          currentEditingTag.chip.style.color =
            tagTextColorsCache[currentEditingTag.tag];
        } else if (currentEditingTag && !currentEditingTag.tag) {
          // It's the next-tag-color-btn
          nextTagColor = color;
          currentEditingTag.chip.style.backgroundColor = color;
        }
        globalColorPalette.classList.add("hidden");
      });
      globalColorPalette.appendChild(btn);
    });

    document.addEventListener("mousedown", (e) => {
      if (globalColorPalette && !globalColorPalette.contains(e.target)) {
        globalColorPalette.classList.add("hidden");
      }
    });

    document.body.appendChild(globalColorPalette);
  }

  currentEditingTag = { tag, chip: chipElement };
  globalColorPalette.classList.remove("hidden");

  const rect = chipElement.getBoundingClientRect();
  globalColorPalette.style.position = "absolute";
  globalColorPalette.style.top = rect.bottom + window.scrollY + 4 + "px";

  let leftPos = rect.left + window.scrollX;
  if (leftPos + 220 > window.innerWidth) {
    // 220px to leave some margin
    leftPos = Math.max(10, rect.right + window.scrollX - 210);
  }
  globalColorPalette.style.left = leftPos + "px";
}

function getContrastYIQ(hexcolor) {
  if (!hexcolor) return "#FFFFFF";
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3)
    hexcolor = hexcolor
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

function renderTags() {
  tagsContainer.querySelectorAll(".tag-chip").forEach((c) => c.remove());
  currentTags.forEach((tag, index) => {
    const chip = document.createElement("div");
    chip.className = "tag-chip";

    // Apply custom colors if they exist
    const bgColor = tagColorsCache[tag] || "#3B82F6";
    const textColor = tagTextColorsCache[tag] || getContrastYIQ(bgColor);
    chip.style.backgroundColor = bgColor;
    chip.style.color = textColor;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = tag;
    nameSpan.style.cursor = "pointer";
    nameSpan.title = "Click to change color";

    nameSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      showColorPalette(tag, chip);
    });

    const removeSpan = document.createElement("span");
    removeSpan.className = "remove";
    removeSpan.setAttribute("data-index", index);
    removeSpan.setAttribute("role", "button");
    removeSpan.setAttribute("title", "Remove tag");
    removeSpan.innerHTML = "&times;";

    removeSpan.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      currentTags.splice(index, 1);
      renderTags();
      tagsInput.focus();
    });

    chip.appendChild(nameSpan);
    chip.appendChild(removeSpan);

    const inputWrapper = document.getElementById("tags-input-wrapper");
    tagsContainer.insertBefore(chip, inputWrapper);
  });
  tagsHiddenInput.value = currentTags.join(",");
  renderQuickSuggestedTags();
}

const nextTagColorBtn = document.getElementById("next-tag-color-btn");
if (nextTagColorBtn) {
  nextTagColorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showColorPalette(null, nextTagColorBtn);
  });
}

tagsContainer.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".remove");
  if (removeBtn) {
    e.stopPropagation();
    const index = parseInt(removeBtn.getAttribute("data-index"), 10);
    if (!isNaN(index) && index >= 0 && index < currentTags.length) {
      currentTags.splice(index, 1);
      renderTags();
      tagsInput.focus();
    }
  } else if (!e.target.closest(".tag-chip")) {
    tagsInput.focus();
  }
});

tagsInput.addEventListener("input", (e) => {
  showSuggestions(e.target.value.trim().replace(/,/g, ""));
});

tagsInput.addEventListener("focus", (e) => {
  showSuggestions(e.target.value.trim().replace(/,/g, ""));
});

tagsInput.addEventListener("blur", () => {
  if (customTagSuggestions) customTagSuggestions.classList.add("hidden");
});

if (customTagSuggestions) {
  customTagSuggestions.addEventListener("mousedown", (e) => {
    e.preventDefault(); // prevent blur when clicking scrollbar
  });
}

tagsInput.addEventListener("keydown", (e) => {
  const items = customTagSuggestions
    ? customTagSuggestions.querySelectorAll(".suggestion-item")
    : [];

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (
      customTagSuggestions &&
      !customTagSuggestions.classList.contains("hidden") &&
      items.length > 0
    ) {
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
      updateActiveSuggestion(items);
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (
      customTagSuggestions &&
      !customTagSuggestions.classList.contains("hidden") &&
      items.length > 0
    ) {
      activeSuggestionIndex =
        (activeSuggestionIndex - 1 + items.length) % items.length;
      updateActiveSuggestion(items);
    }
  } else if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    if (
      customTagSuggestions &&
      !customTagSuggestions.classList.contains("hidden") &&
      activeSuggestionIndex >= 0
    ) {
      addTag(
        items[activeSuggestionIndex].querySelector("span:last-child")
          .textContent,
      );
    } else {
      addTag(tagsInput.value.trim().replace(/,/g, ""));
    }
  } else if (e.key === "Backspace" && !tagsInput.value && currentTags.length) {
    currentTags.pop();
    renderTags();
  }
});

function updateActiveSuggestion(items) {
  items.forEach((item, index) => {
    if (index === activeSuggestionIndex) {
      item.classList.add("active");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("active");
    }
  });
}

form.addEventListener("submit", (e) => {
  // If user hasn't pressed enter on a typed tag, add it
  const pendingTag = tagsInput.value.trim().replace(/,/g, "");
  if (pendingTag && !currentTags.includes(pendingTag)) {
    currentTags.push(pendingTag);
    renderTags();
  }
  saveBookmark(e);
});

initTheme();
updateSelectedFolderDisplay();
loadCurrentTab();
loadTags();

const newFolderInput = document.getElementById("new-folder-input");
const openFolderBtn = document.getElementById("open-folder-view-btn");
const closeFolderBtn = document.getElementById("close-folder-view-btn");
const folderView = document.getElementById("folder-selection-view");

function toggleFolderView(show) {
  if (show) {
    form.classList.add("hidden");
    folderView.classList.remove("hidden");
    // Use requestAnimationFrame to let DOM update before scrolling/focusing
    requestAnimationFrame(() => {
      fillFolders(); // Ensure it is updated and scrolled to active
      const searchInput = document.getElementById("folder-search-input");
      if (searchInput) searchInput.focus();
    });
  } else {
    folderView.classList.add("hidden");
    form.classList.remove("hidden");
  }
}

if (openFolderBtn)
  openFolderBtn.addEventListener("click", () => toggleFolderView(true));
if (closeFolderBtn)
  closeFolderBtn.addEventListener("click", () => toggleFolderView(false));

const createFolderBtn = document.getElementById("create-folder-btn");
const doneFolderBtn = document.getElementById("done-folder-view-btn");

if (doneFolderBtn)
  doneFolderBtn.addEventListener("click", () => toggleFolderView(false));

if (createFolderBtn && newFolderInput) {
  createFolderBtn.addEventListener("click", () => {
    const parentId = preferredFolderId || "1";
    const title = newFolderInput.value.trim();
    if (!title) {
      newFolderInput.focus();
      return;
    }

    // Create folder and update UI
    chrome.bookmarks.create({ parentId, title }, (newFolder) => {
      preferredFolderId = newFolder.id;
      newFolderInput.value = "";
      fillFolders();
      // We don't close the view automatically anymore so they can see the created folder
    });
  });
}

const folderSearchInput = document.getElementById("folder-search-input");
if (folderSearchInput) {
  folderSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll(".folder-tree-item");
    items.forEach((item) => {
      if (item.textContent.toLowerCase().includes(query)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  });
}
const suggestTagBtn = document.getElementById("suggest-tag-btn");
if (suggestTagBtn) {
  suggestTagBtn.addEventListener("click", async () => {
    if (!currentTab || !currentTab.url) return;

    suggestTagBtn.disabled = true;
    const suggestTagIcon = document.getElementById("suggest-tag-icon");
    const suggestTagText = document.getElementById("suggest-tag-text");

    if (suggestTagIcon) suggestTagIcon.className = "fas fa-spinner fa-spin";
    if (suggestTagText) suggestTagText.textContent = "...";

    let suggestedTags = [];

    try {
      const data = await new Promise((resolve) =>
        chrome.storage.local.get(["aiConfig"], resolve),
      );
      const config = data.aiConfig || { model: "gemini", apiKey: "" };

      if (config.apiKey && config.model === "gemini") {
        const modelName = config.modelName || "gemini-1.5-flash";
        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a bookmark categorization assistant. Return 1 to 3 relevant, concise tags (max 2 words per tag) separated by comma for the bookmark.\nTitle: "${currentTab.title}", URL: "${currentTab.url}"`,
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (
            resData.candidates &&
            resData.candidates[0].content.parts[0].text
          ) {
            const raw = resData.candidates[0].content.parts[0].text.trim();
            suggestedTags = raw.split(/[,;\n]+/).map((t) => t.trim().replace(/^['"#]+|['"]+$/g, "")).filter(Boolean);
          }
        }
      } else if (
        config.model === "local" &&
        typeof self.ai !== "undefined" &&
        self.ai.languageModel
      ) {
        const session = await self.ai.languageModel.create({
          systemPrompt:
            "You are a bookmark categorization assistant. Return 1 to 3 relevant, concise tags (max 2 words per tag) separated by comma for the bookmark.",
        });
        const result = await session.prompt(
          `Title: "${currentTab.title}", URL: "${currentTab.url}"`,
        );
        if (result) {
          suggestedTags = result.trim().split(/[,;\n]+/).map((t) => t.trim().replace(/^['"#]+|['"]+$/g, "")).filter(Boolean);
        }
      }
    } catch (e) {
      console.error("AI Categorize failed", e);
    }

    if (suggestedTags.length === 0) {
      const smartHeuristics = extractSmartTagSuggestions(currentTab.title, currentTab.url);
      if (smartHeuristics.length > 0) {
        suggestedTags = smartHeuristics.slice(0, 3);
      }
    }

    if (suggestedTags.length > 0) {
      suggestedTags.forEach((t) => {
        const formatted = t.charAt(0).toUpperCase() + t.slice(1);
        addTag(formatted);
      });
    }

    suggestTagBtn.disabled = false;
    if (suggestTagIcon) suggestTagIcon.className = "fas fa-wand-magic-sparkles";
    if (suggestTagText) {
      const lang = localStorage.getItem("appLanguage") || "en";
      suggestTagText.textContent =
        qsTranslations[lang]?.btnSuggestText || "Suggest";
    }
  });
}

function applyTranslations() {
  const lang = localStorage.getItem("appLanguage") || "en";
  const t = qsTranslations[lang] || qsTranslations.en;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
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

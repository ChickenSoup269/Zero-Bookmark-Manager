// ./components/controller/exportImport.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "../utils.js"
import { flattenBookmarks, getFolders } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, saveUIState } from "../state.js"

export function setupExportImportListeners(elements) {
  elements.exportBookmarksOption.addEventListener("click", async () => {
    const language = localStorage.getItem("appLanguage") || "en"
    const currentTheme = localStorage.getItem("appTheme") || "dark"
    console.log("Current theme:", currentTheme)

    const popup = document.createElement("div")
    popup.className = "popup"
    popup.setAttribute("data-theme", currentTheme)
    popup.innerHTML = `
    <div class="popup-content enhanced-popup">
      <div class="popup-header">
        <div class="icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <h2>${translations[language].exportTitle || "Export Bookmarks"}</h2>
        <p class="popup-subtitle">Choose your preferred export format and settings</p>
      </div>
      
      <div class="form-section">
        <label class="form-label">Export Format</label>
        <div class="format-options">
          <div class="format-card active" data-format="json">
            <div class="format-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"></path>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 148, 20,8"></polyline>
              </svg>
            </div>
            <h3>JSON</h3>
            <p>Machine readable format</p>
          </div>
          <div class="format-card" data-format="html">
            <div class="format-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <h3>HTML</h3>
            <p>Interactive web page</p>
          </div>
        </div>
      </div>
      
      <div class="form-section">
        <label class="form-label">${
          translations[language].advancedSettings || "Advanced Settings"
        }</label>
        <div class="settings-grid">
          <div class="setting-card">
            <div class="setting-toggle">
              <input type="checkbox" id="includeIconData" class="toggle-input">
              <label for="includeIconData" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-info">
              <h4>${
                translations[language].includeIconData ||
                "Include icon data (Base64)"
              }</h4>
              <p>Add favicon data to bookmarks</p>
            </div>
          </div>
          
          <div class="setting-card">
            <div class="setting-toggle">
              <input type="checkbox" id="includeCreationDates" class="toggle-input">
              <label for="includeCreationDates" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-info">
              <h4>${
                translations[language].includeCreationDates ||
                "Include creation dates"
              }</h4>
              <p>Add creation timestamps</p>
            </div>
          </div>
          
          <div class="setting-card">
            <div class="setting-toggle">
              <input type="checkbox" id="includeFolderModDates" class="toggle-input">
              <label for="includeFolderModDates" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-info">
              <h4>${
                translations[language].includeFolderModDates ||
                "Include folder modification dates"
              }</h4>
              <p>Add folder timestamps</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="popup-footer">
        <button id="cancelExport" class="btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          ${translations[language].cancel || "Cancel"}
        </button>
        <button id="confirmExport" class="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          ${translations[language].confirm || "Export"}
        </button>
      </div>
    </div>
  `
    document.body.appendChild(popup)

    // Format selection handling
    const formatCards = popup.querySelectorAll(".format-card")
    let selectedFormat = "json"

    formatCards.forEach((card) => {
      card.addEventListener("click", () => {
        formatCards.forEach((c) => c.classList.remove("active"))
        card.classList.add("active")
        selectedFormat = card.dataset.format
      })
    })

    document
      .getElementById("confirmExport")
      .addEventListener("click", async () => {
        const exportChoice = selectedFormat.toUpperCase()
        const includeIconData =
          document.getElementById("includeIconData").checked
        const includeCreationDates = document.getElementById(
          "includeCreationDates"
        ).checked
        const includeFolderModDates = document.getElementById(
          "includeFolderModDates"
        ).checked

        // Add loading state
        const confirmBtn = document.getElementById("confirmExport")
        const originalContent = confirmBtn.innerHTML
        confirmBtn.innerHTML = `
          <div class="loading-spinner"></div>
          Exporting...
        `
        confirmBtn.disabled = true

        safeChromeBookmarksCall("getTree", [], async (bookmarkTreeNodes) => {
          if (!bookmarkTreeNodes) {
            showCustomPopup(
              translations[language].errorUnexpected ||
                "Unexpected error occurred",
              "error",
              false
            )
            document.body.removeChild(popup)
            return
          }

          const exportData = {
            timestamp: new Date().toISOString(),
            bookmarks: bookmarkTreeNodes,
          }

          if (exportChoice === "JSON") {
            const jsonString = JSON.stringify(exportData, null, 2)
            const blob = new Blob([jsonString], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `bookmarks_${
              new Date().toISOString().split("T")[0]
            }.json`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          } else if (exportChoice === "HTML") {
            let faviconMap = {}
            if (includeIconData) {
              const bookmarksWithUrls = flattenBookmarks(
                bookmarkTreeNodes
              ).filter((b) => b.url)
              for (const bookmark of bookmarksWithUrls) {
                faviconMap[
                  bookmark.url
                ] = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(
                  bookmark.url
                )}`
              }
            }

            // Enhanced CSS theme with modern design
            const cssTheme = `
          :root {
            --bg-primary: ${currentTheme === "dark" ? "#0a0a0a" : "#ffffff"};
            --bg-secondary: ${currentTheme === "dark" ? "#1a1a1a" : "#f8fafc"};
            --bg-tertiary: ${currentTheme === "dark" ? "#2a2a2a" : "#e2e8f0"};
            --bg-card: ${currentTheme === "dark" ? "#1e1e1e" : "#ffffff"};
            --text-primary: ${currentTheme === "dark" ? "#ffffff" : "#1a202c"};
            --text-secondary: ${
              currentTheme === "dark" ? "#a0aec0" : "#4a5568"
            };
            --text-muted: ${currentTheme === "dark" ? "#718096" : "#718096"};
            --border-color: ${currentTheme === "dark" ? "#2d3748" : "#e2e8f0"};
            --accent-color: #3182ce;
            --accent-hover: #2c5aa0;
            --success-color: #48bb78;
            --warning-color: #ed8936;
            --error-color: #f56565;
            --hover-bg: ${currentTheme === "dark" ? "#2d3748" : "#f7fafc"};
            --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            --border-radius: 0.5rem;
            --border-radius-lg: 0.75rem;
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          * {
            box-sizing: border-box;
          }

          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
          }
          
          .container { 
            max-width: 1400px;
            margin: 0 auto;
            background: var(--bg-card);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
            color: white;
            padding: 2rem;
            text-align: center;
          }
          
          .header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
          }
          
          .header p {
            margin: 0.5rem 0 0;
            opacity: 0.9;
            font-size: 1.1rem;
          }
          
          .controls { 
            padding: 2rem;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
          }
          
          #searchInput { 
            flex: 1;
            min-width: 300px;
            padding: 0.75rem 1rem;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 1rem;
            background: var(--bg-card);
            color: var(--text-primary);
            transition: var(--transition);
          }
          
          #searchInput:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
          }
          
          .view-toggle { 
            padding: 0.75rem 1.5rem;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            background: var(--bg-card);
            color: var(--text-primary);
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .view-toggle:hover { 
            background: var(--hover-bg);
            transform: translateY(-1px);
          }
          
          .view-toggle.active { 
            background: var(--accent-color);
            color: white;
            border-color: var(--accent-color);
          }
          
          .content-area {
            padding: 2rem;
          }
          
          .bookmark-list { 
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .bookmark-list li { 
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            transition: var(--transition);
          }
          
          .bookmark-list li:hover { 
            background: var(--hover-bg);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
          }
          
          .bookmark-grid { 
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
            margin: 0;
            padding: 0;
          }
          
          .bookmark-grid .bookmark-item { 
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 1.5rem;
            transition: var(--transition);
            text-align: center;
          }
          
          .bookmark-grid .bookmark-item:hover { 
            transform: translateY(-2px);
            box-shadow: var(--shadow-lg);
            border-color: var(--accent-color);
          }
          
          .bookmark-item a { 
            text-decoration: none;
            color: var(--accent-color);
            font-weight: 500;
            font-size: 1rem;
            transition: var(--transition);
          }
          
          .bookmark-item a:hover { 
            color: var(--accent-hover);
          }
          
          .bookmark-item img { 
            width: 20px;
            height: 20px;
            margin-right: 0.75rem;
            vertical-align: middle;
            border-radius: 0.25rem;
          }
          
          .folder { 
            font-weight: 600;
            margin: 0.5rem 0;
            cursor: pointer;
            color: var(--text-primary);
            padding: 1rem;
            background: var(--bg-secondary);
            border-radius: var(--border-radius);
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          
          .folder:hover {
            background: var(--hover-bg);
          }
          
          .folder::before { 
            content: "📁";
            font-size: 1.25rem;
            transition: var(--transition);
          }
          
          .folder.open::before { 
            content: "📂";
            transform: scale(1.1);
          }
          
          .nested { 
            padding-left: 1rem;
            margin-left: 0.5rem;
            border-left: 2px solid var(--border-color);
            display: none;
            transition: var(--transition);
          }
          
          .open > .nested { 
            display: block;
            animation: slideDown 0.3s ease-out;
          }
          
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .tree-view { 
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
          }
          
          .hidden { 
            display: none !important;
          }
          
          .meta-info { 
            font-size: 0.875rem;
            color: var(--text-muted);
            margin-top: 0.5rem;
            padding: 0.5rem;
            background: var(--bg-secondary);
            border-radius: 0.25rem;
          }
          
          .stats-bar {
            background: var(--bg-secondary);
            padding: 1rem 2rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }
          
          @media (max-width: 768px) {
            .controls {
              flex-direction: column;
              align-items: stretch;
            }
            
            #searchInput {
              min-width: unset;
            }
            
            .bookmark-grid {
              grid-template-columns: 1fr;
            }
            
            .stats-bar {
              flex-direction: column;
              gap: 0.5rem;
            }
          }
        `

            const htmlTemplate = `
          <!DOCTYPE html>
          <html lang="en" data-theme="${currentTheme}">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Bookmarks Collection</title>
            <link rel="icon" type="image/png" href="https://github.com/ChickenSoup269/Extension_Bookmark-Manager/blob/main/icons/icon.png?raw=true">
            <style>${cssTheme}</style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📚 My Bookmarks</h1>
                <p>Exported on ${new Date().toLocaleDateString()}</p>
              </div>
              
              <div class="controls">
                <input type="text" id="searchInput" placeholder="${
                  translations[language].searchPlaceholder ||
                  "Search bookmarks..."
                }">
                <button class="view-toggle active" id="listViewBtn" onclick="toggleView('list')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  List
                </button>
                <button class="view-toggle" id="gridViewBtn" onclick="toggleView('grid')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Grid
                </button>
                <button class="view-toggle" id="treeViewBtn" onclick="toggleView('tree')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 17a2 2 0 0 1-2 2H3s0-2 9-2 9 2 9 2Z"></path>
                    <path d="M5 17a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5Z"></path>
                  </svg>
                  Tree
                </button>
              </div>
              
              <div class="content-area">
                <ul id="bookmarkList" class="bookmark-list"></ul>
                <div id="bookmarkGrid" class="bookmark-grid hidden"></div>
                <ul id="bookmarkTree" class="tree-view hidden"></ul>
              </div>
              
              <div class="stats-bar">
                <span id="bookmarkCount">Loading bookmarks...</span>
                <span>Generated by Bookmark Manager Extension</span>
              </div>
            </div>
            
            <script>
              const bookmarks = {{bookmarks}};
              const includeIconData = {{includeIconData}};
              const includeCreationDates = {{includeCreationDates}};
              const includeFolderModDates = {{includeFolderModDates}};
              const faviconMap = {{faviconMap}};
              
              const listContainer = document.getElementById("bookmarkList");
              const gridContainer = document.getElementById("bookmarkGrid");
              const treeContainer = document.getElementById("bookmarkTree");
              const searchInput = document.getElementById("searchInput");
              const listViewBtn = document.getElementById("listViewBtn");
              const gridViewBtn = document.getElementById("gridViewBtn");
              const treeViewBtn = document.getElementById("treeViewBtn");
              const bookmarkCount = document.getElementById("bookmarkCount");
              
              let totalBookmarks = 0;
              let totalFolders = 0;

              function formatDate(timestamp) {
                return timestamp ? new Date(timestamp).toLocaleString() : "N/A";
              }
              
              function countBookmarks(nodes) {
                nodes.forEach(node => {
                  if (node.url) {
                    totalBookmarks++;
                  } else if (node.children) {
                    totalFolders++;
                    countBookmarks(node.children);
                  }
                });
              }

              function renderBookmarks(nodes, parent = listContainer, gridParent = gridContainer, treeParent = treeContainer, depth = 0) {
                const folders = nodes.filter(node => node.children);
                const bookmarksOnly = nodes.filter(node => node.url);

                nodes.forEach(node => {
                  if (node.url) {
                    const li = document.createElement("li");
                    li.className = "bookmark-item";
                    if (includeIconData && faviconMap[node.url]) {
                      li.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\"><path d=\\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\"/><path d=\\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\"/></svg>'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    } else {
                      li.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    }
                    if (includeCreationDates) {
                      li.innerHTML += \`<div class="meta-info">📅 Created: \${formatDate(node.dateAdded)}</div>\`;
                    }
                    parent.appendChild(li);

                    const gridItem = document.createElement("div");
                    gridItem.className = "bookmark-item";
                    if (includeIconData && faviconMap[node.url]) {
                      gridItem.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\"><path d=\\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\"/><path d=\\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\"/></svg>'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    } else {
                      gridItem.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    }
                    if (includeCreationDates) {
                      gridItem.innerHTML += \`<div class="meta-info">📅 Created: \${formatDate(node.dateAdded)}</div>\`;
                    }
                    gridParent.appendChild(gridItem);
                  }
                });

                [...folders, ...bookmarksOnly].forEach(node => {
                  const treeItem = document.createElement("li");
                  if (node.url) {
                    treeItem.className = "bookmark-item";
                    if (includeIconData && faviconMap[node.url]) {
                      treeItem.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\"><path d=\\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\"/><path d=\\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\"/></svg>'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    } else {
                      treeItem.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
                    }
                    if (includeCreationDates) {
                      treeItem.innerHTML += \`<div class="meta-info">📅 Created: \${formatDate(node.dateAdded)}</div>\`;
                    }
                  } else if (node.children) {
                    treeItem.className = "folder";
                    treeItem.textContent = node.title || "Unnamed Folder";
                    if (includeCreationDates || includeFolderModDates) {
                      const metaDiv = document.createElement("div");
                      metaDiv.className = "meta-info";
                      if (includeCreationDates) {
                        metaDiv.innerHTML += \`📅 Created: \${formatDate(node.dateAdded)}<br>\`;
                      }
                      if (includeFolderModDates) {
                        metaDiv.innerHTML += \`🔄 Modified: \${formatDate(node.dateGroupModified)}\`;
                      }
                      treeItem.appendChild(metaDiv);
                    }
                    const nestedList = document.createElement("ul");
                    nestedList.className = "nested";
                    treeItem.appendChild(nestedList);
                    treeItem.addEventListener("click", (e) => {
                      e.stopPropagation();
                      treeItem.classList.toggle("open");
                    });
                    renderBookmarks(node.children, parent, gridParent, nestedList, depth + 1);
                  }
                  treeParent.appendChild(treeItem);
                });
              }

              function toggleView(view) {
                listContainer.classList.add("hidden");
                gridContainer.classList.add("hidden");
                treeContainer.classList.add("hidden");
                listViewBtn.classList.remove("active");
                gridViewBtn.classList.remove("active");
                treeViewBtn.classList.remove("active");
                
                if (view === "list") {
                  listContainer.classList.remove("hidden");
                  listViewBtn.classList.add("active");
                } else if (view === "grid") {
                  gridContainer.classList.remove("hidden");
                  gridViewBtn.classList.add("active");
                } else if (view === "tree") {
                  treeContainer.classList.remove("hidden");
                  treeViewBtn.classList.add("active");
                }
              }

              function filterBookmarks() {
                const query = searchInput.value.toLowerCase();
                const items = document.querySelectorAll(".bookmark-item, .folder");
                let visibleCount = 0;
                
                items.forEach(item => {
                  const text = item.textContent.toLowerCase();
                  const isVisible = text.includes(query);
                  item.style.display = isVisible ? "" : "none";
                  
                  if (isVisible && item.classList.contains("bookmark-item")) {
                    visibleCount++;
                  }
                  
                  if (item.classList.contains("folder") && item.querySelector(".bookmark-item")) {
                    const hasVisibleChild = Array.from(item.querySelectorAll(".bookmark-item")).some(child => 
                      child.textContent.toLowerCase().includes(query) && child.style.display !== "none"
                    );
                    if (hasVisibleChild) {
                      item.style.display = "";
                      item.classList.add("open");
                    }
                  }
                });
                
                updateBookmarkCount(query ? visibleCount : totalBookmarks);
              }
              
              function updateBookmarkCount(count = totalBookmarks) {
                bookmarkCount.textContent = \`\${count} bookmarks • \${totalFolders} folders\`;
              }

              // Initialize
              countBookmarks(bookmarks);
              updateBookmarkCount();
              searchInput.addEventListener("input", filterBookmarks);
              renderBookmarks(bookmarks);
              toggleView("list");
            </script>
          </body>
          </html>
        `

            const htmlContent = htmlTemplate
              .replace("{{bookmarks}}", JSON.stringify(bookmarkTreeNodes))
              .replace("{{includeIconData}}", JSON.stringify(includeIconData))
              .replace(
                "{{includeCreationDates}}",
                JSON.stringify(includeCreationDates)
              )
              .replace(
                "{{includeFolderModDates}}",
                JSON.stringify(includeFolderModDates)
              )
              .replace("{{faviconMap}}", JSON.stringify(faviconMap))

            const blob = new Blob([htmlContent], { type: "text/html" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `bookmarks_${
              new Date().toISOString().split("T")[0]
            }.html`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }

          // Reset button state
          confirmBtn.innerHTML = originalContent
          confirmBtn.disabled = false
          document.body.removeChild(popup)
          elements.settingsMenu.classList.add("hidden")
        })
      })

    document.getElementById("cancelExport").addEventListener("click", () => {
      document.body.removeChild(popup)
    })

    // Enhanced popup styles
    const style = document.createElement("style")
    style.textContent = `
    .popup {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    .enhanced-popup {
      background: var(--bg-secondary);
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 80%;
      max-width: 450px; /* Reduced from 600px */
      max-height: 80vh; /* Reduced from 90vh */
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
    }
    
    .popup-header {
      text-align: center;
      padding: 1.5rem 1.5rem 0.75rem; /* Adjusted padding */
      border-bottom: 1px solid var(--border-color);
    }
    
    .icon-wrapper {
      width: 48px; /* Reduced from 64px */
      height: 48px;
      background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.75rem; /* Adjusted margin */
      color: white;
    }
    
    .popup-header h2 {
      margin: 0 0 0.3rem; /* Adjusted margin */
      color: var(--text-primary);
      font-size: 1.5rem; /* Reduced from 1.75rem */
      font-weight: 700;
    }
    
    .popup-subtitle {
      color: var(--text-secondary);
      margin: 0;
      font-size: 0.9rem; /* Reduced from 1rem */
    }
    
    .form-section {
      padding: 1rem 1.5rem; /* Adjusted padding */
    }
    
    .form-label {
      display: block;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.75rem; /* Adjusted margin */
      font-size: 1rem; /* Reduced from 1.1rem */
    }
    
    .format-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem; /* Reduced from 1rem */
      margin-bottom: 0.3rem; /* Adjusted margin */
    }
    
    .format-card {
      padding: 1rem; /* Reduced from 1.5rem */
      border: 2px solid var(--border-color);
      border-radius: 0.5rem; /* Reduced from 0.75rem */
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      background: var(--bg-primary);
    }
    
    .format-card:hover {
      border-color: var(--accent-color);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
    
    .format-card.active {
      border-color: var(--accent-color);
      background: var(--accent-color);
      color: white;
      box-shadow: 0 8px 25px rgba(49, 130, 206, 0.3);
    }
    
    .format-icon {
      margin-bottom: 0.5rem; /* Reduced from 0.75rem */
    }
    
    .format-card h3 {
      margin: 0 0 0.3rem; /* Adjusted margin */
      font-size: 1rem; /* Reduced from 1.1rem */
      font-weight: 600;
    }
    
    .format-card p {
      margin: 0;
      font-size: 0.8rem; /* Reduced from 0.9rem */
      opacity: 0.8;
    }
    
    .settings-grid {
      display: grid;
      gap: 0.75rem; /* Reduced from 1rem */
    }
    
    .setting-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem; /* Reduced from 1rem */
      padding: 1rem; /* Reduced from 1.25rem */
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem; /* Reduced from 0.75rem */
      transition: all 0.2s ease;
    }
    
    .setting-card:hover {
      border-color: var(--accent-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .setting-toggle {
      flex-shrink: 0;
    }
    
    .toggle-input {
      display: none;
    }
    
    .toggle-label {
      display: block;
      width: 40px; /* Reduced from 48px */
      height: 20px; /* Reduced from 24px */
      background: var(--border-color);
      border-radius: 20px; /* Adjusted */
      cursor: pointer;
      position: relative;
      transition: all 0.3s ease;
    }
    
    .toggle-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px; /* Reduced from 20px */
      height: 16px; /* Reduced from 20px */
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .toggle-input:checked + .toggle-label {
      background: var(--accent-color);
    }
    
    .toggle-input:checked + .toggle-label .toggle-slider {
      transform: translateX(20px); /* Adjusted for smaller toggle */
    }
    
    .setting-info h4 {
      margin: 0 0 0.2rem; /* Adjusted margin */
      color: var(--text-primary);
      font-size: 0.9rem; /* Reduced from 1rem */
      font-weight: 600;
    }
    
    .setting-info p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.8rem; /* Reduced from 0.9rem */
    }
    
    .popup-footer {
      padding: 1rem 1.5rem 1.5rem; /* Adjusted padding */
      display: flex;
      gap: 0.75rem; /* Reduced from 1rem */
      justify-content: flex-end;
      border-top: 1px solid var(--border-color);
    }
    
    .btn-primary,
    .btn-secondary {
      padding: 0.6rem 1.2rem; /* Reduced from 0.75rem 1.5rem */
      border: none;
      border-radius: 0.4rem; /* Reduced from 0.5rem */
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.4rem; /* Reduced from 0.5rem */
      font-size: 0.9rem; /* Reduced from 0.95rem */
    }
    
    .btn-primary {
      background: var(--accent-color);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(49, 130, 206, 0.4);
    }
    
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    
    .btn-secondary:hover {
      background: var(--hover-bg);
      transform: translateY(-1px);
    }
    
    .loading-spinner {
      width: 14px; /* Reduced from 16px */
      height: 14px; /* Reduced from 16px */
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @media (max-width: 640px) {
      .enhanced-popup {
        width: 95%; /* Increased from 92% for better mobile fit */
        margin: 0.5rem;
      }
      
      .format-options {
        grid-template-columns: 1fr;
      }
      
      .popup-footer {
        flex-direction: column-reverse;
        gap: 0.5rem;
      }
      
      .btn-primary,
      .btn-secondary {
        justify-content: center;
        padding: 0.6rem 0.8rem; /* Adjusted for smaller screens */
      }
      
      .popup-header {
        padding: 1rem 1rem 0.5rem; /* Adjusted for smaller screens */
      }
      
      .form-section {
        padding: 0.75rem 1rem; /* Adjusted for smaller screens */
      }
      
      .popup-footer {
        padding: 0.5rem 1rem 1rem; /* Adjusted for smaller screens */
      }
    }
  `
    document.head.appendChild(style)
  })

  elements.importBookmarksOption.addEventListener("click", () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result)
          if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
            const language = localStorage.getItem("appLanguage") || "en"
            showCustomPopup(
              translations[language].importInvalidFile || "Invalid file format",
              "error",
              false
            )
            return
          }

          safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
            if (!bookmarkTreeNodes) {
              const language = localStorage.getItem("appLanguage") || "en"
              showCustomPopup(
                translations[language].importError ||
                  "Failed to fetch bookmark tree",
                "error",
                false
              )
              return
            }

            const existingBookmarks = flattenBookmarks(bookmarkTreeNodes)
            const existingUrls = new Set(existingBookmarks.map((b) => b.url))

            const bookmarksToImport = []
            const duplicateBookmarks = []
            const flattenImportedBookmarks = flattenBookmarks(data.bookmarks)

            flattenImportedBookmarks.forEach((bookmark) => {
              if (bookmark.url) {
                if (existingUrls.has(bookmark.url)) {
                  duplicateBookmarks.push(bookmark)
                } else {
                  bookmarksToImport.push(bookmark)
                }
              }
            })

            const language = localStorage.getItem("appLanguage") || "en"
            if (duplicateBookmarks.length > 0) {
              showCustomPopup(
                `${
                  translations[language].importDuplicatePrompt ||
                  "Duplicate bookmarks found"
                }: ${duplicateBookmarks.length}`,
                "warning",
                true,
                () => importNonDuplicateBookmarks(bookmarksToImport, elements)
              )
            } else {
              importNonDuplicateBookmarks(bookmarksToImport, elements)
            }
          })
        } catch (error) {
          console.error("Error parsing import file:", error)
          const language = localStorage.getItem("appLanguage") || "en"
          showCustomPopup(
            translations[language].importInvalidFile || "Invalid file format",
            "error",
            false
          )
        }
      }
      reader.readAsText(file)
    })
    input.click()
    elements.settingsMenu.classList.add("hidden")
  })
}

function importNonDuplicateBookmarks(bookmarksToImport, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const importPromises = bookmarksToImport.map((bookmark) => {
    return new Promise((resolve) => {
      safeChromeBookmarksCall(
        "create",
        [
          {
            parentId: bookmark.parentId || "2",
            title: bookmark.title || "",
            url: bookmark.url,
          },
        ],
        resolve
      )
    })
  })

  Promise.all(importPromises).then(() => {
    safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
      if (bookmarkTreeNodes) {
        uiState.bookmarkTree = bookmarkTreeNodes
        uiState.bookmarks = flattenBookmarks(bookmarkTreeNodes)
        uiState.folders = getFolders(bookmarkTreeNodes)
        renderFilteredBookmarks(bookmarkTreeNodes, elements)
        saveUIState()
        showCustomPopup(
          translations[language].importSuccess ||
            "Bookmarks imported successfully!",
          "success"
        )
      } else {
        showCustomPopup(
          translations[language].importError || "Failed to update bookmarks",
          "error",
          false
        )
      }
    })
  })
}

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
    const currentTheme = document.body.getAttribute("data-theme") || "dark"
    const popup = document.createElement("div")
    popup.className = "popup"
    popup.setAttribute("data-theme", currentTheme)
    popup.innerHTML = `
      <div class="popup-content">
        <h2>${translations[language].exportTitle || "Export Bookmarks"}</h2>
        <select id="exportFormat">
          <option value="json">JSON</option>
          <option value="html">HTML</option>
        </select>
        <div id="advancedSettings" style="margin: 10px 0;">
          <h3>${
            translations[language].advancedSettings || "Advanced Settings"
          }</h3>
          <label><input type="checkbox" id="includeIconData"> ${
            translations[language].includeIconData ||
            "Include icon data (Base64)"
          }</label><br>
          <label><input type="checkbox" id="includeCreationDates"> ${
            translations[language].includeCreationDates ||
            "Include creation dates"
          }</label><br>
          <label><input type="checkbox" id="includeFolderModDates"> ${
            translations[language].includeFolderModDates ||
            "Include folder modification dates"
          }</label>
        </div>
        <button id="confirmExport">${
          translations[language].confirm || "Export"
        }</button>
        <button id="cancelExport">${
          translations[language].cancel || "Cancel"
        }</button>
      </div>
    `
    document.body.appendChild(popup)

    document
      .getElementById("confirmExport")
      .addEventListener("click", async () => {
        const exportChoice = document
          .getElementById("exportFormat")
          .value.toUpperCase()
        const includeIconData =
          document.getElementById("includeIconData").checked
        const includeCreationDates = document.getElementById(
          "includeCreationDates"
        ).checked
        const includeFolderModDates = document.getElementById(
          "includeFolderModDates"
        ).checked

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
            // Create faviconMap with URLs instead of Base64 data
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

            const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Bookmarks</title>
  <link rel="icon" type="image/png" href="https://github.com/ChickenSoup269/Extension_Bookmark-Manager/blob/main/icons/icon.png?raw=true">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 20px; 
      background-color: #f5f5f5; 
      color: #333; 
    }
    .container { 
      max-width: 1200px; 
      margin: auto; 
      background: white; 
      padding: 20px; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    .controls { 
      margin-bottom: 20px; 
      display: flex; 
      gap: 10px; 
      align-items: center; 
    }
    #searchInput { 
      padding: 10px; 
      width: 100%; 
      max-width: 300px; 
      border: 1px solid #ccc; 
      border-radius: 4px; 
      font-size: 14px; 
    }
    .view-toggle { 
      padding: 8px 16px; 
      border: none; 
      border-radius: 4px; 
      background-color: #e0e0e0; 
      cursor: pointer; 
      font-size: 14px; 
      transition: background-color 0.2s, transform 0.1s; 
    }
    .view-toggle:hover { 
      background-color: #d0d0d0; 
      transform: translateY(-1px); 
    }
    .view-toggle.active { 
      background-color: #007bff; 
      color: white; 
    }
    .bookmark-list { 
      list-style: none; 
      padding: 0; 
    }
    .bookmark-list li { 
      padding: 12px; 
      border-bottom: 1px solid #eee; 
      transition: background-color 0.2s; 
    }
    .bookmark-list li:hover { 
      background-color: #f8f8f8; 
    }
    .bookmark-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
      gap: 15px; 
    }
    .bookmark-grid .bookmark-item { 
      border: 1px solid #eee; 
      padding: 15px; 
      border-radius: 6px; 
      text-align: center; 
      background: white; 
      transition: box-shadow 0.2s; 
    }
    .bookmark-grid .bookmark-item:hover { 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
    }
    .bookmark-item a { 
      text-decoration: none; 
      color: #007bff; 
      font-size: 14px; 
    }
    .bookmark-item a:hover { 
      text-decoration: underline; 
    }
    .bookmark-item img { 
      width: 16px; 
      height: 16px; 
      margin-right: 8px; 
      vertical-align: middle; 
    }
    .folder { 
      font-weight: 600; 
      margin: 10px 0; 
      cursor: pointer; 
      color: #444; 
      padding: 10px; 
      border-radius: 4px; 
      transition: background-color 0.2s; 
    }
    .folder::before { 
      content: "📁 "; 
      font-size: 16px; 
    }
    .folder.open::before { 
      content: "📂 "; 
    }
    .nested { 
      padding-left: 30px; 
      display: none; 
      transition: all 0.3s ease; 
    }
    .open > .nested { 
      display: block; 
    }
    .tree-view { 
      list-style: none; 
      padding: 0; 
    }
    .hidden { 
      display: none; 
    }
    .meta-info { 
      font-size: 12px; 
      color: #666; 
      margin-left: 24px; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="controls">
      <input type="text" id="searchInput" placeholder="{{searchPlaceholder}}">
      <button class="view-toggle" id="listViewBtn" onclick="toggleView('list')">List View</button>
      <button class="view-toggle" id="gridViewBtn" onclick="toggleView('grid')">Grid View</button>
      <button class="view-toggle" id="treeViewBtn" onclick="toggleView('tree')">Tree View</button>
    </div>
    <ul id="bookmarkList" class="bookmark-list"></ul>
    <div id="bookmarkGrid" class="bookmark-grid hidden"></div>
    <ul id="bookmarkTree" class="tree-view hidden"></ul>
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

    function formatDate(timestamp) {
      return timestamp ? new Date(timestamp).toLocaleString() : "N/A";
    }

    function renderBookmarks(nodes, parent = listContainer, gridParent = gridContainer, treeParent = treeContainer, depth = 0) {
      // Separate folders and bookmarks for tree view
      const folders = nodes.filter(node => node.children);
      const bookmarks = nodes.filter(node => node.url);

      // Render for list and grid views
      nodes.forEach(node => {
        if (node.url) {
          const li = document.createElement("li");
          li.className = "bookmark-item";
          if (includeIconData && faviconMap[node.url]) {
            li.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='https://www.google.com/s2/favicons?sz=32&domain=example.com'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          } else {
            li.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          }
          if (includeCreationDates) {
            li.innerHTML += \`<div class="meta-info">Created: \${formatDate(node.dateAdded)}</div>\`;
          }
          parent.appendChild(li);

          const gridItem = document.createElement("div");
          gridItem.className = "bookmark-item";
          if (includeIconData && faviconMap[node.url]) {
            gridItem.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='https://www.google.com/s2/favicons?sz=32&domain=example.com'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          } else {
            gridItem.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          }
          if (includeCreationDates) {
            gridItem.innerHTML += \`<div class="meta-info">Created: \${formatDate(node.dateAdded)}</div>\`;
          }
          gridParent.appendChild(gridItem);
        }
      });

      // Render for tree view with folders first
      [...folders, ...bookmarks].forEach(node => {
        const treeItem = document.createElement("li");
        if (node.url) {
          treeItem.className = "bookmark-item";
          if (includeIconData && faviconMap[node.url]) {
            treeItem.innerHTML = \`<img src="\${faviconMap[node.url]}" onerror="this.src='https://www.google.com/s2/favicons?sz=32&domain=example.com'" alt="favicon"><a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          } else {
            treeItem.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          }
          if (includeCreationDates) {
            treeItem.innerHTML += \`<div class="meta-info">Created: \${formatDate(node.dateAdded)}</div>\`;
          }
        } else if (node.children) {
          treeItem.className = "folder";
          treeItem.textContent = node.title || "Unnamed Folder";
          if (includeCreationDates || includeFolderModDates) {
            const metaDiv = document.createElement("div");
            metaDiv.className = "meta-info";
            if (includeCreationDates) {
              metaDiv.innerHTML += \`Created: \${formatDate(node.dateAdded)}<br>\`;
            }
            if (includeFolderModDates) {
              metaDiv.innerHTML += \`Modified: \${formatDate(node.dateGroupModified)}\`;
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
        listContainer.className = "bookmark-list";
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
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "" : "none";
        if (item.classList.contains("folder") && item.querySelector(".bookmark-item")) {
          const hasVisibleChild = Array.from(item.querySelectorAll(".bookmark-item")).some(child => 
            child.textContent.toLowerCase().includes(query)
          );
          if (hasVisibleChild) {
            item.style.display = "";
            item.classList.add("open");
          }
        }
      });
    }

    searchInput.addEventListener("input", filterBookmarks);
    renderBookmarks(bookmarks);
    toggleView("list");
  </script>
</body>
</html>
`
            const htmlContent = htmlTemplate
              .replace("{{bookmarks}}", JSON.stringify(bookmarkTreeNodes))
              .replace(
                "{{searchPlaceholder}}",
                translations[language].searchPlaceholder ||
                  "Search bookmarks..."
              )
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

          document.body.removeChild(popup)
          elements.settingsMenu.classList.add("hidden")
        })
      })

    document.getElementById("cancelExport").addEventListener("click", () => {
      document.body.removeChild(popup)
    })

    const style = document.createElement("style")
    style.textContent = `
      .popup {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .popup-content {
        background: white;
        padding: 20px;
        border-radius: 5px;
        text-align: center;
      }
      .popup-content select, .popup-content button {
        margin: 10px;
        padding: 8px;
      }
      #advancedSettings {
        text-align: left;
      }
      #advancedSettings label {
        display: block;
        margin: 5px 0;
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

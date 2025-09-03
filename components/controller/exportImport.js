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
  elements.exportBookmarksOption.addEventListener("click", () => {
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
        <button id="confirmExport">${
          translations[language].confirm || "Export"
        }</button>
        <button id="cancelExport">${
          translations[language].cancel || "Cancel"
        }</button>
      </div>
    `
    document.body.appendChild(popup)

    document.getElementById("confirmExport").addEventListener("click", () => {
      const exportChoice = document
        .getElementById("exportFormat")
        .value.toUpperCase()
      safeChromeBookmarksCall("getTree", [], (bookmarkTreeNodes) => {
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
          const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Bookmarks</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: auto; }
    .controls { margin-bottom: 20px; }
    #searchInput { padding: 8px; width: 100%; max-width: 300px; }
    .view-toggle { margin-left: 20px; }
    .bookmark-list { list-style: none; padding: 0; }
    .bookmark-list li { padding: 10px; border-bottom: 1px solid #ddd; }
    .bookmark-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
      gap: 20px; 
    }
    .bookmark-grid .bookmark-item { 
      border: 1px solid #ddd; 
      padding: 15px; 
      border-radius: 5px; 
      text-align: center; 
    }
    .bookmark-item a { text-decoration: none; color: #007bff; }
    .bookmark-item a:hover { text-decoration: underline; }
    .folder { font-weight: bold; margin-top: 10px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="controls">
      <input type="text" id="searchInput" placeholder="${
        translations[language].searchPlaceholder || "Search bookmarks..."
      }">
      <button class="view-toggle" onclick="toggleView('list')">List View</button>
      <button class="view-toggle" onclick="toggleView('grid')">Grid View</button>
    </div>
    <ul id="bookmarkList" class="bookmark-list"></ul>
    <div id="bookmarkGrid" class="bookmark-grid hidden"></div>
  </div>

  <script>
    const bookmarks = ${JSON.stringify(bookmarkTreeNodes)};
    const listContainer = document.getElementById("bookmarkList");
    const gridContainer = document.getElementById("bookmarkGrid");
    const searchInput = document.getElementById("searchInput");

    function renderBookmarks(nodes, parent = listContainer, gridParent = gridContainer, depth = 0) {
      nodes.forEach(node => {
        if (node.url) {
          const li = document.createElement("li");
          li.className = "bookmark-item";
          li.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          parent.appendChild(li);

          const gridItem = document.createElement("div");
          gridItem.className = "bookmark-item";
          gridItem.innerHTML = \`<a href="\${node.url}" target="_blank">\${node.title || node.url}</a>\`;
          gridParent.appendChild(gridItem);
        }
        if (node.children) {
          const folder = document.createElement("li");
          folder.className = "folder";
          folder.textContent = node.title || "Unnamed Folder";
          parent.appendChild(folder);
          
          const gridFolder = document.createElement("div");
          gridFolder.className = "folder bookmark-item";
          gridFolder.textContent = node.title || "Unnamed Folder";
          gridParent.appendChild(gridFolder);

          renderBookmarks(node.children, parent, gridParent, depth + 1);
        }
      });
    }

    function toggleView(view) {
      if (view === "list") {
        listContainer.classList.remove("hidden");
        gridContainer.classList.add("hidden");
      } else {
        listContainer.classList.add("hidden");
        gridContainer.classList.remove("hidden");
      }
    }

    function filterBookmarks() {
      const query = searchInput.value.toLowerCase();
      const items = document.querySelectorAll(".bookmark-item");
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "" : "none";
      });
    }

    searchInput.addEventListener("input", filterBookmarks);
    renderBookmarks(bookmarks);
  </script>
</body>
</html>
          `
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

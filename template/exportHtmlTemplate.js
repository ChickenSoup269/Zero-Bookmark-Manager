export function generateHtmlExport(bookmarkTreeNodes, language) {
  return `
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
}

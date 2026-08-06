import { showCustomPopup } from "./utils/utils.js"

export function initSessionManager(elements) {
  const saveSessionBtn = document.getElementById("save-session-btn")
  const saveSessionPopup = document.getElementById("save-session-popup")
  const saveSessionFolderSelect = document.getElementById("save-session-folder-select")
  const saveSessionFolderName = document.getElementById("save-session-folder-name")
  const cancelSaveSessionBtn = document.getElementById("cancel-save-session-btn")
  const confirmSaveSessionBtn = document.getElementById("confirm-save-session-btn")

  if (!saveSessionBtn || !saveSessionPopup) return

  // Load folders into the select dropdown
  const loadFolders = () => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      saveSessionFolderSelect.innerHTML = '<option value="new">-- Create New Folder --</option>'
      const traverse = (nodes, depth = 0) => {
        nodes.forEach((node) => {
          if (!node.url && node.id !== "0") {
            const prefix = "\u00A0".repeat(depth * 4)
            const option = document.createElement("option")
            option.value = node.id
            option.textContent = prefix + node.title
            saveSessionFolderSelect.appendChild(option)
          }
          if (node.children) {
            traverse(node.children, depth + 1)
          }
        })
      }
      traverse(bookmarkTreeNodes)
    })
  }

  saveSessionFolderSelect.addEventListener("change", (e) => {
    if (e.target.value === "new") {
      saveSessionFolderName.style.display = "block"
    } else {
      saveSessionFolderName.style.display = "none"
    }
  })

  saveSessionBtn.addEventListener("click", () => {
    // Close settings menu if open
    const settingsMenu = document.getElementById("settings-menu")
    if (settingsMenu && !settingsMenu.classList.contains("hidden")) {
      settingsMenu.classList.add("hidden")
    }
    
    // Set default name
    const dateStr = new Date().toLocaleString()
    saveSessionFolderName.value = `Session - ${dateStr}`
    saveSessionFolderName.style.display = "block"
    
    loadFolders()
    saveSessionPopup.classList.remove("hidden")
  })

  const closePopup = () => {
    saveSessionPopup.classList.add("hidden")
  }

  cancelSaveSessionBtn.addEventListener("click", closePopup)

  confirmSaveSessionBtn.addEventListener("click", () => {
    const isNewFolder = saveSessionFolderSelect.value === "new"
    const targetFolderId = saveSessionFolderSelect.value
    const newFolderName = saveSessionFolderName.value.trim() || `Session - ${new Date().toLocaleString()}`

    chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] }, (window) => {
      const tabs = window?.tabs || []
      const validTabs = tabs.filter(tab => tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://"))
      
      if (validTabs.length === 0) {
        closePopup()
        return
      }

      const saveTabs = (folderId, folderName) => {
        validTabs.forEach((tab) => {
          chrome.bookmarks.create({
            parentId: folderId,
            title: tab.title,
            url: tab.url,
          })
        })

        const t = window.translations && window.translations[localStorage.getItem("appLanguage") || "en"]
        const msg = t ? (t.sessionSaved || `Đã lưu ${validTabs.length} tabs vào thư mục: ${folderName}`) : `Saved ${validTabs.length} tabs to folder: ${folderName}`
        
        showCustomPopup(msg, "success")
        closePopup()
      }

      if (isNewFolder) {
        chrome.bookmarks.create(
          { parentId: "1", title: newFolderName },
          (newFolder) => {
            saveTabs(newFolder.id, newFolderName)
          }
        )
      } else {
        const selectedOption = saveSessionFolderSelect.options[saveSessionFolderSelect.selectedIndex]
        saveTabs(targetFolderId, selectedOption.textContent.trim())
      }
    })
  })
}

const LOCAL_STORAGE_BACKUP_KEYS = [
  "appLanguage",
  "appTheme",
  "appFont",
  "appView",
  "faviconOption",
  "headerLineStyle",
  "duplicateScope",
  "autoRemoveDup",
  "settingsSectionCollapsedStates",
  "customLanguagePacks",
  "firstRunComplete",
]

const CHROME_STORAGE_BACKUP_KEYS = [
  "uiState",
  "storageSettings",
  "quickOpenAction",
  "showBookmarkIds",
  "folderListBg",
  "checkboxesVisible",
  "exportFormat",
  "exportIncludeIconData",
  "exportIncludeCreationDates",
  "exportIncludeFolderModDates",
  "exportIncludeFolderPath",
  "exportOnlySelected",
]

function getLocalStorageBackup() {
  return LOCAL_STORAGE_BACKUP_KEYS.reduce((backup, key) => {
    const value = localStorage.getItem(key)
    if (value !== null) {
      backup[key] = value
    }
    return backup
  }, {})
}

export async function exportToJSON(exportData) {
  try {
    // 1. Get visit counts from background script
    let visitCounts = {}
    try {
      visitCounts = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getVisitCounts" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Error getting visit counts:",
              chrome.runtime.lastError,
            )
            resolve({})
          } else {
            resolve(response?.visitCounts || {})
          }
        })
        // Timeout fallback
        setTimeout(() => resolve({}), 2000)
      })
    } catch (err) {
      console.warn("Failed to get visit counts, using empty object:", err)
      visitCounts = {}
    }

    // Get other data from storage
    const storageData = await chrome.storage.local.get([
      "bookmarkTags",
      "favoriteBookmarks",
      "pinnedBookmarks",
      "tagColors",
      "tagTextColors",
      ...CHROME_STORAGE_BACKUP_KEYS,
    ])

    const {
      bookmarkTags,
      favoriteBookmarks,
      pinnedBookmarks,
      tagColors,
      tagTextColors,
    } = storageData

    const allTags = bookmarkTags || {}
    const favorites = favoriteBookmarks || {}
    const pins = pinnedBookmarks || {}
    const allTagColors = tagColors || {}
    const allTagTextColors = tagTextColors || {}

    // Deep copy để không làm ảnh hưởng đến dữ liệu gốc trong app
    const treeCopy = JSON.parse(JSON.stringify(exportData))

    if (!treeCopy.bookmarks || !Array.isArray(treeCopy.bookmarks)) {
      throw new Error("Invalid bookmark data")
    }

    // 2. Hàm làm giàu dữ liệu (Enrich Nodes)
    function enrichNodes(nodes) {
      if (!Array.isArray(nodes)) return
      nodes.forEach((node) => {
        if (node.url) {
          const tagsForBookmark = allTags[node.id] || []
          // Chuyển đổi tags từ string[] thành object[] với đầy đủ thông tin màu sắc
          node.tags = tagsForBookmark.map((tagName) => ({
            name: tagName,
            bgColor: allTagColors[tagName] || "#FFFFFF", // Default màu nền
            textColor: allTagTextColors[tagName] || "#000000", // Default màu chữ
          }))
          node.accessCount = visitCounts[node.id] || 0
          node.isFavorite = !!favorites[node.id] // Chuyển thành boolean true/false
          node.isPinned = !!pins[node.id]
        }
        if (node.children) {
          enrichNodes(node.children)
        }
      })
    }

    enrichNodes(treeCopy.bookmarks)

    const chromeStorageBackup = {}
    CHROME_STORAGE_BACKUP_KEYS.forEach((key) => {
      if (storageData[key] !== undefined) {
        chromeStorageBackup[key] = storageData[key]
      }
    })

    const exportedAt = new Date().toISOString()
    const manifest = chrome.runtime.getManifest?.() || {}

    // Bổ sung thông tin màu sắc và app settings vào gốc của file JSON
    const exportPayload = {
      ...treeCopy,
      backup: {
        format: "zero-bookmark-full-backup",
        schemaVersion: 2,
        exportedAt,
        extensionVersion: manifest.version || null,
        includes: {
          bookmarks: true,
          metadata: true,
          appSettings: true,
        },
      },
      theme: {
        tagColors: allTagColors,
        tagTextColors: allTagTextColors,
      },
      appSettings: {
        localStorage: getLocalStorageBackup(),
        chromeStorage: chromeStorageBackup,
      },
    }

    await chrome.storage.local.set({ lastBackupAt: exportedAt })

    // 3. Tiến hành xuất file
    const jsonString = JSON.stringify(exportPayload, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bookmarks_full_${
      new Date().toISOString().split("T")[0]
    }.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

  } catch (error) {
    console.error("JSON export failed:", error)
    throw error
  }
}

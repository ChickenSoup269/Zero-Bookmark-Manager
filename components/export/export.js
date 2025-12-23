// components/export/export.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "../utils/utils.js"
import { flattenBookmarks, getFolders } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, saveUIState } from "../state.js"
import { exportToJSON } from "./json.js"
import { exportToHTML } from "./html.js"
import { exportToCSV } from "./csv.js"

export function setupExportImportListeners(elements) {
  elements.exportBookmarksOption.addEventListener("click", async () => {
    const language = localStorage.getItem("appLanguage") || "en"
    let appTheme = localStorage.getItem("appTheme") || "dark"
    const currentTheme =
      appTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : appTheme

    // Đọc cấu hình export lần trước (nếu có)
    const {
      exportFormat: storedExportFormat,
      exportIncludeIconData = false,
      exportIncludeCreationDates = false,
      exportIncludeFolderModDates = false,
      exportIncludeFolderPath = false,
      exportOnlySelected = false,
    } = await chrome.storage.local.get([
      "exportFormat",
      "exportIncludeIconData",
      "exportIncludeCreationDates",
      "exportIncludeFolderModDates",
      "exportIncludeFolderPath",
      "exportOnlySelected",
    ])

    const popup = document.createElement("div")
    popup.className = "popup"
    popup.setAttribute("data-theme", currentTheme)
    popup.innerHTML = `
    <div class="popup-content enhanced-popup">
      <div class="popup-header">
        <div class="icon-wrapper">
          <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <h2>${translations[language].exportTitle || "Export Bookmarks"}</h2>
        <p class="popup-subtitle">${
          translations[language].popupSubtitle ||
          "Choose your preferred export format and settings"
        }</p>
      </div>
      
      <div class="form-section">
        <label class="form-label">${
          translations[language].exportFormat || "Export Format"
        }</label>
        <div class="format-options">
          <div class="format-card active" data-format="json">
            <div class="format-icon">
              <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"></path>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
              </svg>
            </div>
            <h3>JSON</h3>
            <p>${
              translations[language].jsonDescription ||
              "Machine readable format"
            }</p>
          </div>
          <div class="format-card" data-format="html">
            <div class="format-icon">
              <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <h3>HTML</h3>
            <p>${
              translations[language].htmlDescription || "Interactive web page"
            }</p>
          </div>
          <div class="format-card" data-format="csv">
            <div class="format-icon">
              <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18V3H3z"></path>
                <path d="M12 3v18"></path>
                <path d="M3 12h18"></path>
              </svg>
            </div>
            <h3>CSV</h3>
            <p>${
              translations[language].csvDescription || "Spreadsheet format"
            }</p>
          </div>
        </div>
      </div>
      
      <div class="form-section advanced-section">
        <button type="button" class="advanced-toggle" id="advancedToggle">
          <span class="advanced-title">${
            translations[language].advancedSettings || "Advanced Settings"
          }</span>
          <span class="advanced-arrow" id="advancedArrow">▼</span>
        </button>
        <div class="settings-grid" id="advancedSettings">
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
              <p>${
                translations[language].includeIconDataDescription ||
                "Add favicon data to bookmarks"
              }</p>
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
              <p>${
                translations[language].includeCreationDatesDescription ||
                "Add creation timestamps"
              }</p>
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
              <p>${
                translations[language].includeFolderModDatesDescription ||
                "Add folder timestamps"
              }</p>
            </div>
          </div>
          
          <div class="setting-card">
            <div class="setting-toggle">
              <input type="checkbox" id="includeFolderPath" class="toggle-input">
              <label for="includeFolderPath" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-info">
              <h4>${
                translations[language].includeFolderPath ||
                "Include folder path"
              }</h4>
              <p>${
                translations[language].includeFolderPathDescription ||
                "Add folder path to bookmarks"
              }</p>
            </div>
          </div>
          <div class="setting-card">
            <div class="setting-toggle">
              <input type="checkbox" id="exportOnlySelected" class="toggle-input">
              <label for="exportOnlySelected" class="toggle-label">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-info">
              <h4>${
                translations[language].exportOnlySelected ||
                "Only export selected bookmarks"
              }</h4>
              <p>${
                translations[language].exportOnlySelectedDescription ||
                "If any bookmarks are checked in the main list, export only those"
              }</p>
            </div>
        </div>
        </div>
      
      </div>
      
      <div class="popup-footer">
        <button id="cancelExport" class="btn-secondary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          ${translations[language].cancel || "Cancel"}
        </button>
        <button id="confirmExport" class="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          ${translations[language].exportTitle || "Export"}
        </button>
      </div>
    </div>
  `
    document.body.appendChild(popup)

    // Format selection handling
    const formatCards = popup.querySelectorAll(".format-card")
    let selectedFormat = storedExportFormat || "json"

    // Apply saved format card state
    formatCards.forEach((card) => {
      const isActive = card.dataset.format === selectedFormat
      card.classList.toggle("active", isActive)
      card.addEventListener("click", () => {
        formatCards.forEach((c) => c.classList.remove("active"))
        card.classList.add("active")
        selectedFormat = card.dataset.format
      })
    })

    // Apply saved checkbox states
    const includeIconInput = document.getElementById("includeIconData")
    const includeCreationInput = document.getElementById("includeCreationDates")
    const includeFolderModInput = document.getElementById(
      "includeFolderModDates"
    )
    const includeFolderPathInput = document.getElementById("includeFolderPath")
    const exportOnlySelectedInput =
      document.getElementById("exportOnlySelected")

    if (includeIconInput) includeIconInput.checked = exportIncludeIconData
    if (includeCreationInput)
      includeCreationInput.checked = exportIncludeCreationDates
    if (includeFolderModInput)
      includeFolderModInput.checked = exportIncludeFolderModDates
    if (includeFolderPathInput)
      includeFolderPathInput.checked = exportIncludeFolderPath
    if (exportOnlySelectedInput)
      exportOnlySelectedInput.checked = exportOnlySelected

    // Advanced settings collapse/expand
    const advancedToggle = document.getElementById("advancedToggle")
    const advancedSettings = document.getElementById("advancedSettings")
    const advancedArrow = document.getElementById("advancedArrow")

    if (advancedToggle && advancedSettings && advancedArrow) {
      let advancedOpen = true
      const toggleAdvanced = () => {
        advancedOpen = !advancedOpen
        advancedSettings.style.display = advancedOpen ? "grid" : "none"
        advancedArrow.textContent = advancedOpen ? "▼" : "►"
      }
      // Khởi tạo trạng thái: mặc định mở
      advancedSettings.style.display = "grid"
      advancedToggle.addEventListener("click", toggleAdvanced)
    }

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
        const includeFolderPath =
          document.getElementById("includeFolderPath").checked
        const exportOnlySelected =
          document.getElementById("exportOnlySelected").checked

        // Lưu cấu hình lần export này
        chrome.storage.local.set({
          exportFormat: selectedFormat,
          exportIncludeIconData: includeIconData,
          exportIncludeCreationDates: includeCreationDates,
          exportIncludeFolderModDates: includeFolderModDates,
          exportIncludeFolderPath: includeFolderPath,
          exportOnlySelected,
        })

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

          try {
            if (exportChoice === "JSON") {
              await exportToJSON(exportData)
            } else if (exportChoice === "HTML") {
              await exportToHTML(
                bookmarkTreeNodes,
                includeIconData,
                includeCreationDates,
                includeFolderModDates,
                language,
                currentTheme
              )
            } else if (exportChoice === "CSV") {
              await exportToCSV(
                bookmarkTreeNodes,
                includeCreationDates,
                includeFolderModDates,
                includeIconData,
                includeFolderPath,
                exportOnlySelected
              )
            }
          } catch (error) {
            console.error("Export error:", error)
            showCustomPopup(
              translations[language].errorUnexpected ||
                "Unexpected error occurred",
              "error",
              false
            )
          } finally {
            // Reset button state
            confirmBtn.innerHTML = originalContent
            confirmBtn.disabled = false
            document.body.removeChild(popup)
            elements.settingsMenu.classList.add("hidden")
          }
        })
      })

    // Close popup when clicking outside
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        document.body.removeChild(popup)
      }
    })

    document.getElementById("cancelExport").addEventListener("click", () => {
      document.body.removeChild(popup)
    })

    // Enhanced popup styles (unchanged)
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
      border-radius: 0.75rem;
      box-shadow: 0 15px 30px -8px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
      padding: 0.5rem;
    }
    
    .popup-header {
      text-align: center;
      padding: 1rem 0.75rem 0.5rem;
      border-bottom: 1px solid var(--border-color);
    }
    
    .icon-wrapper {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 0.5rem;
      color: white;
    }
    
    .popup-header h2 {
      margin: 0 0 0.2rem;
      color: var(--text-primary);
      font-size: 1.25rem;
      font-weight: 700;
    }
    
    .popup-subtitle {
      color: var(--text-secondary);
      margin: 0;
      font-size: 0.8rem;
    }
    
    .form-section {
      padding: 0.75rem;
    }
    
    .advanced-section {
      padding: 0.75rem;
    }

    .advanced-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.25rem 0;
      cursor: pointer;
    }

    .advanced-title {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .advanced-arrow {
      font-size: 0.75rem;
      opacity: 0.8;
      transition: transform 0.2s ease;
    }
    
    .format-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
      gap: 0.5rem;
      margin-bottom: 0.2rem;
    }

    .icon {
      color: var(--text-primary);
    }
    
    .format-card {
      padding: 0.75rem;
      border: 2px solid var(--border-color);
      border-radius: 0.4rem;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      background: var(--bg-primary);
    }

    .format-card p {
      margin: 0;
      font-size: 0.65rem;
      line-height: 1.2;
    }
    
    .format-card:hover {
      border-color: var(--accent-color);
      transform: translateY(-2px);
      box-shadow: var(--box-shadow);
    }
    
    .format-card.active {
      border-color: var(--accent-color);
      background: var(--text-primary);
      color: var(--bg-primary);
      box-shadow: var(--box-shadow);
    }
  
    .format-card.active h3,
    .format-card.active p,
    .format-card.active svg
    {
      color: var(--bg-primary); 
    }
    
    .format-icon {
      margin-bottom: 0.4rem;
    }
    
    .format-card h3 {
      margin: 0 0 0.2rem;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .settings-grid {
      display: grid;
      gap: 0.5rem;
    }
    
    .setting-card {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 0.4rem;
      transition: all 0.2s ease;
    }
    
    .setting-card:hover {
      border-color: var(--accent-color);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
    }
    
    .setting-toggle {
      flex-shrink: 0;
      position: relative;
    }
    
    .toggle-input {
      display: none;
    }
    
    .toggle-label {
      display: inline-block;
      width: 32px;
      height: 16px;
      background: var(--border-color);
      border-radius: 16px;
      cursor: pointer;
      position: relative;
      transition: background 0.3s ease;
    }
    
    .toggle-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    
    .toggle-input:checked + .toggle-label {
      background: var(--focus-outline);
    }
    
    .toggle-input:checked + .toggle-label .toggle-slider {
      transform: translateX(16px);
    }
    
    .setting-info h4 {
      margin: 0 0 0.15rem;
      color: var(--text-primary);
      font-size: 0.7rem;
      font-weight: 600;
    }
    
    .setting-info p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.6rem;
    }
    
    .popup-footer {
      padding: 0.75rem 1rem 1rem;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      border-top: 1px solid var(--border-color);
    }
    
    .btn-primary,
    .btn-secondary {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.3rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
    }
    
    .btn-primary {
      background: var(--focus-outline);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    
    .btn-secondary:hover {
      background: var(--hover-bg);
      transform: translateY(-1px);
    }
    
    .loading-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Dark mode specific text contrast adjustments */
    .popup[data-theme="dark"] .popup-header h2,
    .popup[data-theme="dark"] .form-label,
    .popup[data-theme="dark"] .setting-info h4 {
      color: #e2e8f0;
    }
    
    .popup[data-theme="dark"] .popup-subtitle,
    .popup[data-theme="dark"] .setting-info p {
      color: #cbd5e1;
    }
    
    @media (max-width: 640px) {
      .enhanced-popup {
        width: 95%;
        margin: 0.5rem;
      }
      
      .format-options {
        grid-template-columns: 1fr;
      }
      
      .popup-footer {
        flex-direction: column-reverse;
        gap: 0.4rem;
      }
      
      .btn-primary,
      .btn-secondary {
        justify-content: center;
        padding: 0.5rem 0.7rem;
      }
      
      .popup-header {
        padding: 0.75rem 0.5rem 0.4rem;
      }
      
      .form-section {
        padding: 0.5rem 0.75rem;
      }
      
      .popup-footer {
        padding: 0.4rem 0.75rem 0.75rem;
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
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result)
          importNonDuplicateBookmarks(data.bookmarks, elements)
          // ... kiểm tra tính hợp lệ của data ...

          // THAY VÌ: flattenBookmarks(data.bookmarks)
          // HÃY LẤY: dữ liệu gốc để giữ cấu trúc folder
          const rawImportData = data.bookmarks

          // Thu thập Tags và AccessCount từ file JSON (vẫn dùng bản flatten để lấy map id)
          const flatData = flattenBookmarks(rawImportData)
          const importedTags = {}
          const importedAccessCounts = {}
          flatData.forEach((b) => {
            if (b.tags) importedTags[b.id] = b.tags
            if (b.accessCount) importedAccessCounts[b.id] = b.accessCount
          })
        } catch (e) {
          console.error(e)
        }
      }
      reader.readAsText(file)
    })
    input.click()
    elements.settingsMenu.classList.add("hidden")
  })
}

async function importNonDuplicateBookmarks(nodesToImport, elements) {
  const language = localStorage.getItem("appLanguage") || "en"
  const idMapping = {}
  const tagsFromJSON = {}

  // 1. Quét Tag từ JSON
  function extractTags(nodes) {
    nodes.forEach((node) => {
      if (node.tags && node.tags.length > 0) tagsFromJSON[node.id] = node.tags
      if (node.children) extractTags(node.children)
    })
  }
  extractTags(nodesToImport)

  // 2. Lấy cây hiện tại để tìm ID hệ thống của Edge/Chrome mới
  const existingTree = await new Promise((r) => chrome.bookmarks.getTree(r))
  const flatExisting = flattenBookmarks(existingTree)
  const existingUrls = new Set(flatExisting.map((b) => b.url).filter((u) => u))

  // Ánh xạ ID hệ thống: [0] thường là root, con của nó là Bar(1) và Other(2)
  const localBarId = existingTree[0]?.children?.[0]?.id || "1"
  const localOtherId = existingTree[0]?.children?.[1]?.id || "2"

  const createBookmark = (data) => {
    return new Promise((resolve) => {
      chrome.bookmarks.create(data, (res) => {
        if (chrome.runtime.lastError) resolve(null)
        else resolve(res)
      })
    })
  }

  // 3. Hàm đệ quy xử lý logic ánh xạ thư mục gốc
  async function processNodes(nodes, currentParentId) {
    for (const node of nodes) {
      let targetParentIdForChildren = currentParentId

      // KIỂM TRA NẾU LÀ THƯ MỤC HỆ THỐNG TRONG FILE JSON
      if (node.id === "1") {
        // Nếu là Bookmark Bar từ máy cũ -> Ánh xạ vào Bookmark Bar máy mới
        await processNodes(node.children, localBarId)
        continue
      }
      if (node.id === "2") {
        // Nếu là Other Bookmarks từ máy cũ -> Ánh xạ vào Other Bookmarks máy mới
        await processNodes(node.children, localOtherId)
        continue
      }
      if (node.id === "0") {
        // Gốc của cây -> Đi tiếp vào con
        await processNodes(node.children, currentParentId)
        continue
      }

      // XỬ LÝ THƯ MỤC NGƯỜI DÙNG TẠO (FE, BE, v.v.)
      if (node.children) {
        const currentChildren = await new Promise((r) =>
          chrome.bookmarks.getChildren(currentParentId, r)
        )
        let targetFolder = currentChildren.find(
          (c) => !c.url && c.title === node.title
        )

        if (!targetFolder) {
          targetFolder = await createBookmark({
            parentId: currentParentId,
            title: node.title,
          })
        }

        if (targetFolder) {
          idMapping[node.id] = targetFolder.id
          await processNodes(node.children, targetFolder.id)
        }
      }
      // XỬ LÝ BOOKMARK
      else if (node.url) {
        if (existingUrls.has(node.url)) {
          const eb = flatExisting.find((b) => b.url === node.url)
          if (eb) idMapping[node.id] = eb.id
          continue
        }

        const newB = await createBookmark({
          parentId: currentParentId,
          title: node.title,
          url: node.url,
        })
        if (newB) {
          idMapping[node.id] = newB.id
          existingUrls.add(node.url)
        }
      }
    }
  }

  try {
    // 1. Đợi quá trình tạo bookmark trên Edge/Chrome hoàn tất
    await processNodes(nodesToImport, localOtherId)

    // 2. Lấy dữ liệu hiện có từ Storage máy mới
    const storageData = await chrome.storage.local.get([
      "bookmarkTags",
      "bookmarkAccessCounts",
      "favoriteBookmarks",
      "pinnedBookmarks",
    ])

    const bookmarkTags = storageData.bookmarkTags || {}
    const bookmarkAccessCounts = storageData.bookmarkAccessCounts || {}
    const favoriteBookmarks = storageData.favoriteBookmarks || {}
    const pinnedBookmarks = storageData.pinnedBookmarks || {}

    // 3. Hàm đệ quy duy nhất để khôi phục toàn bộ Metadata
    function restoreMetadata(nodes) {
      nodes.forEach((node) => {
        const newId = idMapping[node.id] // Tìm ID mới tương ứng trên máy này

        if (newId) {
          // Khôi phục Yêu thích & Ghim
          if (node.isFavorite) favoriteBookmarks[newId] = true
          if (node.isPinned) pinnedBookmarks[newId] = true

          // Khôi phục Tags (Hợp nhất với tag cũ nếu đã có)
          if (node.tags && node.tags.length > 0) {
            const existingTags = bookmarkTags[newId] || []
            // Dùng Set để tránh bị trùng tag
            bookmarkTags[newId] = [...new Set([...existingTags, ...node.tags])]
          }

          // Khôi phục số lần truy cập (Cộng dồn)
          if (node.accessCount) {
            bookmarkAccessCounts[newId] =
              (bookmarkAccessCounts[newId] || 0) + node.accessCount
          }
        }

        // Đi sâu vào các thư mục con
        if (node.children) restoreMetadata(node.children)
      })
    }

    // Chạy khôi phục
    restoreMetadata(nodesToImport)

    // 4. Lưu tất cả vào Storage
    await chrome.storage.local.set({
      bookmarkTags,
      bookmarkAccessCounts,
      favoriteBookmarks,
      pinnedBookmarks,
    })

    // 5. Cập nhật giao diện
    setTimeout(() => {
      chrome.bookmarks.getTree((newTree) => {
        uiState.bookmarkTree = newTree
        uiState.bookmarks = flattenBookmarks(newTree)
        uiState.folders = getFolders(newTree)

        // Đảm bảo uiState cũng được cập nhật dữ liệu mới nhất
        uiState.bookmarkTags = bookmarkTags

        renderFilteredBookmarks(newTree, elements)
        saveUIState()
        showCustomPopup(
          translations[language].importSuccess || "Import thành công!",
          "success"
        )
      })
    }, 200)
  } catch (error) {
    console.error("Import Error:", error)
  }
}

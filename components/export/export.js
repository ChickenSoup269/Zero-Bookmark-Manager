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

          if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
            const language = localStorage.getItem("appLanguage") || "en"
            showCustomPopup(
              translations[language].importInvalidFile || "Invalid file format",
              "error",
              false
            )
            console.error(
              "Invalid JSON: bookmarks property missing or not an array"
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
              console.error("Failed to fetch bookmark tree")
              return
            }

            const existingBookmarks = flattenBookmarks(bookmarkTreeNodes)
            const existingUrls = new Set(existingBookmarks.map((b) => b.url))

            const bookmarksToImport = []
            const duplicateBookmarks = []
            const importedTags = {} // Map old ID to tags
            const importedAccessCounts = {} // Map old ID to access count
            const flattenImportedBookmarks = flattenBookmarks(data.bookmarks)

            // Collect bookmarks, tags, and access counts
            flattenImportedBookmarks.forEach((bookmark, index) => {
              if (bookmark.url) {
                if (existingUrls.has(bookmark.url)) {
                  duplicateBookmarks.push(bookmark)
                } else {
                  bookmarksToImport.push(bookmark)
                  if (bookmark.id) {
                    if (Array.isArray(bookmark.tags)) {
                      importedTags[bookmark.id] = bookmark.tags
                    } else {
                      console.warn(`No valid tags for ID ${bookmark.id}`)
                    }
                    if (typeof bookmark.accessCount === "number") {
                      importedAccessCounts[bookmark.id] = bookmark.accessCount
                    } else {
                      console.warn(`No valid accessCount for ID ${bookmark.id}`)
                    }
                  } else {
                    console.warn("Bookmark missing ID:", bookmark)
                  }
                }
              } else {
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
                () =>
                  importNonDuplicateBookmarks(
                    bookmarksToImport,
                    elements,
                    importedTags,
                    importedAccessCounts
                  )
              )
            } else {
              importNonDuplicateBookmarks(
                bookmarksToImport,
                elements,
                importedTags,
                importedAccessCounts
              )
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

async function importNonDuplicateBookmarks(
  bookmarksToImport,
  elements,
  importedTags,
  importedAccessCounts
) {
  const language = localStorage.getItem("appLanguage") || "en"
  const idMapping = {}

  // --- BƯỚC MỚI: TÌM ID GỐC CỦA TRÌNH DUYỆT HIỆN TẠI ---
  const getSafeParentId = () => {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((nodes) => {
        // Thông thường: nodes[0] là root, nodes[0].children[1] là "Other Bookmarks"
        // Chúng ta lấy ID của "Other Bookmarks" để đảm bảo an toàn
        const otherBookmarks =
          nodes[0]?.children?.[1] || nodes[0]?.children?.[0]
        resolve(otherBookmarks.id || "2")
      })
    })
  }

  const targetParentId = await getSafeParentId()
  // ---------------------------------------------------

  const importPromises = bookmarksToImport.map((bookmark) => {
    return new Promise((resolve) => {
      safeChromeBookmarksCall(
        "create",
        [
          {
            // KHÔNG dùng bookmark.parentId từ file JSON vì ID đó là của trình duyệt cũ
            parentId: targetParentId,
            title: bookmark.title || "",
            url: bookmark.url,
          },
        ],
        (result) => {
          if (result && result.id && bookmark.id) {
            idMapping[bookmark.id] = result.id
          }
          resolve(result)
        }
      )
    })
  })

  try {
    await Promise.all(importPromises)

    // Fetch existing storage data
    const { bookmarkTags = {}, bookmarkAccessCounts = {} } =
      await chrome.storage.local.get(["bookmarkTags", "bookmarkAccessCounts"])

    // Update tags and access counts with new IDs
    let tagsUpdated = 0
    let countsUpdated = 0
    for (const [oldId, tags] of Object.entries(importedTags)) {
      if (idMapping[oldId] && Array.isArray(tags)) {
        bookmarkTags[idMapping[oldId]] = tags
        tagsUpdated++
      }
    }
    for (const [oldId, count] of Object.entries(importedAccessCounts)) {
      if (idMapping[oldId] && typeof count === "number") {
        bookmarkAccessCounts[idMapping[oldId]] = count
        countsUpdated++
      }
    }

    // Save updated data to chrome.storage.local
    await chrome.storage.local.set({
      bookmarkTags,
      bookmarkAccessCounts,
    })

    // Refresh UI
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
        console.error("Failed to fetch bookmark tree after import")
      }
    })
  } catch (error) {
    console.error("Import failed:", error)
    showCustomPopup(
      translations[language].importError || "Failed to update bookmarks",
      "error",
      false
    )
  }
}

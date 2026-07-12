// components/chat.js
import {
  translations,
  showCustomPopup,
  showCustomConfirm,
  showCustomGuide,
} from "./utils/utils.js"
import { uiState, saveUIState } from "./state.js"
import {
  updateTheme,
  renderFilteredBookmarks,
  handleCheckHealth,
} from "./ui.js"
import { groupBookmarksByDomain, autoTagByDomain } from "./cleanupDashboard.js"

document.addEventListener("DOMContentLoaded", () => {
  const chatToggle = document.getElementById("chat-toggle")
  const chatbox = document.getElementById("chatbox")
  const chatInput = document.getElementById("chat-input")
  const chatSend = document.getElementById("chat-send")
  const chatClear = document.getElementById("chat-clear")
  const chatMessages = document.getElementById("chatbox-messages")
  const chatClose = document.getElementById("chat-close")
  const chatMaximize = document.getElementById("chat-maximize")
  const chatScrollBottom = document.getElementById("chat-scroll-bottom")

  // AI Config Elements
  const aiSettingsOption = document.getElementById("ai-settings-option")
  const aiConfigPopup = document.getElementById("ai-config-popup")
  const aiConfigSave = document.getElementById("ai-config-save")
  const aiConfigCancel = document.getElementById("ai-config-cancel")
  const aiProviderSelect = document.getElementById("ai-provider-select")
  const aiApiKeyInput = document.getElementById("ai-api-key")
  const aiModelNameInput = document.getElementById("ai-model-name")
  const aiApiGroup = document.getElementById("ai-api-group")
  const aiLocalWarning = document.getElementById("ai-local-warning")
  const localAiGuideBtn = document.getElementById("local-ai-guide-btn")
  const settingsMenu = document.getElementById("settings-menu")
  const aiStatusIndicator = document.getElementById("ai-status-indicator")

  const chatHelp = document.getElementById("chat-help")
  const chatHistoryBtn = document.getElementById("chat-history")
  const chatFolderSuggestions = document.getElementById(
    "chat-folder-suggestions",
  )

  function getUiElements() {
    const elements = {}
    const requiredElements = [
      { key: "folderFilter", selector: "#folder-filter" },
      { key: "tagFilterContainer", selector: "#tag-filter-container" },
      { key: "sortFilter", selector: "#sort-filter" },
      { key: "createFolderButton", selector: "#create-folder-button" },
      { key: "addToFolderButton", selector: "#add-to-folder-button" },
      { key: "deleteFolderButton", selector: "#delete-folder-button" },
      { key: "renameFolderButton", selector: "#rename-folder-button" },
      { key: "deleteBookmarksButton", selector: "#delete-bookmarks-button" },
      { key: "exportBookmarksOption", selector: "#export-bookmarks-option" },
      { key: "importBookmarksOption", selector: "#import-bookmarks-option" },
      { key: "editInNewTabOption", selector: "#edit-in-new-tab-option" },
      { key: "toggleCheckboxesButton", selector: "#toggle-checkboxes-button" },
      { key: "searchInput", selector: "#search-input" },
      { key: "renamePopup", selector: "#rename-popup" },
      { key: "renameInput", selector: "#rename-input" },
      { key: "addToFolderPopup", selector: "#add-to-folder-popup" },
      { key: "addToFolderSelect", selector: "#add-to-folder-select" },
      { key: "addToFolderSaveButton", selector: "#add-to-folder-save" },
      { key: "addToFolderCancelButton", selector: "#add-to-folder-cancel" },
      { key: "bookmarkCountDiv", selector: "#bookmark-count" },
      { key: "scrollToTopButton", selector: "#scroll-to-top" },
      { key: "clearRenameButton", selector: "#clear-rename" },
      { key: "clearSearchButton", selector: "#clear-search" },
      { key: "settingsButton", selector: "#settings-button" },
      { key: "renameFolderPopup", selector: "#rename-folder-popup" },
      { key: "renameFolderSelect", selector: "#rename-folder-select" },
      { key: "renameFolderInput", selector: "#rename-folder-input" },
      { key: "bookmarkDetailPopup", selector: "#bookmark-detail-popup" },
      { key: "manageTagsPopup", selector: "#manage-tags-popup" },
      { key: "folderListDiv", selector: "#folder-list" },
      { key: "healthSortFilter", selector: "#health-sort-filter" },
      { key: "checkHealthButton", selector: "#check-health-button" },
      { key: "organizeFoldersButton", selector: "#organize-folders-button" },
      { key: "folderContextMenu", selector: "#folder-context-menu" },
      {
        key: "contextMenuMoveFolderButton",
        selector: "#context-menu-move-folder",
      },
    ]
    requiredElements.forEach(({ key, selector }) => {
      elements[key] = document.querySelector(selector)
    })
    return elements
  }

  // Unified System Prompt: Handles both actions and general chat
  const systemPrompt = `
        You are a highly capable bookmark management assistant and a helpful AI. Your role is to classify user intent and either execute bookmark tasks or engage in general conversation. You MUST return your response as a JSON object.

        **SCENARIO 1: Bookmark Management**
        If the user wants to manage bookmarks or folders, return:
        { "action": "action_name", "params": { ... } }

        Available actions:
        - count: Count all bookmarks.
        - count_folders: Count all folders.
        - list: List all bookmarks.
        - list_folders: List all folders.
        - list_bookmarks_in_folder: List bookmarks within a specific folder.
        - add: Add a new bookmark.
        - move: Move a bookmark to a different folder.
        - edit: Edit a bookmark's title or folder.
        - delete: Delete a bookmark.
        - create_folder: Create a new folder.
        - rename_folder: Rename an existing folder.
        - delete_folder: Delete a folder and all its contents.
        - search_bookmark: Search for bookmarks.
        - search_folder: Search for folders.
        - favorite: Mark or unmark a bookmark as a favorite.
        - suggest_website: Suggest websites on a given topic.
        - change_view: Change the layout (list, detail, card, tree).
        - change_theme: Change the color theme.
        - change_sort: Change the sort order.
        - check_links: Check for broken links.

        **SCENARIO 2: General Chat / Questions**
        If the user is greeting you, asking a general question, or just chatting, return:
        { "action": "general", "answer": "Your Markdown-formatted response here" }

        Guidelines for Chat:
        - Use a natural, friendly tone.
        - Use Markdown (bold, lists, tables).
        - Respond in the user's language (e.g., Vietnamese if they speak Vietnamese).

        Example Flows:
        - User: "how many bookmarks do I have?" -> { "action": "count" }
        - User: "delete bookmark 123" -> { "action": "delete", "params": { "id": "123", "confirm": true } }
        - User: "what is the capital of France?" -> { "action": "general", "answer": "The capital of France is **Paris**." }
        - User: "hi" -> { "action": "general", "answer": "Hello! How can I help you manage your bookmarks today?" }
    `

  // General System Prompt for off-topic questions
  const generalSystemPrompt = `
    You are Gemini, a helpful and truthful AI assistant created by Google. Your role is to provide accurate, concise, and conversational answers to a wide range of questions. Respond in the user's language (e.g., Vietnamese if the query is in Vietnamese) in a natural, friendly tone. You must format your responses using Markdown. This includes using bolding, lists, and tables where appropriate.

    When creating a table, use standard GitHub-flavored Markdown syntax. For example:
    | Header 1 | Header 2 |
    |----------|----------|
    | Cell 1   | Cell 2   |
    | Cell 3   | Cell 4   |

    Examples of full responses:
    - Query: "What day is it today?"
      Response: "Today is Monday, October 13, 2025. Is there anything specific you'd like to plan?"
    - Query: "Hello"
      Response: "Hi there! How can I assist you today? You can ask me to manage your bookmarks or ask any general question."
    - Query: "Tell me about Python programming"
      Response: "Python is a versatile, high-level programming language known for its readability and wide range of applications, from web development to data science. \n\n**Key Features:**\n* Easy to learn\n* Large standard library\n* Used in web development, AI, data science, and more.\n\nWould you like tips on learning Python or specific details about its features?"
  `

  // Language support
  const getLanguage = () => localStorage.getItem("appLanguage") || "en"
  const t = (key) => translations[getLanguage()][key] || key

  // Set button titles dynamically
  if (chatToggle) chatToggle.title = t("chatToggle")
  if (chatHelp) chatHelp.title = t("helpGuideTitle")
  if (chatHistoryBtn) chatHistoryBtn.title = t("exportChatHistory")
  if (chatMaximize) chatMaximize.title = t("maximizeMinimize")
  if (chatClose) chatClose.title = t("closeChat")

  // Chat history management
  let chatHistory = []

  // ===== NEW HELPER FUNCTIONS =====
  function appendBotMessage(content, textContent, isMarkdown = false) {
    const botMessageContainer = document.createElement("div")
    botMessageContainer.className = "chatbox-message-container bot"
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    let htmlContent = isMarkdown ? marked.parse(content) : content

    // Wrap code blocks with custom wrapper for copy buttons if it's markdown
    if (isMarkdown) {
      htmlContent = htmlContent.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
        (match, attrs, code) => {
          const langMatch = attrs.match(/class="language-([^"]*)"/)
          const lang = langMatch ? langMatch[1] : ""
          return `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span>${lang}</span>
                        <button class="code-copy-btn" title="${
                          t("copyToClipboard") || "Copy"
                        }">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                    <pre><code ${attrs}>${code}</code></pre>
                </div>
            `
        },
      )
    }

    botMessageContainer.innerHTML = `
      <div class="chat-avatar bot-avatar">
        <i class="fas fa-smile"></i>
      </div>
      <div class="message-wrapper">
        <div class="chatbox-message">
          <button class="chatbox-copy-btn" title="${
            t("copyToClipboard") || "Copy"
          }">
            <i class="far fa-copy"></i>
          </button>
          <div class="message-text">${htmlContent}</div>
        </div>
        <span class="timestamp">${timestamp}</span>
      </div>
    `
    chatMessages.appendChild(botMessageContainer)

    // Add event listeners for copy buttons
    const copyBtn = botMessageContainer.querySelector(".chatbox-copy-btn")
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const textToCopy =
          textContent ||
          botMessageContainer.querySelector(".message-text").innerText
        navigator.clipboard.writeText(textToCopy).then(() => {
          const icon = copyBtn.querySelector("i")
          icon.className = "fas fa-check"
          showCustomPopup(t("copySuccess") || "Copied!", "success", true)
          setTimeout(() => (icon.className = "far fa-copy"), 2000)
        })
      })
    }

    const codeCopyBtns = botMessageContainer.querySelectorAll(".code-copy-btn")
    codeCopyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn
          .closest(".code-block-wrapper")
          .querySelector("code").innerText
        navigator.clipboard.writeText(code).then(() => {
          const icon = btn.querySelector("i")
          icon.className = "fas fa-check"
          showCustomPopup(t("copySuccess") || "Copied!", "success", true)
          setTimeout(() => (icon.className = "far fa-copy"), 2000)
        })
      })
    })

    const cleanText =
      textContent || (isMarkdown ? content : content.replace(/<[^>]*>/g, ""))
    addToChatHistory("bot", cleanText, timestamp)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function showTypingIndicator() {
    if (document.getElementById("typing-indicator")) return
    const typingIndicator = document.createElement("div")
    typingIndicator.id = "typing-indicator"
    typingIndicator.className = "chatbox-message-container bot"
    typingIndicator.innerHTML = `
      <div class="chat-avatar bot-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="chatbox-message">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `
    chatMessages.appendChild(typingIndicator)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById("typing-indicator")
    if (indicator) indicator.remove()
  }
  // ===== END OF NEW HELPERS =====

  function normalizeText(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }

  function extractFirstUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/i)
    return match ? match[0] : ""
  }

  function extractId(text) {
    const match = text.match(/\b(?:id|ID)\s*[:#]?\s*(\d+)\b/)
    return match ? match[1] : ""
  }

  function extractQuotedText(text) {
    const match = text.match(/"([^"]+)"|'([^']+)'/)
    return match ? match[1] || match[2] : ""
  }

  function extractMentionedFolder(text) {
    const quotedMatch = text.match(/@"([^"]+)"|@'([^']+)'/)
    if (quotedMatch) return quotedMatch[1] || quotedMatch[2]
    const wordMatch = text.match(/@([^\s]+)/)
    return wordMatch ? wordMatch[1] : ""
  }

  function extractFolderName(text) {
    const mention = extractMentionedFolder(text)
    if (mention) return mention
    const quoted = extractQuotedText(text)
    if (quoted) return quoted
    const match = text.match(/(?:folder|thu muc)\s*[:\-]?\s*(.+)$/i)
    if (!match) return ""
    return match[1].trim().replace(/\s+\d{1,2}:\d{2}\s*$/, "")
  }

  function getMentionContext(text, cursorPosition) {
    const beforeCursor = text.slice(0, cursorPosition)
    const atIndex = beforeCursor.lastIndexOf("@")
    if (atIndex === -1) return null
    if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) return null
    const mentionText = beforeCursor.slice(atIndex + 1)
    if (/\s/.test(mentionText)) return null
    return { atIndex, query: mentionText }
  }

  function getFolderSuggestionList(query) {
    const normalized = query.toLowerCase()
    const seen = new Set()
    const folders = []
    ;(uiState.folders || []).forEach((folder) => {
      if (!folder || !folder.title) return
      if (seen.has(folder.title)) return
      seen.add(folder.title)
      folders.push(folder.title)
    })

    if (!normalized) return folders
    return folders.filter((title) => title.toLowerCase().includes(normalized))
  }

  function hideFolderSuggestions() {
    if (chatFolderSuggestions) {
      chatFolderSuggestions.classList.add("hidden")
      chatFolderSuggestions.innerHTML = ""
    }
  }

  function insertFolderMention(folderName, atIndex, cursorPosition) {
    if (!chatInput) return
    const needsQuotes = /\s/.test(folderName)
    const mention = needsQuotes ? `@"${folderName}"` : `@${folderName}`
    const value = chatInput.value
    const before = value.slice(0, atIndex)
    const after = value.slice(cursorPosition)
    const nextValue = `${before}${mention}${after}`
    chatInput.value = nextValue
    const nextCursor = before.length + mention.length
    chatInput.setSelectionRange(nextCursor, nextCursor)
    chatInput.focus()
    hideFolderSuggestions()
    chatInput.dispatchEvent(new Event("input"))
  }

  function renderFolderSuggestions(context) {
    if (!chatFolderSuggestions || !context || !chatInput) return
    const suggestions = getFolderSuggestionList(context.query).slice(0, 8)
    if (suggestions.length === 0) {
      hideFolderSuggestions()
      return
    }

    chatFolderSuggestions.innerHTML = ""
    suggestions.forEach((title) => {
      const item = document.createElement("div")
      item.className = "chat-suggestion-item"
      item.textContent = title
      item.addEventListener("click", () => {
        insertFolderMention(title, context.atIndex, chatInput.selectionStart)
      })
      chatFolderSuggestions.appendChild(item)
    })
    chatFolderSuggestions.classList.remove("hidden")
  }

  function parseLocalCommand(message) {
    const raw = message
    const text = normalizeText(message)
    const url = extractFirstUrl(raw)
    const id = extractId(raw)

    if (/^(\/help|help|tro giup|giup|huong dan)$/i.test(text)) {
      return { action: "help" }
    }

    if (/^\/(group\s+domain|group_domain)/i.test(raw)) {
      return { action: "group_domain" };
    }
    
    if (/^\/(autotag|auto_tag)/i.test(raw)) {
      return { action: "autotag_domain" };
    }

    if (/^\/autoorganize/i.test(raw)) {
      return { action: "autoorganize" };
    }

    if (/(goi y|suggest).*(website|web|site)/i.test(text)) {
      // Let it fall through to AI for better processing
      return { action: "general" }
    }

    if (/(check|kiem tra).*(link|broken|suc khoe|health)/i.test(text)) {
      return { action: "check_links" }
    }

    if (/(change|switch|doi|chuyen).*(view|che do|layout).*(list|detail|card|tree)/i.test(text) || 
        /(list|detail|card|tree).*(view|che do|layout)/i.test(text) ||
        /^(list|detail|card|tree)$/i.test(text)) {
      const viewMatch = text.match(/(list|detail|card|tree)/i)
      return {
        action: "change_view",
        params: { view_mode: viewMatch ? viewMatch[1] : "list" },
      }
    }

    if (
      /(doi giao dien|theme|chu de|mau|change theme).*(light|dark|dracula|onedark|tokyonight|monokai|winter|github|tet|nord|synthwave|gruvbox|catppuccin|nightowl|nord-light|gruvbox-light|catppuccin-light|nightowl-light|system)/i.test(
        text,
      ) || /(light|dark|dracula|onedark|tokyonight|monokai|winter|github|tet|nord|synthwave|gruvbox|catppuccin|nightowl|nord-light|gruvbox-light|catppuccin-light|nightowl-light|system).*(theme|giao dien|mau)/i.test(text)
    ) {
      const themeMatch = text.match(
        /(light|dark|dracula|onedark|tokyonight|monokai|winter-is-coming|github-blue|github-light|tet|nord|synthwave|gruvbox|catppuccin|nightowl|nord-light|gruvbox-light|catppuccin-light|nightowl-light|system)/i,
      )
      return {
        action: "change_theme",
        params: { theme_name: themeMatch ? themeMatch[1] : "system" },
      }
    }

    if (/(sort|sap xep).*(a-z|z-a|default|favorites|favorite|most-visited|old|new|last-opened|domain)/i.test(text)) {
      const sortMap = {
        "a-z": "a-z",
        "z-a": "z-a",
        default: "default",
        favorites: "favorites",
        favorite: "favorites",
        "most-visited": "most-visited",
        old: "old",
        new: "new",
        "newest": "new",
        "last-opened": "last-opened",
        domain: "domain",
      }
      const sortMatch = text.match(
        /(a-z|z-a|default|favorites|favorite|most-visited|old|newest|new|last-opened|domain)/i,
      )
      return {
        action: "change_sort",
        params: { sort_by: sortMatch ? sortMap[sortMatch[1]] || "default" : "default" },
      }
    }

    if (/(bao nhieu|dem|count).*(folder|thu muc)/i.test(text)) {
      return { action: "count_folders" }
    }

    if (/(bao nhieu|dem|count).*(bookmark|dau trang)/i.test(text)) {
      return { action: "count" }
    }

    if (/(trong|in).*(folder|thu muc)/i.test(text)) {
      const folder = extractFolderName(raw)
      if (folder) {
        return {
          action: "list_bookmarks_in_folder",
          params: { folder },
        }
      }
    }

    if (/(liet ke|list|show).*(folder|thu muc)/i.test(text)) {
      return { action: "list_folders" }
    }

    if (/(liet ke|list|show).*(bookmark|dau trang)/i.test(text)) {
      return { action: "list" }
    }

    if (/(tao|create|new).*(folder|thu muc)/i.test(text)) {
      const folderName = extractFolderName(raw) || extractQuotedText(raw)
      return { action: "create_folder", params: { folderName } }
    }

    if (/(doi ten|rename).*(folder|thu muc)/i.test(text)) {
      const parts = raw.split(/to|sang|thanh|->/i)
      const oldName = extractQuotedText(parts[0])
      const newName = parts[1] ? extractQuotedText(parts[1]) : ""
      return { action: "rename_folder", params: { oldName, newName } }
    }

    if (/(xoa|delete|remove).*(folder|thu muc)/i.test(text)) {
      const folderName = extractFolderName(raw) || extractQuotedText(raw)
      return { action: "delete_folder", params: { folderName, confirm: true } }
    }

    if (/(xoa|delete|remove).*(bookmark|dau trang)/i.test(text)) {
      const title = extractQuotedText(raw)
      return {
        action: "delete",
        params: { id: id || undefined, url: url || undefined, title },
      }
    }

    if (/(them|add|save|luu).*(bookmark|dau trang)/i.test(text) || url) {
      const folder = extractFolderName(raw)
      const title = extractQuotedText(raw)
      return { action: "add", params: { url, folder, title } }
    }

    if (/(chuyen|move).*(folder|thu muc)/i.test(text)) {
      const folder = extractFolderName(raw)
      const title = extractQuotedText(raw)
      return {
        action: "move",
        params: { id: id || undefined, title, folder },
      }
    }

    if (/(sua|edit|doi).*(bookmark|dau trang)/i.test(text)) {
      const title = extractQuotedText(raw)
      const folder = extractFolderName(raw)
      return {
        action: "edit",
        params: {
          id: id || undefined,
          url: url || undefined,
          title,
          new_title: title,
          folder,
        },
      }
    }

    if (/(tim|search|find).*(folder|thu muc)/i.test(text)) {
      const keyword =
        extractQuotedText(raw) || raw.replace(/.*(tim|search|find)/i, "").trim()
      return { action: "search_folder", params: { keyword } }
    }

    if (/(tim|search|find).*(bookmark|dau trang)/i.test(text)) {
      const keyword =
        extractQuotedText(raw) || raw.replace(/.*(tim|search|find)/i, "").trim()
      return { action: "search_bookmark", params: { keyword } }
    }

    if (/(yeu thich|favorite|star|unstar|bo yeu thich)/i.test(text)) {
      const favorite = !/(unstar|bo yeu thich)/i.test(text)
      const title = extractQuotedText(raw)
      return {
        action: "favorite",
        params: { id: id || undefined, title, favorite },
      }
    }

    return { action: "general" }
  }

  const getChatHistory = () => {
    return chatHistory
  }

  const saveChatHistory = (history) => {
    chatHistory = history
  }

  const addToChatHistory = (type, content, timestamp) => {
    const history = getChatHistory()
    history.push({ type, content, timestamp })
    saveChatHistory(history)
  }

  window.addEventListener("beforeunload", () => {
    chatHistory = []
  })

  const exportChatHistory = () => {
    const history = getChatHistory()
    if (history.length === 0) {
      showCustomPopup(t("noChatHistory"), "error", true)
      return
    }

    showCustomConfirm(
      t("exportPrompt")?.replace("JSON hoặc HTML", "TXT") ||
        "Export chat history as TXT?",
      () => {
        const txtContent = history
          .map(
            (msg) =>
              `[${msg.timestamp}] ${msg.type.toUpperCase()}: ${msg.content}`,
          )
          .join("\n\n---\n\n")
        const blob = new Blob([txtContent], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const now = new Date()
        const formattedDateTime = now
          .toISOString()
          .replace(/T/, "-")
          .replace(/:/g, "-")
          .split(".")[0]
        a.download = `chat-history-${formattedDateTime}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showCustomPopup(t("successTitle"), "success", true)
      },
      () => {
        showCustomPopup(t("cancel") || "Cancelled", "success", true)
      },
    )
  }

  // Load saved AI config
  const getAiConfig = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get("aiConfig", (result) => {
        if (result.aiConfig) {
          resolve(result.aiConfig)
        } else {
          // Default config
          resolve({
            model: "gemini",
            apiKey: "",
            modelName: "gemini-1.5-flash",
            apiVisible: true,
          })
        }
      })
    })
  }

  const saveAiConfig = async (model, apiKey, modelName, apiVisible = true) => {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { aiConfig: { model, apiKey, modelName, apiVisible } },
        () => {
          resolve()
        },
      )
    })
  }

  const checkLocalAiAvailability = async () => {
    try {
      if (typeof window.ai !== "undefined" && window.ai.languageModel) {
        const capabilities = await window.ai.languageModel.capabilities()
        return capabilities.available !== "no"
      }
      if (typeof window.ai !== "undefined" && window.ai.canCreateTextSession) {
        const status = await window.ai.canCreateTextSession()
        return status !== "no"
      }
      return false
    } catch (e) {
      console.error("Local AI Check Error:", e)
      return false
    }
  }

  const updateAiStatusIndicator = async (configOverride) => {
    if (!aiStatusIndicator) return

    const config = configOverride || (await getAiConfig())
    const provider = config.model || "gemini"
    let state = "is-warning"
    let text = t("aiStatusSetup") || "Setup AI"

    if (provider === "none") {
      state = "is-offline"
      text = t("aiStatusBasic") || "Basic"
    } else if (provider === "local") {
      const isLocalAvailable = await checkLocalAiAvailability()
      state = isLocalAvailable ? "is-ready" : "is-warning"
      text = t("aiStatusLocal") || "Local AI"
    } else if (config.apiKey) {
      state = "is-ready"
      text = t("aiStatusReady") || "AI Ready"
    }

    aiStatusIndicator.className = `ai-status-indicator ${state}`
    aiStatusIndicator.innerHTML = `
      <i class="fas fa-circle" aria-hidden="true"></i>
      <span>${text}</span>
    `
    aiStatusIndicator.title = text
  }

  updateAiStatusIndicator()

  // Validate URL
  const isValidUrl = (url) => {
    try {
      new URL(url)
      return url.includes("http")
    } catch {
      return false
    }
  }

  // Build API request for Gemini
  const buildApiRequest = (
    modelName,
    apiKey,
    model,
    message,
    isGeneral = false,
  ) => {
    try {
      let apiUrl
      const headers = { "Content-Type": "application/json" }
      let body

      const prompt = isGeneral ? generalSystemPrompt : systemPrompt

      if (model === "local") {
        return { isLocal: true, prompt, message }
      }

      if (model === "gemini") {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
        apiUrl = apiUrl.includes("?key=")
          ? apiUrl.replace(/(\?key=)[^&]+/, `$1${apiKey}`)
          : apiUrl + (apiUrl.includes("?") ? "&" : "?") + `key=${apiKey}`
        body = {
          contents: [
            {
              parts: [{ text: message }],
            },
          ],
          systemInstruction: {
            parts: [{ text: prompt }],
          },
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
            topP: 0.8,
            responseMimeType: isGeneral ? "text/plain" : "application/json",
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
          ],
        }
      } else if (model === "gpt") {
        apiUrl = "https://api.openai.com/v1/chat/completions"
        headers["Authorization"] = `Bearer ${apiKey}`
        body = {
          model: modelName || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: message },
          ],
          response_format: isGeneral ? undefined : { type: "json_object" },
        }
      } else {
        apiUrl = modelName
        headers["x-api-key"] = apiKey
        body = {
          prompt: `${prompt}\n${message}`,
        }
      }

      return { url: apiUrl, headers, body, method: "POST" }
    } catch (error) {
      console.error("Failed to build API request:", error)
      showCustomPopup(
        `${t("errorTitle") || "Error"}: Invalid model name or configuration - ${
          error.message
        }`,
        "error",
        true,
      )
      return null
    }
  }

  // Suggest bookmark details
  async function suggestBookmarkDetails(url) {
    const config = await getAiConfig()
    const apiRequest = buildApiRequest(
      config.modelName,
      config.apiKey,
      config.model,
      `Analyze the website at ${url} and suggest a title and folder for the bookmark. Return JSON: { "title": string, "folder": string }`,
    )
    if (!apiRequest) {
      throw new Error(t("errorUnexpected") || "Invalid model name")
    }
    try {
      const response = await fetch(apiRequest.url, {
        method: "POST",
        headers: apiRequest.headers,
        body: JSON.stringify(apiRequest.body),
      })
      if (!response.ok) {
        throw new Error(
          `${t("errorUnexpected") || "Unexpected error"}: ${
            response.statusText
          }`,
        )
      }
      const data = await response.json()
      let result
      try {
        let text = ""
        if (config.model === "gemini") {
          text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
        } else if (config.model === "gpt") {
          text = data.choices?.[0]?.message?.content || "{}"
        } else {
          text = data.text || "{}"
        }
        
        // Clean markdown backticks
        const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim()
        result = JSON.parse(cleanedText)
      } catch (parseError) {
        throw new Error(
          `${
            t("errorUnexpected") || "Unexpected error"
          }: Invalid AI response format`,
        )
      }
      return result
    } catch (error) {
      console.error("AI suggestion failed:", error)
      return { title: url, folder: t("unnamedFolder") || "Unnamed" }
    }
  }

  // Suggest websites
  async function suggestWebsites(topic) {
    const config = await getAiConfig()
    const apiRequest = buildApiRequest(
      config.modelName,
      config.apiKey,
      config.model,
      `Suggest websites for ${topic}. Return JSON: { "websites": [{ "url": string, "title": string, "description": string }, ...] }`,
    )
    if (!apiRequest) {
      throw new Error(t("errorUnexpected") || "Invalid model name")
    }
    try {
      const response = await fetch(apiRequest.url, {
        method: "POST",
        headers: apiRequest.headers,
        body: JSON.stringify(apiRequest.body),
      })
      if (!response.ok) {
        throw new Error(
          `${t("errorUnexpected") || "Unexpected error"}: ${
            response.statusText
          }`,
        )
      }
      const data = await response.json()
      let result
      try {
        let text = ""
        if (config.model === "gemini") {
          text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
        } else if (config.model === "gpt") {
          text = data.choices?.[0]?.message?.content || "{}"
        } else {
          text = data.text || "{}"
        }
        
        // Clean markdown backticks
        const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim()
        result = JSON.parse(cleanedText)
      } catch (parseError) {
        throw new Error(
          `${
            t("errorUnexpected") || "Unexpected error"
          }: Invalid AI response format`,
        )
      }
      return result
    } catch (error) {
      console.error("Website suggestion failed:", error)
      return { websites: [] }
    }
  }

  // Check if URL exists
  async function checkUrlExists(url) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ url }, (results) => {
        resolve(results.filter((node) => node.url))
      })
    })
  }

  // Find or create folder
  async function findFolderId(folderName) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.search({ title: folderName }, (results) => {
        const folders = results.filter((node) => !node.url)
        if (folders.length > 1) {
          reject(
            new Error(
              `${
                t("duplicateFolderError") || "Duplicate folders found with name"
              }: ${folderName}. Please specify a unique name.`,
            ),
          )
        } else if (folders.length === 1) {
          resolve(folders[0].id)
        } else {
          chrome.bookmarks.create({ title: folderName }, (folder) => {
            resolve(folder.id)
          })
        }
      })
    })
  }

  // Get folder name
  async function getFolderName(folderId) {
    return new Promise((resolve) => {
      chrome.bookmarks.get(folderId, (results) => {
        resolve(results[0]?.title || t("unnamedFolder") || "Unnamed")
      })
    })
  }

  // Search bookmarks by title
  async function searchBookmarksByTitle(title) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ title }, (results) => {
        resolve(results.filter((node) => node.url))
      })
    })
  }

  // Search folders by name
  async function searchFoldersByName(keyword) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ title: keyword }, (results) => {
        resolve(results.filter((node) => !node.url))
      })
    })
  }

  // Get bookmark by ID
  async function getBookmarkById(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (results.length === 0) {
          reject(
            new Error(
              `${t("noBookmarks") || "No bookmark found with"} ID: ${id}.`,
            ),
          )
        } else {
          resolve(results[0])
        }
      })
    })
  }

  // Toggle favorite status
  async function toggleFavorite(bookmarkId, favorite) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("favoriteBookmarks", (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        const favoriteBookmarks = data.favoriteBookmarks || {}
        if (favorite) {
          favoriteBookmarks[bookmarkId] = true
        } else {
          delete favoriteBookmarks[bookmarkId]
        }
        chrome.storage.local.set({ favoriteBookmarks }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(favoriteBookmarks)
          }
        })
      })
    })
  }

  // Handle bookmark commands

  async function handleBookmarkCommand(action, params) {
    showTypingIndicator()

    try {
      if (action === "count") {
        window.BookmarkCache.getTree((bookmarkTree) => {
          let count = 0

          function countBookmarks(nodes) {
            nodes.forEach((node) => {
              if (node.url) count++

              if (node.children) countBookmarks(node.children)
            })
          }

          countBookmarks(bookmarkTree[0].children)

          hideTypingIndicator()

          const content = `${t("youHave") || "You have"} ${count} ${
            t("bookmarks") || "bookmarks"
          }.`

          appendBotMessage(content, content)
        })
      } else if (action === "count_folders") {
        window.BookmarkCache.getTree((bookmarkTree) => {
          let count = 0

          function countFolders(nodes) {
            nodes.forEach((node) => {
              if (!node.url) count++

              if (node.children) countFolders(node.children)
            })
          }

          countFolders(bookmarkTree[0].children)

          hideTypingIndicator()

          const htmlContent = `${t("youHave") || "You have"} ${count} ${
            t("folders") || "folders"
          }.`

          const textContent = `${t("youHave") || "You have"} ${count} ${
            t("folders") || "folders"
          }.`

          appendBotMessage(htmlContent, textContent)
        })
      } else if (action === "list") {
        window.BookmarkCache.getTree((bookmarkTree) => {
          const bookmarks = []

          function collectBookmarks(nodes) {
            nodes.forEach((node) => {
              if (node.url) {
                bookmarks.push({
                  title: node.title || node.url,
                  url: node.url,
                  id: node.id,
                })
              }
              if (node.children) collectBookmarks(node.children)
            })
          }

          collectBookmarks(bookmarkTree[0].children)
          hideTypingIndicator()

          const htmlContent = bookmarks.length
            ? `${
                t("hereAreYourBookmarks") || "Here are your bookmarks"
              }:<br>${bookmarks
                .map((b, index) => {
                  const bHostname = new URL(b.url).hostname
                  return `<span class="bookmark-item">${
                    index + 1
                  }. <img src="https://www.google.com/s2/favicons?domain=${bHostname}" class="favicon" alt="Favicon" data-hostname="${bHostname}"> <a href="${
                    b.url
                  }" target="_blank">${b.title}</a> (ID: ${b.id})</span>`
                })
                .join("<br>")}`
            : `${t("noBookmarks") || "You don't have any bookmarks yet."}`

          appendBotMessage(htmlContent)
        })
      } else if (action === "list_folders") {
        window.BookmarkCache.getTree((bookmarkTree) => {
          const folders = []

          function collectFolders(nodes) {
            nodes.forEach((node) => {
              if (!node.url && node.id !== "0") {
                folders.push({
                  title: node.title || t("unnamedFolder") || "Unnamed",

                  id: node.id,
                })
              }

              if (node.children) collectFolders(node.children)
            })
          }

          collectFolders(bookmarkTree[0].children)

          hideTypingIndicator()

          const htmlContent = folders.length
            ? `${
                t("hereAreYourFolders") || "Here are your folders"
              }:<br>${folders

                .map(
                  (f, index) =>
                    `<span class="bookmark-item">${index + 1}. ${
                      f.title
                    } (ID: ${f.id})</span>`,
                )

                .join("<br>")}`
            : `${t("noFolders") || "You don't have any folders yet."}`

          appendBotMessage(htmlContent)
        })
      } else if (action === "list_bookmarks_in_folder" && params.folder) {
        searchFoldersByName(params.folder).then((folders) => {
          if (folders.length === 0) {
            throw new Error(
              `${t("noFoldersFound") || "No folder found with name"}: ${
                params.folder
              }`,
            )
          }

          if (folders.length > 1) {
            throw new Error(
              `${
                t("duplicateFolderError") || "Multiple folders found with name"
              }: ${params.folder}. Please specify a unique name.`,
            )
          }

          const folderId = folders[0].id

          chrome.bookmarks.getChildren(folderId, (children) => {
            const bookmarks = children.filter((node) => node.url)

            hideTypingIndicator()

            const htmlContent = bookmarks.length
              ? `${
                  t("hereAreBookmarksInFolder") ||
                  "Here are the bookmarks in folder"
                } '${params.folder}':<br>${bookmarks

                  .map(
                    (b, index) => {
                      const bHostname = new URL(b.url).hostname
                      return `<span class="bookmark-item">${
                        index + 1
                      }. <img src="https://www.google.com/s2/favicons?domain=${bHostname}" class="favicon" alt="Favicon" data-hostname="${bHostname}"> <a href="${
                        b.url
                      }" target="_blank">${b.title}</a> (ID: ${b.id})</span>`
                    },
                  )

                  .join("<br>")}`
              : `${
                  t("noBookmarksInFolder") || "No bookmarks in this folder"
                } '${params.folder}'.`

            appendBotMessage(htmlContent)
          })
        })
      } else if (action === "create_folder" && params.folderName) {
        const { folderName, parentFolder } = params
        let parentId = "1" // Default to Bookmarks Bar

        const existingFolders = await searchFoldersByName(folderName)
        if (existingFolders.length > 0) {
          throw new Error(
            `${
              t("duplicateFolderError") ||
              "A folder with this name already exists"
            }: ${folderName}.`,
          )
        }

        if (parentFolder) {
          const parentFolders = await searchFoldersByName(parentFolder)
          if (parentFolders.length === 0) {
            throw new Error(
              `${
                t("noFoldersFound") || "No parent folder found with name"
              }: ${parentFolder}`,
            )
          }
          if (parentFolders.length > 1) {
            throw new Error(
              `${
                t("duplicateFolderError") ||
                "Multiple parent folders found with name"
              }: ${parentFolder}.`,
            )
          }
          parentId = parentFolders[0].id
        }

        chrome.bookmarks.create(
          { parentId, title: folderName },
          (newFolder) => {
            if (chrome.runtime.lastError) {
              hideTypingIndicator()
              const errorMsg = `${t("errorTitle") || "Oops"}: ${
                chrome.runtime.lastError.message
              }`
              appendBotMessage(
                `<span class="error-text">${errorMsg}</span>`,
                errorMsg,
              )
              return
            }
            hideTypingIndicator()
            const content = `${
              t("createdFolder") || "I have created the folder"
            } '${newFolder.title}' (ID: ${newFolder.id}).`
            appendBotMessage(content, content)
          },
        )
      } else if (
        action === "rename_folder" &&
        params.oldName &&
        params.newName
      ) {
        const { oldName, newName } = params

        const folders = await searchFoldersByName(oldName)
        if (folders.length === 0) {
          throw new Error(
            `${t("noFoldersFound") || "No folder found with name"}: ${oldName}`,
          )
        }
        if (folders.length > 1) {
          throw new Error(
            `${
              t("duplicateFolderError") || "Multiple folders found with name"
            }: ${oldName}. Please be more specific.`,
          )
        }

        const folderToRename = folders[0]

        const existingNewNameFolders = await searchFoldersByName(newName)
        if (existingNewNameFolders.length > 0) {
          throw new Error(
            `${
              t("duplicateFolderError") || "A folder with the name"
            } '${newName}' ${t("alreadyExists") || "already exists."}`,
          )
        }

        chrome.bookmarks.update(
          folderToRename.id,
          { title: newName },
          (updatedFolder) => {
            if (chrome.runtime.lastError) {
              console.error("Rename error:", chrome.runtime.lastError)
              hideTypingIndicator()
              const errorMsg =
                chrome.runtime.lastError.message ||
                t("renameError") ||
                "Error renaming folder"
              appendBotMessage(errorMsg, errorMsg)
              return
            }
            hideTypingIndicator()
            const content = `${
              t("renamedFolder") || "I have renamed the folder"
            } '${oldName}' ${t("to") || "to"} '${updatedFolder.title}'.`
            appendBotMessage(content, content)
          },
        )
      } else if (action === "delete_folder" && params.folderName) {
        const { folderName } = params

        const folders = await searchFoldersByName(folderName)
        if (folders.length === 0) {
          throw new Error(
            `${
              t("noFoldersFound") || "No folder found with name"
            }: ${folderName}`,
          )
        }
        if (folders.length > 1) {
          throw new Error(
            `${
              t("duplicateFolderError") || "Multiple folders found with name"
            }: ${folderName}. Please be more specific.`,
          )
        }

        const folderToDelete = folders[0]

        if (params.confirm) {
          hideTypingIndicator()
          const confirmMsg = `${
            t("deleteFolderConfirm") ||
            "Are you sure you want to delete the folder"
          } '${folderToDelete.title}' (ID: ${folderToDelete.id}) ${
            t("andAllItsContents") || "and all its contents"
          }?`

          appendBotMessage(confirmMsg, confirmMsg)

          showCustomConfirm(
            confirmMsg,
            () => {
              chrome.bookmarks.removeTree(folderToDelete.id, () => {
                if (chrome.runtime.lastError) {
                  const errorMsg = `${t("errorTitle") || "Oops"}: ${
                    chrome.runtime.lastError.message
                  }`
                  appendBotMessage(
                    `<span class="error-text">${errorMsg}</span>`,
                    errorMsg,
                  )
                  return
                }
                const successMsg = `${
                  t("deletedFolder") || "I have deleted the folder"
                }: ${folderToDelete.title}.`
                appendBotMessage(successMsg, successMsg)
                showCustomPopup(t("successTitle") || "Success", "success", true)
              })
            },
            () => {
              const cancelMsg = `${t("cancel") || "Cancelled"}: ${
                t("deleteFolderCancelled") || "Folder deletion cancelled"
              }.`
              appendBotMessage(cancelMsg, cancelMsg)
            },
          )
        } else {
          hideTypingIndicator()
          const confirmMsg = `${
            t("deleteFolderConfirm") ||
            "Are you sure you want to delete the folder"
          } '${folderToDelete.title}' (ID: ${folderToDelete.id}) ${
            t("andAllItsContents") || "and all its contents"
          }?`

          appendBotMessage(confirmMsg, confirmMsg)

          showCustomConfirm(
            confirmMsg,
            () => {
              chrome.bookmarks.removeTree(folderToDelete.id, () => {
                if (chrome.runtime.lastError) {
                  const errorMsg = `${t("errorTitle") || "Oops"}: ${
                    chrome.runtime.lastError.message
                  }`
                  appendBotMessage(
                    `<span class="error-text">${errorMsg}</span>`,
                    errorMsg,
                  )
                  return
                }
                const successMsg = `${
                  t("deletedFolder") || "I have deleted the folder"
                }: ${folderToDelete.title}.`
                appendBotMessage(successMsg, successMsg)
                showCustomPopup(t("successTitle") || "Success", "success", true)
              })
            },
            () => {
              const cancelMsg = `${t("cancel") || "Cancelled"}: ${
                t("deleteFolderCancelled") || "Folder deletion cancelled"
              }.`
              appendBotMessage(cancelMsg, cancelMsg)
            },
          )
        }
      } else if (action === "add" && params.url) {
        let { url, title, folder } = params

        const existingBookmarks = await checkUrlExists(url)

        if (existingBookmarks.length > 0) {
          throw new Error(
            `${
              t("duplicateUrlError") ||
              "A bookmark with this URL already exists"
            }: ${url}. Found ${existingBookmarks.length} bookmark(s).`,
          )
        }

        if (!folder || !title) {
          const suggestions = await suggestBookmarkDetails(url)

          folder =
            folder || suggestions.folder || t("unnamedFolder") || "Unnamed"

          title = title || suggestions.title || url
        }

        chrome.bookmarks.create(
          { parentId: await findFolderId(folder), title, url },

          (bookmark) => {
            hideTypingIndicator()

            const htmlContent = `${
              t("addedBookmarkToFolder") || "I've added the bookmark"
            } <a href="${url}" target="_blank">${title}</a> ${
              t("toFolder") || "to the folder"
            } '${folder}' (ID: ${bookmark.id}).`

            const textContent = `${
              t("addedBookmarkToFolder") || "I've added the bookmark"
            } ${title} ${t("toFolder") || "to the folder"} '${folder}' (ID: ${
              bookmark.id
            }).`

            appendBotMessage(htmlContent, textContent)
          },
        )
      } else if (
        action === "edit" &&
        (params.url || params.title || params.id)
      ) {
        const {
          url,

          title: oldTitle,

          new_title: newTitle,

          folder: newFolder,

          id,
        } = params

        if (!newTitle && !newFolder) {
          throw new Error(
            t("emptyTitleError") || "Please provide a new title or folder.",
          )
        }

        let bookmarks = []

        if (id) {
          const bookmark = await getBookmarkById(id)

          bookmarks = [bookmark]
        } else if (url) {
          bookmarks = await checkUrlExists(url)
        } else if (oldTitle) {
          bookmarks = await searchBookmarksByTitle(oldTitle)
        }

        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with"} ${
              id ? `ID: ${id}` : url ? `URL: ${url}` : `title: ${oldTitle}`
            }.`,
          )
        }

        if (bookmarks.length > 1 && !id) {
          if (newFolder) {
            const folderId = await findFolderId(newFolder)

            bookmarks = bookmarks.filter((b) => b.parentId === folderId)
          }

          if (bookmarks.length > 1) {
            throw new Error(
              `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
                oldTitle || url
              }'. ${
                t("clarifyBookmark") ||
                "Please provide the URL, ID, or folder to specify which one."
              }`,
            )
          }
        }

        if (bookmarks.length === 1) {
          const bookmarkId = bookmarks[0].id

          const performUpdates = async () => {
            if (newTitle) {
              await new Promise((resolve, reject) => {
                chrome.bookmarks.update(
                  bookmarkId,

                  { title: newTitle },

                  (updatedBookmark) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message))
                    } else {
                      resolve(updatedBookmark)
                    }
                  },
                )
              })
            }

            if (newFolder) {
              const folderId = await findFolderId(newFolder)

              await new Promise((resolve, reject) => {
                chrome.bookmarks.move(
                  bookmarkId,

                  { parentId: folderId },

                  (movedBookmark) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message))
                    } else {
                      resolve(movedBookmark)
                    }
                  },
                )
              })
            }

            const updatedBookmark = await new Promise((resolve) => {
              chrome.bookmarks.get(bookmarkId, (results) => resolve(results[0]))
            })

            const folderName = await getFolderName(updatedBookmark.parentId)

            hideTypingIndicator()

            const htmlContent = `${
              t("updatedBookmark") || "I've updated the bookmark"
            } <a href="${updatedBookmark.url}" target="_blank">${
              updatedBookmark.title
            }</a> ${t("inFolder") || "in"} '${folderName}' (ID: ${bookmarkId}).`

            const textContent = `${
              t("updatedBookmark") || "I've updated the bookmark"
            } ${updatedBookmark.title} ${
              t("inFolder") || "in"
            } '${folderName}' (ID: ${bookmarkId}).`

            appendBotMessage(htmlContent, textContent)
          }

          performUpdates().catch((error) => {
            hideTypingIndicator()

            appendBotMessage(
              `<span class="error-text">${t("errorTitle") || "Oops"}: ${
                error.message
              }</span>`,

              `${t("errorTitle") || "Oops"}: ${error.message}`,
            )
          })
        }
      } else if (
        action === "delete" &&
        (params.url || params.title || params.id)
      ) {
        let bookmarks = []

        let bookmarkId, bookmarkTitle

        if (params.id) {
          const bookmark = await getBookmarkById(params.id)

          bookmarks = [bookmark]

          bookmarkId = params.id

          bookmarkTitle = bookmark.title || bookmark.url
        } else if (params.url) {
          bookmarks = await checkUrlExists(params.url)
        } else if (params.title) {
          bookmarks = await searchBookmarksByTitle(params.title)
        }

        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with"} ${
              params.id
                ? `ID: ${params.id}`
                : params.url
                  ? `URL: ${params.url}`
                  : `title: ${params.title}`
            }.`,
          )
        }

        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.url || params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`,
          )
        }

        if (bookmarks.length === 1) {
          bookmarkId = bookmarks[0].id

          bookmarkTitle = bookmarks[0].title || bookmarks[0].url
        }

        if (params.confirm) {
          hideTypingIndicator()

          const htmlContent = `${
            t("deleteConfirm") || "Are you sure you want to delete the bookmark"
          } '${bookmarkTitle}' (ID: ${bookmarkId})?`

          const textContent = htmlContent

          appendBotMessage(htmlContent, textContent)

          showCustomConfirm(
            `${
              t("deleteConfirm") ||
              "Are you sure you want to delete the bookmark"
            } '${bookmarkTitle}' (ID: ${bookmarkId})?`,

            () => {
              chrome.bookmarks.remove(bookmarkId, () => {
                if (chrome.runtime.lastError) {
                  throw new Error(chrome.runtime.lastError.message)
                }

                const htmlContent = `${
                  t("deletedBookmark") || "I've deleted the bookmark"
                }: ${bookmarkTitle} (ID: ${bookmarkId}).`

                const textContent = htmlContent

                appendBotMessage(htmlContent, textContent)

                showCustomPopup(t("successTitle") || "Success", "success", true)
              })
            },

            () => {
              const htmlContent = `${t("cancel") || "Cancelled"}: ${
                t("deleteBookmarkSuccess") || "Bookmark deletion cancelled"
              }.`

              const textContent = htmlContent

              appendBotMessage(htmlContent, textContent)
            },
          )
        }
      } else if (
        action === "move" &&
        (params.title || params.id) &&
        params.folder
      ) {
        let bookmarks = []

        let bookmarkId

        if (params.id) {
          const bookmark = await getBookmarkById(params.id)

          bookmarks = [bookmark]

          bookmarkId = params.id
        } else if (params.title) {
          bookmarks = await searchBookmarksByTitle(params.title)
        }

        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with"} ${
              params.id ? `ID: ${params.id}` : `title: ${params.title}`
            }.`,
          )
        }

        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`,
          )
        }

        if (bookmarks.length === 1) {
          bookmarkId = bookmarks[0].id

          const folderId = await findFolderId(params.folder)

          await new Promise((resolve, reject) => {
            chrome.bookmarks.move(
              bookmarkId,

              { parentId: folderId },

              (movedBookmark) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  resolve(movedBookmark)
                }
              },
            )
          })

          const folderName = await getFolderName(folderId)

          hideTypingIndicator()

          const htmlContent = `${
            t("movedBookmark") || "I've moved the bookmark"
          } '${bookmarks[0].title || bookmarks[0].url}' (ID: ${bookmarkId}) ${
            t("toFolder") || "to the folder"
          } '${folderName}'.`

          const textContent = htmlContent

          appendBotMessage(htmlContent, textContent)
        }
      } else if (action === "search_bookmark" && params.keyword) {
        chrome.bookmarks.search({ query: params.keyword }, (results) => {
          const bookmarks = results.filter((node) => node.url)

          hideTypingIndicator()

          const htmlContent = bookmarks.length
            ? `${t("foundBookmarks") || "I found"} ${bookmarks.length} ${
                t("bookmarksMatching") || "bookmarks matching"
              } '${params.keyword}':<br>${bookmarks
                .map((b, index) => {
                  const bHostname = new URL(b.url).hostname
                  return `<span class="bookmark-item">${
                    index + 1
                  }. <img src="https://www.google.com/s2/favicons?domain=${bHostname}" class="favicon" alt="Favicon" data-hostname="${bHostname}"> <a href="${
                    b.url
                  }" target="_blank">${b.title}</a> (ID: ${b.id})</span>`
                })
                .join("<br>")}`
            : `${
                t("noBookmarksFoundFor") ||
                "I couldn't find any bookmarks matching"
              } '${params.keyword}'.`

          appendBotMessage(htmlContent)
        })
      } else if (action === "search_folder" && params.keyword) {
        searchFoldersByName(params.keyword).then((folders) => {
          hideTypingIndicator()

          const htmlContent = folders.length
            ? `${t("foundFolders") || "I found these folders"}:<br>${folders

                .map(
                  (f, index) =>
                    `<span class="bookmark-item">${index + 1}. ${
                      f.title || t("unnamedFolder") || "Unnamed"
                    } (ID: ${f.id})</span>`,
                )

                .join("<br>")}`
            : `${
                t("noFoldersFoundFor") || "I couldn't find any folders matching"
              } '${params.keyword}'.`

          appendBotMessage(htmlContent)
        })
      } else if (action === "favorite" && (params.title || params.id)) {
        let bookmarks = []

        let bookmarkId

        if (params.id) {
          const bookmark = await getBookmarkById(params.id)

          bookmarks = [bookmark]

          bookmarkId = params.id
        } else if (params.title) {
          bookmarks = await searchBookmarksByTitle(params.title)
        }

        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with"} ${
              params.id ? `ID: ${params.id}` : `title: ${params.title}`
            }.`,
          )
        }

        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`,
          )
        }

        if (bookmarks.length === 1) {
          bookmarkId = bookmarks[0].id

          await toggleFavorite(bookmarkId, params.favorite)

          hideTypingIndicator()

          const htmlContent = `${
            params.favorite
              ? t("markedFavorite") || "I've marked the bookmark"
              : t("unmarkedFavorite") ||
                "I've removed the bookmark from favorites"
          } '${bookmarks[0].title || bookmarks[0].url}' (ID: ${bookmarkId}).`

          const textContent = htmlContent

          appendBotMessage(htmlContent, textContent)
        }
      } else if (action === "suggest_website") {
        hideTypingIndicator()
        const websites = params.websites || []

        const htmlContent = websites.length
          ? `${
              t("suggestWebsite") || "I've suggested the following websites"
            }:<br>${websites
              .map((site, index) => {
                const sHostname = new URL(site.url).hostname
                return `<span class="bookmark-item">${
                  index + 1
                }. <img src="https://www.google.com/s2/favicons?domain=${sHostname}" class="favicon" alt="Favicon" data-hostname="${sHostname}"> <a href="${
                  site.url
                }" target="_blank">${site.title}</a> - ${
                  site.description
                } <button class="bookmark-btn" data-url="${
                  site.url
                }" data-title="${site.title}" data-folder="Suggested">${
                  t("addToFolder") || "Bookmark"
                }</button></span>`
              })
              .join("<br>")}`
          : `${
              t("noBookmarksFoundFor") ||
              "I couldn't find any websites for this topic"
            }.`

        appendBotMessage(htmlContent)

        // Add event listeners for bookmark buttons
        const lastBotMessageContainer = chatMessages.lastElementChild
        if (lastBotMessageContainer) {
          const bookmarkButtons = lastBotMessageContainer.querySelectorAll(".bookmark-btn")
          bookmarkButtons.forEach((button) => {
            button.addEventListener("click", async () => {
              const url = button.getAttribute("data-url")
              const title = button.getAttribute("data-title")
              const folder = button.getAttribute("data-folder")
              try {
                const existingBookmarks = await checkUrlExists(url)
                if (existingBookmarks.length > 0) {
                  showCustomPopup(
                    `${t("duplicateUrlError") || "A bookmark with this URL already exists"}: ${url}.`,
                    "error",
                    true
                  )
                  return
                }
                chrome.bookmarks.create(
                  { parentId: await findFolderId(folder), title, url },
                  (bookmark) => {
                    showCustomPopup(
                      `${t("addedBookmarkToFolder") || "I've added the bookmark"} ${title} ${t("toFolder") || "to the folder"} '${folder}' (ID: ${bookmark.id}).`,
                      "success",
                      true
                    )
                  }
                )
              } catch (error) {
                showCustomPopup(`${t("errorTitle") || "Error"}: ${error.message}`, "error", true)
              }
            })
          })
        }
      } else if (action === "change_view" && params.view_mode) {
        const validViews = ["list", "detail", "card", "tree"]
        if (validViews.includes(params.view_mode)) {
          uiState.viewMode = params.view_mode
          localStorage.setItem("appView", params.view_mode)
          saveUIState()
          window.BookmarkCache.getTree((tree) => {
            const elements = getUiElements()
            renderFilteredBookmarks(tree, elements)
          })
          hideTypingIndicator()
          const content = `${t("viewChanged") || "View changed to"} ${
            params.view_mode
          }.`
          appendBotMessage(content, content)
        } else {
          throw new Error(
            `${t("invalidView") || "Invalid view mode"}: ${params.view_mode}`,
          )
        }
      } else if (action === "change_theme" && params.theme_name) {
        const validThemes = [
          "light",
          "dark",
          "dracula",
          "onedark",
          "tet",
          "system",
        ]
        if (validThemes.includes(params.theme_name)) {
          localStorage.setItem("appTheme", params.theme_name)
          const elements = getUiElements()
          updateTheme(elements, params.theme_name)
          hideTypingIndicator()
          const content = `${t("themeChanged") || "Theme changed to"} ${
            params.theme_name
          }.`
          appendBotMessage(content, content)
        } else {
          throw new Error(
            `${t("invalidTheme") || "Invalid theme"}: ${params.theme_name}`,
          )
        }
      } else if (action === "change_sort" && params.sort_by) {
        const validSorts = [
          "default",
          "favorites",
          "most-visited",
          "old",
          "last-opened",
          "a-z",
          "z-a",
          "domain",
        ]
        if (validSorts.includes(params.sort_by)) {
          uiState.sortType = params.sort_by
          window.BookmarkCache.getTree((tree) => {
            const elements = getUiElements()
            renderFilteredBookmarks(tree, elements)
          })
          hideTypingIndicator()
          const content = `${t("sortChanged") || "Sort order changed to"} ${
            params.sort_by
          }.`
          appendBotMessage(content, content)
        } else {
          throw new Error(
            `${t("invalidSort") || "Invalid sort type"}: ${params.sort_by}`,
          )
        }
      } else if (action === "check_links") {
        const elements = getUiElements()
        handleCheckHealth(elements)
        hideTypingIndicator()
        const content =
          t("checkingLinks") ||
          "Started checking for broken links. Results will appear in the UI."
        appendBotMessage(content, content)
      } else if (action === "group_domain") {
        hideTypingIndicator()
        groupBookmarksByDomain()
        appendBotMessage("Grouping bookmarks by domain...", "Grouping bookmarks by domain...")
      } else if (action === "autotag_domain") {
        hideTypingIndicator()
        autoTagByDomain()
        appendBotMessage("Auto-tagging bookmarks by domain...", "Auto-tagging bookmarks by domain...")
      } else if (action === "autoorganize") {
        hideTypingIndicator()
        appendBotMessage("Please specify how you'd like to organize (by meaning, by folder structure) so I can assist you with AI organization.", "Please specify how you'd like to organize.")
      } else {
        throw new Error(
          t("notSupported") ||
            "Sorry, I can only help with bookmark-related tasks or simple questions.",
        )
      }
    } catch (error) {
      hideTypingIndicator()

      appendBotMessage(
        `<span class="error-text">${t("errorTitle") || "Oops"}: ${
          error.message
        }</span>`,

        `${t("errorTitle") || "Oops"}: ${error.message}`,
      )
    }
  }

  // Handle user input

  // API Call handler
  async function callAiApi(message, isGeneral = false) {
    try {
      const config = await getAiConfig()
      const request = buildApiRequest(
        config.modelName,
        config.apiKey,
        config.model,
        message,
        isGeneral,
      )

      let responseText = ""

      if (request.isLocal) {
        const isAvailable = await checkLocalAiAvailability()
        if (!isAvailable) {
          throw new Error(
            t("localGeminiNotAvailable") || "Local Gemini not available",
          )
        }

        let session
        if (window.ai.languageModel) {
          session = await window.ai.languageModel.create({
            systemPrompt: request.prompt,
          })
          responseText = await session.prompt(request.message)
        } else {
          // Legacy Text Session API
          session = await window.ai.createTextSession()
          responseText = await session.prompt(
            `${request.prompt}\n\nUser: ${request.message}`,
          )
        }
        if (session.destroy) session.destroy()
      } else {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || response.statusText)
        }

        const data = await response.json()
        if (config.model === "gemini") {
          responseText = data.candidates[0].content.parts[0].text
        } else if (config.model === "gpt") {
          responseText = data.choices[0].message.content
        } else {
          responseText = data.response || data.text || JSON.stringify(data)
        }
      }

      hideTypingIndicator()
      return responseText
    } catch (error) {
      hideTypingIndicator()
      console.error("AI API Error:", error)
      throw error
    }
  }

  async function handleUserInput() {
    const message = chatInput.value.trim()

    if (!message) return

    const userMessageContainer = document.createElement("div")
    userMessageContainer.className = "chatbox-message-container user"
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    userMessageContainer.innerHTML = `
      <div class="message-wrapper">
        <div class="chatbox-message">
          ${message}
        </div>
        <span class="timestamp">${timestamp}</span>
      </div>
      <div class="chat-avatar">
        <i class="fas fa-user"></i>
      </div>
    `

    chatMessages.appendChild(userMessageContainer)
    addToChatHistory("user", message, timestamp)
    chatMessages.scrollTop = chatMessages.scrollHeight

    chatInput.value = ""
    chatInput.style.height = "auto"

    showTypingIndicator()

    try {
      const result = parseLocalCommand(message)
      console.log("Local Parser Result:", result)

      if (result.action === "help") {
        hideTypingIndicator()
        const helpContent = t("helpCommands") || ""
        appendBotMessage(helpContent, helpContent)
        return
      }

      // If action is NOT general, it's a local command we recognize - handle it immediately
      if (result.action !== "general") {
        console.log("Executing local command:", result.action, result.params)
        await handleBookmarkCommand(result.action, result.params || {})
        return
      }

      // If we reach here, it's a "general" action - we need AI or Offline Check
      const config = await getAiConfig()
      console.log("AI Config Model:", config.model)
      
      if (config.model === "none") {
        hideTypingIndicator()
        const reply = t("localOnlyNotSupported") || "This command is not supported in Offline Mode. Please enable an AI provider for advanced tasks."
        appendBotMessage(reply, reply)
        return
      }

      try {
        // Unified AI Call: Always get JSON for intent and answer
        const responseText = await callAiApi(message, false)
        let aiResult
        
        try {
          // Clean the response in case AI includes markdown code blocks
          const cleanedText = responseText.replace(/```json\n?|\n?```/g, "").trim()
          aiResult = JSON.parse(cleanedText)
        } catch (parseError) {
          console.error("Failed to parse AI JSON:", responseText)
          // Fallback: If AI didn't return JSON, treat the whole response as a chat message
          hideTypingIndicator()
          appendBotMessage(responseText, responseText, true)
          return
        }

        if (aiResult.action && aiResult.action !== "general") {
          // It's a bookmark action
          console.log("AI executing action:", aiResult.action, aiResult.params)
          // If the action is suggest_website but we don't have websites yet, 
          // it means AI just returned the action. We need to handle this.
          if (aiResult.action === "suggest_website" && !aiResult.params?.websites) {
            // Re-call AI specifically for websites or just treat as general
            const answer = aiResult.answer || "Đang lấy gợi ý website cho bạn..."
            appendBotMessage(answer, answer, true)
            const webSuggestions = await suggestWebsites(message)
            await handleBookmarkCommand("suggest_website", { websites: webSuggestions.websites })
          } else {
            await handleBookmarkCommand(aiResult.action, aiResult.params || {})
          }
        } else {
          // It's a general chat or the AI decided it's general
          hideTypingIndicator()
          const answer = aiResult.answer || responseText
          appendBotMessage(answer, answer, true)
        }
      } catch (aiError) {
        hideTypingIndicator()
        
        const errorMsg = aiError.message || ""
        const isProviderError = errorMsg.includes("chrome://flags") || 
                               errorMsg.includes("API Key") || 
                               errorMsg.includes("model") ||
                               errorMsg.includes("fetch")

        if (isProviderError) {
          appendBotMessage(
            `<div class="error-container">
              <p><strong><i class="fas fa-exclamation-triangle"></i> ${t("errorTitle") || "AI Error"}:</strong></p>
              <p>${errorMsg}</p>
              ${errorMsg.includes("chrome://flags") ? `<button class="button info-btn" id="fix-ai-btn" style="margin-top:10px; font-size:0.8rem;">${t("learnHowToEnable") || "How to fix"}</button>` : ""}
            </div>`,
            errorMsg
          )
          
          setTimeout(() => {
            const btn = document.getElementById("fix-ai-btn")
            if (btn) btn.onclick = () => {
              const steps = t("localAiGuideSteps") || "Instructions..."
              showCustomPopup(steps, "info", false)
            }
          }, 100)
        } else {
          const reply =
            t("notSupported") ||
            "I can only help with bookmark-related tasks or simple questions."
          appendBotMessage(
            `${reply}<br><br><small style="opacity:0.6">${errorMsg}</small>`,
            reply,
          )
        }
      }
    } catch (error) {
      hideTypingIndicator()
      appendBotMessage(
        `<span class="error-text">${t("errorTitle") || "Oops"}: ${error.message}</span>`,
        `${t("errorTitle") || "Oops"}: ${error.message}`
      )
    }
  }

  // Function to display the welcome message and start button
  const displayWelcomeMessage = () => {
    if (chatMessages.querySelector(".chatbox-welcome-container")) {
      return // Don't add if already present
    }

    const welcomeContainer = document.createElement("div")
    welcomeContainer.className = "chatbox-welcome-container"

    const welcomeMessage = document.createElement("div")
    welcomeMessage.className = "chatbox-welcome-message"
    welcomeMessage.innerHTML = `${
      t("welcomeMessage") || "Welcome to Zero Bookmark Manager Chat!"
    }<br><br>${t("welcomeSubMessage") || "How can I assist you today?"}`

    const startButton = document.createElement("button")
    startButton.className = "button chatbox-start-button"
    startButton.textContent = t("startButton") || "Start Chat"
    startButton.addEventListener("click", () => {
      const initialMessage = getLanguage() === "vi" ? "Xin chào" : "Hello"
      chatInput.value = initialMessage // Set the input value
      handleUserInput() // Trigger sending the message
      // After sending, the welcome message should be removed by handleUserInput if it detects messages
      removeWelcomeMessage()
    })

    welcomeContainer.appendChild(welcomeMessage)
    welcomeContainer.appendChild(startButton)
    chatMessages.appendChild(welcomeContainer)
  }

  // Function to remove the welcome message
  const removeWelcomeMessage = () => {
    const welcomeContainer = chatMessages.querySelector(
      ".chatbox-welcome-container",
    )
    if (welcomeContainer) {
      welcomeContainer.remove()
    }
  }

  // Event listeners

  if (chatSend) {
    chatSend.addEventListener("click", () => {
      removeWelcomeMessage() // Remove welcome message when user sends a message
      handleUserInput()
    })
  }

  if (chatInput) {
    chatInput.addEventListener("input", () => {
      chatInput.style.height = "auto"
      chatInput.style.height = `${chatInput.scrollHeight}px`
      const context = getMentionContext(
        chatInput.value,
        chatInput.selectionStart || 0,
      )
      if (context) {
        renderFolderSuggestions(context)
      } else {
        hideFolderSuggestions()
      }
    })

    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault() // Prevent newline
        removeWelcomeMessage() // Remove welcome message when user types and presses enter
        hideFolderSuggestions()
        handleUserInput()
      }
    })
  }

  if (chatClear) {
    chatClear.addEventListener("click", () => {
      chatMessages.innerHTML = ""
      chatHistory = []
      chatMessages.scrollTop = chatMessages.scrollHeight
      displayWelcomeMessage() // Display welcome message if chat is cleared
    })
  }

  if (chatToggle) {
    chatToggle.addEventListener("click", () => {
      chatbox.classList.toggle("hidden")
      if (!chatbox.classList.contains("hidden")) {
        chatInput.focus()
        chatMessages.scrollTop = chatMessages.scrollHeight
        // Display welcome message if chat history is empty
        if (getChatHistory().length === 0) {
          displayWelcomeMessage()
        } else {
          removeWelcomeMessage() // Ensure it's removed if there's history
        }
      }
    })
  }

  // Initial check when chatbox might be opened initially (e.g., on page load if not hidden)
  if (!chatbox.classList.contains("hidden") && getChatHistory().length === 0) {
    displayWelcomeMessage()
  }

  if (chatClose) {
    chatClose.addEventListener("click", () => {
      chatbox.classList.add("hidden")
    })
  }

  if (chatMaximize) {
    chatMaximize.addEventListener("click", () => {
      chatbox.classList.toggle("maximized")
      chatMessages.scrollTop = chatMessages.scrollHeight
    })
  }

  if (chatScrollBottom) {
    chatScrollBottom.addEventListener("click", () => {
      chatMessages.scrollTop = chatMessages.scrollHeight
    })
  }

  document.addEventListener("click", (event) => {
    if (!chatFolderSuggestions || !chatInput) return
    if (
      event.target === chatInput ||
      chatFolderSuggestions.contains(event.target)
    ) {
      return
    }
    hideFolderSuggestions()
  })

  if (chatHelp) {
    chatHelp.addEventListener("click", showCustomGuide)
  }

  if (chatHistoryBtn) {
    chatHistoryBtn.addEventListener("click", exportChatHistory)
  }

  // --- AI Model Suggestions ---
  const modelSuggestions = {
    gemini: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.0-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ],
  }

  const renderModelSuggestions = (provider) => {
    const suggestionsContainer = document.getElementById("ai-model-suggestions")
    if (!suggestionsContainer) return

    suggestionsContainer.innerHTML = ""
    const models = modelSuggestions[provider] || []

    models.forEach((model) => {
      const chip = document.createElement("span")
      chip.className = "model-suggestion-chip"
      chip.textContent = model
      chip.addEventListener("click", () => {
        if (aiModelNameInput) {
          aiModelNameInput.value = model
        }
      })
      suggestionsContainer.appendChild(chip)
    })
  }

  const saveAiProfileBtn = document.getElementById("save-ai-profile")
  const deleteAiProfileBtn = document.getElementById("delete-ai-profile")
  const aiProfileSelect = document.getElementById("ai-profile-select")
  const aiProfileNamePopup = document.getElementById("ai-profile-name-popup")
  const aiProfileNameInput = document.getElementById("ai-profile-name-input")
  const aiProfileNameSave = document.getElementById("ai-profile-name-save")
  const aiProfileNameCancel = document.getElementById("ai-profile-name-cancel")

  const getAiProfiles = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get("aiProfiles", (result) => {
        resolve(result.aiProfiles || [])
      })
    })
  }

  const saveAiProfiles = async (profiles) => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ aiProfiles: profiles }, () => {
        resolve()
      })
    })
  }

  const renderAiProfiles = async () => {
    if (!aiProfileSelect) return
    const profiles = await getAiProfiles()
    
    // Save current selection to restore if possible
    const currentVal = aiProfileSelect.value
    
    aiProfileSelect.innerHTML = `<option value="">-- ${t("selectFolder") || "Chọn Profile"} --</option>`

    profiles.forEach((profile, index) => {
      const option = document.createElement("option")
      option.value = index
      option.textContent = profile.name || `Profile ${index + 1}`
      aiProfileSelect.appendChild(option)
    })

    // Restore selection or keep default
    if (currentVal !== "" && currentVal < profiles.length) {
      aiProfileSelect.value = currentVal
    }
  }

  if (aiProfileSelect) {
    aiProfileSelect.addEventListener("change", async () => {
      const index = aiProfileSelect.value
      if (index === "") return

      const profiles = await getAiProfiles()
      const profile = profiles[index]
      if (profile) {
        aiProviderSelect.value = profile.model || "gemini"
        aiApiKeyInput.value = profile.apiKey || ""
        aiModelNameInput.value = profile.modelName || ""
        aiProviderSelect.dispatchEvent(new Event("change"))
        showCustomPopup(`${t("aiProfileApplySuccess") || "Đã áp dụng profile:"} ${profile.name}`, "success", true)
      }
    })
  }

  if (saveAiProfileBtn) {
    saveAiProfileBtn.addEventListener("click", () => {
      if (aiProfileNamePopup) {
        aiProfileNameInput.value = `Profile ${new Date().toLocaleDateString()}`
        aiProfileNamePopup.classList.remove("hidden")
        aiProfileNameInput.focus()
        aiProfileNameInput.select()
      }
    })
  }

  if (deleteAiProfileBtn) {
    deleteAiProfileBtn.addEventListener("click", async () => {
      const index = aiProfileSelect.value
      if (index === "") {
        showCustomPopup(t("aiProfileSelectToDelete") || "Vui lòng chọn Profile để xóa", "info", true)
        return
      }

      const profiles = await getAiProfiles()
      const profileName = profiles[index]?.name || ""
      
      const confirmMsg = (t("aiProfileDeleteConfirm") || "Bạn có chắc chắn muốn xóa profile \"{0}\"?").replace("{0}", profileName)

      showCustomConfirm(confirmMsg, async () => {
        profiles.splice(index, 1)
        await saveAiProfiles(profiles)
        await renderAiProfiles()
        showCustomPopup(`${t("aiProfileDeleteSuccess") || "Đã xóa profile:"} ${profileName}`, "success", true)
      })
    })
  }

  if (aiProfileNameSave) {
    aiProfileNameSave.addEventListener("click", async () => {
      const name = aiProfileNameInput.value.trim()
      if (!name) return

      const newProfile = {
        name,
        model: aiProviderSelect.value,
        apiKey: aiApiKeyInput.value,
        modelName: aiModelNameInput.value
      }

      const profiles = await getAiProfiles()
      profiles.push(newProfile)
      await saveAiProfiles(profiles)
      await renderAiProfiles()
      
      // Select the newly added profile
      aiProfileSelect.value = profiles.length - 1
      
      aiProfileNamePopup.classList.add("hidden")
      showCustomPopup(t("aiProfileSaveSuccess") || "Đã lưu Profile thành công!", "success", true)
    })
  }

  if (aiProfileNameCancel) {
    aiProfileNameCancel.addEventListener("click", () => {
      aiProfileNamePopup.classList.add("hidden")
    })
  }

  // --- AI Config Modal Logic ---
  if (aiSettingsOption) {
    aiSettingsOption.addEventListener("click", async (e) => {
      e.stopPropagation()
      const config = await getAiConfig()
      aiProviderSelect.value = config.model || "gemini"
      aiApiKeyInput.value = config.apiKey || ""
      aiModelNameInput.value = config.modelName || ""

      // Render suggestions and profiles
      renderModelSuggestions(aiProviderSelect.value)
      renderAiProfiles()

      // Check local availability
      const isLocalAvailable = await checkLocalAiAvailability()
      if (aiLocalWarning) {
        aiLocalWarning.classList.toggle("hidden", isLocalAvailable || aiProviderSelect.value !== "local")
      }

      // Handle experimental note visibility
      const expNote = document.getElementById("local-ai-experimental-note")
      if (expNote) {
        expNote.classList.toggle("hidden", aiProviderSelect.value !== "local")
      }

      // Toggle API group based on provider
      if (aiApiGroup) {
        aiApiGroup.classList.toggle("hidden", aiProviderSelect.value === "local" || aiProviderSelect.value === "none")
      }

      aiConfigPopup.classList.remove("hidden")
      if (settingsMenu) settingsMenu.classList.add("hidden")
    })
  }

  if (aiProviderSelect) {
    aiProviderSelect.addEventListener("change", () => {
      const isApiProvider = aiProviderSelect.value !== "local" && aiProviderSelect.value !== "none"
      if (aiApiGroup) {
        aiApiGroup.classList.toggle("hidden", !isApiProvider)
      }
      
      const expNote = document.getElementById("local-ai-experimental-note")
      if (expNote) {
        expNote.classList.toggle("hidden", aiProviderSelect.value !== "local")
      }

      if (aiLocalWarning) {
        checkLocalAiAvailability().then(isAvailable => {
          aiLocalWarning.classList.toggle("hidden", isAvailable || aiProviderSelect.value !== "local")
        })
      }

      renderModelSuggestions(aiProviderSelect.value)
    })
  }

  if (aiConfigSave) {
    aiConfigSave.addEventListener("click", async () => {
      await saveAiConfig(
        aiProviderSelect.value,
        aiApiKeyInput.value,
        aiModelNameInput.value,
        aiProviderSelect.value !== "local" && aiProviderSelect.value !== "none",
      )
      await updateAiStatusIndicator({
        model: aiProviderSelect.value,
        apiKey: aiApiKeyInput.value,
        modelName: aiModelNameInput.value,
        apiVisible:
          aiProviderSelect.value !== "local" && aiProviderSelect.value !== "none",
      })
      aiConfigPopup.classList.add("hidden")
      showCustomPopup(
        t("aiConfigSaveSuccess") || "AI settings saved!",
        "success",
        true,
      )
    })
  }

  const toggleApiKeyVisibilityBtn = document.getElementById("toggle-api-key-visibility")
  if (toggleApiKeyVisibilityBtn && aiApiKeyInput) {
    toggleApiKeyVisibilityBtn.addEventListener("click", (e) => {
      e.preventDefault()
      const type = aiApiKeyInput.getAttribute("type") === "password" ? "text" : "password"
      aiApiKeyInput.setAttribute("type", type)
      
      const icon = toggleApiKeyVisibilityBtn.querySelector("i")
      if (icon) {
        icon.className = type === "password" ? "fas fa-eye" : "fas fa-eye-slash"
      }
    })
  }

  if (aiConfigCancel) {
    aiConfigCancel.addEventListener("click", () => {
      aiConfigPopup.classList.add("hidden")
    })
  }

  // --- Draggable Chatbox Logic ---
  const initDraggableChat = () => {
    const header = chatbox.querySelector("h3")
    if (!header) return

    let isDragging = false
    let startX, startY
    let initialLeft, initialTop

    header.addEventListener("mousedown", (e) => {
      // Don't drag if clicking buttons or if maximized
      if (
        e.target.closest("button") ||
        chatbox.classList.contains("maximized")
      ) {
        return
      }

      isDragging = true
      startX = e.clientX
      startY = e.clientY

      const rect = chatbox.getBoundingClientRect()
      initialLeft = rect.left
      initialTop = rect.top

      // Switch to absolute positioning for dragging
      chatbox.style.bottom = "auto"
      chatbox.style.right = "auto"
      chatbox.style.left = `${initialLeft}px`
      chatbox.style.top = `${initialTop}px`
      chatbox.style.margin = "0"

      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)
      header.style.cursor = "grabbing"
      e.preventDefault()
    })

    const onMouseMove = (e) => {
      if (!isDragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      // Constrain within window
      let newLeft = initialLeft + dx
      let newTop = initialTop + dy

      newLeft = Math.max(
        0,
        Math.min(newLeft, window.innerWidth - chatbox.offsetWidth),
      )
      newTop = Math.max(
        0,
        Math.min(newTop, window.innerHeight - chatbox.offsetHeight),
      )

      chatbox.style.left = `${newLeft}px`
      chatbox.style.top = `${newTop}px`
    }

    const onMouseUp = () => {
      isDragging = false
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      header.style.cursor = "move"
    }
  }

  if (localAiGuideBtn) {
    localAiGuideBtn.addEventListener("click", (e) => {
      e.preventDefault()
      const steps = t("localAiGuideSteps") || "Instructions..."
      showCustomPopup(steps, "info", false)
    })
  }

  initDraggableChat()
})

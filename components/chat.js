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

  // System Prompt: Includes suggest_website action
  const systemPrompt = `
        You are a bookmark management assistant integrated into a browser extension. Your role is to classify user intent for managing bookmarks. Based on the user's query, you must return a JSON object with an "action" and optional "params".

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
        - change_view: Change the layout of the bookmark list (list, detail, card, tree).
        - change_theme: Change the color theme (light, dark, dracula, onedark, tet, system).
        - change_sort: Change the sort order of bookmarks (default, favorites, most-visited, old, last-opened, a-z, z-a, domain).
        - check_links: Check all bookmarks for broken links.
        - general: For any query that is not related to bookmark management, is a greeting, or is too vague.

        Guidelines:
        - For natural language queries, interpret the user's intent and provide the corresponding action and parameters.
        - For deletion actions, include a "confirm" field in the params set to true.
        - If a query is not about managing bookmarks (e.g., "hello", "what is the capital of France?"), or is vague ("hmm"), you MUST return: { "action": "general" }. Do not attempt to answer the question yourself.

        Example Flows:
        - User: "how many bookmarks do I have?" -> Response: { "action": "count" }
        - User: "add https://google.com to my work folder" -> Response: { "action": "add", "params": { "url": "https://google.com", "folder": "work" } }
        - User: "delete bookmark with id 123" -> Response: { "action": "delete", "params": { "id": "123", "confirm": true } }
        - User: "create a new folder called 'social media'" -> Response: { "action": "create_folder", "params": { "folderName": "social media" } }
        - User: "rename folder 'work' to 'office'" -> Response: { "action": "rename_folder", "params": { "oldName": "work", "newName": "office" } }
        - User: "delete the 'temp' folder" -> Response: { "action": "delete_folder", "params": { "folderName": "temp", "confirm": true } }
        - User: "switch to card view" -> Response: { "action": "change_view", "params": { "view_mode": "card" } }
        - User: "use the dracula theme" -> Response: { "action": "change_theme", "params": { "theme_name": "dracula" } }
        - User: "sort my bookmarks by name" -> Response: { "action": "change_sort", "params": { "sort_by": "a-z" } }
        - User: "check for broken links" -> Response: { "action": "check_links" }
        - User: "what is python?" -> Response: { "action": "general" }
        - User: "hi there" -> Response: { "action": "general" }
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

    const htmlContent = isMarkdown ? marked.parse(content) : content

    botMessageContainer.innerHTML = `
      <div class="chat-avatar">
       <i class="fas fa-power-off"></i>
      </div>
      <div class="chatbox-message">
        ${htmlContent}
        <span class="timestamp">${timestamp}</span>
      </div>
    `
    chatMessages.appendChild(botMessageContainer)
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
      <div class="chat-avatar">
       <i class="fas fa-power-off"></i>
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

    if (/(goi y|suggest).*(website|web|site)/i.test(text)) {
      return { action: "general", reason: "suggest_disabled" }
    }

    if (/(check|kiem tra).*(link|broken|suc khoe|health)/i.test(text)) {
      return { action: "check_links" }
    }

    if (
      /(doi giao dien|theme|chu de|mau).*(light|dark|dracula|onedark|tet|system)/i.test(
        text,
      )
    ) {
      const themeMatch = text.match(/(light|dark|dracula|onedark|tet|system)/i)
      return {
        action: "change_theme",
        params: { theme_name: themeMatch ? themeMatch[1] : "system" },
      }
    }

    if (/(view|che do).*(list|detail|card|tree)/i.test(text)) {
      const viewMatch = text.match(/(list|detail|card|tree)/i)
      return {
        action: "change_view",
        params: { view_mode: viewMatch ? viewMatch[1] : "list" },
      }
    }

    if (/(sort|sap xep)/i.test(text)) {
      const sortMap = {
        "a-z": "a-z",
        "z-a": "z-a",
        default: "default",
        favorites: "favorites",
        favorite: "favorites",
        "most-visited": "most-visited",
        old: "old",
        "last-opened": "last-opened",
        domain: "domain",
      }
      const sortMatch = text.match(
        /(a-z|z-a|default|favorites|favorite|most-visited|old|last-opened|domain)/i,
      )
      return {
        action: "change_sort",
        params: { sort_by: sortMatch ? sortMap[sortMatch[1]] : "default" },
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
  const getAiConfig = () => {
    const config = localStorage.getItem("aiConfig")
    return config
      ? JSON.parse(config)
      : { model: "", apiKey: "", modelName: "", apiVisible: true }
  }

  const saveAiConfig = (model, apiKey, modelName, apiVisible = true) => {
    localStorage.setItem(
      "aiConfig",
      JSON.stringify({ model, apiKey, modelName, apiVisible }),
    )
  }

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
    const config = getAiConfig()
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
        if (config.model === "gemini") {
          result = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}",
          )
        } else if (config.model === "gpt") {
          result = JSON.parse(data.choices?.[0]?.message?.content || "{}")
        } else {
          result = JSON.parse(data.text || "{}")
        }
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
    const config = getAiConfig()
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
        if (config.model === "gemini") {
          result = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}",
          )
        } else if (config.model === "gpt") {
          result = JSON.parse(data.choices?.[0]?.message?.content || "{}")
        } else {
          result = JSON.parse(data.text || "{}")
        }
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
        chrome.bookmarks.getTree((bookmarkTree) => {
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
        chrome.bookmarks.getTree((bookmarkTree) => {
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
        chrome.bookmarks.getTree((bookmarkTree) => {
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

                .map(
                  (b, index) =>
                    `<span class="bookmark-item">${
                      index + 1
                    }. <img src="https://www.google.com/s2/favicons?domain=${
                      new URL(b.url).hostname
                    }" class="favicon" alt="Favicon" onerror="this.src='./images/default-favicon.png';"> <a href="${
                      b.url
                    }" target="_blank">${b.title}</a> (ID: ${b.id})</span>`,
                )

                .join("<br>")}`
            : `${t("noBookmarks") || "You don't have any bookmarks yet."}`

          appendBotMessage(htmlContent)
        })
      } else if (action === "list_folders") {
        chrome.bookmarks.getTree((bookmarkTree) => {
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
                    (b, index) =>
                      `<span class="bookmark-item">${
                        index + 1
                      }. <img src="https://www.google.com/s2/favicons?domain=${
                        new URL(b.url).hostname
                      }" class="favicon" alt="Favicon" onerror="this.src='./images/default-favicon.png';"> <a href="${
                        b.url
                      }" target="_blank">${b.title || b.url}</a> (ID: ${
                        b.id
                      })</span>`,
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

                .map(
                  (b, index) =>
                    `<span class="bookmark-item">${
                      index + 1
                    }. <img src="https://www.google.com/s2/favicons?domain=${
                      new URL(b.url).hostname
                    }" class="favicon" alt="Favicon" onerror="this.src='./images/default-favicon.png';"> <a href="${
                      b.url
                    }" target="_blank">${b.title || b.url}</a> (ID: ${
                      b.id
                    })</span>`,
                )

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
      } else if (action === "suggest_website" && params.websites) {
        hideTypingIndicator()

        const websites = params.websites || []

        const htmlContent = websites.length
          ? `${
              t("suggestWebsite") || "I've suggested the following websites"
            }:<br>${websites

              .map(
                (site, index) =>
                  `<span class="bookmark-item">${
                    index + 1
                  }. <img src="https://www.google.com/s2/favicons?domain=${
                    new URL(site.url).hostname
                  }" class="favicon" alt="Favicon" onerror="this.src='./images/default-favicon.png';"> <a href="${
                    site.url
                  }" target="_blank">${site.title}</a>: ${
                    site.description
                  } <button class="bookmark-btn" data-url="${
                    site.url
                  }" data-title="${site.title}" data-folder="Suggested">${
                    t("addToFolder") || "Bookmark"
                  }</button></span>`,
              )

              .join("<br>")}`
          : `${
              t("noBookmarksFoundFor") ||
              "I couldn't find any websites for this topic"
            }.`

        appendBotMessage(htmlContent)

        // Add event listeners for bookmark buttons

        const lastBotMessageContainer = chatMessages.lastElementChild

        if (lastBotMessageContainer) {
          const bookmarkButtons =
            lastBotMessageContainer.querySelectorAll(".bookmark-btn")

          bookmarkButtons.forEach((button) => {
            button.addEventListener("click", async () => {
              const url = button.getAttribute("data-url")

              const title = button.getAttribute("data-title")

              const folder = button.getAttribute("data-folder")

              try {
                const existingBookmarks = await checkUrlExists(url)

                if (existingBookmarks.length > 0) {
                  showCustomPopup(
                    `${
                      t("duplicateUrlError") ||
                      "A bookmark with this URL already exists"
                    }: ${url}.`,

                    "error",

                    true,
                  )

                  return
                }

                chrome.bookmarks.create(
                  { parentId: await findFolderId(folder), title, url },

                  (bookmark) => {
                    showCustomPopup(
                      `${
                        t("addedBookmarkToFolder") || "I've added the bookmark"
                      } ${title} ${
                        t("toFolder") || "to the folder"
                      } '${folder}' (ID: ${bookmark.id}).`,

                      "success",

                      true,
                    )
                  },
                )
              } catch (error) {
                showCustomPopup(
                  `${t("errorTitle") || "Error"}: ${error.message}`,

                  "error",

                  true,
                )
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
          chrome.bookmarks.getTree((tree) => {
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
          chrome.bookmarks.getTree((tree) => {
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

        <div class="chatbox-message">

          ${message} <span class="timestamp">${timestamp}</span>

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

      if (result.action === "help") {
        hideTypingIndicator()
        const helpContent = t("helpCommands") || ""
        appendBotMessage(helpContent, helpContent)
        return
      }

      if (result.action === "general") {
        hideTypingIndicator()
        const reply =
          result.reason === "suggest_disabled"
            ? t("featureDisabled") ||
              "Website suggestions are disabled in local mode."
            : t("notSupported") ||
              "I can only help with bookmark commands in local mode."
        appendBotMessage(reply, reply)
        return
      }

      await handleBookmarkCommand(result.action, result.params || {})
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
})

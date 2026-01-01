// components/chat.js
import {
  translations,
  showCustomPopup,
  showCustomConfirm,
  showCustomGuide,
} from "./utils/utils.js"

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
  const aiConfigPopup = document.getElementById("ai-config-popup")
  const aiModelSelect = document.getElementById("ai-model-select")
  const apiKeyInput = document.getElementById("api-key-input")
  const toggleApiVisibility = document.getElementById("toggle-api-visibility")
  const curlInput = document.getElementById("curl-input")
  const clearApiKey = document.getElementById("clear-api-key")
  const clearCurl = document.getElementById("clear-curl")
  const aiConfigSave = document.getElementById("ai-config-save")
  const aiConfigCancel = document.getElementById("ai-config-cancel")
  const chatEditConfig = document.getElementById("chat-edit-config")
  const chatHelp = document.getElementById("chat-help")
  const chatHistoryBtn = document.getElementById("chat-history")

  // System Prompt: Includes suggest_website action
  const systemPrompt = `
        You are a bookmark management assistant integrated into a browser extension. Your role is to help users manage their bookmarks and suggest relevant websites using natural language or specific commands, interpreting their intent as flexibly as possible. Respond in a conversational, natural way in the user's language (e.g., Vietnamese if the query is in Vietnamese). You have access to Chrome Bookmarks API to perform actions like:
        - Counting bookmarks ("how many bookmarks do I have?").
        - Counting folders ("how many folders do I have?").
        - Listing bookmarks ("list my bookmarks").
        - Listing folders ("list my folders").
        - Listing bookmarks in a folder ("list bookmarks in folder <folder>").
        - Adding bookmarks ("bookmark add <URL> [title <title>] [to folder <folder>]"). Check if the URL already exists; if it does, suggest not adding or ask for confirmation.
        - Moving bookmarks ("move bookmark 'title' to folder 'folder'" or "move bookmark id <id> to folder 'folder'"). If multiple bookmarks with the same title, specify or ask for clarification.
        - Editing bookmarks ("edit bookmark <URL> [title <new_title>] [to folder <new_folder>]", "change bookmark title <old_title> to <new_title> [in folder <folder>]", or "edit bookmark id <id> [title <new_title>] [to folder <new_folder>]"). If only a title is provided, search for bookmarks by title; if multiple matches, ask for clarification or use folder context. For ID-based edits, use the bookmark ID directly.
        - Deleting bookmarks ("delete bookmark <URL>", "delete bookmark titled <title>", or "delete bookmark id <id>"). If duplicate URLs or titles, delete all or specify. For deletion, always require confirmation from the user before proceeding.
        - Searching bookmarks ("search bookmark <keyword>").
        - Searching folders ("search folder <keyword>"). If multiple folders with the same name, report an error.
        - Marking/unmarking bookmarks as favorite ("make bookmark <title> a favorite" or "remove bookmark <title> from favorites"). If multiple bookmarks with the same title, ask for clarification or use folder context.
        - Suggesting websites ("suggest website for <topic>"). Return a list of relevant website suggestions with URLs, titles, and brief descriptions in JSON format: { "websites": [{ "url": string, "title": string, "description": string }, ...] }. Do not use search or external APIs; rely on your knowledge to suggest reputable websites.
        For natural language queries, interpret the user's intent and provide a JSON response with:
        - "action": the action (count, count_folders, list, list_folders, list_bookmarks_in_folder, add, move, edit, delete, search_bookmark, search_folder, favorite, suggest_website, general).
        - "params": parameters needed for the action (e.g., { url, title, folder, keyword, favorite, id, websites }).
        - "response": a conversational response in the user's language, summarizing the action or explaining issues (e.g., "I found two bookmarks named 'ChickenSoup'. Which one do you want to make a favorite?").
        For deletion actions, include a "confirm" field in the params set to true to indicate that user confirmation is required before proceeding.
        If the query is unclear or not bookmark-related (e.g., "hello", "what time is it?", vague terms like "hmm"), return a conversational fallback response encouraging clarification, like:
        - Vietnamese: "Tui đang cố hiểu bạn muốn gì! Bạn có thể nói rõ hơn không, như 'đổi tên bookmark ChickenSoup thành ChickenSoup2698' hoặc 'gợi ý trang web để học Python'?"
        - English: "I'm trying to understand what you want! Could you clarify, like 'change bookmark ChickenSoup to ChickenSoup2698' or 'suggest a website for learning Python'?"
        Always return JSON format: { "action": string, "params": object, "response": string (optional) }.
        Example for non-bookmark or unmatched queries:
        - Query: "What day is it today?" or "hello"
          Response: { "action": "general", "response": "Tui đang cố hiểu bạn muốn gì! Bạn có thể nói rõ hơn không, như 'đổi tên bookmark ChickenSoup thành ChickenSoup2698' hoặc 'gợi ý trang web để học Python'?" }
        Example for favorite bookmark query:
        - Query: "Làm bookmark ChickenSoup thành yêu thích"
          Response: { "action": "favorite", "params": { "title": "ChickenSoup", "favorite": true }, "response": "Đang tìm bookmark 'ChickenSoup' để đánh dấu là yêu thích..." }
        - Query: "Bỏ yêu thích bookmark ChickenSoup"
          Response: { "action": "favorite", "params": { "title": "ChickenSoup", "favorite": false }, "response": "Đang tìm bookmark 'ChickenSoup' để bỏ đánh dấu yêu thích..." }
        Example for edit by ID:
        - Query: "Sửa bookmark ID 123 thành tiêu đề 'NewTitle' trong thư mục 'Favorites'"
          Response: { "action": "edit", "params": { "id": "123", "new_title": "NewTitle", "folder": "Favorites" }, "response": "Đang sửa bookmark với ID 123..." }
        Example for delete by ID with confirmation:
        - Query: "Xóa bookmark ID 123"
          Response: { "action": "delete", "params": { "id": "123", "confirm": true }, "response": "Bạn có chắc muốn xóa bookmark với ID 123 không?" }
        Example for website suggestion:
        - Query: "Suggest a website for learning Python"
          Response: { "action": "suggest_website", "params": { "websites": [{ "url": "https://www.python.org", "title": "Official Python Website", "description": "The official Python website offers tutorials and documentation for learning Python." }, { "url": "https://www.codecademy.com/learn/learn-python-3", "title": "Codecademy Python Course", "description": "An interactive course for learning Python programming." }] }, "response": "I've suggested the following websites for learning Python..." }
        If multiple bookmarks match the title, return:
        - { "action": "general", "response": "Tui tìm thấy nhiều bookmark tên 'ChickenSoup'. Bạn muốn chỉnh sửa cái nào? Hãy cung cấp URL, ID, hoặc thư mục." }
    `

  // General System Prompt for off-topic questions
  const generalSystemPrompt = `
    You are Gemini, a helpful and truthful AI assistant created by Google. Your role is to provide accurate, concise, and conversational answers to a wide range of questions. Respond in the user's language (e.g., Vietnamese if the query is in Vietnamese) in a natural, friendly tone. If the question is vague or unclear, politely ask for clarification while offering a helpful response based on your best interpretation. Provide factual information based on your knowledge and avoid speculative or unverified content.
    Examples:
    - Query: "What day is it today?"
      Response: "Today is Monday, October 13, 2025. Anything specific you want to plan for today?"
    - Query: "Hello"
      Response: "Hi there! How can I assist you today? Want to manage your bookmarks or ask something else?"
    - Query: "Tell me about Python programming"
      Response: "Python is a versatile, high-level programming language known for its readability and wide range of applications, from web development to data science. Would you like tips on learning Python or specific details about its features?"
  `

  // Language support
  const getLanguage = () => localStorage.getItem("appLanguage") || "en"
  const t = (key) => translations[getLanguage()][key] || key

  // Set button titles dynamically
  if (chatToggle) chatToggle.title = t("chatToggle")
  if (chatHelp) chatHelp.title = t("helpGuideTitle")
  if (chatHistoryBtn) chatHistoryBtn.title = t("exportChatHistory")
  if (chatMaximize) chatMaximize.title = t("maximizeMinimize")
  if (chatEditConfig) chatEditConfig.title = t("editAIConfig")
  if (chatClose) chatClose.title = t("closeChat")
  if (toggleApiVisibility && apiKeyInput) {
    toggleApiVisibility.addEventListener("click", () => {
      const isHidden = apiKeyInput.type === "password"
      apiKeyInput.type = isHidden ? "text" : "password"
      toggleApiVisibility.innerHTML = isHidden
        ? '<i class="fas fa-eye"></i>'
        : '<i class="fas fa-eye-slash"></i>'
      const config = getAiConfig()
      config.apiVisible = !isHidden
      localStorage.setItem("aiConfig", JSON.stringify(config))
    })
  }

  // Chat history management
  let chatHistory = []

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
              `[${msg.timestamp}] ${msg.type.toUpperCase()}: ${msg.content}`
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
      }
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
      JSON.stringify({ model, apiKey, modelName, apiVisible })
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
    isGeneral = false
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
        true
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
      `Analyze the website at ${url} and suggest a title and folder for the bookmark. Return JSON: { "title": string, "folder": string }`
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
          }`
        )
      }
      const data = await response.json()
      let result
      try {
        if (config.model === "gemini") {
          result = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
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
          }: Invalid AI response format`
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
      `Suggest websites for ${topic}. Return JSON: { "websites": [{ "url": string, "title": string, "description": string }, ...] }`
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
          }`
        )
      }
      const data = await response.json()
      let result
      try {
        if (config.model === "gemini") {
          result = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
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
          }: Invalid AI response format`
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
              }: ${folderName}. Please specify a unique name.`
            )
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
              `${t("noBookmarks") || "No bookmark found with"} ID: ${id}.`
            )
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
  async function handleBookmarkCommand(action, params, originalMessage) {
    const loadingMessage = document.createElement("div")
    loadingMessage.className = "chatbox-message bot loading"
    loadingMessage.textContent = t("loadingBookmarks") || "Loading..."
    chatMessages.appendChild(loadingMessage)
    chatMessages.scrollTop = chatMessages.scrollHeight

    try {
      if (action === "general") {
        const config = getAiConfig()
        const apiRequest = buildApiRequest(
          config.modelName,
          config.apiKey,
          config.model,
          originalMessage,
          true // Use generalSystemPrompt
        )
        if (!apiRequest) {
          throw new Error(t("errorUnexpected") || "Invalid model name")
        }

        const response = await fetch(apiRequest.url, {
          method: apiRequest.method,
          headers: apiRequest.headers,
          body: JSON.stringify(apiRequest.body),
        })
        if (!response.ok) {
          throw new Error(
            `${t("errorUnexpected") || "Unexpected error"}: ${
              response.statusText
            }`
          )
        }

        const data = await response.json()
        let answer
        if (config.model === "gemini") {
          answer =
            data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
        } else if (config.model === "gpt") {
          answer = data.choices?.[0]?.message?.content || "No response"
        } else {
          answer = data.text || "No response"
        }

        loadingMessage.remove()
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        const timestamp = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        botMessage.innerHTML = `${answer}<span class="timestamp">${timestamp}</span>`
        chatMessages.appendChild(botMessage)
        addToChatHistory("bot", answer, timestamp)
        chatMessages.scrollTop = chatMessages.scrollHeight
      } else if (action === "count") {
        chrome.bookmarks.getTree((bookmarkTree) => {
          let count = 0
          function countBookmarks(nodes) {
            nodes.forEach((node) => {
              if (node.url) count++
              if (node.children) countBookmarks(node.children)
            })
          }
          countBookmarks(bookmarkTree[0].children)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${t("youHave") || "You have"} ${count} ${
            t("bookmarks") || "bookmarks"
          }.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("youHave") || "You have"} ${count} ${
              t("bookmarks") || "bookmarks"
            }.`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
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
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${t("youHave") || "You have"} ${count} ${
            t("folders") || "folders"
          }.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("youHave") || "You have"} ${count} ${
              t("folders") || "folders"
            }.`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
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
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = bookmarks.length
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
                    }" target="_blank">${b.title}</a> (ID: ${b.id})</span>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noBookmarks") || "You don't have any bookmarks yet."
              }<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            botMessage.textContent
              .replace(/<[^>]*>/g, "")
              .replace(timestamp, "")
              .trim(),
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
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
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = folders.length
            ? `${
                t("hereAreYourFolders") || "Here are your folders"
              }:<br>${folders
                .map(
                  (f, index) =>
                    `<span class="bookmark-item">${index + 1}. ${
                      f.title
                    } (ID: ${f.id})</span>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noFolders") || "You don't have any folders yet."
              }<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            botMessage.textContent
              .replace(/<[^>]*>/g, "")
              .replace(timestamp, "")
              .trim(),
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else if (action === "list_bookmarks_in_folder" && params.folder) {
        searchFoldersByName(params.folder).then((folders) => {
          if (folders.length === 0) {
            throw new Error(
              `${t("noFoldersFound") || "No folder found with name"}: ${
                params.folder
              }`
            )
          }
          if (folders.length > 1) {
            throw new Error(
              `${
                t("duplicateFolderError") || "Multiple folders found with name"
              }: ${params.folder}. Please specify a unique name.`
            )
          }
          const folderId = folders[0].id
          chrome.bookmarks.getChildren(folderId, (children) => {
            const bookmarks = children.filter((node) => node.url)
            loadingMessage.remove()
            const botMessage = document.createElement("div")
            botMessage.className = "chatbox-message bot"
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            botMessage.innerHTML = bookmarks.length
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
                      })</span>`
                  )
                  .join("<br>")}<span class="timestamp">${timestamp}</span>`
              : `${
                  t("noBookmarksInFolder") || "No bookmarks in this folder"
                } '${
                  params.folder
                }'.<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              botMessage.textContent
                .replace(/<[^>]*>/g, "")
                .replace(timestamp, "")
                .trim(),
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          })
        })
      } else if (action === "add" && params.url) {
        let { url, title, folder } = params
        const existingBookmarks = await checkUrlExists(url)
        if (existingBookmarks.length > 0) {
          throw new Error(
            `${
              t("duplicateUrlError") ||
              "A bookmark with this URL already exists"
            }: ${url}. Found ${existingBookmarks.length} bookmark(s).`
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
            loadingMessage.remove()
            const botMessage = document.createElement("div")
            botMessage.className = "chatbox-message bot"
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            botMessage.innerHTML = `${
              t("addedBookmarkToFolder") || "I've added the bookmark"
            } <a href="${url}" target="_blank">${title}</a> ${
              t("toFolder") || "to the folder"
            } '${folder}' (ID: ${
              bookmark.id
            }).<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${
                t("addedBookmarkToFolder") || "I've added the bookmark"
              } ${title} ${t("toFolder") || "to the folder"} '${folder}' (ID: ${
                bookmark.id
              }).`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          }
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
            t("emptyTitleError") || "Please provide a new title or folder."
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
            }.`
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
              }`
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
                  }
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
                  }
                )
              })
            }
            const updatedBookmark = await new Promise((resolve) => {
              chrome.bookmarks.get(bookmarkId, (results) => resolve(results[0]))
            })
            const folderName = await getFolderName(updatedBookmark.parentId)
            loadingMessage.remove()
            const botMessage = document.createElement("div")
            botMessage.className = "chatbox-message bot"
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            botMessage.innerHTML = `${
              t("updatedBookmark") || "I've updated the bookmark"
            } <a href="${updatedBookmark.url}" target="_blank">${
              updatedBookmark.title
            }</a> ${
              t("inFolder") || "in"
            } '${folderName}' (ID: ${bookmarkId}).<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${t("updatedBookmark") || "I've updated the bookmark"} ${
                updatedBookmark.title
              } ${t("inFolder") || "in"} '${folderName}' (ID: ${bookmarkId}).`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          }
          performUpdates().catch((error) => {
            loadingMessage.remove()
            const errorMessage = document.createElement("div")
            errorMessage.className = "chatbox-message bot error"
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            errorMessage.innerHTML = `${t("errorTitle") || "Oops"}: ${
              error.message
            }<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(errorMessage)
            addToChatHistory(
              "bot",
              `${t("errorTitle") || "Oops"}: ${error.message}`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
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
            }.`
          )
        }
        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.url || params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`
          )
        }
        if (bookmarks.length === 1) {
          bookmarkId = bookmarks[0].id
          bookmarkTitle = bookmarks[0].title || bookmarks[0].url
        }
        if (params.confirm) {
          loadingMessage.remove()
          const confirmMessage = document.createElement("div")
          confirmMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          confirmMessage.innerHTML = `${
            t("deleteConfirm") || "Are you sure you want to delete the bookmark"
          } '${bookmarkTitle}' (ID: ${bookmarkId})?<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(confirmMessage)
          addToChatHistory(
            "bot",
            `${
              t("deleteConfirm") ||
              "Are you sure you want to delete the bookmark"
            } '${bookmarkTitle}' (ID: ${bookmarkId})?`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
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
                const botMessage = document.createElement("div")
                botMessage.className = "chatbox-message bot"
                const timestamp = new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                botMessage.innerHTML = `${
                  t("deletedBookmark") || "I've deleted the bookmark"
                }: ${bookmarkTitle} (ID: ${bookmarkId}).<span class="timestamp">${timestamp}</span>`
                chatMessages.appendChild(botMessage)
                addToChatHistory(
                  "bot",
                  `${
                    t("deletedBookmark") || "I've deleted the bookmark"
                  }: ${bookmarkTitle} (ID: ${bookmarkId}).`,
                  timestamp
                )
                chatMessages.scrollTop = chatMessages.scrollHeight
                showCustomPopup(t("successTitle") || "Success", "success", true)
              })
            },
            () => {
              const cancelMessage = document.createElement("div")
              cancelMessage.className = "chatbox-message bot"
              const timestamp = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              cancelMessage.innerHTML = `${t("cancel") || "Cancelled"}: ${
                t("deleteBookmarkSuccess") || "Bookmark deletion cancelled"
              }.<span class="timestamp">${timestamp}</span>`
              chatMessages.appendChild(cancelMessage)
              addToChatHistory(
                "bot",
                `${t("cancel") || "Cancelled"}: ${
                  t("deleteBookmarkSuccess") || "Bookmark deletion cancelled"
                }.`,
                timestamp
              )
              chatMessages.scrollTop = chatMessages.scrollHeight
            }
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
            }.`
          )
        }
        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`
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
              }
            )
          })
          const folderName = await getFolderName(folderId)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${
            t("movedBookmark") || "I've moved the bookmark"
          } '${bookmarks[0].title || bookmarks[0].url}' (ID: ${bookmarkId}) ${
            t("toFolder") || "to the folder"
          } '${folderName}'.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("movedBookmark") || "I've moved the bookmark"} '${
              bookmarks[0].title || bookmarks[0].url
            }' (ID: ${bookmarkId}) ${
              t("toFolder") || "to the folder"
            } '${folderName}'.`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        }
      } else if (action === "search_bookmark" && params.keyword) {
        chrome.bookmarks.search({ query: params.keyword }, (results) => {
          const bookmarks = results.filter((node) => node.url)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = bookmarks.length
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
                    })</span>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noBookmarksFoundFor") ||
                "I couldn't find any bookmarks matching"
              } '${params.keyword}'.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            botMessage.textContent
              .replace(/<[^>]*>/g, "")
              .replace(timestamp, "")
              .trim(),
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else if (action === "search_folder" && params.keyword) {
        searchFoldersByName(params.keyword).then((folders) => {
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = folders.length
            ? `${t("foundFolders") || "I found these folders"}:<br>${folders
                .map(
                  (f, index) =>
                    `<span class="bookmark-item">${index + 1}. ${
                      f.title || t("unnamedFolder") || "Unnamed"
                    } (ID: ${f.id})</span>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noFoldersFoundFor") || "I couldn't find any folders matching"
              } '${params.keyword}'.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            botMessage.textContent
              .replace(/<[^>]*>/g, "")
              .replace(timestamp, "")
              .trim(),
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
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
            }.`
          )
        }
        if (bookmarks.length > 1 && !params.id) {
          throw new Error(
            `${t("clarifyBookmark") || "I found multiple bookmarks named"} '${
              params.title
            }'. ${
              t("clarifyBookmark") ||
              "Please provide the URL, ID, or folder to specify which one."
            }`
          )
        }
        if (bookmarks.length === 1) {
          bookmarkId = bookmarks[0].id
          await toggleFavorite(bookmarkId, params.favorite)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${
            params.favorite
              ? t("markedFavorite") || "I've marked the bookmark"
              : t("unmarkedFavorite") ||
                "I've removed the bookmark from favorites"
          } '${
            bookmarks[0].title || bookmarks[0].url
          }' (ID: ${bookmarkId}).<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${
              params.favorite
                ? t("markedFavorite") || "I've marked the bookmark"
                : t("unmarkedFavorite") ||
                  "I've removed the bookmark from favorites"
            } '${bookmarks[0].title || bookmarks[0].url}' (ID: ${bookmarkId}).`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        }
      } else if (action === "suggest_website" && params.websites) {
        loadingMessage.remove()
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        const timestamp = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        const websites = params.websites || []
        botMessage.innerHTML = websites.length
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
                  }</button></span>`
              )
              .join("<br>")}<span class="timestamp">${timestamp}</span>`
          : `${
              t("noBookmarksFoundFor") ||
              "I couldn't find any websites for this topic"
            }.<span class="timestamp">${timestamp}</span>`
        chatMessages.appendChild(botMessage)
        addToChatHistory(
          "bot",
          botMessage.textContent
            .replace(/<[^>]*>/g, "")
            .replace(timestamp, "")
            .trim(),
          timestamp
        )
        chatMessages.scrollTop = chatMessages.scrollHeight

        // Add event listeners for bookmark buttons
        const bookmarkButtons = botMessage.querySelectorAll(".bookmark-btn")
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
                  true
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
                    true
                  )
                }
              )
            } catch (error) {
              showCustomPopup(
                `${t("errorTitle") || "Error"}: ${error.message}`,
                "error",
                true
              )
            }
          })
        })
      } else {
        throw new Error(
          t("notSupported") ||
            "Sorry, I can only help with bookmark-related tasks or simple questions."
        )
      }
    } catch (error) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      errorMessage.innerHTML = `${t("errorTitle") || "Oops"}: ${
        error.message
      }<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(errorMessage)
      addToChatHistory(
        "bot",
        `${t("errorTitle") || "Oops"}: ${error.message}`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
    }
  }

  // Handle user input
  async function handleUserInput() {
    const message = chatInput.value.trim()
    if (!message) return

    const userMessage = document.createElement("div")
    userMessage.className = "chatbox-message user"
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    userMessage.innerHTML = `${message}<span class="timestamp">${timestamp}</span>`
    chatMessages.appendChild(userMessage)
    addToChatHistory("user", message, timestamp)
    chatMessages.scrollTop = chatMessages.scrollHeight
    chatInput.value = ""

    const config = getAiConfig()
    if (!config.model || !config.apiKey || !config.modelName) {
      const botMessage = document.createElement("div")
      botMessage.className = "chatbox-message bot error"
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      botMessage.innerHTML = `${
        t("errorTitle") || "Error"
      }: Please configure AI settings in 'Configure AI Chatbot'.<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(botMessage)
      addToChatHistory(
        "bot",
        `${
          t("errorTitle") || "Error"
        }: Please configure AI settings in 'Configure AI Chatbot'.`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
      return
    }

    const apiRequest = buildApiRequest(
      config.modelName,
      config.apiKey,
      config.model,
      message
    )
    if (!apiRequest) {
      return
    }

    try {
      const response = await fetch(apiRequest.url, {
        method: apiRequest.method,
        headers: apiRequest.headers,
        body: JSON.stringify(apiRequest.body),
      })
      if (!response.ok) {
        throw new Error(
          `${t("errorUnexpected") || "Unexpected error"}: ${
            response.statusText
          }`
        )
      }
      const data = await response.json()
      let result
      try {
        if (config.model === "gemini") {
          result = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
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
          }: Invalid AI response format`
        )
      }

      await handleBookmarkCommand(result.action, result.params || {}, message)
    } catch (error) {
      // If API fails, try handling as off-topic question
      const apiRequestGeneral = buildApiRequest(
        config.modelName,
        config.apiKey,
        config.model,
        message,
        true
      )
      if (apiRequestGeneral) {
        try {
          const responseGeneral = await fetch(apiRequestGeneral.url, {
            method: apiRequestGeneral.method,
            headers: apiRequestGeneral.headers,
            body: JSON.stringify(apiRequestGeneral.body),
          })
          if (!responseGeneral.ok) {
            throw new Error(
              `${t("errorUnexpected") || "Unexpected error"}: ${
                responseGeneral.statusText
              }`
            )
          }
          const dataGeneral = await responseGeneral.json()
          let answer
          if (config.model === "gemini") {
            answer =
              dataGeneral.candidates?.[0]?.content?.parts?.[0]?.text ||
              "No response"
          } else if (config.model === "gpt") {
            answer = dataGeneral.choices?.[0]?.message?.content || "No response"
          } else {
            answer = dataGeneral.text || "No response"
          }

          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${answer}<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory("bot", answer, timestamp)
          chatMessages.scrollTop = chatMessages.scrollHeight
        } catch (generalError) {
          const errorMessage = document.createElement("div")
          errorMessage.className = "chatbox-message bot error"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          errorMessage.innerHTML = `${t("errorTitle") || "Oops"}: ${
            generalError.message
          }<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(errorMessage)
          addToChatHistory(
            "bot",
            `${t("errorTitle") || "Oops"}: ${generalError.message}`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        }
      }
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
    }<br><br>${
      t("welcomeSubMessage") || "How can I assist you today?"
    }`

    const startButton = document.createElement("button")
    startButton.className = "button chatbox-start-button"
    startButton.textContent = t("startButton") || "Start Chat"
    startButton.addEventListener("click", () => {
      const initialMessage =
        getLanguage() === "vi" ? "Xin chào Zero" : "Hello Zero"
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
      ".chatbox-welcome-container"
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
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        removeWelcomeMessage() // Remove welcome message when user types and presses enter
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

  if (chatEditConfig) {
    chatEditConfig.addEventListener("click", () => {
      const config = getAiConfig()
      if (aiModelSelect) aiModelSelect.value = config.model || ""
      if (apiKeyInput) apiKeyInput.value = config.apiKey || ""
      if (curlInput) curlInput.value = config.modelName || ""
      if (aiConfigPopup)
        aiConfigPopup.classList.remove("hidden")[
          // Reset validation styles
          (aiModelSelect, apiKeyInput, curlInput)
        ].forEach((input) => {
          if (input) input.classList.remove("error")
        })
      ;["ai-model-error", "api-key-error", "curl-error"].forEach((errorId) => {
        const errorElement = document.getElementById(errorId)
        if (errorElement) errorElement.classList.add("hidden")
      })
    })
  }
  if (clearApiKey) {
    clearApiKey.addEventListener("click", () => {
      if (apiKeyInput) apiKeyInput.value = ""
    })
  }

  if (clearCurl) {
    clearCurl.addEventListener("click", () => {
      if (curlInput) curlInput.value = ""
    })
  }

  if (aiConfigSave) {
    aiConfigSave.addEventListener("click", () => {
      const model = aiModelSelect ? aiModelSelect.value : ""
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : ""
      const modelName = curlInput ? curlInput.value.trim() : ""
      const apiVisible = apiKeyInput
        ? apiKeyInput.type === "text"
        : true[
            // Reset previous error states
            (aiModelSelect, apiKeyInput, curlInput)
          ].forEach((input) => {
            if (input) input.classList.remove("error")
          })
      ;["ai-model-error", "api-key-error", "curl-error"].forEach((errorId) => {
        const errorElement = document.getElementById(errorId)
        if (errorElement) errorElement.classList.add("hidden")
      })

      // Validate inputs
      let hasError = false
      const errors = []

      if (!model) {
        if (aiModelSelect) aiModelSelect.classList.add("error")
        const errorElement = document.getElementById("ai-model-error")
        if (errorElement) errorElement.classList.remove("hidden")
        errors.push("Please select an AI model.")
        hasError = true
      }

      if (!apiKey) {
        if (apiKeyInput) apiKeyInput.classList.add("error")
        const errorElement = document.getElementById("api-key-error")
        if (errorElement) errorElement.classList.remove("hidden")
        errors.push("Please enter an API key.")
        hasError = true
      }

      if (!modelName) {
        if (curlInput) curlInput.classList.add("error")
        const errorElement = document.getElementById("curl-error")
        if (errorElement) errorElement.classList.remove("hidden")
        errors.push("Please enter a model name.")
        hasError = true
      }

      // Show combined error popup if any validation fails
      if (hasError) {
        showCustomPopup(
          t("errorTitle") || "Error",
          errors.join(" "),
          "error",
          true
        )
        return
      }

      // Save configuration if all validations pass
      saveAiConfig(model, apiKey, modelName, apiVisible)
      if (aiConfigPopup) aiConfigPopup.classList.add("hidden")
      showCustomPopup(t("successTitle") || "Success", "success", true)
    })
  }
  if (aiConfigCancel) {
    aiConfigCancel.addEventListener("click", () => {
      if (aiConfigPopup) aiConfigPopup.classList.add("hidden")
    })
  }

  if (chatHelp) {
    chatHelp.addEventListener("click", showCustomGuide)
  }

  if (chatHistoryBtn) {
    chatHistoryBtn.addEventListener("click", exportChatHistory)
  }
})

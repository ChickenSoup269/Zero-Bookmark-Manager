// components/chat.js
import {
  translations,
  showCustomPopup,
  showCustomConfirm,
  showCustomGuide,
} from "./utils.js"

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
  const curlInput = document.getElementById("curl-input")
  const clearApiKey = document.getElementById("clear-api-key")
  const clearCurl = document.getElementById("clear-curl")
  const aiConfigSave = document.getElementById("ai-config-save")
  const aiConfigCancel = document.getElementById("ai-config-cancel")
  const chatEditConfig = document.getElementById("chat-edit-config")
  const chatHelp = document.getElementById("chat-help")
  const chatHistory = document.getElementById("chat-history")

  // System Prompt tích hợp trực tiếp
  const systemPrompt = `
    You are a bookmark management assistant integrated into a browser extension. Your role is to help users manage their bookmarks using natural language or specific commands. You have access to Chrome Bookmarks API to perform actions like:
    - Counting bookmarks ("how many bookmarks do I have?").
    - Listing bookmarks ("list my bookmarks").
    - Adding bookmarks ("bookmark add <URL> [title <title>] [to folder <folder>]").
    - Moving bookmarks ("move bookmark 'title' to folder 'folder'").
    - Editing bookmarks ("edit bookmark <URL> [title <new_title>] [to folder <new_folder>]").
    - Deleting bookmarks ("delete bookmark <URL>").
    - Searching bookmarks ("search bookmark <keyword>").
    - Searching folders ("search folder <keyword>").
    For natural language queries, interpret the user's intent and provide a JSON response with:
    - "action": the bookmark action (count, list, add, move, edit, delete, search_bookmark, search_folder).
    - "params": parameters needed for the action (e.g., { url, title, folder, keyword }).
    If the query is unclear or not bookmark-related, respond with:
    - "action": "general".
    - "response": a helpful text response.
    Always return JSON format: { "action": string, "params": object, "response": string (optional) }.
  `

  // Language support
  const getLanguage = () => localStorage.getItem("appLanguage") || "en"
  const t = (key) => translations[getLanguage()][key] || key

  // Set button titles dynamically
  if (chatToggle) chatToggle.title = t("chatToggle")
  if (chatHelp) chatHelp.title = t("helpGuideTitle")
  if (chatHistory) chatHistory.title = t("exportChatHistory")
  if (chatMaximize) chatMaximize.title = t("maximizeMinimize")
  if (chatEditConfig) chatEditConfig.title = t("editAIConfig")
  if (chatClose) chatClose.title = t("closeChat")

  // Chat history management
  const CHAT_HISTORY_KEY = "chatHistory"
  const getChatHistory = () => {
    const history = localStorage.getItem(CHAT_HISTORY_KEY)
    return history ? JSON.parse(history) : []
  }

  const saveChatHistory = (history) => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history))
  }

  const addToChatHistory = (type, content, timestamp) => {
    const history = getChatHistory()
    history.push({ type, content, timestamp })
    saveChatHistory(history)
  }

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
        a.download = `chat-history-${
          new Date().toISOString().split("T")[0]
        }.txt`
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
    return config ? JSON.parse(config) : { model: "", apiKey: "", curl: "" }
  }

  // Save AI config
  const saveAiConfig = (model, apiKey, curl) => {
    localStorage.setItem("aiConfig", JSON.stringify({ model, apiKey, curl }))
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

  // Build API request from URL
  // Build API request from URL
  const buildApiRequest = (url, apiKey, model, message) => {
    try {
      let apiUrl = url
      const headers = { "Content-Type": "application/json" }
      let body

      // Fallback cho model không hợp lệ
      const validModels = {
        gemini: "gemini-2.0-flash", // Default cho gemini
        gpt: "gpt-3.5-turbo", // Cho OpenAI
        other: "default", // Generic
      }
      const effectiveModel = validModels[model] || model

      // Xây dựng URL với model đúng (nếu là Gemini)
      if (model === "gemini") {
        apiUrl = apiUrl.replace(/models\/[^:]+/, `models/${effectiveModel}`) // Thay model trong URL
        apiUrl = apiUrl.includes("?key=")
          ? apiUrl.replace(/(\?key=)[^&]+/, `$1${apiKey}`)
          : apiUrl + (apiUrl.includes("?") ? "&" : "?") + `key=${apiKey}`
        body = {
          contents: [
            { parts: [{ text: systemPrompt }] },
            { parts: [{ text: message }] },
          ],
          generationConfig: {
            // Thêm config để tránh lỗi token/safety
            maxOutputTokens: 1024,
            temperature: 0.7,
            topP: 0.8,
          },
          safetySettings: [
            // Giảm safety để tránh block
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
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
        headers["Authorization"] = `Bearer ${apiKey}`
        body = {
          model: effectiveModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }
      } else {
        headers["x-api-key"] = apiKey
        body = {
          prompt: `${systemPrompt}\n${message}`,
        }
      }

      console.log("Built API Request:", {
        url: apiUrl,
        model: effectiveModel,
        body,
      }) // Log để debug
      return { url: apiUrl, headers, body, method: "POST" }
    } catch (error) {
      console.error("Failed to build API request:", error)
      showCustomPopup(
        `${t("errorTitle") || "Error"}: Invalid API URL - ${error.message}`,
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
      config.curl,
      config.apiKey,
      config.model,
      `Analyze the website at ${url} and suggest a title and folder for the bookmark. Return JSON: { "title": string, "folder": string }`
    )
    if (!apiRequest) {
      throw new Error(t("errorUnexpected") || "Invalid API URL")
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

  // Find or create folder
  async function findFolderId(folderName) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ title: folderName }, (results) => {
        const folder = results.find((node) => !node.url)
        if (folder) {
          resolve(folder.id)
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

  // Handle bookmark commands
  async function handleBookmarkCommand(action, params, originalMessage) {
    const loadingMessage = document.createElement("div")
    loadingMessage.className = "chatbox-message bot loading"
    loadingMessage.textContent = t("loadingBookmarks") || "Loading bookmarks..."
    chatMessages.appendChild(loadingMessage)
    chatMessages.scrollTop = chatMessages.scrollHeight

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
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${
            t("totalBookmarks") || "Total bookmarks"
          }: ${count}<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("totalBookmarks") || "Total bookmarks"}: ${count}`,
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
                bookmarks.push({ title: node.title || node.url, url: node.url })
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
            ? `${t("bookmarks") || "Bookmarks"}:<br>${bookmarks
                .map((b) => `<a href="${b.url}" target="_blank">${b.title}</a>`)
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noBookmarks") || "No bookmarks found"
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
      } else if (action === "add" && params.url) {
        let { url, title, folder } = params
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
            botMessage.innerHTML = `${(
              t("addToFolderSuccess") || "Added to folder"
            ).replace(
              "Bookmark(s)",
              t("bookmarks") || "Bookmarks"
            )}: <a href="${url}" target="_blank">${title}</a> (${folder})<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${(t("addToFolderSuccess") || "Added to folder").replace(
                "Bookmark(s)",
                t("bookmarks") || "Bookmarks"
              )}: ${title} (${folder})`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          }
        )
      } else if (action === "edit" && params.url) {
        const { url, title: newTitle, folder: newFolder } = params
        if (!newTitle && !newFolder) {
          throw new Error(t("emptyTitleError") || "Title or folder required")
        }
        chrome.bookmarks.search({ url }, (results) => {
          if (results.length) {
            const bookmarkId = results[0].id
            const updates = {}
            if (newTitle) updates.title = newTitle
            if (newFolder) updates.parentId = findFolderId(newFolder)
            Promise.resolve(updates.parentId).then((parentId) => {
              chrome.bookmarks.update(
                bookmarkId,
                {
                  title: updates.title || results[0].title,
                  parentId: parentId || results[0].parentId,
                },
                async (updatedBookmark) => {
                  const folderName = await getFolderName(
                    updatedBookmark.parentId
                  )
                  loadingMessage.remove()
                  const botMessage = document.createElement("div")
                  botMessage.className = "chatbox-message bot"
                  const timestamp = new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  botMessage.innerHTML = `${
                    t("renameSuccess") || "Bookmark updated"
                  }: <a href="${url}" target="_blank">${
                    updatedBookmark.title
                  }</a> (${folderName})<span class="timestamp">${timestamp}</span>`
                  chatMessages.appendChild(botMessage)
                  addToChatHistory(
                    "bot",
                    `${t("renameSuccess") || "Bookmark updated"}: ${
                      updatedBookmark.title
                    } (${folderName})`,
                    timestamp
                  )
                  chatMessages.scrollTop = chatMessages.scrollHeight
                }
              )
            })
          } else {
            throw new Error(
              `${t("noBookmarks") || "No bookmarks found"}: ${url}`
            )
          }
        })
      } else if (action === "delete" && params.url) {
        chrome.bookmarks.search({ url }, (results) => {
          if (results.length) {
            chrome.bookmarks.remove(results[0].id, () => {
              loadingMessage.remove()
              const botMessage = document.createElement("div")
              botMessage.className = "chatbox-message bot"
              const timestamp = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              botMessage.innerHTML = `${
                t("deleteBookmarkSuccess") || "Bookmark deleted"
              }: ${url}<span class="timestamp">${timestamp}</span>`
              chatMessages.appendChild(botMessage)
              addToChatHistory(
                "bot",
                `${t("deleteBookmarkSuccess") || "Bookmark deleted"}: ${url}`,
                timestamp
              )
              chatMessages.scrollTop = chatMessages.scrollHeight
            })
          } else {
            throw new Error(
              `${t("noBookmarks") || "No bookmarks found"}: ${url}`
            )
          }
        })
      } else if (action === "search_bookmark" && params.keyword) {
        chrome.bookmarks.search(params.keyword, (results) => {
          const bookmarks = results.filter((node) => node.url)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = bookmarks.length
            ? `${t("bookmarks") || "Bookmarks"}: ${
                bookmarks.length
              }<br>${bookmarks
                .map(
                  (b) =>
                    `<a href="${b.url}" target="_blank">${b.title || b.url}</a>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${t("noBookmarks") || "No bookmarks found"} "${
                params.keyword
              }"<span class="timestamp">${timestamp}</span>`
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
            ? `${t("searchFolderResult") || "Found folders"}:<br>${folders
                .map((f) => f.title || t("unnamedFolder") || "Unnamed")
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${t("noFoldersFound") || "No folders found"} "${
                params.keyword
              }"<span class="timestamp">${timestamp}</span>`
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
      } else if (action === "move" && params.title && params.folder) {
        const bookmarks = await searchBookmarksByTitle(params.title)
        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "No bookmarks found"} "${params.title}"`
          )
        }
        const bookmarkId = bookmarks[0].id
        const folderId = await findFolderId(params.folder)
        chrome.bookmarks.move(bookmarkId, { parentId: folderId }, async () => {
          const folderName = await getFolderName(folderId)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = `${
            t("moveBookmarkSuccess") || "Bookmark moved successfully"
          }: <a href="${bookmarks[0].url}" target="_blank">${
            params.title
          }</a> to ${folderName}<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("moveBookmarkSuccess") || "Bookmark moved successfully"}: ${
              params.title
            } to ${folderName}`,
            timestamp
          )
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else if (action === "general" && params.response) {
        loadingMessage.remove()
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        const timestamp = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        botMessage.innerHTML = `${t("aiBookmarkResponse") || "AI Response"}: ${
          params.response
        }<span class="timestamp">${timestamp}</span>`
        chatMessages.appendChild(botMessage)
        addToChatHistory(
          "bot",
          `${t("aiBookmarkResponse") || "AI Response"}: ${params.response}`,
          timestamp
        )
        chatMessages.scrollTop = chatMessages.scrollHeight
      } else {
        throw new Error(
          `${
            t("errorUnexpected") || "Unexpected error"
          }: Supported actions are count, list, add, move, edit, delete, search_bookmark, search_folder`
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
      errorMessage.innerHTML = `${t("errorTitle") || "Error"}: ${
        error.message
      }<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(errorMessage)
      addToChatHistory(
        "bot",
        `${t("errorTitle") || "Error"}: ${error.message}`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
    }
  }

  // Show AI config popup
  const showAiConfigPopup = () => {
    const config = getAiConfig()
    aiModelSelect.value = config.model
    apiKeyInput.value = config.apiKey
    curlInput.value = config.curl
    aiConfigPopup.classList.remove("hidden")
    aiModelSelect.focus()
  }

  // Hide AI config popup
  const hideAiConfigPopup = () => {
    aiConfigPopup.classList.add("hidden")
  }

  // Toggle chatbox visibility
  chatToggle.addEventListener("click", () => {
    const config = getAiConfig()
    if (!config.model || !config.apiKey || !config.curl) {
      showAiConfigPopup()
    } else {
      chatbox.classList.toggle("hidden")
      if (!chatbox.classList.contains("hidden")) {
        chatInput.focus()
      }
    }
  })

  // Close chatbox
  chatClose.addEventListener("click", () => {
    chatbox.classList.add("hidden")
  })

  // Edit AI config
  chatEditConfig.addEventListener("click", () => {
    showAiConfigPopup()
  })

  // Maximize/Minimize chatbox
  let isMaximized = false
  chatMaximize.addEventListener("click", () => {
    if (isMaximized) {
      chatbox.style.width = "360px"
      chatbox.style.height = "480px"
      chatMaximize.innerHTML = '<i class="fas fa-expand"></i>'
    } else {
      chatbox.style.width = "500px"
      chatbox.style.height = "600px"
      chatMaximize.innerHTML = '<i class="fas fa-compress"></i>'
    }
    isMaximized = !isMaximized
    chatMessages.scrollTop = chatMessages.scrollHeight
  })

  // Send message
  chatSend.addEventListener("click", async () => {
    const message = chatInput.value.trim()
    if (!message) return

    // Add user message
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

    // Show loading state
    const loadingMessage = document.createElement("div")
    loadingMessage.className = "chatbox-message bot loading"
    loadingMessage.textContent = t("loadingChat") || "Processing..."
    chatMessages.appendChild(loadingMessage)
    chatMessages.scrollTop = chatMessages.scrollHeight

    // Get AI config
    const config = getAiConfig()
    if (!config.model || !config.apiKey || !config.curl) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      errorMessage.innerHTML = `${t("errorTitle") || "Error"}: ${
        t("aiTitle") || "AI Config"
      } incomplete<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(errorMessage)
      addToChatHistory(
        "bot",
        `${t("errorTitle") || "Error"}: ${
          t("aiTitle") || "AI Config"
        } incomplete`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
      chatInput.value = ""
      return
    }

    // Build API request
    const apiRequest = buildApiRequest(
      config.curl,
      config.apiKey,
      config.model,
      message
    )
    if (!apiRequest) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      errorMessage.innerHTML = `${
        t("errorTitle") || "Error"
      }: Invalid API URL<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(errorMessage)
      addToChatHistory(
        "bot",
        `${t("errorTitle") || "Error"}: Invalid API URL`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
      chatInput.value = ""
      return
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
      let aiResult
      try {
        if (config.model === "gemini") {
          aiResult = JSON.parse(
            data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
          )
        } else if (config.model === "gpt") {
          aiResult = JSON.parse(data.choices?.[0]?.message?.content || "{}")
        } else {
          aiResult = JSON.parse(data.text || "{}")
        }
      } catch (parseError) {
        throw new Error(
          `${
            t("errorUnexpected") || "Unexpected error"
          }: Invalid AI response format`
        )
      }

      // Remove loading message
      loadingMessage.remove()

      // Handle AI response
      await handleBookmarkCommand(
        aiResult.action,
        aiResult.params || {},
        message
      )
    } catch (error) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
      errorMessage.innerHTML = `${t("errorTitle") || "Error"}: ${
        error.message
      }<span class="timestamp">${timestamp}</span>`
      chatMessages.appendChild(errorMessage)
      addToChatHistory(
        "bot",
        `${t("errorTitle") || "Error"}: ${error.message}`,
        timestamp
      )
      chatMessages.scrollTop = chatMessages.scrollHeight
    }

    // Clear input
    chatInput.value = ""
  })

  // Handle Enter key
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      chatSend.click()
    }
  })

  // Show/Hide scroll button
  chatMessages.addEventListener("scroll", () => {
    const threshold = 100
    if (
      chatMessages.scrollHeight -
        chatMessages.scrollTop -
        chatMessages.clientHeight >
      threshold
    ) {
      chatScrollBottom.style.display = "flex"
    } else {
      chatScrollBottom.style.display = "none"
    }
  })

  // Click scroll to bottom
  chatScrollBottom.addEventListener("click", () => {
    chatMessages.scrollTop = chatMessages.scrollHeight
  })

  // Clear input
  chatClear.addEventListener("click", () => {
    chatInput.value = ""
  })

  // Clear API key input
  clearApiKey.addEventListener("click", () => {
    apiKeyInput.value = ""
  })

  // Clear cURL input
  clearCurl.addEventListener("click", () => {
    curlInput.value = ""
  })

  // Save AI config
  aiConfigSave.addEventListener("click", () => {
    const model = aiModelSelect.value
    const apiKey = apiKeyInput.value.trim()
    const curl = curlInput.value.trim()
    if (!model || !apiKey || !curl) {
      showCustomPopup(
        `${t("errorTitle") || "Error"}: ${
          t("aiTitle") || "AI Config"
        } incomplete`,
        "error",
        true
      )
      return
    }
    if (!isValidUrl(curl)) {
      showCustomPopup(
        `${t("errorTitle") || "Error"}: Invalid API URL`,
        "error",
        true
      )
      return
    }
    saveAiConfig(model, apiKey, curl)
    hideAiConfigPopup()
    chatbox.classList.remove("hidden")
    chatInput.focus()
  })

  // Cancel AI config
  aiConfigCancel.addEventListener("click", () => {
    hideAiConfigPopup()
    const config = getAiConfig()
    if (config.model && config.apiKey && config.curl) {
      chatbox.classList.remove("hidden")
      chatInput.focus()
    }
  })

  // Help button handler
  if (chatHelp) {
    chatHelp.addEventListener("click", () => {
      showCustomGuide()
    })
  }

  // Chat history export
  if (chatHistory) {
    chatHistory.addEventListener("click", exportChatHistory)
  }
})

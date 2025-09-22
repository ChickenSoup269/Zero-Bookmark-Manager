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
  const chatHistoryBtn = document.getElementById("chat-history") // Sửa: Đổi tên biến từ chatHistory thành chatHistoryBtn để tránh xung đột

  // System Prompt được cập nhật: thêm list_folders và list_bookmarks_in_folder; giới hạn phản hồi general chỉ một câu cụ thể; khuyến khích phản hồi tự nhiên hơn
  const systemPrompt = `
You are a bookmark management assistant integrated into a browser extension. Your role is to help users manage their bookmarks using natural language or specific commands, interpreting their intent as flexibly as possible. Respond in a conversational, natural way in the user's language (e.g., Vietnamese if the query is in Vietnamese). You have access to Chrome Bookmarks API to perform actions like:
- Counting bookmarks ("how many bookmarks do I have?").
- Counting folders ("how many folders do I have?").
- Listing bookmarks ("list my bookmarks").
- Listing folders ("list my folders").
- Listing bookmarks in a folder ("list bookmarks in folder <folder>").
- Adding bookmarks ("bookmark add <URL> [title <title>] [to folder <folder>]"). Check if the URL already exists; if it does, suggest not adding or ask for confirmation.
- Moving bookmarks ("move bookmark 'title' to folder 'folder'"). If multiple bookmarks with the same title, specify or ask for clarification.
- Editing bookmarks ("edit bookmark <URL> [title <new_title>] [to folder <new_folder>]" or "change bookmark title <old_title> to <new_title> [in folder <folder>]"). If only a title is provided, search for bookmarks by title; if multiple matches, ask for clarification or use folder context.
- Deleting bookmarks ("delete bookmark <URL>" or "delete bookmark titled <title>"). If duplicate URLs or titles, delete all or specify.
- Searching bookmarks ("search bookmark <keyword>").
- Searching folders ("search folder <keyword>"). If multiple folders with the same name, report an error.
For natural language queries, interpret the user's intent and provide a JSON response with:
- "action": the bookmark action (count, count_folders, list, list_folders, list_bookmarks_in_folder, add, move, edit, delete, search_bookmark, search_folder).
- "params": parameters needed for the action (e.g., { url, title, folder, keyword }).
- "response": a conversational response in the user's language, summarizing the action or explaining issues (e.g., "I found two bookmarks named 'ChickenSoup'. Which one do you want to edit?").
If the query is unclear or not bookmark-related (e.g., asking about the day, time, or vague terms like "hmm"), respond with exactly this one sentence in "response":
- "I am trained to only answer questions related to bookmarks." (in English) or "Tui chỉ được huấn luyện để trả lời các câu hỏi liên quan đến bookmark." (in Vietnamese, based on user language).
Always return JSON format: { "action": string, "params": object, "response": string (optional) }.
Example for non-bookmark queries:
- Query: "What day is it today?"
  Response: { "action": "general", "response": "Tui chỉ được huấn luyện để trả lời các câu hỏi liên quan đến bookmark." }
- Query: "hmm"
  Response: { "action": "general", "response": "Tui chỉ được huấn luyện để trả lời các câu hỏi liên quan đến bookmark." }
Example for natural language bookmark query:
- Query: "Change the name of my ChickenSoup bookmark to ChickenSoup269"
  Response: { "action": "edit", "params": { "title": "ChickenSoup", "new_title": "ChickenSoup269" }, "response": "Đang tìm bookmark 'ChickenSoup' để đổi thành 'ChickenSoup269'..." }
If multiple bookmarks match the title, return:
- { "action": "general", "response": "Tui tìm thấy nhiều bookmark tên 'ChickenSoup'. Bạn muốn chỉnh sửa cái nào? Hãy cung cấp URL hoặc thư mục." }
`

  // Language support
  const getLanguage = () => localStorage.getItem("appLanguage") || "en"
  const t = (key) => translations[getLanguage()][key] || key

  // Set button titles dynamically
  if (chatToggle) chatToggle.title = t("chatToggle")
  if (chatHelp) chatHelp.title = t("helpGuideTitle")
  if (chatHistoryBtn) chatHistoryBtn.title = t("exportChatHistory") // Sửa: Sử dụng chatHistoryBtn
  if (chatMaximize) chatMaximize.title = t("maximizeMinimize")
  if (chatEditConfig) chatEditConfig.title = t("editAIConfig")
  if (chatClose) chatClose.title = t("closeChat")

  // Chat history management - Không lưu vào localStorage
  let chatHistory = [] // Mảng tạm thời để lưu lịch sử chat

  const getChatHistory = () => {
    return chatHistory
  }

  const saveChatHistory = (history) => {
    chatHistory = history // Cập nhật mảng tạm thời
  }

  const addToChatHistory = (type, content, timestamp) => {
    const history = getChatHistory()
    history.push({ type, content, timestamp })
    saveChatHistory(history)
  }

  // Xóa lịch sử khi rời khỏi trang
  window.addEventListener("beforeunload", () => {
    chatHistory = [] // Xóa lịch sử chat
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

        // Tạo tên file tự động dựa trên ngày giờ
        const now = new Date()
        const formattedDateTime = now
          .toISOString()
          .replace(/T/, "-")
          .replace(/:/g, "-")
          .split(".")[0] // Ví dụ: 2025-09-22-00-26-30
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

  // Fixed buildApiRequest function for Gemini API
  const buildApiRequest = (url, apiKey, model, message) => {
    try {
      let apiUrl = url
      const headers = { "Content-Type": "application/json" }
      let body

      if (model === "gemini") {
        if (!apiUrl.includes("generateContent")) {
          apiUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
        }
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
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
            topP: 0.8,
            responseMimeType: "application/json",
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
        headers["Authorization"] = `Bearer ${apiKey}`
        body = {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          response_format: { type: "json_object" },
        }
      } else {
        headers["x-api-key"] = apiKey
        body = {
          prompt: `${systemPrompt}\n${message}`,
        }
      }

      console.log("Built API Request:", {
        url: apiUrl,
        model,
        body: JSON.stringify(body, null, 2),
      })

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

  // Handle bookmark commands - Cập nhật để phản hồi tự nhiên hơn (e.g., "You have X bookmarks" thay vì "Total bookmarks: X")
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
                    }" target="_blank">${b.title}</a></span>`
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
              if (!node.url) {
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
                    }</span>`
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
                      }" target="_blank">${b.title || b.url}</a></span>`
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
            } '${folder}'.<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${
                t("addedBookmarkToFolder") || "I've added the bookmark"
              } ${title} ${t("toFolder") || "to the folder"} '${folder}'.`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          }
        )
      } else if (action === "edit" && (params.url || params.title)) {
        const {
          url,
          title: oldTitle,
          new_title: newTitle,
          folder: newFolder,
        } = params
        if (!newTitle && !newFolder) {
          throw new Error(
            t("emptyTitleError") || "Please provide a new title or folder."
          )
        }
        let bookmarks = []
        if (url) {
          bookmarks = await checkUrlExists(url)
        } else if (oldTitle) {
          bookmarks = await searchBookmarksByTitle(oldTitle)
        }
        if (bookmarks.length === 0) {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with"} ${
              url ? `URL: ${url}` : `title: ${oldTitle}`
            }.`
          )
        }
        if (bookmarks.length > 1) {
          if (newFolder) {
            const folderId = await findFolderId(newFolder)
            bookmarks = bookmarks.filter((b) => b.parentId === folderId)
          }
          if (bookmarks.length > 1) {
            throw new Error(
              `${
                t("duplicateBookmarkError") ||
                "Multiple bookmarks found with title"
              }: ${oldTitle || url}. ${
                t("clarifyBookmark") ||
                "Please provide the URL or folder to specify which one."
              }`
            )
          }
        }
        if (bookmarks.length === 1) {
          const bookmarkId = bookmarks[0].id
          const performUpdates = async () => {
            // Update title if provided
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
            // Move to new folder if provided
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
            // Get the final bookmark state
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
            } '${folderName}'.<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${t("updatedBookmark") || "I've updated the bookmark"} ${
                updatedBookmark.title
              } ${t("inFolder") || "in"} '${folderName}'.`,
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
      } else if (action === "delete" && params.url) {
        const bookmarks = await checkUrlExists(url)
        if (bookmarks.length > 1) {
          throw new Error(
            `${
              t("duplicateUrlError") || "Multiple bookmarks found with this URL"
            }: ${url}. Please specify which one.`
          )
        }
        if (bookmarks.length === 1) {
          chrome.bookmarks.remove(bookmarks[0].id, () => {
            loadingMessage.remove()
            const botMessage = document.createElement("div")
            botMessage.className = "chatbox-message bot"
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            botMessage.innerHTML = `${
              t("deletedBookmark") || "I've deleted the bookmark"
            }: ${params.url}.<span class="timestamp">${timestamp}</span>`
            chatMessages.appendChild(botMessage)
            addToChatHistory(
              "bot",
              `${t("deletedBookmark") || "I've deleted the bookmark"}: ${
                params.url
              }.`,
              timestamp
            )
            chatMessages.scrollTop = chatMessages.scrollHeight
          })
        } else {
          throw new Error(
            `${t("noBookmarks") || "I couldn't find a bookmark with URL"}: ${
              params.url
            }.`
          )
        }
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
            ? `${t("foundBookmarks") || "I found"} ${bookmarks.length} ${
                t("bookmarksMatching") || "bookmarks matching"
              } "${params.keyword}":<br>${bookmarks
                .map(
                  (b, index) =>
                    `<span class="bookmark-item">${
                      index + 1
                    }. <img src="https://www.google.com/s2/favicons?domain=${
                      new URL(b.url).hostname
                    }" class="favicon" alt="Favicon" onerror="this.src='./images/default-favicon.png';"> <a href="${
                      b.url
                    }" target="_blank">${b.title || b.url}</a></span>`
                )
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noBookmarksFoundFor") ||
                "I couldn't find any bookmarks matching"
              } "${params.keyword}".<span class="timestamp">${timestamp}</span>`
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
          if (folders.length > 1) {
            throw new Error(
              `${
                t("duplicateFolderError") || "Multiple folders found with name"
              }: ${params.keyword}. Please specify a unique name.`
            )
          }
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          botMessage.innerHTML = folders.length
            ? `${t("foundFolders") || "I found these folders"}:<br>${folders
                .map((f) => f.title || t("unnamedFolder") || "Unnamed")
                .join("<br>")}<span class="timestamp">${timestamp}</span>`
            : `${
                t("noFoldersFoundFor") || "I couldn't find any folders matching"
              } "${params.keyword}".<span class="timestamp">${timestamp}</span>`
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
            `${t("noBookmarks") || "I couldn't find any bookmarks titled"} "${
              params.title
            }".`
          )
        }
        if (bookmarks.length > 1) {
          throw new Error(
            `${
              t("duplicateBookmarkError") ||
              "Multiple bookmarks found with title"
            }: ${
              params.title
            }. Please specify a unique title or use the URL instead.`
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
            t("movedBookmark") || "I've moved the bookmark"
          } <a href="${bookmarks[0].url}" target="_blank">${params.title}</a> ${
            t("toFolder") || "to"
          } '${folderName}'.<span class="timestamp">${timestamp}</span>`
          chatMessages.appendChild(botMessage)
          addToChatHistory(
            "bot",
            `${t("movedBookmark") || "I've moved the bookmark"} ${
              params.title
            } ${t("toFolder") || "to"} '${folderName}'.`,
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
        botMessage.innerHTML = `${params.response}<span class="timestamp">${timestamp}</span>` // Bỏ prefix để tự nhiên hơn
        chatMessages.appendChild(botMessage)
        addToChatHistory("bot", `${params.response}`, timestamp)
        chatMessages.scrollTop = chatMessages.scrollHeight
      } else {
        loadingMessage.remove()
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        const timestamp = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
        const fallbackResponse =
          t("naturalLanguagePrompt") ||
          "Tui đang cố hiểu bạn muốn gì! Bạn có thể nói rõ hơn không, như 'đổi tên bookmark ChickenSoup thành ChickenSoup2698' hoặc 'thêm bookmark vào thư mục Tin Tức'?"
        botMessage.innerHTML = `${fallbackResponse}<span class="timestamp">${timestamp}</span>`
        chatMessages.appendChild(botMessage)
        addToChatHistory("bot", fallbackResponse, timestamp)
        chatMessages.scrollTop = chatMessages.scrollHeight
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

    const formatMessage = (text) => {
      const urlRegex = /(https?:\/\/[^\s<]+)(?=\s|$|<)/g
      return text.replace(urlRegex, (url) => {
        try {
          const urlObj = new URL(url)
          const shortText = urlObj.hostname
          return `<a href="${url}" target="_blank" class="short-url">${shortText}</a>`
        } catch {
          return url
        }
      })
    }

    // Add user message
    const userMessage = document.createElement("div")
    userMessage.className = "chatbox-message user"
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    userMessage.innerHTML = `${formatMessage(
      message
    )}<span class="timestamp">${timestamp}</span>`
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
  if (chatHistoryBtn) {
    // Sửa: Sử dụng chatHistoryBtn
    chatHistoryBtn.addEventListener("click", exportChatHistory)
  }
})

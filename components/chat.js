import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
} from "./utils.js"
import {
  getBookmarkTree,
  flattenBookmarks,
  getFolders,
  moveBookmarksToFolder,
} from "./bookmarks.js"
import { renderFilteredBookmarks } from "./ui.js"
import { uiState, selectedBookmarks, setCurrentBookmarkId } from "./state.js"

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
  const renamePopup = document.getElementById("rename-popup")
  const renameInput = document.getElementById("rename-input")
  const renameSave = document.getElementById("rename-save")

  // Load saved AI config from localStorage
  const getAiConfig = () => {
    const config = localStorage.getItem("aiConfig")
    return config ? JSON.parse(config) : { model: "", apiKey: "", curl: "" }
  }

  // Save AI config to localStorage
  const saveAiConfig = (model, apiKey, curl) => {
    localStorage.setItem("aiConfig", JSON.stringify({ model, apiKey, curl }))
  }

  // Parse cURL command and inject API key
  const parseCurlCommand = (curl, apiKey, model) => {
    try {
      let urlMatch = curl.match(/curl\s+['"]?([^'"\s]+)['"]?/)
      const headersMatch = curl.matchAll(/--header\s+['"]([^'"]+)['"]/g)
      const bodyMatch = curl.match(/--data-raw\s+['"]([^'"]+)['"]/)

      let url = urlMatch ? urlMatch[1] : ""
      const headers = {}
      for (const match of headersMatch) {
        const [key, value] = match[1].split(": ")
        headers[key] = value
      }
      const body = bodyMatch ? JSON.parse(bodyMatch[1]) : {}

      if (model === "gemini") {
        url = url.replace(/(\?key=)[^&]+/, `$1${apiKey}`)
        if (!url.includes("?key=")) {
          url += (url.includes("?") ? "&" : "?") + `key=${apiKey}`
        }
      } else if (model === "gpt") {
        headers["Authorization"] = `Bearer ${apiKey}`
      } else {
        headers["x-api-key"] = apiKey
      }

      return { url, headers, body }
    } catch (error) {
      console.error("Failed to parse cURL:", error)
      return null
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

  // Bookmark command prompt
  const bookmarkPrompt = (message, language) => `
You are a chatbot integrated into a bookmark management extension. Your task is to analyze user messages related to managing Chrome bookmarks and return a structured JSON response indicating the action and parameters needed to perform the task. The supported actions are:

1. **add_bookmark**: Add a new bookmark with a URL and optional title and folder.
2. **edit_bookmark**: Rename an existing bookmark identified by its title, optionally specifying a new title.
3. **delete_bookmark**: Delete a bookmark identified by its title.
4. **move_bookmark**: Move a bookmark to a specified folder, identified by bookmark title and folder title.
5. **search_bookmarks**: Search bookmarks by a query string, matching title or URL.
6. **create_folder**: Create a new folder with a specified name.
7. **general**: For non-bookmark-related queries, return a general response.

Analyze the user's message and return a JSON object with:
- \`action\`: One of the above actions (string).
- \`parameters\`: An object containing relevant parameters (e.g., url, title, folder, query).
- \`response\`: A user-friendly message to display in the chat (in ${
    language === "vi" ? "Vietnamese" : "English"
  }).

Examples:
- Input: "Add bookmark https://example.com title 'My Site' to folder 'Favorites'"
  Output: {
    "action": "add_bookmark",
    "parameters": { "url": "https://example.com", "title": "My Site", "folder": "Favorites" },
    "response": "${
      language === "vi"
        ? "Đang thêm bookmark 'My Site' vào thư mục 'Favorites'."
        : "Adding bookmark 'My Site' to folder 'Favorites'."
    }"
  }
- Input: "Edit bookmark 'News' to 'Daily News'"
  Output: {
    "action": "edit_bookmark",
    "parameters": { "title": "News", "new_title": "Daily News" },
    "response": "${
      language === "vi"
        ? "Đang đổi tên bookmark 'News' thành 'Daily News'."
        : "Renaming bookmark 'News' to 'Daily News'."
    }"
  }
- Input: "Search bookmarks for news"
  Output: {
    "action": "search_bookmarks",
    "parameters": { "query": "news" },
    "response": "${
      language === "vi"
        ? "Đang tìm kiếm bookmark chứa 'news'."
        : "Searching for bookmarks containing 'news'."
    }"
  }
- Input: "What's the weather?"
  Output: {
    "action": "general",
    "parameters": {},
    "response": "${
      language === "vi"
        ? "Vui lòng cung cấp lệnh liên quan đến bookmark hoặc hỏi câu hỏi chung."
        : "Please provide a bookmark-related command or ask a general question."
    }"
  }

User's language setting: ${language}
User's message: ${message}

Return the JSON response.
`

  // Handle bookmark commands based on AI response
  const handleBookmarkCommand = async (action, parameters, aiResponse) => {
    const language = localStorage.getItem("appLanguage") || "en"

    if (action === "add_bookmark") {
      const { url, title = "New Bookmark", folder } = parameters
      if (!url) {
        return (
          translations[language].errorUnexpected ||
          "Please provide a valid URL."
        )
      }

      const folders = getFolders(uiState.bookmarkTree)
      const targetFolder = folder
        ? folders.find((f) =>
            f.title.toLowerCase().includes(folder.toLowerCase())
          )
        : null

      safeChromeBookmarksCall(
        "create",
        [{ title, url, parentId: targetFolder?.id }],
        (result) => {
          if (result) {
            getBookmarkTree((bookmarkTreeNodes) => {
              renderFilteredBookmarks(bookmarkTreeNodes, {
                folderList: document.getElementById("folder-list"),
              })
            })
          }
        }
      )
      return aiResponse
    }

    if (action === "edit_bookmark") {
      const { title, new_title } = parameters
      if (!title) {
        return (
          translations[language].errorNoBookmarkSelected ||
          "Please specify the bookmark title to edit."
        )
      }

      const bookmarks = flattenBookmarks(uiState.bookmarkTree)
      const bookmark = bookmarks.find((b) =>
        b.title.toLowerCase().includes(title.toLowerCase())
      )

      if (!bookmark) {
        return (
          translations[language].bookmarkNotFound ||
          `Bookmark "${title}" not found.`
        )
      }

      if (!new_title) {
        setCurrentBookmarkId(bookmark.id)
        renameInput.value = bookmark.title
        renamePopup.classList.remove("hidden")
        renameInput.focus()
        return (
          translations[language].renamePlaceholder ||
          "Please enter the new title in the popup."
        )
      }

      safeChromeBookmarksCall(
        "update",
        [bookmark.id, { title: new_title }],
        (result) => {
          if (result) {
            getBookmarkTree((bookmarkTreeNodes) => {
              renderFilteredBookmarks(bookmarkTreeNodes, {
                folderList: document.getElementById("folder-list"),
              })
            })
          }
        }
      )
      return aiResponse
    }

    if (action === "delete_bookmark") {
      const { title } = parameters
      if (!title) {
        return (
          translations[language].errorNoBookmarkSelected ||
          "Please specify the bookmark title to delete."
        )
      }

      const bookmarks = flattenBookmarks(uiState.bookmarkTree)
      const bookmark = bookmarks.find((b) =>
        b.title.toLowerCase().includes(title.toLowerCase())
      )

      if (!bookmark) {
        return (
          translations[language].bookmarkNotFound ||
          `Bookmark "${title}" not found.`
        )
      }

      safeChromeBookmarksCall("remove", [bookmark.id], () => {
        getBookmarkTree((bookmarkTreeNodes) => {
          renderFilteredBookmarks(bookmarkTreeNodes, {
            folderList: document.getElementById("folder-list"),
          })
        })
      })
      return aiResponse
    }

    if (action === "move_bookmark") {
      const { title, folder } = parameters
      if (!title || !folder) {
        return (
          translations[language].errorUnexpected ||
          "Please specify the bookmark and folder."
        )
      }

      const bookmarks = flattenBookmarks(uiState.bookmarkTree)
      const folders = getFolders(uiState.bookmarkTree)
      const bookmark = bookmarks.find((b) =>
        b.title.toLowerCase().includes(title.toLowerCase())
      )
      const targetFolder = folders.find((f) =>
        f.title.toLowerCase().includes(folder.toLowerCase())
      )

      if (!bookmark) {
        return (
          translations[language].bookmarkNotFound ||
          `Bookmark "${title}" not found.`
        )
      }
      if (!targetFolder) {
        return (
          translations[language].errorUnexpected ||
          `Folder "${folder}" not found.`
        )
      }

      moveBookmarksToFolder(
        [bookmark.id],
        targetFolder.id,
        {
          folderList: document.getElementById("folder-list"),
          addToFolderButton: document.getElementById("add-to-folder"),
          deleteBookmarksButton: document.getElementById(
            "delete-bookmarks-button"
          ),
        },
        () => {}
      )
      return aiResponse
    }

    if (action === "search_bookmarks") {
      const { query } = parameters
      if (!query) {
        return (
          translations[language].errorUnexpected ||
          "Please provide a search query."
        )
      }

      const bookmarks = flattenBookmarks(uiState.bookmarkTree)
      const results = bookmarks.filter(
        (b) =>
          b.title.toLowerCase().includes(query.toLowerCase()) ||
          b.url.toLowerCase().includes(query.toLowerCase())
      )

      if (results.length === 0) {
        return (
          translations[language].bookmarkNotFound ||
          `No bookmarks found for "${query}".`
        )
      }

      let response = `${language === "vi" ? "Tìm thấy" : "Found"} ${
        results.length
      } bookmark(s) for "${query}":\n`
      results.forEach((b, index) => {
        response += `${index + 1}. ${b.title} (${b.url})\n`
      })

      renderFilteredBookmarks(
        uiState.bookmarkTree,
        {
          folderList: document.getElementById("folder-list"),
          search: document.getElementById("search"),
        },
        query
      )

      return response
    }

    if (action === "create_folder") {
      const { title } = parameters
      if (!title) {
        return (
          translations[language].errorUnexpected ||
          "Please specify the folder name."
        )
      }

      safeChromeBookmarksCall("create", [{ title }], (result) => {
        if (result) {
          getBookmarkTree((bookmarkTreeNodes) => {
            renderFilteredBookmarks(bookmarkTreeNodes, {
              folderList: document.getElementById("folder-list"),
            })
          })
        }
      })
      return aiResponse
    }

    return null // General query, proceed to AI API
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
    userMessage.innerHTML = `${message}<span class="timestamp">${new Date().toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )}</span>`
    chatMessages.appendChild(userMessage)

    // Show loading state
    const loadingMessage = document.createElement("div")
    loadingMessage.className = "chatbox-message bot loading"
    loadingMessage.textContent = "Typing..."
    chatMessages.appendChild(loadingMessage)
    chatMessages.scrollTop = chatMessages.scrollHeight

    // Get AI config
    const config = getAiConfig()
    if (!config.model || !config.apiKey || !config.curl) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      errorMessage.innerHTML = `Error: No API configuration set.<span class="timestamp">${new Date().toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      )}</span>`
      chatMessages.appendChild(errorMessage)
      chatMessages.scrollTop = chatMessages.scrollHeight
      chatInput.value = ""
      return
    }

    // Parse cURL and inject API key
    const parsedCurl = parseCurlCommand(
      config.curl,
      config.apiKey,
      config.model
    )
    if (!parsedCurl) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      errorMessage.innerHTML = `Error: Invalid cURL command.<span class="timestamp">${new Date().toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      )}</span>`
      chatMessages.appendChild(errorMessage)
      chatMessages.scrollTop = chatMessages.scrollHeight
      chatInput.value = ""
      return
    }

    try {
      // Send prompt to AI API
      const language = localStorage.getItem("appLanguage") || "en"
      const prompt = bookmarkPrompt(message, language)
      const response = await fetch(parsedCurl.url, {
        method: "POST",
        headers: parsedCurl.headers,
        body: JSON.stringify({
          ...parsedCurl.body,
          contents:
            config.model === "gemini"
              ? [{ parts: [{ text: prompt }] }]
              : [{ role: "user", content: prompt }],
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = await response.json()
      let aiResponse
      if (config.model === "gemini") {
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
      } else if (config.model === "gpt") {
        aiResponse = data.choices?.[0]?.message?.content || "{}"
      } else {
        aiResponse = data.text || "{}"
      }

      // Parse AI response
      let parsedResponse
      try {
        parsedResponse = JSON.parse(aiResponse)
      } catch (error) {
        throw new Error("Invalid AI response format.")
      }

      // Handle bookmark command
      const bookmarkResult = await handleBookmarkCommand(
        parsedResponse.action,
        parsedResponse.parameters,
        parsedResponse.response
      )

      // Remove loading message
      loadingMessage.remove()

      // Add bot response
      const botMessage = document.createElement("div")
      botMessage.className = "chatbox-message bot"
      botMessage.innerHTML = `${
        bookmarkResult || parsedResponse.response
      }<span class="timestamp">${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}</span>`
      chatMessages.appendChild(botMessage)
    } catch (error) {
      // Remove loading message
      loadingMessage.remove()

      // Show error message
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      errorMessage.innerHTML = `Error: ${
        error.message
      }<span class="timestamp">${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}</span>`
      chatMessages.appendChild(errorMessage)
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight

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
      alert(
        "Please select an AI model, enter an API key, and provide a valid cURL command."
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

  // Handle rename popup save for chatbot-triggered rename
  renameSave.addEventListener("click", () => {
    const newTitle = renameInput.value.trim()
    const language = localStorage.getItem("appLanguage") || "en"

    if (!newTitle) {
      renameInput.classList.add("error")
      renameInput.placeholder = translations[language].emptyTitleError
      renameInput.focus()
      return
    }

    if (!uiState.currentBookmarkId) {
      showCustomPopup(
        translations[language].errorNoBookmarkSelected ||
          "No bookmark selected",
        "error",
        false
      )
      renamePopup.classList.add("hidden")
      return
    }

    safeChromeBookmarksCall("get", [uiState.currentBookmarkId], (bookmark) => {
      if (!bookmark || !bookmark[0]) {
        showCustomPopup(
          translations[language].bookmarkNotFound || "Bookmark not found",
          "error",
          false
        )
        renamePopup.classList.add("hidden")
        return
      }

      safeChromeBookmarksCall(
        "update",
        [uiState.currentBookmarkId, { title: newTitle }],
        (result) => {
          if (result) {
            getBookmarkTree((bookmarkTreeNodes) => {
              renderFilteredBookmarks(bookmarkTreeNodes, {
                folderList: document.getElementById("folder-list"),
              })
              const botMessage = document.createElement("div")
              botMessage.className = "chatbox-message bot"
              botMessage.innerHTML = `${
                translations[language].renameSuccess ||
                "Bookmark renamed successfully!"
              }<span class="timestamp">${new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}</span>`
              chatMessages.appendChild(botMessage)
              chatMessages.scrollTop = chatMessages.scrollHeight
              renamePopup.classList.add("hidden")
              uiState.currentBookmarkId = null
            })
          } else {
            showCustomPopup(
              translations[language].errorUnexpected ||
                "Failed to rename bookmark.",
              "error",
              false
            )
          }
        }
      )
    })
  })
})

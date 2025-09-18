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
      const urlMatch = curl.match(/curl\s+['"]?([^'"\s]+)['"]?/)
      let url = urlMatch ? urlMatch[1] : ""
      const headers = {}
      const headersMatch = curl.matchAll(/-(?:H|header)\s+['"]([^'"]+)['"]/g)
      for (const match of headersMatch) {
        const [key, value] = match[1].split(/:\s*/)
        headers[key.trim()] = value.trim()
      }
      const bodyMatch =
        curl.match(/--data(?:-raw)?\s+['"]([^'"]+)['"]/) ||
        curl.match(/-d\s+['"]([^'"]+)['"]/)
      let body = {}
      if (bodyMatch) {
        try {
          body = JSON.parse(bodyMatch[1])
        } catch {
          body = bodyMatch[1]
        }
      }
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
      return { url, headers, body, method: "POST" }
    } catch (error) {
      console.error("Failed to parse cURL:", error)
      return null
    }
  }

  // Suggest bookmark details using AI
  async function suggestBookmarkDetails(url) {
    const config = getAiConfig()
    const parsedCurl = parseCurlCommand(
      config.curl,
      config.apiKey,
      config.model
    )
    if (!parsedCurl) {
      throw new Error("Invalid cURL command for AI suggestion.")
    }
    const prompt = `Analyze the website at ${url} and suggest a title and folder for the bookmark. Return JSON: { "title": string, "folder": string }`
    try {
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
        throw new Error(`AI API request failed: ${response.statusText}`)
      }
      const data = await response.json()
      let result
      if (config.model === "gemini") {
        result = JSON.parse(
          data.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
        )
      } else if (config.model === "gpt") {
        result = JSON.parse(data.choices?.[0]?.message?.content || "{}")
      } else {
        result = JSON.parse(data.text || "{}")
      }
      return result
    } catch (error) {
      console.error("AI suggestion failed:", error)
      return { title: url, folder: "Uncategorized" }
    }
  }

  // Find or create folder
  async function findFolderId(folderName) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ title: folderName }, (results) => {
        if (results.length && !results[0].url) {
          resolve(results[0].id)
        } else {
          chrome.bookmarks.create({ title: folderName }, (folder) => {
            resolve(folder.id)
          })
        }
      })
    })
  }

  // Handle bookmark commands
  // Trong hàm handleBookmarkCommand, thêm case cho "count"
  // Trong hàm handleBookmarkCommand, thêm logic phân tích câu hỏi tự nhiên
  async function handleBookmarkCommand(message) {
    const loadingMessage = document.createElement("div")
    loadingMessage.className = "chatbox-message bot loading"
    loadingMessage.textContent = "Processing bookmark command..."
    chatMessages.appendChild(loadingMessage)
    chatMessages.scrollTop = chatMessages.scrollHeight

    try {
      const lowerMessage = message.toLowerCase()
      const commandParts = lowerMessage.split(" ")
      const action = commandParts[1]
      const urlMatch = message.match(/(https?:\/\/[^\s]+)/)
      const url = urlMatch ? urlMatch[1] : null

      // Xử lý câu hỏi tự nhiên
      if (
        lowerMessage.includes("how many bookmarks") ||
        lowerMessage.includes("bao nhiêu bookmark") ||
        lowerMessage.includes("số lượng bookmark")
      ) {
        chrome.bookmarks.getTree((bookmarkTree) => {
          let count = 0
          function countBookmarks(nodes) {
            nodes.forEach((node) => {
              if (node.url) count++ // Chỉ đếm node có url (bookmark)
              if (node.children) countBookmarks(node.children) // Đệ quy cho folder
            })
          }
          countBookmarks(bookmarkTree[0].children)
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          botMessage.innerHTML = `Bạn có ${count} bookmark.<span class="timestamp">${new Date().toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          )}</span>`
          chatMessages.appendChild(botMessage)
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else if (
        lowerMessage.includes("list bookmarks") ||
        lowerMessage.includes("danh sách bookmark")
      ) {
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
          botMessage.innerHTML = bookmarks.length
            ? `Danh sách bookmark của bạn:<br>${bookmarks
                .map((b) => `<a href="${b.url}" target="_blank">${b.title}</a>`)
                .join(
                  "<br>"
                )}<span class="timestamp">${new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}</span>`
            : `Bạn chưa có bookmark nào.<span class="timestamp">${new Date().toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              )}</span>`
          chatMessages.appendChild(botMessage)
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else if (action === "add" && url) {
        const folderMatch = message.match(/to folder (\w+)/)
        const titleMatch = message.match(/title ([^\s].+)/)
        let folder = folderMatch ? folderMatch[1] : null
        let title = titleMatch ? titleMatch[1] : null
        if (!folder || !title) {
          const suggestions = await suggestBookmarkDetails(url)
          folder = folder || suggestions.folder || "Uncategorized"
          title = title || suggestions.title || url
        }
        chrome.bookmarks.create(
          {
            parentId: await findFolderId(folder),
            title,
            url,
          },
          (bookmark) => {
            loadingMessage.remove()
            const botMessage = document.createElement("div")
            botMessage.className = "chatbox-message bot"
            botMessage.innerHTML = `Bookmark đã được thêm vào ${folder}: <a href="${url}" target="_blank">${title}</a><span class="timestamp">${new Date().toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" }
            )}</span>`
            chatMessages.appendChild(botMessage)
            chatMessages.scrollTop = chatMessages.scrollHeight
          }
        )
      } else if (action === "edit" && url) {
        const titleMatch = message.match(/title ([^\s].+)/)
        const folderMatch = message.match(/to folder (\w+)/)
        const newTitle = titleMatch ? titleMatch[1] : null
        const newFolder = folderMatch ? folderMatch[1] : null
        if (!newTitle && !newFolder) {
          throw new Error(
            "Vui lòng chỉ định tiêu đề mới hoặc thư mục để chỉnh sửa."
          )
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
                  botMessage.innerHTML = `Bookmark đã được cập nhật: <a href="${url}" target="_blank">${
                    updatedBookmark.title
                  }</a> trong thư mục ${folderName}<span class="timestamp">${new Date().toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  )}</span>`
                  chatMessages.appendChild(botMessage)
                  chatMessages.scrollTop = chatMessages.scrollHeight
                }
              )
            })
          } else {
            throw new Error(`Không tìm thấy bookmark: ${url}`)
          }
        })
      } else if (action === "delete" && url) {
        chrome.bookmarks.search({ url }, (results) => {
          if (results.length) {
            chrome.bookmarks.remove(results[0].id, () => {
              loadingMessage.remove()
              const botMessage = document.createElement("div")
              botMessage.className = "chatbox-message bot"
              botMessage.innerHTML = `Bookmark đã bị xóa: ${url}<span class="timestamp">${new Date().toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              )}</span>`
              chatMessages.appendChild(botMessage)
              chatMessages.scrollTop = chatMessages.scrollHeight
            })
          } else {
            throw new Error(`Không tìm thấy bookmark: ${url}`)
          }
        })
      } else if (action === "search" && commandParts[2]) {
        const keyword = commandParts.slice(2).join(" ")
        chrome.bookmarks.search(keyword, (results) => {
          loadingMessage.remove()
          const botMessage = document.createElement("div")
          botMessage.className = "chatbox-message bot"
          botMessage.innerHTML = results.length
            ? `Tìm thấy ${results.length} bookmark:<br>${results
                .map(
                  (b) =>
                    `<a href="${b.url}" target="_blank">${b.title || b.url}</a>`
                )
                .join(
                  "<br>"
                )}<span class="timestamp">${new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}</span>`
            : `Không tìm thấy bookmark nào cho "${keyword}".<span class="timestamp">${new Date().toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              )}</span>`
          chatMessages.appendChild(botMessage)
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
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
          botMessage.innerHTML = `Bạn có ${count} bookmark.<span class="timestamp">${new Date().toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          )}</span>`
          chatMessages.appendChild(botMessage)
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } else {
        throw new Error(
          "Lệnh bookmark không hợp lệ. Sử dụng: add bookmark <URL> [title <title>] [to folder <folder>], edit bookmark <URL> [title <new_title>] [to folder <new_folder>], delete bookmark <URL>, search bookmark <keyword>, bookmark count, hoặc câu hỏi tự nhiên như 'Tôi có bao nhiêu bookmark?'"
        )
      }
    } catch (error) {
      loadingMessage.remove()
      const errorMessage = document.createElement("div")
      errorMessage.className = "chatbox-message bot error"
      errorMessage.innerHTML = `Lỗi: ${
        error.message
      }<span class="timestamp">${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}</span>`
      chatMessages.appendChild(errorMessage)
      chatMessages.scrollTop = chatMessages.scrollHeight
    }
  }

  // Giữ nguyên các hàm khác (getAiConfig, saveAiConfig, parseCurlCommand, suggestBookmarkDetails, findFolderId, getFolderName) và sự kiện khác

  // Giữ nguyên các hàm khác (getAiConfig, saveAiConfig, parseCurlCommand, suggestBookmarkDetails, findFolderId, getFolderName) và sự kiện khác như trong code trước
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
    userMessage.innerHTML = `${message}<span class="timestamp">${new Date().toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )}</span>`
    chatMessages.appendChild(userMessage)

    // Check if message is a bookmark command
    if (message.toLowerCase().startsWith("bookmark ")) {
      await handleBookmarkCommand(message)
    } else {
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
        const response = await fetch(parsedCurl.url, {
          method: "POST",
          headers: parsedCurl.headers,
          body: JSON.stringify({
            ...parsedCurl.body,
            contents:
              config.model === "gemini"
                ? [{ parts: [{ text: message }] }]
                : [{ role: "user", content: message }],
          }),
        })

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`)
        }

        const data = await response.json()
        let botResponse
        if (config.model === "gemini") {
          botResponse =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Sorry, I couldn't generate a response."
        } else if (config.model === "gpt") {
          botResponse =
            data.choices?.[0]?.message?.content ||
            "Sorry, I couldn't generate a response."
        } else {
          botResponse = data.text || "Sorry, I couldn't generate a response."
        }

        // Remove loading message
        loadingMessage.remove()

        // Add bot response
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        botMessage.innerHTML = `${botResponse}<span class="timestamp">${new Date().toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}</span>`
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
})

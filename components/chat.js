document.addEventListener("DOMContentLoaded", () => {
  const chatToggle = document.getElementById("chat-toggle")
  const chatbox = document.getElementById("chatbox")
  const chatInput = document.getElementById("chat-input")
  const chatSend = document.getElementById("chat-send")
  const chatClear = document.getElementById("chat-clear")
  const chatMessages = document.getElementById("chatbox-messages")

  // Toggle chatbox visibility
  chatToggle.addEventListener("click", () => {
    chatbox.classList.toggle("hidden")
    if (!chatbox.classList.contains("hidden")) {
      chatInput.focus()
    }
  })

  // Send message
  chatSend.addEventListener("click", () => {
    const message = chatInput.value.trim()
    if (message) {
      // Add user message
      const userMessage = document.createElement("div")
      userMessage.className = "chatbox-message user"
      userMessage.textContent = message
      chatMessages.appendChild(userMessage)

      // Simulate bot response
      setTimeout(() => {
        const botMessage = document.createElement("div")
        botMessage.className = "chatbox-message bot"
        botMessage.textContent =
          "Hello! This is a simulated response. How can I assist you?"
        chatMessages.appendChild(botMessage)

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight
      }, 500)

      // Clear input
      chatInput.value = ""
    }
  })

  // Handle Enter key
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      chatSend.click()
    }
  })

  // Clear input
  chatClear.addEventListener("click", () => {
    chatInput.value = ""
  })
})

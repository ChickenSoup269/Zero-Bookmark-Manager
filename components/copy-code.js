// Wrap tất cả code blocks với copy button
export function initCopyButtons() {
  const codeBlocks = document.querySelectorAll(".custom-guide code")

  codeBlocks.forEach((code) => {
    // Tạo wrapper nếu chưa có
    if (!code.parentElement.classList.contains("code-wrapper")) {
      const wrapper = document.createElement("div")
      wrapper.className = "code-wrapper"
      code.parentNode.insertBefore(wrapper, code)
      wrapper.appendChild(code)

      // Tạo copy button
      const copyBtn = document.createElement("button")
      copyBtn.className = "copy-btn"
      copyBtn.textContent = "Copy"
      copyBtn.setAttribute("aria-label", "Copy code to clipboard")

      // Thêm event listener
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const textToCopy = code.textContent

        try {
          await navigator.clipboard.writeText(textToCopy)

          // Visual feedback
          copyBtn.classList.add("copied")
          copyBtn.textContent = "Copied!"

          // Reset sau 2 giây
          setTimeout(() => {
            copyBtn.classList.remove("copied")
            copyBtn.textContent = "Copy"
          }, 2000)
        } catch (err) {
          console.error("Failed to copy:", err)
          copyBtn.textContent = "Error!"
          setTimeout(() => {
            copyBtn.textContent = "Copy"
          }, 2000)
        }
      })

      wrapper.appendChild(copyBtn)
    }
  })
}

// Gọi hàm khi DOM loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCopyButtons)
} else {
  initCopyButtons()
}

// Hoặc gọi lại khi guide được mở
const guideElement = document.querySelector(".custom-guide")
if (guideElement) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "class") {
        if (!guideElement.classList.contains("hidden")) {
          initCopyButtons()
        }
      }
    })
  })

  observer.observe(guideElement, { attributes: true })
}

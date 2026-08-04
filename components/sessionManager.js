export function initSessionManager(elements) {
  const saveSessionBtn = document.getElementById("save-session-btn")
  if (!saveSessionBtn) return

  saveSessionBtn.addEventListener("click", () => {
    // Tự động tạo tên thư mục với thời gian hiện tại
    const dateStr = new Date().toLocaleString()
    const folderName = `Session - ${dateStr}`

    // Lấy tất cả tab đang mở trong window hiện tại
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return
      
      // Tạo một thư mục mới ở Bookmark Bar (parentId: '1')
      chrome.bookmarks.create(
        {
          parentId: "1",
          title: folderName,
        },
        (newFolder) => {
          // Duyệt qua các tab và lưu vào thư mục vừa tạo
          tabs.forEach((tab) => {
            // Bỏ qua các trang chrome:// hoặc trang extension
            if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;
            
            chrome.bookmarks.create({
              parentId: newFolder.id,
              title: tab.title,
              url: tab.url,
            })
          })
          
          // Hiển thị thông báo thành công
          const t = window.translations && window.translations[localStorage.getItem("appLanguage") || "en"]
          const msg = t ? (t.sessionSaved || `Đã lưu ${tabs.length} tabs vào thư mục: ${folderName}`) : `Saved ${tabs.length} tabs to folder: ${folderName}`
          
          if (window.showCustomPopup) {
            window.showCustomPopup(msg)
          } else {
            alert(msg)
          }
          
          // Đóng dropdown menu nếu đang mở
          const settingsMenu = document.getElementById("settings-menu")
          if (settingsMenu && !settingsMenu.classList.contains("hidden")) {
             settingsMenu.classList.add("hidden")
          }
        },
      )
    })
  })
}

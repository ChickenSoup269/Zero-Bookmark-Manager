// components/controller/bookmarkAction.js
import {
  translations,
  safeChromeBookmarksCall,
  showCustomPopup,
  showCustomConfirm,
} from "../utils/utils.js"
import { getBookmarkTree } from "../bookmarks.js"
import { renderFilteredBookmarks } from "../ui.js"
import { uiState, setCurrentBookmarkId } from "../state.js"
import { openAddToFolderPopup } from "./addToFolder.js"
import { updateTag } from "../tag.js"

// --- HELPER FUNCTIONS ---

const getLang = () => localStorage.getItem("appLanguage") || "en"

const getTranslation = (key, fallback) => {
  const t = translations[getLang()] || translations.en
  return t[key] || fallback || key
}

const handleError = (logMsg, uiMsgKey, isError = true) => {
  console.error(logMsg)
  showCustomPopup(
    getTranslation(uiMsgKey, "An unexpected error occurred"),
    isError ? "error" : "success",
    isError
  )
}

const attachListener = (element, event, handler) => {
  if (element) {
    element.removeEventListener(event, handler)
    element.addEventListener(event, handler)
  }
}

// --- MAIN SETUP ---

export function setupBookmarkActionListeners(elements) {
  const listeners = [
    {
      el: elements.renameSave,
      evt: "click",
      handler: (e) => handleRenameSave(e, elements),
    },
    {
      el: elements.renameCancel,
      evt: "click",
      handler: (e) => handleRenameCancel(e, elements),
    },
    {
      el: elements.renameInput,
      evt: "keypress",
      handler: (e) => handleRenameInputKeypress(e, elements),
    },
    {
      el: elements.renameInput,
      evt: "keydown",
      handler: (e) => handleRenameInputKeydown(e, elements),
    },
    {
      el: elements.renamePopup,
      evt: "click",
      handler: (e) => handleRenamePopupClick(e, elements),
    },
    {
      el: elements.clearRenameButton,
      evt: "click",
      handler: (e) => handleClearRename(e, elements),
    },
  ]

  listeners.forEach(({ el, evt, handler }) => {
    if (el) attachListener(el, evt, handler)
    else console.warn(`Element for event '${evt}' not found`)
  })

  // Menu items
  document.querySelectorAll(".menu-item").forEach((button) => {
    attachListener(button, "click", (e) => handleMenuItemClick(e, elements))
  })

  // Checkboxes
  document.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
    attachListener(checkbox, "change", (e) =>
      handleBookmarkCheckbox(e, elements)
    )
  })
}

function handleMenuItemClick(e, elements) {
  e.stopPropagation()
  const target = e.target
  const bookmarkId = target.dataset.id

  // Ignored options
  const ignoredIds = [
    "localstorage-settings-option",
    "export-bookmarks-option",
    "import-bookmarks-option",
    "rename-folder-option",
    "show-bookmark-ids-option",
    "edit-in-new-tab-option",
  ]
  if (ignoredIds.includes(target.id)) return

  // Determine action
  const actions = {
    "add-to-folder": () => handleAddToFolder(e, elements),
    "delete-btn": () => handleDeleteBookmark(e, elements),
    "rename-btn": () => handleRenameBookmark(e, elements),
    "favorite-btn": () => handleFavoriteBookmark(e, elements),
    "view-detail-btn": () => openBookmarkDetailPopup(bookmarkId, elements),
    "manage-tags-btn": () => openManageTagsPopup(bookmarkId, elements),
  }

  const actionKey = Object.keys(actions).find((key) =>
    target.classList.contains(key)
  )

  if (actionKey) {
    if (!bookmarkId) {
      console.error("Invalid bookmark ID for action", actionKey)
      return
    }
    actions[actionKey]()
    target.closest(".dropdown-menu")?.classList.add("hidden")
  }
}

// --- POPUP HANDLERS ---

// Thay thế hàm này trong components/controller/bookmarkAction.js

export function openBookmarkDetailPopup(bookmarkId, elements) {
  const popup = document.getElementById("bookmark-detail-popup")
  if (!popup) return handleError("Detail popup missing", "errorUnexpected")

  const els = {
    title: document.getElementById("detail-title"),
    url: document.getElementById("detail-url"),
    date: document.getElementById("detail-date-added"),
    tags: document.getElementById("detail-tags"),
    close: popup.querySelector(".close-modal"),
    thumb: popup.querySelector("#detail-thumbnail"),
    modalFooter: popup.querySelector(".modal-footer .button"), // Nút đóng ở dưới
  }

  // Clear dữ liệu cũ trước khi load mới (tránh hiện lại ảnh của bookmark trước)
  els.title.textContent = "Loading..."
  els.thumb.src = "./images/loading-spinner.gif" // Hoặc ảnh placeholder
  els.thumb.style.display = "none"

  safeChromeBookmarksCall("get", [bookmarkId], (results) => {
    if (chrome.runtime.lastError || !results?.[0]) {
      return handleError(
        chrome.runtime.lastError?.message || "Bookmark not found",
        "errorUnexpected"
      )
    }

    const b = results[0]
    const defaultThumb = "./images/default-favicon.png" // Đảm bảo đường dẫn này đúng trong project của bạn

    // --- XỬ LÝ THUMBNAIL ---
    // Dùng service của WordPress để lấy ảnh chụp màn hình web
    let thumbUrl = defaultThumb
    if (b.url && b.url.startsWith("http")) {
      thumbUrl = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(
        b.url
      )}?w=800`
    }

    // Hiển thị ảnh
    els.thumb.style.display = "block"
    els.thumb.src = thumbUrl

    // Nếu tải ảnh lỗi (web chặn hoặc không tồn tại), fallback về icon mặc định
    els.thumb.onerror = () => {
      // Nếu load mshots lỗi, thử dùng Google Favicon chất lượng cao
      els.thumb.src = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(
        b.url
      )}`
      // Nếu vẫn lỗi nữa thì về default
      els.thumb.onerror = () => {
        els.thumb.src = defaultThumb
      }
    }
    els.thumb.alt = b.title || "Thumbnail"

    // --- SETUP TEXT DATA ---
    els.title.textContent = b.title || b.url || getTranslation("notAvailable")
    els.url.textContent = b.url || getTranslation("notAvailable")
    els.url.href = b.url // Biến URL thành link click được
    els.url.target = "_blank"

    els.date.textContent = b.dateAdded
      ? new Date(b.dateAdded).toLocaleString()
      : getTranslation("notAvailable")

    // --- SETUP TAGS ---
    const tagList = uiState.bookmarkTags[bookmarkId] || []
    if (tagList.length > 0) {
      els.tags.innerHTML = tagList
        .map(
          (tag) => `
          <span class="bookmark-tag" style="
            background-color: ${uiState.tagColors[tag] || "#ccc"}; 
            color: ${uiState.tagTextColors?.[tag] || "#fff"}; 
            padding: 4px 10px; 
            border-radius: 6px; 
            font-size: 12px; 
            margin: 0 4px 4px 0; 
            display: inline-block;">
            ${tag}
          </span>
        `
        )
        .join("")
    } else {
      els.tags.innerHTML = `<span style="color: var(--text-secondary); font-style: italic;">${getTranslation(
        "noTags",
        "No tags"
      )}</span>`
    }

    // Setup Magnify (Phóng to ảnh)
    setupThumbnailInteraction(els.thumb)

    // --- SHOW POPUP ---
    popup.classList.remove("hidden")

    const close = () => popup.classList.add("hidden")

    // Gắn sự kiện đóng (đảm bảo xóa listener cũ để không bị double click)
    attachListener(els.close, "click", close)
    if (els.modalFooter) attachListener(els.modalFooter, "click", close)

    popup.onclick = (e) => e.target === popup && close()

    const escHandler = (e) => {
      if (e.key === "Escape") {
        close()
        document.removeEventListener("keydown", escHandler)
      }
    }
    document.addEventListener("keydown", escHandler)
  })
}
function setupThumbnailInteraction(thumbEl) {
  const container = thumbEl.parentElement
  if (!container.querySelector(".magnify-icon")) {
    container.classList.add("thumbnail-container")
    const icon = document.createElement("span")
    icon.className = "magnify-icon"
    icon.innerHTML = "<i class='fas fa-search-plus'></i>"
    container.appendChild(icon)
  }

  thumbEl.onclick = () => {
    const overlay = document.createElement("div")
    overlay.className = "enlarge-overlay"
    overlay.innerHTML = `<img src="${thumbEl.src}" class="enlarged-image" alt="Enlarged">`
    document.body.appendChild(overlay)

    const remove = () => overlay.remove()
    overlay.onclick = (e) => e.target === overlay && remove()
    const esc = (e) => {
      if (e.key === "Escape") {
        remove()
        document.removeEventListener("keydown", esc)
      }
    }
    document.addEventListener("keydown", esc)
  }
}

// --- MANAGE TAGS ---

async function openManageTagsPopup(bookmarkId) {
  const popup = document.getElementById("manage-tags-popup")
  const addTagContainer = popup?.querySelector(".add-tag-container")
  if (!popup || !addTagContainer)
    return handleError("Tags popup missing", "errorUnexpected")

  const els = {
    existingTags: document.getElementById("existing-tags"),
    input: document.getElementById("new-tag-input"),
    color: document.getElementById("new-tag-color"),
    addBtn: document.getElementById("add-tag-btn"),
    close: popup.querySelector(".close-modal"),
  }

  // --- Utility inside Manage Tags ---
  const MAX_TAGS = 8
  const getContrastColor = (hex) => {
    const r = parseInt(hex.substr(1, 2), 16),
      g = parseInt(hex.substr(3, 2), 16),
      b = parseInt(hex.substr(5, 2), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#000000" : "#ffffff"
  }

  // --- Get Elements (They should already exist from bookmarks.html) ---
  const textColorInput = document.getElementById("new-tag-text-color")
  const tagSelect = document.querySelector(".existing-tags-select")

  if (!textColorInput) console.error("new-tag-text-color input not found!")
  if (!tagSelect) console.error("existing-tags-select dropdown not found!")

  // Predefined Colors (màu nền tag, hiển thị gọn)
  // Ensure this block runs only once when the popup is first initialized or when a bookmark is selected that triggers it.
  // The HTML structure should already contain the .color-palette-container from bookmarks.html
  // So we only need to attach event listeners here.
  const colorPaletteContainer = popup.querySelector(".color-palette-container")
  if (colorPaletteContainer) {
    // Clear existing listeners to prevent duplicates
    Array.from(colorPaletteContainer.children).forEach((btn) => {
      btn.removeEventListener("click", handleSwatchClick)
    })

    // Attach new listeners
    Array.from(colorPaletteContainer.children).forEach((btn) => {
      btn.addEventListener("click", handleSwatchClick)
    })

    // Set initial selected color
    const initialColor = els.color.value
    const swatches = colorPaletteContainer.querySelectorAll(".color-swatch")
    swatches.forEach((swatch) => {
      if (swatch.dataset.color === initialColor) {
        swatch.classList.add("selected")
      } else {
        swatch.classList.remove("selected")
      }
    })
  }

  function handleSwatchClick(e) {
    const selectedColor = e.target.dataset.color
    if (selectedColor) {
      els.color.value = selectedColor
      textColorInput.value = getContrastColor(selectedColor)

      // Remove .selected from all swatches
      const swatches = colorPaletteContainer.querySelectorAll(".color-swatch")
      swatches.forEach((swatch) => swatch.classList.remove("selected"))

      // Add .selected to the clicked swatch
      e.target.classList.add("selected")
    }
  }

  let countDisplay = popup.querySelector(".tag-count")
  if (!countDisplay) {
    countDisplay = document.createElement("div")
    countDisplay.className = "tag-count"
    countDisplay.style.cssText =
      "font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;"
    addTagContainer.before(countDisplay)
  }

  // --- Logic ---
  const updateDropdown = async () => {
    const tags = await getAllTags()
    tagSelect.innerHTML = `<option value="">${getTranslation(
      "selectTag",
      "Select Tag"
    )}</option>`
    tags.forEach((t) => {
      const opt = document.createElement("option")
      opt.value = t
      opt.textContent = t
      opt.style.backgroundColor = uiState.tagColors[t] || "#ccc"
      opt.style.color =
        uiState.tagTextColors?.[t] ||
        getContrastColor(uiState.tagColors[t] || "#ccc")
      tagSelect.appendChild(opt)
    })
  }

  const renderTags = () => {
    const currentTags = uiState.bookmarkTags[bookmarkId] || []
    countDisplay.textContent = `${currentTags.length}/${MAX_TAGS} tags`
    els.existingTags.innerHTML = currentTags
      .map(
        (tag) => `
        <div class="tag-item" style="display: inline-flex; align-items: center; gap: 6px; margin: 0 8px 8px 0;">
          <span class="bookmark-tag" style="background-color: ${
            uiState.tagColors[tag] || "#ccc"
          }; color: ${
          uiState.tagTextColors?.[tag] || "#fff"
        }; padding: 4px 10px; border-radius: 6px; font-size: 12px;">${tag}</span>
          <button class="edit-tag-btn" data-tag="${tag}" style="background: none; border: none; color: var(--primary-color); cursor: pointer;">✎</button>
          <button class="remove-tag-btn" data-tag="${tag}" style="background: none; border: none; color: var(--text-danger); cursor: pointer;">✕</button>
        </div>`
      )
      .join("")
  }

  const saveTagData = (cb) => {
    chrome.storage.local.set(
      {
        bookmarkTags: uiState.bookmarkTags,
        tagColors: uiState.tagColors,
        tagTextColors: uiState.tagTextColors,
      },
      cb
    )
  }

  const handleAddTag = (tagName, bgColor, txtColor) => {
    const currentTags = uiState.bookmarkTags[bookmarkId] || []
    if (currentTags.length >= MAX_TAGS)
      return handleError("Limit reached", "tagLimitReached")
    if (!tagName) return

    if (!uiState.bookmarkTags[bookmarkId]) uiState.bookmarkTags[bookmarkId] = []

    if (!uiState.bookmarkTags[bookmarkId].includes(tagName)) {
      uiState.bookmarkTags[bookmarkId].push(tagName)
      if (bgColor) uiState.tagColors[tagName] = bgColor
      if (txtColor) {
        if (!uiState.tagTextColors) uiState.tagTextColors = {}
        uiState.tagTextColors[tagName] = txtColor
      }
      saveTagData(() => {
        renderTags()
        updateDropdown()
      })
    } else {
      handleError("Tag exists", "tagExists")
    }
  }

  // Events
  attachListener(tagSelect, "change", () => {
    handleAddTag(tagSelect.value)
    tagSelect.value = ""
  })

  els.addBtn.onclick = () => {
    handleAddTag(els.input.value.trim(), els.color.value, textColorInput.value)
    els.input.value = ""
    els.color.value = "#cccccc"
    textColorInput.value = "#ffffff"
  }

  // Edit/Remove Delegation
  els.existingTags.onclick = (e) => {
    const tag = e.target.dataset.tag
    if (e.target.classList.contains("remove-tag-btn")) {
      uiState.bookmarkTags[bookmarkId] = uiState.bookmarkTags[
        bookmarkId
      ].filter((t) => t !== tag)
      saveTagData(renderTags)
    } else if (e.target.classList.contains("edit-tag-btn")) {
      // Edit logic (simplified for brevity, similar structure to original but cleaner DOM calls)
      handleEditTagUI(
        e.target.closest(".tag-item"),
        tag,
        bookmarkId,
        saveTagData,
        renderTags,
        updateDropdown
      )
    }
  }

  await updateDropdown()
  renderTags()
  popup.classList.remove("hidden")

  const close = () => popup.classList.add("hidden")
  els.close.onclick = close
  popup.onclick = (e) => e.target === popup && close()
  const esc = (e) => {
    if (e.key === "Escape") {
      close()
      document.removeEventListener("keydown", esc)
    }
  }
  document.addEventListener("keydown", esc)
}

function handleEditTagUI(
  container,
  oldTag,
  bookmarkId,
  saveFn,
  renderFn,
  updateDropdownFn
) {
  // 1. Lưu lại HTML cũ để phục hồi nếu bấm Cancel
  const originalHTML = container.innerHTML

  // 2. Tạo giao diện Edit
  container.classList.add("editing-container") // Đánh dấu đang edit
  container.style.display = "flex"
  container.style.alignItems = "center"
  container.style.gap = "4px"
  container.innerHTML = "" // Xóa nội dung cũ

  const input = document.createElement("input")
  input.value = oldTag
  input.style.cssText =
    "padding: 4px 6px; border-radius: 4px; border: 1px solid var(--accent-color); width: 80px; font-size: 12px;"

  const bgColorPicker = document.createElement("input")
  bgColorPicker.type = "color"
  bgColorPicker.value = uiState.tagColors[oldTag] || "#cccccc"
  bgColorPicker.style.cssText =
    "width: 24px; height: 24px; border: none; padding: 0; border-radius: 50%;"

  const textColorPicker = document.createElement("input")
  textColorPicker.type = "color"
  textColorPicker.value = uiState.tagTextColors[oldTag] || "#ffffff"
  textColorPicker.style.cssText =
    "width: 24px; height: 24px; border: none; padding: 0; border-radius: 50%;"

  // Tự động focus và bôi đen text
  setTimeout(() => input.select(), 0)

  const saveBtn = document.createElement("button")
  saveBtn.innerHTML = "✓" // Icon tick
  saveBtn.title = "Save"
  saveBtn.style.cssText =
    "background: var(--success-color, #28a745); color: #fff; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;"

  const cancelBtn = document.createElement("button")
  cancelBtn.innerHTML = "✕" // Icon x
  cancelBtn.title = "Cancel"
  cancelBtn.style.cssText =
    "background: var(--text-danger, #dc3545); color: #fff; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;"

  container.append(input, bgColorPicker, textColorPicker, saveBtn, cancelBtn)

  // 3. Xử lý nút Cancel
  cancelBtn.onclick = (e) => {
    e.stopPropagation()
    container.classList.remove("editing-container")
    container.innerHTML = originalHTML // Khôi phục giao diện cũ
  }

  // 4. Xử lý nút Save
  saveBtn.onclick = async (e) => {
    e.stopPropagation()
    const newTag = input.value.trim()
    const newBgColor = bgColorPicker.value
    const newTextColor = textColorPicker.value

    // Validate
    if (!newTag)
      return showCustomPopup(
        getTranslation("tagEmpty", "Tag cannot be empty"),
        "error",
        true
      )

    await updateTag(oldTag, newTag, newBgColor, newTextColor)

    // The refreshUI in updateTag will trigger a full re-render,
    // which should include the tags in the popup.
    // However, to be safe, let's call renderFn()
    renderFn()
    updateDropdownFn()
  }

  // Hỗ trợ bấm Enter để save
  input.onkeydown = (e) => {
    if (e.key === "Enter") saveBtn.click()
    if (e.key === "Escape") cancelBtn.click()
  }
}

async function getAllTags() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["bookmarkTags"], (data) => {
      const allTags = new Set()
      Object.values(data.bookmarkTags || {}).forEach((tags) =>
        tags.forEach((tag) => allTags.add(tag))
      )
      resolve([...allTags].sort())
    })
  })
}

// --- ACTION HANDLERS ---

function handleRenameSave(e, elements) {
  e.stopPropagation()
  const newTitle = elements.renameInput.value.trim()

  if (!newTitle) {
    elements.renameInput.classList.add("error")
    elements.renameInput.placeholder = getTranslation("emptyTitleError")
    return elements.renameInput.focus()
  }

  if (!uiState.currentBookmarkId)
    return handleError("No ID", "errorNoBookmarkSelected", false)

  safeChromeBookmarksCall("get", [uiState.currentBookmarkId], (res) => {
    if (!res?.[0]?.url)
      return handleError("Not a bookmark", "errorNotABookmark", false)

    safeChromeBookmarksCall("getChildren", [res[0].parentId], (siblings) => {
      if (
        siblings?.some(
          (s) =>
            s.id !== uiState.currentBookmarkId &&
            s.title.toLowerCase() === newTitle.toLowerCase()
        )
      ) {
        elements.renameInput.classList.add("error")
        elements.renameInput.placeholder = getTranslation("duplicateTitleError")
        return elements.renameInput.focus()
      }

      safeChromeBookmarksCall(
        "update",
        [uiState.currentBookmarkId, { title: newTitle }],
        (updated) => {
          if (!updated) return handleError("Update failed", "errorUnexpected")

          getBookmarkTree((nodes) => {
            renderFilteredBookmarks(nodes, elements)
            showCustomPopup(getTranslation("renameSuccess"), "success")
            handleRenameCancel(e, elements)
          })
        }
      )
    })
  })
}

function handleRenameCancel(e, elements) {
  e?.stopPropagation()
  elements.renamePopup.classList.add("hidden")
  elements.renameInput.classList.remove("error")
  elements.renameInput.value = ""
  elements.renameInput.placeholder = getTranslation("renamePlaceholder")
  setCurrentBookmarkId(null)
}

function handleRenameInputKeypress(e, elements) {
  if (e.key === "Enter") elements.renameSave.click()
}
function handleRenameInputKeydown(e, elements) {
  if (e.key === "Escape") elements.renameCancel.click()
}
function handleRenamePopupClick(e, elements) {
  if (e.target === elements.renamePopup) elements.renameCancel.click()
}

function handleClearRename(e, elements) {
  e.stopPropagation()
  elements.renameInput.value = ""
  elements.renameInput.focus()
}

function handleAddToFolder(e, elements) {
  e.stopPropagation()
  if (e.target.dataset.id) openAddToFolderPopup(elements, [e.target.dataset.id])
}

function handleDeleteBookmark(e, elements) {
  e.stopPropagation()
  const id = e.target.dataset.id
  if (!id) return handleError("No ID", "errorUnexpected")

  showCustomConfirm(getTranslation("deleteConfirm"), () => {
    if (uiState.bookmarkTags[id]) {
      delete uiState.bookmarkTags[id]
      chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags })
    }

    safeChromeBookmarksCall("remove", [id], () => {
      getBookmarkTree((nodes) => {
        renderFilteredBookmarks(nodes, elements)
        showCustomPopup(getTranslation("deleteBookmarkSuccess"), "success")
      })
    })
  })
}

function handleFavoriteBookmark(e, elements) {
  e.stopPropagation()
  const id = e.target.dataset.id
  if (!id) return handleError("No ID", "errorUnexpected")

  safeChromeBookmarksCall("get", [id], (res) => {
    if (!res?.[0]?.url)
      return handleError("Invalid bookmark", "errorNotABookmark", false)

    chrome.storage.local.get("favoriteBookmarks", (data) => {
      const favs = data.favoriteBookmarks || {}
      const isFav = !favs[id]
      favs[id] = isFav

      chrome.storage.local.set({ favoriteBookmarks: favs }, () => {
        // Update local state tree recursively
        const updateTree = (nodes) =>
          nodes.some((n) => {
            if (n.id === id) {
              n.isFavorite = isFav
              return true
            }
            return n.children && updateTree(n.children)
          })
        updateTree(uiState.bookmarkTree)

        // UI Update
        const btn = document.querySelector(`.dropdown-btn[data-id="${id}"]`)
        if (btn) {
          btn.classList.toggle("favorited", isFav)
          btn.innerHTML = isFav
            ? '<i class="fas fa-star"></i>'
            : '<i class="fas fa-ellipsis-v"></i>'
        }
        renderFilteredBookmarks(uiState.bookmarkTree, elements)
        showCustomPopup(
          getTranslation(isFav ? "favoriteSuccess" : "unfavoriteSuccess"),
          "success"
        )
      })
    })
  })
}

function handleBookmarkCheckbox(e, elements) {
  e.stopPropagation()
  const id = e.target.dataset.id
  if (!id) return

  e.target.checked
    ? uiState.selectedBookmarks.add(id)
    : uiState.selectedBookmarks.delete(id)

  const hasSelected = uiState.selectedBookmarks.size > 0
  elements.addToFolderButton.classList.toggle("hidden", !hasSelected)
  elements.deleteBookmarksButton.classList.toggle("hidden", !hasSelected)
}

export function handleDeleteSelectedBookmarks(elements) {
  if (uiState.selectedBookmarks.size === 0)
    return handleError("No selection", "errorNoBookmarkSelected", false)

  showCustomConfirm(getTranslation("deleteBookmarksConfirm"), () => {
    // Cleanup tags
    uiState.selectedBookmarks.forEach((id) => delete uiState.bookmarkTags[id])
    chrome.storage.local.set({ bookmarkTags: uiState.bookmarkTags })

    // Bulk delete
    Promise.all(
      Array.from(uiState.selectedBookmarks).map(
        (id) =>
          new Promise((resolve) =>
            safeChromeBookmarksCall("remove", [id], resolve)
          )
      )
    ).then(() => {
      uiState.selectedBookmarks.clear()
      elements.addToFolderButton.classList.add("hidden")
      elements.deleteBookmarksButton.classList.add("hidden")
      document
        .querySelectorAll(".bookmark-checkbox")
        .forEach((cb) => (cb.checked = false))

      getBookmarkTree((nodes) => {
        renderFilteredBookmarks(nodes, elements)
        showCustomPopup(getTranslation("deleteBookmarksSuccess"), "success")
      })
    })
  })
}

function handleRenameBookmark(e, elements) {
  e.stopPropagation()
  const id = e.target.dataset.id
  if (!id) return handleError("No ID", "errorUnexpected")

  if (!elements.renamePopup || !elements.renameInput)
    return handleError("Popup missing", "popupNotFound")

  setCurrentBookmarkId(id)
  elements.renameInput.value = ""
  elements.renameInput.classList.remove("error")
  elements.renameInput.placeholder = getTranslation("renamePlaceholder")
  elements.renamePopup.classList.remove("hidden")
  elements.renameInput.focus()

  safeChromeBookmarksCall("get", [id], (res) => {
    if (res?.[0]?.url) elements.renameInput.value = res[0].title || ""
    else {
      handleError("Not found", "bookmarkNotFound", false)
      handleRenameCancel(null, elements)
    }
  })
}

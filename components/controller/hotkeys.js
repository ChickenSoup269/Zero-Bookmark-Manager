// components/controller/hotkeys.js
import { uiState } from "../state.js"
import { handleDeleteSelectedBookmarks } from "./bookmarkActions.js"

export function setupHotkeys(elements) {
  document.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === "INPUT" || 
      activeElement.tagName === "TEXTAREA" || 
      activeElement.tagName === "SELECT" ||
      activeElement.isContentEditable
    );

    // Focus Search (Ctrl+F or Cmd+F)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      const searchInput = document.getElementById("search");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Undo (Ctrl+Z or Cmd+Z)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      if (isTyping) return;
      
      const undoButton = document.querySelector(".undo-toast button");
      if (undoButton) {
        e.preventDefault();
        undoButton.click();
      }
      return;
    }

    // Delete selected bookmarks (Delete or Backspace)
    if (e.key === "Delete" || e.key === "Backspace") {
      if (isTyping) return;
      if (uiState.selectedBookmarks.size > 0) {
        e.preventDefault();
        handleDeleteSelectedBookmarks(elements);
        return;
      }
      
      const focused = document.querySelector(".keyboard-focus");
      if (focused) {
         e.preventDefault();
         const delBtn = focused.querySelector(".delete-btn");
         if (delBtn) delBtn.click();
      }
    }

    // Select All (Ctrl+A or Cmd+A)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      if (isTyping) return;
      
      e.preventDefault();
      const selectAllCheckbox = document.getElementById("select-all");
      if (selectAllCheckbox) {
        if (!uiState.checkboxesVisible) {
          const toggleCheckboxesBtn = document.getElementById("toggle-checkboxes");
          if (toggleCheckboxesBtn) toggleCheckboxesBtn.click();
        }
        
        setTimeout(() => {
          if (!selectAllCheckbox.checked) {
             selectAllCheckbox.click();
          }
        }, 50);
      }
    }
    // Create Folder (Ctrl+N or Cmd+N)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      const createFolderBtn = document.getElementById("create-folder-btn");
      if (createFolderBtn) createFolderBtn.click();
      return;
    }

    // Arrow keys navigation
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (isTyping) return;
      
      const items = Array.from(document.querySelectorAll(".bookmark-item, .folder-item"));
      if (items.length === 0) return;
      
      let activeIdx = items.findIndex(item => item.classList.contains("keyboard-focus"));
      let nextIdx = 0;
      
      if (activeIdx !== -1) {
        items[activeIdx].classList.remove("keyboard-focus");
        nextIdx = e.key === "ArrowDown" ? activeIdx + 1 : activeIdx - 1;
        if (nextIdx < 0) nextIdx = items.length - 1;
        if (nextIdx >= items.length) nextIdx = 0;
      }
      
      items[nextIdx].classList.add("keyboard-focus");
      items[nextIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
      e.preventDefault();
      return;
    }

    // Enter to open focused bookmark
    if (e.key === "Enter" && !isTyping) {
      const focused = document.querySelector(".keyboard-focus");
      if (focused) {
        if (focused.classList.contains("bookmark-item")) {
           const link = focused.querySelector("a.bookmark-link") || focused.querySelector("a");
           if (link && link.href) window.open(link.href, "_blank");
        } else if (focused.classList.contains("folder-item")) {
           focused.click();
        }
        e.preventDefault();
        return;
      }
    }
  });
}

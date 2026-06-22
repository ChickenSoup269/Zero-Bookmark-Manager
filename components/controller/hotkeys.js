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
  });
}

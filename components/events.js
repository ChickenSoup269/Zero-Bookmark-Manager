// ./components/events.js
import { setupCreateFolderListeners } from "./controller/createFolder.js"
import { setupRenameFolderListeners } from "./controller/renameFolder.js"
import { setupAddToFolderListeners } from "./controller/addToFolder.js"
import { setupDeleteFolderListeners } from "./controller/deleteFolder.js"
import { setupExportImportListeners } from "./controller/exportImport.js"
import { setupBookmarkActionListeners } from "./controller/bookmarkActions.js"
import { setupUIControlListeners } from "./controller/uiControls.js"
import { attachDropdownListeners } from "./controller/dropdown.js"

export function setupEventListeners(elements) {
  setupCreateFolderListeners(elements)
  setupRenameFolderListeners(elements)
  setupAddToFolderListeners(elements)
  setupDeleteFolderListeners(elements)
  setupExportImportListeners(elements)
  setupBookmarkActionListeners(elements)
  setupUIControlListeners(elements)
  attachDropdownListeners(elements)
}

# Zero Bookmark Manager - Copilot Instructions

## Project Overview

**Zero Bookmark Manager** is a Chrome extension (manifest v3) for organizing, searching, and managing browser bookmarks. It provides flat list, tree, detail, and card views with export/import, theming, multilingual support (EN/VI), and AI-powered chat interface.

## Architecture

### Core Data Flow

1. **State Management** ([components/state.js](components/state.js)): Central `uiState` object tracks bookmarks, folders, view mode, search query, sort type, and tag metadata
2. **Data Fetching** ([components/bookmarks.js](components/bookmarks.js)):
   - `getBookmarkTree()` → Chrome API → `flattenBookmarks()` + `getFolders()` → populates `uiState`
3. **UI Rendering** ([components/ui.js](components/ui.js)): `renderFilteredBookmarks()` applies filters, sorting, and view transformations
4. **Event Handling** ([components/events.js](components/events.js)): Orchestrates listener setup across controller modules

### Module Organization

- **controllers/** - User interactions (folder CRUD, bookmarks, UI state changes)
- **export/** - Format-specific export (JSON, HTML, CSV with configurable metadata)
- **health/** - Link health checking and verification
- **option/** - Settings persistence and UI state serialization
- **utils/** - Translations, Chrome API wrappers, UI helpers

### Key Integration Points

- **Chrome Bookmarks API**: Wrapped by `safeChromeBookmarksCall()` for error handling
- **Chrome Storage API**: Persists UI state, export config, tag colors, API keys (chat feature)
- **Dynamic Theming**: Applied via `updateTheme()` with system preference detection
- **Chat/AI Module**: `[components/chat.js](components/chat.js)` (2080 lines) integrates external AI API for bookmark management via natural language

## Critical Patterns

### State Updates & Persistence

```javascript
// Always use setter functions to update state, then persist
import { uiState, setBookmarks } from "./state.js"
setBookmarks(newBookmarkArray) // Updates uiState.bookmarks
saveUIState() // Persists to chrome.storage.local
```

### View Rendering Pipeline

Bookmark display respects this filter chain:

1. **Folder filter** (folder tree hierarchy)
2. **Search query** (keyword matching on title/URL)
3. **Tag filters** (selected tags in dropdown)
4. **Sort type** (default/date/A-Z/favorites/health status)
5. **View mode** (flat/tree/detail/card) → specific render function

### Folder Hierarchy

- Bookmarks have `parentId` linking to folder `id`
- `isInFolder()` recursively checks membership including nested folders
- Folder operations (create/delete/rename) use Chrome API; tag colors stored separately

### Localization Pattern

```javascript
// Always use translations object for user-facing text
const msg = translations[localStorage.getItem("appLanguage") || "en"].keyName
// Supported: en, vi
```

### Tag System

- **Tag Storage**: `uiState.bookmarkTags = { bookmarkId: [tag1, tag2, ...] }`
- **Tag Colors**: `uiState.tagColors = { tagName: hexColor }`
- **Text Contrast**: `getContrastColor()` auto-picks text color for readability
- **Persistence**: Tags and colors saved to chrome.storage.local in custom format

### Bookmark Metadata

- Core Chrome API fields: `id`, `title`, `url`, `parentId`, `dateAdded`
- Custom fields (stored separately): tags, health status, favorite flag
- Export preserves both core and custom metadata based on user config

## Development Workflows

### Adding a New View Mode

1. Add option to `#view-switcher` select in [index.html](index.html)
2. Create render function in [components/ui.js](components/ui.js) (e.g., `renderCardView()`)
3. Update `renderFilteredBookmarks()` switch statement
4. Add CSS styling in [styles/style.css](styles/style.css)

### Adding UI State Persistence

1. Add property to `uiState` object in [components/state.js](components/state.js)
2. Include in `saveUIState()` serialization
3. Include in `loadUIState()` restoration (in [components/option/option.js](components/option/option.js))

### Export Format Extension

1. Create `exportToFormat()` function in [components/export/format.js](components/export/format.js)
2. Import and call from [components/export/export.js](components/export/export.js) export listener
3. Add format-specific config options in export popup HTML

### Adding Chat Commands

- Edit system prompt in [components/chat.js](components/chat.js) (search "System Prompt" comment)
- Map new intents to existing functions (e.g., `renameFolder()`, `toggleTheme()`)
- AI parses natural language → intent classification → action execution → bookmark state refresh

## Testing & Debugging

### Local Extension Loading

1. `chrome://extensions` → Enable Developer Mode
2. Load unpacked from `BookMark2.0/` directory
3. Test in popup after modifying files
4. Check **Extension background** console for errors (chrome://extensions → service worker logs)

### State Inspection

- Open extension popup → DevTools (right-click → Inspect)
- Console: `console.log(uiState)` to inspect current state
- Check `chrome.storage.local` persistence via DevTools → Storage

### Useful Chrome API Methods Used

- `chrome.bookmarks.getTree(callback)` - Load all bookmarks
- `chrome.bookmarks.create({parentId, title, url}, callback)` - Add bookmark/folder
- `chrome.bookmarks.move({id, parentId}, callback)` - Move bookmark
- `chrome.bookmarks.remove(id, callback)` - Delete bookmark
- `chrome.storage.local.get/set` - Persist extension state

## File Dependencies Map

- **main.js** → initializes all components via DOMContentLoaded
- **components/ui.js** ← depends on state, bookmarks, controllers for rendering
- **components/events.js** → glues controllers to UI elements (no rendering)
- **components/chat.js** ← autonomous; reads/modifies state, triggers UI updates
- **export/** ← generates formats; imports → validates + merges via `getBookmarkTree()` callback

## Known Constraints

- **Popup window size**: Fixed dimensions affect view mode responsiveness
- **Chrome Storage Quota**: bookmark metadata limited to storage.local capacity
- **Manifest v3**: No background scripts; state lost on extension restart (use storage.local for persistence)
- **Health check**: External API call; requires internet and timeout handling
- **Chat feature**: Requires API key configuration; calls external model via custom curl endpoint

## Performance Considerations

- **Search debouncing** applied to avoid re-renders on every keystroke
- **Flattening operation**: O(n) complexity; called on tree fetch only
- **Autoscroll on drag**: Uses `setInterval` for smooth UX; stopped on drop (watch for memory leaks)
- **Large bookmark trees**: No pagination; consider lazy loading if >10k bookmarks

<!-- ---Extension version---- -->

### [1.1.8] - 2026-02-09

## Added

- **New Themes:** Added 5 new color themes for better customization:
  - **Tokyo Night** - Popular dark theme with blue/purple accent colors inspired by Tokyo's night cityscape
  - **GitHub Blue** - Dark theme matching GitHub's modern dark interface with blue accents
  - **GitHub Light** - Clean light theme following GitHub's light mode color palette
  - **Monokai** - Classic Monokai theme with vibrant green, cyan, and yellow highlights
  - **Winter is Coming** - Deep blue dark theme inspired by VS Code's Winter is Coming extension

## Updated

- Moved font assets to CDN (replaced local font files with CDN-hosted sources) to reduce extension bundle size and improve load performance.
- Updated AI chat system to recognize all new theme names in natural language commands
- Updated theme documentation in help guide (both English and Vietnamese)

## Improved

- Reduced extension bundle size by offloading large font assets to CDN and improving initial load times.
- Enhanced theme switcher UI with more diverse color scheme options (now 11 total themes)
- Better theme coverage for different user preferences (light, dark, and colorful variants)

## Fixed

- Fixed CSS color for cancel buttons so they display correctly across light/dark themes.

### [1.1.7] - 2026-02-04

## Added

- **Pure HTML Export:** Added new export format to generate clean, standalone HTML files with bookmarks
- **Folder Delete Icon in Tree View:** Added delete icon for folders directly in tree view for easier folder management
- **Sidebar Tag Contrast Detection:** Auto-detect and apply optimal text color (black/white) for tag pills based on background color
- **Visit Count Tracking:** Track how many times each bookmark is opened inside the extension and during normal browsing (via `webNavigation`)
- **Visit Count Icon:** Added a visit count icon indicator per bookmark

## Improved

- **Sidebar Section Animations:** Changed section collapse/expand from instant to smooth animation using max-height transition (0.3s)
- **Sidebar Layout:** Removed excessive padding between Folders and Manage sections for better space utilization
- **Tag Pill Display:** Enhanced tag pill styling in sidebar with automatic contrast color calculation for better readability
- **Visit Count Accuracy:** Improved counting when users open a bookmark page

## Fixed

- **Sidebar Section State Persistence:** Fixed issue where sidebar section state (collapsed/expanded) wasn't being restored correctly after page refresh
- **Sidebar Content Overflow:** Removed unwanted overflow-y scrollbars from folder tree and tag container to allow full content display
- **Sidebar Icon Display:** Fixed bookmark icon visibility and color in sidebar-total-count (now uses accent-color)
- **Collapsed Sidebar CSS:** Consolidated and fixed duplicate CSS rules for collapsed state to prevent elements from showing incorrectly

## Updated

- Removed deprecated sidebar-footer-stats component - total count now displays in header section
- Added `webNavigation` permission to support visit count tracking

### [1.1.6] - 2026-01-27

## Added

[none]

## Improved

- Performance: Converted all font assets from .ttf to .woff2 to boost loading speed and reduce memory usage

## Fixed

[none]

## Updated

- Cleaned up unused heavy fonts (HackNerd and AnonymiceProNerd)
- Bundle Size: Reduced total extension size from 6.1MiB down to ~3MiB

### [1.1.5] - 2026-01-25

## Added

- **Configurable Click Action:** Added a setting that lets users choose what happens when clicking the extension icon (Popup, Full Page, or Side Panel).
- Side Panel support.
- Default favicon handling for bookmarks without icons.

## Improved

- **Popup Window Behavior:** The popup window is now reused if already open, preventing duplicate popup windows.
- **Side Panel Opening:** Opening the side panel from the popup now correctly focuses the main browser window.
- Improved favicon loading logic.
- Settings: bookmark options can now be shown or hidden with a section title.

## Fixed

- Fixed an issue where saving other UI settings could reset the **Quick Open Action** preference.

## Updated

- Automatically uses the local **Gohu** font on first install.
- Minor UI refinements.
- Version bumped to **1.1.5**.

### [1.1.4] - [2026-01-21]

## Added

- Generate QR code for bookmark
- Move to folder in "tree view" and "Organize Folders" with right click in folder
- Automatically remove duplicate bookmarks when a new one is added, keeping the newest.
- Added a manual option to check for and remove duplicate bookmarks.

## Improved

- **Chatbot:**
  - Can now manage folders directly through chat commands (create, rename, delete).
  - Can now control UI settings like view mode, theme, and sort order via chat.
  - Can now initiate a link health check for all bookmarks.
- Enhanced "Add to Folder" functionality with an improved user interface, theme support, and rendering of the folder
- Dropdown menus (Settings) are now scrollable for better usability with extensive options.
- Visual styling of dropdown section titles improved with a 'centered line' effect for better readability.structure.
- Improved the "Organize Folders" popup with new styling and enhanced drag-and-drop capabilities.
- Refactored code structure for better readability and maintainability.

## Updated

- Updated Help Guide in chatbot to include all new commands.

### [1.1.3] - [2026-01-06]

## Added

- Confirmation popup for deleting tags.
- CSS styling for rendered Markdown in chat responses (tables, code blocks, etc.).
- New "Tet" theme with red and gold color palette, fully implemented in HTML export.
- Dynamic localization for sidebar section titles (Filters, Search, Folder actions, Selection).
- Chatbox welcome message with localized text and a "Start Chat" button.
- Color palette for tag management in the "Manage Tags" popup.
- Check Link Health verify bookmark health

## Improved

- Chatbot can now reliably answer non-bookmark-related questions.
- Chat input now auto-resizes and supports `Shift+Enter` for newlines.
- Robustness of AI API calls to prevent errors and handle various response formats.
- "Tet" theme color palette adjusted for better contrast and readability.
- Font switching mechanism enhanced with more choices and robust handling.
- Overall localization experience improved with dedicated script and event handling.
- Improved tag color import logic to correctly restore colors from imported JSON files.

## Updated

- AI system prompts for a more reliable and efficient two-step (classify-then-respond) logic.
- Localization system to dynamically translate elements using `data-i18n` attributes.
- `README.md` to reflect new features, version, and usage examples.
- Corrected HackNerd font file path in styles.

### [1.1.2] - [2025-12-04]

## Added

- Added bookmark component and utility functions.
- Added version 1.1.2 to the CHANGELOG and introduced web preview & properties modals.
- Added version badge to the README.
- Added modals for web preview and properties in the bookmark detail view.

## Improved

- Improved README layout for better visual alignment.
- Refactored code structure for better readability and maintainability (multiple iterations).
- Enhanced bookmark detail popup (openBookmarkDetailPopup) with better error handling.
- Improved renderCardView with better bookmark handling and smoother drag-and-drop interactions.
- Enhanced README images for improved clarity and consistency.
- Updated footer to display a dynamic version number.

## Updated

- Updated changelog dates for consistency.
- Updated README and manifest.json (version bumped to 1.1.2).
- Updated CHANGELOG and related UI components.
- Removed "tabs" permission from manifest.json.

### [1.1.1] - [2025-11-07]

- Added Card View

### [1.1.0] - [2025-08-14]

- Added webView (edit in new tab)
- Added Chatbot - Gemini (Beta)
- Added soft most visted
- Added favourite bookmarks
  - fav bookmark & added soft type favourite
- Added Tree view (option work with flat list)
  - Option View details | add tags
  - View details: Title, date add, tags
  - Mange tags: add tags in bookmark with color
- Added Details view
  - View bookmark details: Title, Date Added, Folder, and Mini Web Preview (can be extended for use)
- Added Local Storage Settings (choose to persist data between sessions)
  - Save Search Query
  - Save Selected Folder
  - Save Sort Type
  - Save View Mode
  - Save Collapsed Folders
  - Save Checkboxes Visibility
  - Save Selected Tags
- Added tags into bookmark (limit: 10 per bookmark)
- Updated UI refinements and small visual improvements
- Updated Themes (added One Dark & Dracula)
- Updated Export options — now supports CSV (Excel/Sheets)
- Updated Fonts (added AnonymicePro, ProFont, JetBrains )

### [1.0.3] - [2025-09-02]

- Added light/dark theme switching (auto-detected)
- Added English/Vietnamese language support with dynamic UI updates
- Added bookmark import with duplicate URL detection and user confirmation
- Added bookmark export with JSON or HTML
- Added Chrome Web Store video introduction
- Improved bookmark refresh for add/delete/rename actions
- Updated code split to components
- Updated content script for package-based summary and title
- Renamed popup.html/js to index.html/js
- Replaced changefont button with font-switcher dropdown
- Removed unrelated files
- Added visibility toggle for Select All container based on checkbox visibility state
- Added dynamic display of Delete Bookmarks button based on selected bookmarks
- Fixed missing text for Delete Bookmarks button with proper translation support
- Improved checkbox selection handling for individual and Select All interactions

### [1.0.2] - [2025-08-15]

- Removed unused "identity" permission from manifest.json.

### [1.0.1] - [2025-08-12]

- Base bookmarks

<!-- ---Extension version---- -->

## [1.2.1] - 2026-04-03

### 🇬🇧 English (Tiếng Anh)

#### Added

- **Favicon Options:** Added support for selecting how favicons are fetched for bookmarks: Google, Hostname, or Auto (prioritizes Google with Hostname fallback) in Settings.
- **UI Setting:** Added a "Favicon Mode" dropdown in the Extension Options, allowing users to choose their preferred favicon source.
- **Update Notification:** Added a popup notification when the extension is successfully updated, including a button to view the Release Notes on GitHub.

#### Improved

- Optimized favicon fetching logic: in Auto mode, the system prioritizes Google and automatically falls back to hostname-based favicon (DuckDuckGo) if unavailable.
- When changing the favicon mode, the UI now automatically refreshes icons for all bookmarks.
- **Drag and Drop & Move Bookmarks:** Updated the Drag-and-Drop and "Add to folder" behaviors to fully respect the "Duplicate Scope" and "Auto Remove Duplicates" settings. Bookmarks will now accurately be cloned (instead of moved) when the scope is set to "Across folders" and auto-delete is turned off.

#### Fixed

- Fixed cases where favicons appeared blurry or failed to load by introducing a more flexible fallback mechanism between different favicon sources.
- Fixed an issue where the `logo.png` image was missing in the HTML resulting in a 404 (`net::ERR_FILE_NOT_FOUND`).
- Fixed a console error (`popupWindowId is not defined`) in the background service worker script.
- Fixed a JavaScript syntax error preventing the bulk "Add to Folder" functionality from completing.

---

### 🇻🇳 Vietnamese (Tiếng Việt)

#### Tính năng mới

- **Tùy chọn Favicon:** Bổ sung lựa chọn cách hiển thị Favicon của các trang web: lấy qua Google, qua Tên miền, hoặc Tự động (Ưu tiên Google, dự phòng quét Tên miền) trong màn hình Cài đặt.
- **Cài đặt UI:** Thêm menu trỏ xuống "Favicon Mode" trong mục Tùy chọn Tiện ích (Options) để thiết lập nguồn lấy ảnh hiển thị cho thư trang.
- **Thông báo cập nhật:** Thêm một màn hình Popup nổi thông báo khi tiện ích được nâng cấp cập nhật bản vá thành công lên phiên bản mới nhất, kèm theo nút mở trang Lịch sử Phiên bản (Release Notes).

#### Cải tiến

- Tối ưu hóa nguyên lý tải logic Favicon: Khi để chế độ Tự động, hệ thống ưu tiên gọi từ máy chủ của Google trước, rồi mới dùng DuckDuckGo với tên miền để quét nếu Google thất bại trả ảnh về.
- Giao diện UI sẽ tự động làm mới ngay toàn bộ các biểu tượng favicon trang khi người dùng bật thử lựa chọn thay đổi chế độ.
- **Kéo thả & Di chuyển Bookmark:** Cập nhật lại thao tác chuột tính năng "Kéo thả" cũng như "Thêm vào thư mục" để tương thích hoàn toàn cho "Duplicate Scope". Bookmark giờ đây sẽ chỉ làm bản sao (Copy) thay vì di chuyển nếu Scope là "Across folders" và bạn đang TẮT Chế độ tự động dọn dẹp bookmark trùng lặp bằng ngầm.

#### Sửa lỗi

- Sửa tình trạng các trường hợp favicon tải thất bại hoặc bị mờ.
- Khắc phục lỗi báo 404 mất hoàn toàn đường dẫn hình ảnh của `logo.png` khi bật giao diện ở thư mục con.
- Khắc phục lỗi văng console báo biến chưa khai báo `popupWindowId is not defined` hoạt động ở tiến trình ẩn phía sau (Background Worker).
- Khắc phục lỗi văng ngoặc đóng cú pháp ngăn chặn quá trình chuyển đổi hàng loạt các bookmark đang chọn vào các thư mục mới qua nút Bulk.

### [1.2.0] - 2026-03-08

## Added

- **Tags Browser Popup:** Added a new "All Tags" button in the Tags sidebar section that opens a full-screen popup for browsing all tags at once — displays tags in multi-row wrap layout for easy overview
- **Tag Search:** Added a live search input inside both the sidebar Tags section and the Tags Browser popup to quickly filter tags by name (with 400ms debounce — filters only after user stops typing)
- **Tag Usage Count Badge:** Each tag pill now shows a small count indicating how many bookmarks use that tag
- **Clear Tag Filter Button:** Added a one-click button to deselect all active tag filters (appears only when ≥1 tag is selected)
- **Active Tags Badge:** The Tags section header now shows a badge with the number of currently active (selected) tag filters
- Scroll to Top button in sidebar
- **List Background Toggle:** Added ON/OFF toggle switch in Extension Options to show/hide the background, border, and shadow of the bookmark list area

## Improved

- **Tag Layout in Sidebar:** Tags list now displays as a single horizontal scrollable row to save vertical space in the 260px sidebar
- **Tags Browser Popup Layout:** Full popup displays tags in a flexible multi-row wrap layout (`flex-wrap`) with scrollable content for comfortable browsing of large tag collections
- **Tag Pills:** Active (selected) tags are sorted to the top of the list; pills now have `overflow: hidden` with `text-overflow: ellipsis` to handle long tag names gracefully
- **Tag Expand Button:** Button includes both icon and localized text (`openTagsBrowser`) with EN/VI translation support
- Updated scrollbar styling
- Enhanced sidebar scrollbar visibility on hover

## Fixed

- Realtime UI sync in Bookmarks Webview (`bookmarks.html`) — page now updates automatically without requiring manual refresh (F5)
  - Ensured `loadVisitCounts()` always triggers callback even when MV3 background service worker is inactive
  - Added `chrome.storage.onChanged` listener to auto re-render UI when bookmark-related data changes
  - Cleaned up storage listeners on page unload to prevent memory leaks

### [1.1.9] - 2026-02-21

## Refactored

- **CSS Architecture Overhaul:** Restructured styles into modular files for better maintainability:
  - **fonts.css** - Isolated all @font-face declarations (GohuFont, JetBrainsMono, ProFontWindows, AnonymicePro)
  - **variables.css** - Centralized common CSS variables (spacing, border-radius, transitions, shadows)
  - **theme.css** - Separated all theme configurations (10 themes: Dark, Light, Dracula, OneDark, Tet, Tokyo Night, GitHub Blue/Light, Monokai, Winter is Coming)
  - **style.css** - Main stylesheet now imports modular files using @import for cleaner structure

## Improved

- Better code organization with separation of concerns (fonts, variables, themes, components)
- Easier theme customization and maintenance with dedicated theme.css file
- Simplified debugging with clearly separated CSS modules
- Reduced cognitive load when editing styles by having focused, single-purpose files

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

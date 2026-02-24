<div align="center">

# Bookmark Manager Extension <img src="./icons/icon_vn_tet.png" alt="logoEX" width="30">

</div>

<div align="center">
<img src="./images/logo.png" alt="logo" width="520">
</div>

<div align="center">
 <table width="100%" >
  <tr>
    <td align="left">
    English | <a href="https://github.com/ChickenSoup269/Bookmark-Manager/blob/main/README_VN.md">Tiếng Việt</a>
    </td>
    <td align="right">
      <a href="https://github.com/ChickenSoup269/Extension_Bookmark-Manager/blob/main/CHANGELOG.md">CHANGELOG.md</a>
    </td>
    <td align="right">
      <a href="https://chromewebstore.google.com/detail/zero-bookmark-manager/jhcoclfodfnchlddakkeegkogajdpgce?authuser=0&hl=en"> 
       Link Extension 🌐 
      </a>
    </td>
  </tr>
  
</table>
</div>

<div align="center">

<p>

<a href="https://chromewebstore.google.com/detail/zero-bookmark-manager/jhcoclfodfnchlddakkeegkogajdpgce?authuser=0&hl=en">
<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/available_chrome_web.png?raw=true" width="200px"  >
</a>

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Generic badge](https://img.shields.io/badge/Version-1.1.9-white.svg)](https://shields.io/)

</p>
<p>

![My Skills](https://go-skill-icons.vercel.app/api/icons?i=js,html,css)

</p>

</div>

## Introduction

Bookmark Manager is a powerful and intuitive Chrome extension that simplifies bookmark organization. Easily view, search, sort, and manage your bookmarks with a sleek interface. It supports light/dark themes, multilingual display (English/Vietnamese), and export/import functionality for seamless backup and restore.

## How to add bookmark ?

- Web Browsers ![Chrome](https://img.shields.io/badge/Chrome-4285F4?logo=google-chrome&logoColor=white), ![Firefox](https://img.shields.io/badge/Firefox-FF7139?logo=firefox&logoColor=white), ![Edge](https://img.shields.io/badge/Edge-0078D7?logo=microsoft-edge&logoColor=white), ![Safari](https://img.shields.io/badge/Safari-000000?logo=safari&logoColor=white)
  The universal shortcut to bookmark your current page is:
  - Windows/Linux: Ctrl + D
  - Mac: Command (⌘) + D

* Pro Tip: To bookmark all open tabs into a single folder, use Ctrl + Shift + D (Windows) or ⌘ + Shift + D (Mac).

# OR

<p align="center">
<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/add_bookmark.png?raw=true" width="450px"/>
</p>

## Features

- **View Bookmarks:** Browse bookmarks by flat list, tree view, or details view.
- **Search:** Instantly find bookmarks by keyword (title or URL).
- **Sort:** Organize bookmarks by date added, last opened, or alphabetically (A-Z, Z-A), favourite, most visted.
- **Folder Management:** Create, delete, or move bookmarks between folders.
- **Edit Bookmarks:** add to folder, rename or delete bookmarks. View details, favourite, add tags.
- **Export/Import:** Save bookmarks to JSON/HTML/CSV or import with JSON duplicate detection (based on URL).
- **Themes:** Switch between light, dark, dracula, one dark, Tet, or system-based themes.
- **Fonts:** Customize interface with various font styles, including improved Nerd Fonts support.
- **Multilingual:** Supports English and Vietnamese for a localized experience.
- **Check Link Health:** Verify the availability and safety of your bookmarked links.
- **Generate QR Code:** Create QR codes for your bookmarks for easy sharing and access on other devices.
- **Visit Count Tracking:** Track how many times each bookmark is opened inside the extension and in normal browsing (uses the `webNavigation` permission).
- **Visit Count Icon:** See a quick icon indicator showing total visits per bookmark.
- **Chatbot (Beta):** Manage bookmarks and control the extension using natural language. Create, delete, and organize bookmarks and folders, change themes, views, and more, all from the chat interface.
- **Duplicate Management:** Automatically removes duplicate bookmarks upon creation. Includes a manual option in the settings menu to scan and clean all existing duplicates.
- **Configurable Click Action:** Choose whether clicking the extension icon opens a popup, the full page, or the side panel.

## Running Tests

To run tests, ensure the following environment:

- **Browser:** Google Chrome (latest version).
- **Permissions:** Access to Chrome's bookmark API.

## Installation

Install Bookmark-Manager

```bash
  git clone https://github.com/ChickenSoup269/Zero-Bookmark-Manager
  cd Zero-Bookmark-Manager
```

### Step by step to use without Chrome store:

1. Clone the repository or download/Releases you can chosse version you like here <a href="https://github.com/ChickenSoup269/Zero-Bookmark-Manager/releases">All Zero Bookmarks releases</a>.
2. Open Chrome and navigate to **chrome://extensions**

<p align=center>3.  Enable Developer Mode.</p>

<p align="center">
<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_1.webp?raw=true" width="full"/>
</p>

<p align=center>4. Click Load unpacked and select the extension folder.</p>

<p align="center">
   <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_2.webp?raw=true"  width="full"/>
</p>

<p align=center>5. Select the newly downloaded folder</p>

<p align="center">
   <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_3.png?raw=true"  width="full"/>
</p>

<p align=center>- Make sure you go in and see files like this</p>

<p align="center">
<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_4.png?raw=true"  width="full"/>
</p>

<p align=center>6. Click the extension icon in the toolbar to start using it.</p>
<p align="center">
  <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_5.png?raw=true"  width="full" height="480"/>
</p>

## Usage/Examples

| Parameter                | Description                                                                                                                                                                                                                                  |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Search`                 | Type keywords in the search box.                                                                                                                                                                                                             |
| `Filter folders`         | Select a folder from the dropdown.                                                                                                                                                                                                           |
| `Sort`                   | Choose a sorting option.                                                                                                                                                                                                                     |
| `Manage folders`         | Create, rename, or delete fodlers                                                                                                                                                                                                            |
| `Manage bookmarks`       | Click "⋮" to add to folder, rename, or delete, Viewdetail, Manage tags (now with a color palette), Favourite                                                                                                                                 |
| `Export/Import`          | Use Settings to export as JSON/HTML/CSV or import with Json duplicate check.                                                                                                                                                                 |
| `Customize`              | Adjust theme (including the new Tet theme), font, or language in Settings, Render view                                                                                                                                                       |
| `Edit in new tabs`       | Use extension with web view                                                                                                                                                                                                                  |
| `Open Side Panel`        | Open bookmark in a side panel for quick viewing.                                                                                                                                                                                             |
| `Local Storage Settings` | Custom save data use in search, select, sort, view mode, collapsed folders, tags, checkboxs                                                                                                                                                  |
| `Quick Open Action`      | In the main settings menu, choose the default action (Popup, Full Page, Side Panel) for clicking the extension icon.                                                                                                                         |
| `Tags`                   | Choose a sorting tags option                                                                                                                                                                                                                 |
| `Pin to top`             | Choose a bookmark to pin on top                                                                                                                                                                                                              |
| `Check Link Health`      | Verify bookmark health via settings or dropdown.                                                                                                                                                                                             |
| `Check Duplicates`       | Find and remove all duplicate bookmarks manually via the settings menu.                                                                                                                                                                      |
| `Generate QR Code`       | Create QR codes for your bookmarks from the dropdown.                                                                                                                                                                                        |
| `Visit Count`            | Track and display how many times a bookmark was opened, both inside the extension and from normal browsing.                                                                                                                                  |
| `Chatbot`                | Now supports full bookmark and folder management (add, edit, delete, move, create/rename/delete folders), UI control (themes, views, sorting), and can answer general questions. See the in-chat Help Guide for all commands. (beta version) |
| `Localization`           | Sidebar section titles (Filters, Search, Folder actions, Selection) are now dynamically translated.                                                                                                                                          |

## Video & screenshots

<div style="text-align: center;">

</div>

Video Updating

<!-- image -->
<p align="center">

<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/extension_bookmark_119/1.png?raw=true" alt="Screenshot" width=""/>

---

<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/extension_bookmark_119/2.png?raw=true" alt="Screenshot" width=""/>

---

<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/extension_bookmark_119/3.png?raw=true" alt="Screenshot" width=""/>

---

<img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/extension_bookmark_119/4.png?raw=true" alt="Screenshot" width=""/>

 </p>

## Feedback

If you have any feedback, please reach out to me at thientran01345@icloud.com

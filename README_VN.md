# Bookmark Manager Extension <img src="./icons/icon.png" alt="logoEX" width="30">

<div align="center">
<img src="./images/logo.png" alt="logo">
</div>

<table width="100%">
  <tr>
    <td align="left">
      <a href="https://github.com/ChickenSoup269/Bookmark-Manager/blob/main/README.md">English</a> | Tiếng Việt
    </td>
    <td align="right">
      <a href="https://github.com/ChickenSoup269/Extension_Bookmark-Manager/blob/main/CHANGELOG.md">CHANGELOG.md</a>
    </td>
       <td align="right">
      <a href="https://chromewebstore.google.com/detail/zero-bookmark-manager/jhcoclfodfnchlddakkeegkogajdpgce?authuser=0&hl=en">Link Extension</a>
    </td>
  </tr>
</table>

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)

<p align="center">
  <a href="https://unikorn.vn/p/zero-bookmark-manager?ref=embed-zero-bookmark-manager" target="_blank">
    <img src="https://unikorn.vn/api/widgets/badge/zero-bookmark-manager?theme=light" alt="Zero Bookmark Manager trên Unikorn.vn" width="256" height="64" />
  </a>
  &nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/zero-bookmark-manager/jhcoclfodfnchlddakkeegkogajdpgce?authuser=0&hl=en">
    <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/available_chrome_web.png?raw=true" width="200" />
  </a>
  &nbsp;&nbsp;
  <a href="https://launch.j2team.dev/products/zero-bookmark-manager-v122?utm_source=badge-launched&utm_medium=badge&utm_campaign=badge-zero-bookmark-manager-v122" target="_blank" rel="noopener noreferrer">
    <img src="https://launch.j2team.dev/badge/zero-bookmark-manager-v122/light" alt="Zero Bookmark Manager - Launched on J2TEAM Launch" width="250" height="54" />
  </a>
</p>



## Introduction

Quản lý Bookmark là một tiện ích mở rộng Chrome, giúp đơn giản hóa việc tổ chức bookmark. Dễ dàng xem, tìm kiếm, sắp xếp và quản lý bookmark của bạn với giao diện dễ nhìn? Hỗ trợ chủ đề sáng/tối, hiển thị ngôn ngữ (Tiếng Anh/Tiếng Việt), và chức năng xuất/nhập để sao lưu và khôi phục liền mạch.

## Features

- **Xem Bookmark:** Duyệt qua bookmark theo dạng danh sách phẳng, cây thư mục, chế độ chi tiết, **Chế độ thẻ (Card View)** hoặc **Chế độ danh sách (List View)**.
- **Tìm kiếm:** Tìm bookmark ngay lập tức bằng từ khóa (tiêu đề hoặc URL) với hỗ trợ **Tìm kiếm mờ (Fuzzy Search)**.
- **Sắp xếp:** Sắp xếp bookmark theo ngày thêm, lần mở gần nhất, bảng chữ cái (A–Z, Z–A), yêu thích, lượt truy cập nhiều nhất hoặc **theo Tên miền (Domain)**.
- **Thanh bên & Quản lý Thư mục:** Thanh bên phong cách Raindrop với cây thư mục phân cấp. Hỗ trợ **Kéo & Thả (Drag & Drop)** để tổ chức nhanh chóng.
- **Chỉnh sửa Bookmark:** Thêm vào thư mục, đổi tên hoặc xóa dấu trang. Xem chi tiết, đánh dấu yêu thích, thêm thẻ (tags).
- **Xem trước Trang web:** Mở một **Modal Iframe** trong Chế độ chi tiết để xem trước trang web mà không cần rời khỏi extension.
- **Xuất/Nhập:** Lưu bookmark dưới dạng JSON/HTML/CSV hoặc nhập vào bằng tệp JSON (tự động phát hiện trùng lặp dựa trên URL).
- **Giao diện (Themes):** Chuyển đổi giữa các chủ đề Sáng, Tối, Dracula, One Dark, **Tokyo Night**, **Monokai**, **Winter is Coming**, **GitHub Blue**, **GitHub Light**, Tết hoặc theo hệ thống.
- **Phông chữ:** Tùy chỉnh giao diện với các kiểu phông chữ khác nhau (hỗ trợ Nerd Fonts).
- **Đa ngôn ngữ:** Hỗ trợ tiếng Anh và tiếng Việt.
- **Kiểm tra tình trạng liên kết:** Xác minh tính khả dụng và an toàn của các liên kết.
- **Tạo mã QR cho Bookmark:** Tạo mã QR để dễ dàng chia sẻ và truy cập trên các thiết bị khác.
- **Theo dõi lượt truy cập:** Theo dõi số lần mở của mỗi bookmark trong extension và khi duyệt bình thường.
- **Quản lý Thẻ (Tags):** Quản lý thẻ với bảng màu và một **Popup trình duyệt Thẻ** riêng biệt.
- **Chatbot (AI Assistant):** Quản lý bookmark bằng ngôn ngữ tự nhiên. Hỗ trợ nhiều nhà cung cấp AI và **Local AI (Ollama)**.
- **Quản lý Bookmark Trùng lặp:** Tự động xóa bookmark trùng lặp khi tạo hoặc quét thủ công.
- **Cấu hình linh hoạt:** Tùy chỉnh nguồn Favicon (Google, DuckDuckGo, Auto), hành động khi nhấp icon, v.v.

## Running Tests

Để chạy thử nghiệm, đảm bảo môi trường sau:

- **Trình duyệt:** Google Chrome (phiên bản mới nhất).
- **Quyền truy cập:** Truy cập vào API bookmark của Chrome.

## Installation

Cài đặt Bookmark-Manager

```bash
  git clone https://github.com/ChickenSoup269/Zero-Bookmark-Manager
  cd Zero-Bookmark-Manager
```

### Step by step to use offline:

1. Clone repository hoặc tải bản phát hành (Releases) mà bạn muốn tại đây <a href="https://github.com/ChickenSoup269/Zero-Bookmark-Manager/releases">All Zero Bookmarks releases</a>.
2. Mở Chrome và truy cập vào đường dẫn **chrome://extensions**

<p align="center"> 3. Bật chế độ Nhà phát triển (Developer Mode).</p>

<p align="center">
  <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_1.webp?raw=true" width="full" />
</p>

<p align="center">4. Nhấn “Load unpacked” (Tải tiện ích chưa đóng gói) và chọn thư mục chứa tiện ích mở rộng.</p>
<p align="center">
   <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_2.webp?raw=true"  width="full" />
</p>

<p align="center">5. Chọn thư mục bạn vừa tải về.</p>
<p align="center">
   <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_3.png?raw=true" width="full"  />
</p>

<p align="center">- Hãy đảm bảo rằng bên trong thư mục có các tệp như hình dưới đây:</p>
<p align="center">
  <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_4.png?raw=true"  width="full" />
</p>

<p align="center">6. Nhấn vào biểu tượng tiện ích trên thanh công cụ để bắt đầu sử dụng.</p>
<p align="center">
  <img src="https://github.com/ChickenSoup269/imagesForRepo/blob/main/img_repo_extension_bookmarks/use_offline_img/extension_download_5.png?raw=true" width="full"  />
</p>

## Usage/Examples

| Parameter                  | Description                                                                              |
| :------------------------- | :--------------------------------------------------------------------------------------- |
| `Tìm kiếm`                 | Nhập từ khóa (Hỗ trợ tìm kiếm mờ).                                                       |
| `Lọc thư mục`              | Chọn thư mục từ thanh bên hoặc dropdown.                                                 |
| `Sắp xếp`                  | Ngày thêm, A-Z, Yêu thích, Truy cập nhiều, hoặc Tên miền.                                |
| `Quản lý thư mục`          | Tạo, sửa, xóa thư mục. Sử dụng Kéo & Thả ở thanh bên để tổ chức.                         |
| `Quản lý bookmark`         | Nhấn “⋮” để thao tác. Xem Chi tiết để mở modal xem trước trang web.                      |
| `Xuất/Nhập`                | Xuất ra JSON/HTML/CSV hoặc nhập vào với kiểm tra trùng lặp.                              |
| `Tùy chỉnh`                | Điều chỉnh giao diện (Tokyo Night, Monokai...), phông chữ hoặc ngôn ngữ.                 |
| `Xem trước Web`            | Xem nội dung trang web ngay trong extension qua modal (nút Chi tiết).                    |
| `Mở trong bảng điều khiển` | Mở bookmark trong bảng điều khiển bên cạnh (Side Panel).                                 |
| `Hành động mở nhanh`       | Chọn hành động mặc định khi nhấp vào biểu tượng tiện ích.                                |
| `Tags`                     | Lọc theo thẻ qua thanh bên hoặc Popup trình duyệt Thẻ.                                   |
| `Ghim lên đầu`             | Ghim các bookmark quan trọng lên trên cùng.                                              |
| `Kiểm tra tình trạng`      | Xác minh link sống/chết hoặc nghi ngờ.                                                   |
| `Lượt truy cập`            | Theo dõi và hiển thị số lần mở bookmark.                                                 |
| `Chatbot`                  | Điều khiển qua ngôn ngữ tự nhiên. Hỗ trợ Local AI (Ollama) và các nhà cung cấp phổ biến. |
| `Nguồn Favicon`            | Chọn giữa Google, DuckDuckGo hoặc Auto để lấy biểu tượng.                                |

## Video & screenshots

- (để tiết kiệm bạn hãy qua readme chính để xem, xin cảm ơn)

## Feedback

Nếu bạn có bất kỳ phản hồi nào, vui lòng liên hệ với mình tại thientran01345@icloud.com.

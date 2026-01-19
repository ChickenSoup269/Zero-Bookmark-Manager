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

## Introduction

Quản lý Bookmark là một tiện ích mở rộng Chrome, giúp đơn giản hóa việc tổ chức bookmark. Dễ dàng xem, tìm kiếm, sắp xếp và quản lý bookmark của bạn với giao diện dễ nhìn? Hỗ trợ chủ đề sáng/tối, hiển thị ngôn ngữ (Tiếng Anh/Tiếng Việt), và chức năng xuất/nhập để sao lưu và khôi phục liền mạch.

## Features

- **Xem Bookmark:** Duyệt qua bookmark theo dạng danh sách phẳng, cây thư mục hoặc chế độ chi tiết.
- **Tìm kiếm:** Tìm bookmark ngay lập tức bằng từ khóa (tiêu đề hoặc URL)..
- **Sắp xếp:** Sắp xếp bookmark theo ngày thêm, lần mở gần nhất, bảng chữ cái (A–Z, Z–A), yêu thích hoặc lượt truy cập nhiều nhất.
- **Quản lý Thư mục:** Tạo, xóa, hoặc di chuyển bookmark giữa các thư mục.
- **Chỉnh sửa Bookmark:** Thêm vào thư mục, đổi tên hoặc xóa dấu trang. Xem chi tiết, đánh dấu yêu thích, thêm thẻ (tags).
- **Xuất/Nhập:** Lưu bookmark dưới dạng JSON/HTML/CSV hoặc nhập vào bằng tệp JSON (tự động phát hiện trùng lặp dựa trên URL).
- **Giao diện (Themes):** Chuyển đổi giữa các chủ đề sáng, tối, dracula, one dark hoặc theo hệ thống.
- **Phông chữ:** Tùy chỉnh giao diện với các kiểu phông chữ khác nhau.
- **Đa ngôn ngữ:** Hỗ trợ tiếng Anh và tiếng Việt để mang lại trải nghiệm thân thiện hơn.
- **Kiểm tra tình trạng liên kết:** Xác minh tính khả dụng và an toàn của các liên kết đã đánh dấu của bạn.
- **Tạo mã QR cho Bookmark:** Tạo mã QR cho các dấu trang của bạn để dễ dàng chia sẻ và truy cập trên các thiết bị khác.
- **Chatbot (Beta):** Quản lý bookmark và kiểm soát tiện ích mở rộng bằng ngôn ngữ tự nhiên. Tạo, xóa và tổ chức bookmark và thư mục, thay đổi chủ đề, chế độ xem, v.v., tất cả từ giao diện chat.

## Running Tests

Để chạy thử nghiệm, đảm bảo môi trường sau:

- **Trình duyệt:** Google Chrome (phiên bản mới nhất).
- **Quyền truy cập:** Truy cập vào API bookmark của Chrome.

## Installation

Cài đặt Bookmark-Manager

```bash
  git clone https://github.com/ChickenSoup269/Bookmark-Manager.git
  cd Bookmark-Manager
```

### Step by step to use offline:

1. Clone repository hoặc tải bản phát hành (Releases) mà bạn muốn tại đây <a href="https://github.com/ChickenSoup269/Extension_Bookmark-Manager/releases">All Zero Bookmarks releases</a>.
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

| Parameter                        | Description                                                                                                                                                                                                                                                       |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tìm kiếm`                       | Nhập từ khóa vào ô tìm kiếm.                                                                                                                                                                                                                                      |
| `Lọc thư mục`                    | Chọn thư mục từ dropdown.                                                                                                                                                                                                                                         |
| `Sắp xếp`                        | Chọn tùy chọn sắp xếp.                                                                                                                                                                                                                                            |
| `Quản lý thư mục`                | Hiển thị tạo, sửa, xóa thư mục.                                                                                                                                                                                                                                   |
| `Quản lý bookmark`               | Nhấn vào biểu tượng “⋮” để thêm vào thư mục, đổi tên hoặc xóa. Xem chi tiết, quản lý thẻ (tags), đánh dấu yêu thích.                                                                                                                                              |
| `Xuất/Nhập`                      | Dùng phần Cài đặt (Settings) để xuất bookmarks ra JSON/HTML/CSV hoặc nhập vào với kiểm tra trùng lặp (dựa trên JSON).                                                                                                                                             |
| `Tùy chỉnh`                      | Điều chỉnh giao diện, phông chữ hoặc ngôn ngữ trong phần Cài đặt, chế độ hiển thị (Render view).                                                                                                                                                                  |
| `Chỉnh sửa trong tab mới`        | Sử dụng tiện ích trong chế độ xem web.                                                                                                                                                                                                                            |
| `Cài đặt lưu trữ ở local chrome` | Lưu dữ liệu tùy chỉnh cho tìm kiếm, chọn, sắp xếp, chế độ xem, trạng thái thư mục thu gọn, thẻ, và checkbox.                                                                                                                                                      |
| `Tags`                           | Chọn tùy chọn sắp xếp theo thẻ.                                                                                                                                                                                                                                   |
| `Ghim lên đầu`                   | Chọn bookmark ghim lên đầu trang                                                                                                                                                                                                                                  |
| `Kiểm tra tình trạng liên kết`   | Xác minh tình trạng liên kết bookmark qua cài đặt hoặc menu thả xuống.                                                                                                                                                                                            |
| `Tạo mã QR cho Bookmark`         | Tạo mã QR cho các bookmark của bạn từ menu thả xuống.                                                                                                                                                                                                             |
| `Chatbot`                        | Hiện hỗ trợ quản lý bookmark và thư mục (thêm, sửa, xóa, di chuyển, tạo/đổi tên/xóa thư mục), điều khiển giao diện (chủ đề, chế độ xem, sắp xếp) và có thể trả lời các câu hỏi chung. Xem Hướng dẫn Trợ giúp trong chat để biết tất cả các lệnh. (phiên bản beta) |

## How to get Gemini APi ?

1. Đầu tiên các bạn cần có API key của Gemini (bắt buộc) và tên model của nó
2. Lấy API key ở tại trang web này
   https://aistudio.google.com/prompts/new_chat

3. Chọn model của bạn ở đây và get API key là xong

Video hướng dẫn

## Video & screenshots

- (để tiết kiệm bạn hãy qua readme chính để xem, xin cảm ơn)

## Feedback

Nếu bạn có bất kỳ phản hồi nào, vui lòng liên hệ với chúng tôi tại thientran01345@icloud.com.

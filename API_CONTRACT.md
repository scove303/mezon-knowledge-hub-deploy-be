# Tài Liệu Giao Tiếp API - Mezon Knowledge Hub

Tài liệu này quy định cấu trúc và các điểm kết nối (endpoints) giữa Frontend (Dashboard) và Backend.
- **Base URL (Local):** `http://localhost:3000/api/v1`
- **Môi trường:** JSON (`Content-Type: application/json`)

---

## 1. QUY ƯỚC CHUNG (GLOBAL FORMAT)
Tất cả các API trả về BẮT BUỘC phải tuân theo cấu trúc JSON sau:

### ✅ Khi thành công (HTTP Status 200/201)
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { ... } // Có thể là object hoặc array
}
```

### ❌ Khi thất bại (HTTP Status 400/401/403/500)
```json
{
  "success": false,
  "message": "Mô tả chi tiết lỗi để Frontend hiện thông báo",
  "data": null
}
```

---

## 2. NHÓM API XÁC THỰC (AUTH)
### 2.1. Đăng nhập

* **Method:** `POST /auth/login`
* **Mô tả:** Frontend gửi user/pass để lấy cặp Token đăng nhập (Access Token & Refresh Token).
* **Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1R...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "ADMIN"
    }
  }
}
```

### 2.2. Làm mới Token (Refresh Token)

* **Method:** `POST /auth/refresh`
* **Mô tả:** Frontend gửi `refreshToken` để làm mới `accessToken` khi token cũ đã hết hạn (thông thường accessToken sống 15 phút, refreshToken sống 7 ngày).
* **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1R..."
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1R..." // Có thể trả về token mới hoặc giữ nguyên
  }
}
```

---

## 3. NHÓM API KIẾN THỨC (KNOWLEDGE BASE)
### 3.1. Lấy danh sách Q&A

* **Method:** `GET /knowledge`
* **Mô tả:** Lấy danh sách các câu hỏi để hiển thị trên bảng Dashboard. Có phân trang.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Query Parameters:** `?page=1&limit=10&search=keyword`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Lấy dữ liệu thành công",
  "data": {
    "items": [
      {
        "id": 1,
        "question": "Làm sao để tạo server?",
        "answer": "Để tạo server bạn cần...",
        "author_name": "admin",
        "tags": ["hướng dẫn", "server"],
        "is_active": true,
        "created_at": "2026-07-13T10:00:00Z"
      }
    ],
    "pagination": {
      "totalRecords": 45,
      "currentPage": 1,
      "totalPages": 5
    }
  }
}
```

### 3.2. Thêm mới một Q&A

* **Method:** `POST /knowledge`
* **Mô tả:** Lưu câu hỏi và câu trả lời mới vào DB để dạy Bot.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
```json
{
  "question": "Bot có thể trả lời những gì?",
  "answer": "Bot có thể đọc dữ liệu từ MySQL để trả lời.",
  "tags": ["bot", "tính năng"]
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Tạo dữ liệu thành công",
  "data": {
    "id": 2,
    "question": "Bot có thể trả lời những gì?"
  }
}
```

---

## 4. NHÓM API CẤU HÌNH BOT (BOT CONFIG)
### 4.1. Lấy cấu hình hiện tại

* **Method:** `GET /bot/config`
* **Mô tả:** Lấy các thiết lập hệ thống của Bot.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "active_channels": ["channel_id_1", "channel_id_2"],
    "bot_personality": "Chuyên nghiệp, ngắn gọn"
  }
}
```

### 4.2. Cập nhật cấu hình Bot

* **Method:** `PUT /bot/config`
* **Mô tả:** Sửa thiết lập của Bot từ Dashboard.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body (Gửi lên những trường cần update):**
```json
{
  "active_channels": ["channel_id_1", "channel_id_2", "channel_id_3"]
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Cập nhật cấu hình thành công",
  "data": null
}
```

---

## 5. NHÓM API THƯ MỤC VÀ TÀI LIỆU CÁ NHÂN (PERSONAL DATA & FILE MANAGER)
Nhóm API này quản lý cây thư mục và file Markdown đã được lưu của riêng từng người dùng phục vụ cho tính năng **Cá nhân hóa (Personalization)**.

### 5.1. Lấy danh sách thư mục ảo của người dùng

* **Method:** `GET /folders`
* **Mô tả:** Lấy danh sách toàn bộ các thư mục ảo mà người dùng đang sở hữu (gồm thông tin metadata và danh sách file con của thư mục đó).
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Lấy danh sách thư mục thành công",
  "data": [
    {
      "id": "folder-1",
      "name": "🐍 Lộ trình Python cho người mới",
      "type": "roadmap",
      "created_at": "2026-07-10T08:00:00Z",
      "files": [
        {
          "id": "file-1-1",
          "name": "Tong_quan.md",
          "created_at": "2026-07-10T08:05:00Z"
        }
      ]
    }
  ]
}
```

### 5.2. Khởi tạo thư mục ảo mới

* **Method:** `POST /folders`
* **Mô tả:** Tạo một thư mục ảo rỗng cho người dùng.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
```json
{
  "name": "📂 Nghiên cứu AI Agents",
  "type": "roadmap" // Có thể là: roadmap, document, video, hoặc general
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Tạo thư mục thành công",
  "data": {
    "id": "folder-12345",
    "name": "📂 Nghiên cứu AI Agents",
    "type": "roadmap",
    "created_at": "2026-07-13T14:30:00Z",
    "files": []
  }
}
```

### 5.3. Xóa thư mục ảo

* **Method:** `DELETE /folders/:id`
* **Mô tả:** Xóa thư mục và toàn bộ các file bên trong của người dùng đó khỏi database.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đã xóa thư mục và các file liên quan thành công",
  "data": null
}
```

### 5.4. Lấy chi tiết nội dung một tài liệu (File Viewer)

* **Method:** `GET /files/:id`
* **Mô tả:** Lấy chi tiết nội dung Markdown, link video gốc, danh sách timestamp (nếu là video summary) của một file.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Lấy chi tiết file thành công",
  "data": {
    "id": "file-3-1",
    "name": "Video_Summary_SystemDesign.md",
    "content": "# Tóm Tắt Video: Kiến Trúc Hệ Thống...",
    "video_url": "https://www.youtube.com/watch?v=xpDnVSmNFX0",
    "created_at": "2026-07-13T10:15:00Z",
    "timestamps": [
      { "time": "00:00", "seconds": 0, "text": "Giới thiệu tổng quan" },
      { "time": "03:15", "seconds": 195, "text": "Monolith vs Microservices" }
    ]
  }
}
```

### 5.5. Cập nhật nội dung một tài liệu (File Editor)

* **Method:** `PUT /files/:id`
* **Mô tả:** Lưu lại nội dung Markdown sau khi người dùng chỉnh sửa trực tiếp trên Web Dashboard.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
```json
{
  "content": "# Nội dung Markdown mới cập nhật...\n..."
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đã cập nhật nội dung tài liệu",
  "data": {
    "id": "file-3-1",
    "updated_at": "2026-07-13T14:35:00Z"
  }
}
```

### 5.6. Xóa một tài liệu

* **Method:** `DELETE /files/:id`
* **Mô tả:** Xóa một file Markdown cụ thể ra khỏi thư mục ảo.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response (Success):**
```json
{
  "success": true,
  "message": "Xóa file thành công",
  "data": null
}
```

---

## 6. NHÓM API TRỢ LÝ TRÍ TUỆ NHÂN TẠO (AI SERVICES)
Nhóm API này xử lý yêu cầu cào dữ liệu, gọi Google Gemini để phân tích, biên soạn và lưu kết quả vào tài khoản cá nhân của người dùng.

### 6.1. Yêu cầu tạo lộ trình học từ Internet (Prompt-to-Folder)

* **Method:** `POST /ai/roadmap`
* **Mô tả:** Người dùng gửi chủ đề cần tìm hiểu. Hệ thống tự động quét web, biên soạn tài liệu và lưu thành folder mới.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
```json
{
  "topic": "Học máy cơ bản cho Data Scientist",
  "folder_name": "🤖 Khóa học Machine Learning"
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đang tổng hợp lộ trình học tập, vui lòng kiểm tra lại sau vài giây",
  "data": {
    "folder_id": "folder-ml-101",
    "folder_name": "🤖 Khóa học Machine Learning"
  }
}
```

### 6.2. Tiêu hóa & tóm tắt file tài liệu tải lên (Doc-to-Summary)

* **Method:** `POST /ai/digest`
* **Mô tả:** Nhận file tài liệu vật lý từ người dùng, trích xuất text, gọi AI biên soạn và lưu vào thư mục ảo chỉ định.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Content-Type:** `multipart/form-data`
* **Request Body:**
  * `file`: (Tệp nhị phân .pdf hoặc .docx)
  * `folder_id`: "folder-1" (Thư mục đích lưu trữ file tóm tắt)
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đã bóc tách tài liệu thành công",
  "data": {
    "files_created": [
      {
        "id": "file-summary-12",
        "name": "Executive_Summary.md"
      },
      {
        "id": "file-summary-13",
        "name": "Action_Items.md"
      }
    ]
  }
}
```

### 6.3. Tóm tắt video Youtube (Video-to-Markdown)

* **Method:** `POST /ai/youtube`
* **Mô tả:** Bóc tách phụ đề và tóm tắt video Youtube theo mốc thời gian.
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=xpDnVSmNFX0",
  "folder_id": "folder-3"
}
```
* **Response (Success):**
```json
{
  "success": true,
  "message": "Đang lấy phụ đề và tóm tắt video...",
  "data": {
    "file_id": "file-video-sum-99",
    "name": "Video_Summary_SystemDesign.md"
  }
}
```

---

## 7. GIAO TIẾP SỰ KIỆN BOT MEZON (MEZON BOT SDK WEBHOOKS & EVENTS)
Phần này định nghĩa các cấu trúc sự kiện (Events) mà Bot Backend nhận được khi lắng nghe kết nối thời gian thực (WebSockets/Gateway) hoặc thông qua HTTP Webhook Callback từ máy chủ Mezon Developer Portal.

### 7.1. Sự kiện Nhận tin nhắn (Message Event)
* **Event Type:** `CHANNEL_MESSAGE`
* **Mô tả:** Kích hoạt khi có người dùng gõ lệnh chat trong kênh Mezon (Ví dụ: `/roadmap`, `/youtube`, `/digest`, `/dashboard`, `/help`).
* **Event Payload:**
```json
{
  "event_type": "CHANNEL_MESSAGE",
  "sender": {
    "user_id": 9876543210,
    "username": "hoang_minh",
    "display_name": "Minh Hoàng"
  },
  "channel_id": "chan-00129",
  "message_id": "msg-12345678",
  "content": "/roadmap topic:\"Lập trình Python\" folder_name:\"Python_Basic\"",
  "attachments": [],
  "timestamp": "2026-07-13T14:40:00Z"
}
```

### 7.2. Sự kiện Đính kèm tài liệu (Document Upload Event)
* **Event Type:** `DOCUMENT_ATTACHMENT`
* **Mô tả:** Kích hoạt khi người dùng tải lên tài liệu (`.pdf`, `.docx`) đính kèm câu lệnh `/digest` trong phòng chat.
* **Event Payload:**
```json
{
  "event_type": "DOCUMENT_ATTACHMENT",
  "sender": {
    "user_id": 9876543210,
    "username": "hoang_minh"
  },
  "channel_id": "chan-00129",
  "message_id": "msg-987654",
  "content": "/digest",
  "attachments": [
    {
      "id": "att-pdf-99",
      "file_name": "Lap_trinh_huong_doi_tuong.pdf",
      "file_size": 2048576,
      "url": "https://cdn.mezon.ai/attachments/hoang_minh/Lap_trinh_huong_doi_tuong.pdf",
      "mime_type": "application/pdf"
    }
  ],
  "timestamp": "2026-07-13T14:42:00Z"
}
```

### 7.3. Sự kiện Click nút bấm tương tác (Button Interaction Event)
* **Event Type:** `BUTTON_INTERACTION`
* **Mô tả:** Kích hoạt khi người dùng click vào các nút bấm trong bảng tin nhắn Rich Embed do Bot gửi về (Ví dụ: Nút `[📁 Đọc ngay trên Mezon]` hoặc `[🌐 Mở Web Dashboard]`).
* **Event Payload:**
```json
{
  "event_type": "BUTTON_INTERACTION",
  "user_id": 9876543210,
  "channel_id": "chan-00129",
  "message_id": "msg-embed-1122",
  "button_id": "btn-open-web",
  "custom_id": "action:open_dashboard;folder_id:folder-1;file_id:file-1-1",
  "timestamp": "2026-07-13T14:45:00Z"
}
```

---

## 8. CƠ SỞ DỮ LIỆU SQL (DATABASE SCHEMA)
Phần này mô tả cấu trúc bảng trong cơ sở dữ liệu quan hệ MySQL dùng để lưu trữ cấu trúc thư mục ảo cá nhân hóa và các tài liệu tri thức dưới dạng Markdown.

```sql
-- 1. Bảng users (Lưu thông tin người dùng đồng bộ từ Mezon)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY, -- ID người dùng Mezon (ví dụ: 9876543210)
    username VARCHAR(100) NOT NULL, -- Tên tài khoản người dùng
    display_name VARCHAR(100) DEFAULT NULL, -- Tên hiển thị của người dùng
    role VARCHAR(20) DEFAULT 'USER', -- Quyền: 'USER', 'ADMIN'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng folders (Quản lý thư mục ảo cá nhân hóa theo từng User)
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(50) PRIMARY KEY, -- Sử dụng UUID hoặc chuỗi string định danh (ví dụ: folder-123)
    name VARCHAR(255) NOT NULL, -- Tên thư mục (ví dụ: Lộ trình Python)
    type VARCHAR(20) NOT NULL, -- Thể loại: 'roadmap', 'document', 'video', 'general'
    user_id BIGINT NOT NULL,   -- Khóa ngoại liên kết đến bảng users để cá nhân hóa
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Bảng knowledge_files (Quản lý các file tài liệu Markdown nằm trong thư mục)
CREATE TABLE IF NOT EXISTS knowledge_files (
    id VARCHAR(50) PRIMARY KEY, -- Định danh file (ví dụ: file-1-1)
    folder_id VARCHAR(50) NOT NULL, -- Khóa ngoại liên kết với thư mục chứa nó
    name VARCHAR(255) NOT NULL, -- Tên file (ví dụ: Tong_quan.md)
    markdown_content LONGTEXT NOT NULL, -- Nội dung chữ Markdown do Gemini sinh ra hoặc user sửa
    video_url VARCHAR(500) DEFAULT NULL, -- Đường link video gốc (nếu bóc tách từ YouTube)
    timestamps_json JSON DEFAULT NULL, -- Lưu danh sách mốc thời gian dạng JSON để tua video
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

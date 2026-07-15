-- ====================================================================
-- DATABASE SCHEMA: MEZON KNOWLEDGE HUB BOT (AI-KHB)
-- ====================================================================

-- 1. Bảng users (Lưu thông tin người dùng đồng bộ từ Mezon)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, -- ID nội bộ
    username VARCHAR(100) NOT NULL UNIQUE, -- Tên tài khoản (cho Web Dashboard)
    display_name VARCHAR(100) DEFAULT NULL, -- Tên hiển thị
    hashed_password VARCHAR(255) NOT NULL, -- Mật khẩu đã mã hóa
    role VARCHAR(20) DEFAULT 'USER', -- Quyền: 'USER', 'ADMIN'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng folders (Quản lý thư mục ảo cá nhân hóa theo từng User)
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(50) PRIMARY KEY, -- Định danh folder (ví dụ: folder-123)
    name VARCHAR(255) NOT NULL, -- Tên thư mục
    type VARCHAR(20) DEFAULT 'general', -- Thể loại: 'roadmap', 'document', 'video', 'general'
    user_id INT NOT NULL,   -- Khóa ngoại liên kết bảng users
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

-- Thêm các chỉ mục (Indexes) để tối ưu hóa hiệu năng truy vấn cây thư mục
CREATE INDEX idx_folders_user ON folders(user_id);
CREATE INDEX idx_files_folder ON knowledge_files(folder_id);
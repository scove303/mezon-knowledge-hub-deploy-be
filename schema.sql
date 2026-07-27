CREATE DATABASE IF NOT EXISTS mezon_knowledge_hub;
USE mezon_knowledge_hub;

-- 1. Bảng users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) DEFAULT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng folders
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'general',
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Bảng folder_roots (Liên kết Thư mục Gốc với User)
CREATE TABLE IF NOT EXISTS folder_roots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    folder_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_root_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_root_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 4. Bảng knowledge_files
CREATE TABLE IF NOT EXISTS knowledge_files (
    id VARCHAR(50) PRIMARY KEY,
    folder_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    markdown_content LONGTEXT NOT NULL,
    video_url VARCHAR(500) DEFAULT NULL,
    timestamps_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_folders_user ON folders(user_id);
CREATE INDEX idx_folder_roots_user ON folder_roots(user_id);
CREATE INDEX idx_files_folder ON knowledge_files(folder_id);
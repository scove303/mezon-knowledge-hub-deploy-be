// src/mocks/DATA_MOCK.ts

export interface TimestampItem {
  time: string;
  seconds: number;
  text: string;
}

export interface FileDetailItem {
  id: string;
  folderId: string;
  folderName: string;
  name: string;
  createdAt: string;
  content: string;
  videoUrl: string | null;
  timestamps: TimestampItem[];
}

export interface FolderFileItem {
  id: string;
  name: string;
  created_at: string;
}

export interface FolderItem {
  id: string;
  name: string;
  type: string;
  created_at: string;
  files: FolderFileItem[];
}

export interface RevisionItem {
  id: string;
  created_at: string;
  content: string;
}

export const MOCK_FOLDERS: FolderItem[] = [
  {
    id: "folder-python-01",
    name: "🐍 Lộ trình Python cho người mới",
    type: "roadmap",
    created_at: "2026-08-01T08:00:00Z",
    files: [
      {
        id: "file-py-101",
        name: "01_Tong_quan_ngon_ngu_Python.md",
        created_at: "2026-08-01T08:05:00Z",
      },
      {
        id: "file-py-102",
        name: "02_Cấu_trúc_dữ_liệu_và_Toán_học.md",
        created_at: "2026-08-02T09:15:00Z",
      },
    ],
  },
];

export const MOCK_FILES_DETAIL: Record<string, FileDetailItem> = {
  "file-py-101": {
    id: "file-py-101",
    folderId: "folder-python-01",
    folderName: "🐍 Lộ trình Python cho người mới",
    name: "01_Tong_quan_ngon_ngu_Python.md",
    createdAt: "2026-08-01 08:05",
    content: `# Giới thiệu về Ngôn ngữ Lập trình Python

Python là một ngôn ngữ lập trình bậc cao, interpreted, có cú pháp rõ ràng và hướng tới việc giúp người lập trình viết mã nguồn ngắn gọn, dễ đọc.

## 1. Triết lý thiết kế của Python
* **Đơn giản và rõ ràng**: Ưu tiên tính dễ đọc của mã nguồn.
* **Cổ điển và Bền vững**: Hạn chế các cú pháp phức tạp không cần thiết.
* **Đa năng**: Sử dụng trong Web Development, Data Science, AI, Automation.

## 2. Cú pháp cơ bản
Dưới đây là đoạn mã khởi tạo chương trình đầu tiên:

\`\`\`python
def chao_mung(ten: str) -> str:
    """Hàm trả về lời chào người dùng"""
    return f"Chào mừng {ten} đến với lộ trình học Python vĩnh viễn!"

if __name__ == "__main__":
    ket_qua = chao_mung("Lập trình viên")
    print(ket_qua)
\`\`\`

## 3. Bảng so sánh Kiểu dữ liệu trong Python

| Kiểu dữ liệu | Mô tả | Tính biến đổi (Mutable) | Ví dụ |
| :--- | :--- | :--- | :--- |
| **int** | Số nguyên | Không (Immutable) | \`x = 100\` |
| **list** | Danh sách có thứ tự | Có (Mutable) | \`arr = [1, 2, 3]\` |
| **dict** | Cặp Khóa - Giá trị | Có (Mutable) | \`data = {"id": 1}\` |
| **tuple** | Bảng hằng số | Không (Immutable) | \`point = (10, 20)\` |

### 3.1. Lưu ý về Bộ nhớ (Memory Management)
Python sử dụng cơ chế **Reference Counting** kết hợp **Garbage Collector** để dọn dẹp các vùng nhớ không còn đối tượng trỏ tới.`,
    videoUrl: null,
    timestamps: [],
  },
};

export const MOCK_REVISONS: Record<string, RevisionItem[]> = {
  "file-py-101": [
    {
      id: "rev-py-101-v1",
      created_at: "2026-08-01T08:05:00Z",
      content:
        "# Giới thiệu về Ngôn ngữ Lập trình Python\n\nNội dung sơ khai ban đầu.",
    },
  ],
};

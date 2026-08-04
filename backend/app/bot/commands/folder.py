import json
import re
from sqlmodel import Session
from app.crud.folder import get_folders_by_user,get_folder
from app.core.database import engine
from app.core.config import settings


def extract_file_number(file_info) -> int:

    if isinstance(file_info, dict):
        name = file_info.get("name", "")
    elif isinstance(file_info, str):
        name = file_info
    else:
        name = getattr(file_info, "name", "") or ""

    name_str = str(name)
    match = re.search(r'\d+', name_str)
    return int(match.group()) if match else 9999


def list_all_folder(user_id: int) -> str:
    # 1. Fetch danh sách folders của user
    with Session(engine) as session:
        folders = get_folders_by_user(session=session, user_id=user_id)

    # 2. Xử lý trường hợp chưa có Folder nào
    if not folders:
        return (
            "🗂️ **No folders found!**\n\n"
            "You haven't created any learning roadmaps or folders yet.\n\n"
            "💡 **To get started, try typing:**\n"
            "`/roadmap [topic]` — *e.g., `/roadmap Python for beginners`*"
        )

    # 3. Lấy base URL cho Web UI
    base_web_url = getattr(settings, "WEB_APP_URL", "https://localhost:3001")

    #  Format danh sách Folders thành Markdown
    folder_lines = []
    for idx, folder in enumerate(folders, 1):
        # Đếm số lượng bài học trong folder
        files_count = len(getattr(folder, "files", []))
        
        # Link mở folder trên Web UI
        web_ui_url = f"{base_web_url}/workspace/folders/{folder.id}"
        
        folder_lines.append(
            f"{idx}. 📁 **[{folder.name}]({web_ui_url})**\n"
            f"   └── 📊 `{files_count} bài học` • ID: `{folder.id}`"
        )

    folder_list_str = "\n".join(folder_lines)
    total_folders = len(folders)

    # 5. Ghép tin nhắn hoàn chỉnh
    message_response = (
        f"📚 **Danh sách Thư mục Học tập của bạn ({total_folders}):**\n\n"
        f"{folder_list_str}\n\n"
        f"💡 *Bấm vào tên thư mục để mở và xem nội dung chi tiết trên Web!*"
    )

    return message_response




def get_folder_by_id(user_id: int, folder_id: str) -> str:
    # 1. Query database trong Session
    with Session(engine) as session:
        folder = get_folder(session=session, folder_id=folder_id, user_id=user_id)

        # 2. Xử lý trường hợp không tìm thấy folder
        if not folder:
            return (
                f"❌ **Không tìm thấy thư mục!**\n\n"
                f"Thư mục có ID `{folder_id}` không tồn tại hoặc bạn không có quyền truy cập."
            )

        # 3. Lấy base URL cho Web UI
        base_web_url = getattr(settings, "WEB_APP_URL", "https://your-app-domain.com")
        web_ui_url = f"{base_web_url}/workspace/folders/{folder.id}"

        # 4. Lấy danh sách bài học (files)
        raw_files = list(getattr(folder, "files", []) or [])

        if not raw_files:
            return (
                f"📁 **Thư mục:** `{folder.name}`\n"
                f"🆔 **ID:** `{folder.id}`\n\n"
                f"*(Thư mục này hiện chưa có bài học nào)*\n\n"
                f"👉 **[Bấm vào đây để mở trên Web UI]({web_ui_url})**"
            )

        # 5. Trích xuất cả 'name/title' VÀ 'id' của từng file
        extracted_files = []
        for f in raw_files:
            if isinstance(f, dict):
                file_name = f.get("title") or f.get("name") or "Untitled File"
                file_id = f.get("id") or "N/A"
            else:
                file_name = getattr(f, "name", None) or getattr(f, "title", "Untitled File")
                file_id = getattr(f, "id", "N/A")

            extracted_files.append({
                "name": file_name,
                "id": file_id
            })

        # 6. Sort chuẩn thứ tự bài học (Bài 1 -> Bài 12)
        sorted_files = sorted(extracted_files, key=extract_file_number)

        # 7. Render Cây thư mục (Folder Tree) kèm File ID
        tree_lines = [f"📁 **{folder.name}/**"]
        total_files = len(sorted_files)

        for i, item in enumerate(sorted_files):
            is_last = (i == total_files - 1)
            branch = "└── 📄 " if is_last else "├── 📄 "
            # Hiển thị tên bài học kèm ID để user dễ dùng lệnh /file-id <file_id>
            tree_lines.append(f"{branch}{item['name']}  [ID: {item['id']}]")

        tree_str = "\n".join(tree_lines)
        folder_id_val = folder.id
        folder_name_val = folder.name

    # 8. Ghép tin nhắn Markdown phản hồi
    return (
        f"📖 **Chi tiết Thư mục Học tập:** `{folder_name_val}`\n\n"
        f"```text\n"
        f"{tree_str}\n"
        f"```\n"
        f"📊 **Tổng số bài học:** `{total_files} bài`\n"
        f"🆔 **Folder ID:** `{folder_id_val}`\n\n"
        f"💡 *Mẹo: Bạn có thể copy File ID ở trên và gõ `/file-id <file_id>` để đọc bài ngay trong Bot!*\n"
        f"👉 **[Bấm vào đây để mở và đọc chi tiết trên Web UI]({web_ui_url})**"
    )
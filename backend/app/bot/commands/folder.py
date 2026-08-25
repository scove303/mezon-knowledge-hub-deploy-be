import json
import re
from typing import Any
from sqlmodel import Session
from app.crud.folder import get_folders_by_user, get_folder
from app.core.database import engine
from app.core.config import settings


def extract_file_number(file_info: Any) -> int:
    if isinstance(file_info, dict):
        name = file_info.get("name") or file_info.get("title") or ""
    elif isinstance(file_info, str):
        name = file_info
    else:
        name = getattr(file_info, "name", None) or getattr(file_info, "title", "") or ""

    name_str = str(name)
    match = re.search(r'\d+', name_str)
    return int(match.group()) if match else 9999


def list_all_folder(user_id: int) -> str:
    # 1. Fetch user's folders inside session
    with Session(engine) as session:
        folders = get_folders_by_user(session=session, user_id=user_id)
        
        # Prepare data while session is active
        folder_data = []
        for folder in folders:
            # Handle both title and name field fallback
            name = getattr(folder, "title", None) or getattr(folder, "name", "Untitled Folder")
            files_count = len(getattr(folder, "files", []) or [])
            folder_data.append({
                "id": folder.id,
                "name": name,
                "files_count": files_count
            })

    # 2. Return message if empty
    if not folder_data:
        return (
            "🗂️ **No folders found!**\n\n"
            "You haven't created any learning roadmaps or folders yet.\n\n"
            "💡 **To get started, try typing:**\n"
            "`/roadmap [topic]` — *e.g., `/roadmap Python for beginners`*"
        )

    # 3. Base URL resolution
    base_web_url = getattr(settings, "WEB_APP_URL", getattr(settings, "WEB_FRONTEND_URL", "https://localhost:3001"))

    # 4. Format folders list
    folder_lines = []
    for idx, item in enumerate(folder_data, 1):
        web_ui_url = f"{base_web_url}/workspace/folders/{item['id']}"
        folder_lines.append(
            f"{idx}. 📁 **[{item['name']}]({web_ui_url})**\n"
            f"   └── 📊 `{item['files_count']} bài học` • ID: `{item['id']}`"
        )

    folder_list_str = "\n".join(folder_lines)
    total_folders = len(folder_data)

    return (
        f"📚 **Danh sách Thư mục Học tập của bạn ({total_folders}):**\n\n"
        f"{folder_list_str}\n\n"
        f"💡 *Bấm vào tên thư mục để mở và xem nội dung chi tiết trên Web!*"
    )


def get_folder_by_id(user_id: int, folder_id: str) -> str:
    base_web_url = getattr(settings, "WEB_APP_URL", getattr(settings, "WEB_FRONTEND_URL", "https://localhost:3001"))
    web_ui_url = f"{base_web_url}/workspace/folders/{folder_id}"

    # 1. Query database and extract fields inside session
    with Session(engine) as session:
        folder = get_folder(session=session, folder_id=folder_id, user_id=user_id)

        if not folder:
            return (
                f"❌ **Không tìm thấy thư mục!**\n\n"
                f"Thư mục có ID `{folder_id}` không tồn tại hoặc bạn không có quyền truy cập."
            )

        # Extract name using 'title' first (DB column is title)
        folder_name = getattr(folder, "title", None) or getattr(folder, "name", "Untitled Folder")
        folder_id_val = folder.id
        raw_files = list(getattr(folder, "files", []) or [])

        # Process files inside session
        extracted_files = []
        for f in raw_files:
            if isinstance(f, dict):
                file_name = f.get("title") or f.get("name") or "Untitled File"
                file_id = f.get("id") or "N/A"
            else:
                file_name = getattr(f, "title", None) or getattr(f, "name", "Untitled File")
                file_id = getattr(f, "id", "N/A")

            extracted_files.append({
                "name": file_name,
                "id": file_id
            })

    # 2. Handle empty folder
    if not extracted_files:
        return (
            f"📁 **Thư mục:** `{folder_name}`\n"
            f"🆔 **ID:** `{folder_id_val}`\n\n"
            f"*(Thư mục này hiện chưa có bài học nào)*\n\n"
            f"👉 **[Bấm vào đây để mở trên Web UI]({web_ui_url})**"
        )

    # 3. Sort files
    sorted_files = sorted(extracted_files, key=extract_file_number)
    total_files = len(sorted_files)

    # 4. Render Folder Tree
    tree_lines = [f"📁 **{folder_name}/**"]
    for i, item in enumerate(sorted_files):
        is_last = (i == total_files - 1)
        branch = "└── 📄 " if is_last else "├── 📄 "
        tree_lines.append(f"{branch}{item['name']}  [ID: {item['id']}]")

    tree_str = "\n".join(tree_lines)

    # 5. Build final response
    return (
        f"📖 **Chi tiết Thư mục Học tập:** `{folder_name}`\n\n"
        f"```text\n"
        f"{tree_str}\n"
        f"```\n"
        f"📊 **Tổng số bài học:** `{total_files} bài`\n"
        f"🆔 **Folder ID:** `{folder_id_val}`\n\n"
        f"💡 *Mẹo: Bạn có thể copy File ID ở trên và gõ `/file-id <file_id>` để đọc bài ngay trong Bot!*\n"
        f"👉 **[Bấm vào đây để mở và đọc chi tiết trên Web UI]({web_ui_url})**"
    )
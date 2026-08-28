import json
import re
from typing import Any
from sqlmodel import Session
from app.crud.folder import get_folders_by_user, get_folder
from app.core.database import engine
from app.core.config import settings
from app.bot.utils.embeds import (
    build_folder_list_embed,
    build_folder_detail_embed,
    build_status_embed,
    build_error_embed,
)
from mezon_sdk.models import InteractiveMessageProps


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


def list_all_folder(user_id: int) -> InteractiveMessageProps:
    with Session(engine) as session:
        folders = get_folders_by_user(session=session, user_id=user_id)
        
        folder_data = []
        for folder in folders:
            name = getattr(folder, "title", None) or getattr(folder, "name", "Untitled Folder")
            files_count = len(getattr(folder, "files", []) or [])
            folder_data.append({
                "id": folder.id,
                "name": name,
                "files_count": files_count
            })

    if not folder_data:
        return build_error_embed(
            "🗂️ Chưa có thư mục nào!",
            "Bạn chưa tạo lộ trình học tập nào.\n\n💡 Gõ `/roadmap [chủ đề]` để bắt đầu!"
        )

    base_web_url = getattr(settings, "WEB_APP_URL", getattr(settings, "WEB_FRONTEND_URL", "https://localhost:3001"))
    return build_folder_list_embed(folder_data, base_web_url)


def get_folder_by_id(user_id: int, folder_id: str) -> InteractiveMessageProps:
    base_web_url = getattr(settings, "WEB_APP_URL", getattr(settings, "WEB_FRONTEND_URL", "https://localhost:3001"))
    web_ui_url = f"{base_web_url}/workspace/folders/{folder_id}"

    with Session(engine) as session:
        folder = get_folder(session=session, folder_id=folder_id, user_id=user_id)

        if not folder:
            return build_error_embed(
                "❌ Không tìm thấy thư mục!",
                f"Thư mục `{folder_id}` không tồn tại hoặc bạn không có quyền truy cập."
            )

        folder_name = getattr(folder, "title", None) or getattr(folder, "name", "Untitled Folder")
        folder_id_val = folder.id
        raw_files = list(getattr(folder, "files", []) or [])

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

    if not extracted_files:
        return build_folder_detail_embed(folder_name, folder_id_val, [], base_web_url)

    return build_folder_detail_embed(folder_name, folder_id_val, extracted_files, base_web_url)
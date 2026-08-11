import json
import re
from sqlmodel import Session
from mezon_sdk.models import ChannelMessageContent

from app.core.database import engine
from app.bot.client import client
from app.bot.commands.roadmap import run_roadmap_service


def build_folder_tree_message(folder_name: str, folder_id: str, files: list) -> str:
    web_ui_url = f"http://localhost:3001"

    # 1. Trích xuất danh sách (Object/Dict -> Tên string)
    file_names = [
        f.get("title") or f.get("name") if isinstance(f, dict) else getattr(f, "name", "Untitled")
        for f in files
    ]

    # 2. Sort chuẩn theo số nguyên (Tránh lỗi Bài 10 đứng trước Bài 2)
    sorted_files = sorted(
        file_names, 
        key=lambda name: int(m.group()) if (m := re.search(r'\d+', name)) else 999
    )

    # 3. Vẽ cây thư mục
    tree_lines = [f"📁 **{folder_name}/**"]
    total = len(sorted_files)

    for i, name in enumerate(sorted_files):
        branch = "└── 📄 " if i == total - 1 else "├── 📄 "
        tree_lines.append(f"{branch}{name}")

    tree_str = "\n".join(tree_lines)

    return (
        f"🎉 **Lộ trình học tập đã được tạo thành công!**\n\n"
        f"### 🗂️ Cấu trúc thư mục:\n"
        f"```text\n"
        f"{tree_str}\n"
        f"```\n"
        f"📊 **Tổng số bài học:** `{total} bài`\n\n"
        f"👉 **[Bấm vào đây để mở và đọc chi tiết trên Web UI]({web_ui_url})**"
    )


async def process_roadmap_task(channel_id: str, content: str, user_id: int) -> None:
    try:
        # 1. Gọi service sinh roadmap
        with Session(engine) as session:
            response_data = await run_roadmap_service(
                content,
                user_id=user_id,
                session=session,
                folder_name=content
            )

        # 2. Xử lý dữ liệu trả về từ service
        folder_name = content
        folder_id = ""
        files = []

        if isinstance(response_data, dict):
            # Lấy data payload (hỗ trợ cả response trả về từ FastAPI custom response hoặc dict trực tiếp)
            data_payload = response_data.get("data", response_data)
            
            folder_name = data_payload.get("folder_name", content)
            folder_id = data_payload.get("folder_id", "")
            files = data_payload.get("files", []) or data_payload.get("tree", [])
        elif hasattr(response_data, "files"):
            folder_name = getattr(response_data, "name", content)
            folder_id = getattr(response_data, "id", "")
            files = getattr(response_data, "files", [])

        # 3. Tạo message chứa Folder Tree + Web Link
        if files:
            full_text = build_folder_tree_message(folder_name, folder_id, files)
        else:
            # Fallback nếu không parse được danh sách file
            full_text = f"✅ **Đã khởi tạo xong Folder:** `{folder_name}`\n\n*(Không tìm thấy bài học chi tiết)*"

        # 4. Lấy channel & Gửi tin nhắn qua Mezon Client
        channel = await client.channels.fetch(channel_id)
        
        await channel.send(
            content=ChannelMessageContent(t=full_text)
        )

    except Exception as e:
        print(f"[WORKER ERROR] Roadmap generation failed: {e}", flush=True)
        try:
            channel = await client.channels.fetch(channel_id)
            await channel.send(
                content=ChannelMessageContent(
                    t=f"❌ **Đã xảy ra lỗi khi tạo lộ trình:** {str(e)}"
                )
            )
        except Exception as send_err:
            print(f"[WORKER ERROR] Failed to send error message: {send_err}", flush=True)
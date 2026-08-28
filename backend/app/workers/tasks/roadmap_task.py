import json
import re
from sqlmodel import Session
from mezon_sdk.models import ChannelMessageContent, InteractiveMessageProps
from mezon_sdk.structures.interactive_message import InteractiveBuilder

from app.core.database import engine
from app.bot.client import client
from app.bot.commands.roadmap import run_roadmap_service
from app.bot.utils.embeds import build_warning_embed


def build_folder_tree_embed(folder_name: str, folder_id: str, files: list) -> InteractiveMessageProps:
    builder = InteractiveBuilder(f"📁 {folder_name}")
    builder.set_description(f"**{len(files)} bài học** • [Mở Web UI](http://localhost:3001)")
    builder.set_color("#00BFFF")

    file_names = [
        f.get("title") or f.get("name") if isinstance(f, dict) else getattr(f, "name", "Untitled")
        for f in files
    ]

    sorted_files = sorted(
        file_names, 
        key=lambda name: int(m.group()) if (m := re.search(r'\d+', name)) else 999
    )

    for i, name in enumerate(sorted_files[:15]):
        builder.add_field(name=f"📄 {name}", value=" ", inline=False)

    if len(sorted_files) > 15:
        builder.add_field(name="...", value=f"Và {len(sorted_files) - 15} bài khác", inline=False)

    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


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

        # 3. Tạo embed message
        if files:
            embed = build_folder_tree_embed(folder_name, folder_id, files)
            message_text = f"✅ Lộ trình **{folder_name}** đã tạo xong!"
        else:
            # Fallback nếu không parse được danh sách file
            embed = build_warning_embed(f"📁 {folder_name}", "Không tìm thấy bài học chi tiết")
            message_text = f"✅ **Đã khởi tạo xong Folder:** `{folder_name}`"

        # 4. Lấy channel & Gửi tin nhắn qua Mezon Client
        channel = await client.channels.fetch(channel_id)
        
        await channel.send(
            content=ChannelMessageContent(t=message_text, embed=[embed])
        )

    except Exception as e:
        print(f"[WORKER ERROR] Roadmap generation failed: {e}", flush=True)
        try:
            channel = await client.channels.fetch(channel_id)
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[InteractiveMessageProps(**InteractiveBuilder("❌ Lỗi tạo lộ trình").set_description(str(e)).set_color("#FF0000").build())]
                )
            )
        except Exception as send_err:
            print(f"[WORKER ERROR] Failed to send error message: {send_err}", flush=True)
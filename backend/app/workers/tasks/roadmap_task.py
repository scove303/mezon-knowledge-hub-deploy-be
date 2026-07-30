import json
from sqlmodel import Session
from mezon.models import ChannelMessageContent

from app.core.database import engine
from app.bot.client import client
from app.bot.commands.roadmap import run_roadmap_service


def split_text(text: str, max_length: int = 1800) -> list[str]:
    """Cắt văn bản thành các đoạn nhỏ để tránh vượt giới hạn ký tự của Mezon."""
    chunks = []
    while len(text) > max_length:
        split_at = text.rfind("\n", 0, max_length)
        if split_at == -1:
            split_at = text.rfind(" ", 0, max_length)
        if split_at == -1:
            split_at = max_length

        chunks.append(text[:split_at])
        text = text[split_at:].lstrip()

    if text:
        chunks.append(text)
    return chunks


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

        # 2. Ép kiểu response_data để lấy NỘI DUNG THỰC SỰ
        display_msg = ""
        if isinstance(response_data, dict):
            # Kiểm tra xem nội dung roadmap nằm ở key nào (data, content, roadmap,...)
            roadmap_body = (
                response_data.get("data") 
                or response_data.get("content") 
                or response_data.get("roadmap")
            )
            
            if roadmap_body:
                if isinstance(roadmap_body, (dict, list)):
                    display_msg = json.dumps(roadmap_body, ensure_ascii=False, indent=2)
                else:
                    display_msg = str(roadmap_body)
            else:
                # Nếu dict không có key dữ liệu riêng, dump toàn bộ dict ra JSON
                display_msg = json.dumps(response_data, ensure_ascii=False, indent=2)
        else:
            display_msg = str(response_data)

        # 3. Lấy channel để gửi
        channel = await client.channels.fetch(channel_id)

        # 4. Tạo chuỗi hoàn chỉnh và gửi (tự động chia nhỏ nếu bài quá dài)
        full_text = f"**Roadmap Generated for '{content}'!**\n\n{display_msg}"
        message_chunks = split_text(full_text, max_length=1800)

        for chunk in message_chunks:
            await channel.send(
                content=ChannelMessageContent(t=chunk)
            )

    except Exception as e:
        print(f"[WORKER ERROR] Roadmap generation failed: {e}", flush=True)
        try:
            channel = await client.channels.fetch(channel_id)
            await channel.send(
                content=ChannelMessageContent(t=f"❌ An error occurred while generating the roadmap: {str(e)}")
            )
        except Exception as send_err:
            print(f"[WORKER ERROR] Failed to send error message: {send_err}", flush=True)
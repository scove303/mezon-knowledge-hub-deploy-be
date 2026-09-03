import json
import asyncio
from sqlmodel import Session, select
from mezon_sdk.models import ChannelMessageContent, InteractiveMessageProps, ApiMessageAttachment
from mezon_sdk.protobuf.api import api_pb2

from app.bot.client import client
from app.core.database import engine
from app.workers.tasks.roadmap_task import process_roadmap_task
from app.core.security import get_password_hash
from app.models.user import User

# Import các hàm service/view vừa viết
from app.bot.commands.folder import list_all_folder, get_folder_by_id
from app.bot.commands.file import get_file_by_id
from app.workers.tasks.youtube_task import process_youtube_native_pipeline
from app.bot.commands.digest import _run_digest_pipeline
from app.bot.commands.shared_chat import (
    share_chat_command,
    import_chat_command,
    list_shared_chats_command,
    browse_public_chats_command,
)
from app.bot.utils.embeds import (
    build_status_embed,
    build_error_embed,
    build_warning_embed,
    build_help_embed,
)

PREFIX = "/"


def extract_attachments(message: api_pb2.ChannelMessage) -> list[ApiMessageAttachment]:
    """Safely extract attachments from protobuf message (handles both raw bytes and parsed list)."""
    raw = getattr(message, "attachments", None)
    if raw is None:
        return []
    # Already parsed list (from ChannelMessage model)
    if isinstance(raw, list):
        return raw
    # Raw protobuf bytes - decode
    if isinstance(raw, bytes):
        try:
            attachment_list = api_pb2.MessageAttachmentList()
            attachment_list.ParseFromString(raw)
            return [
                ApiMessageAttachment(
                    filename=a.filename,
                    filetype=a.filetype,
                    height=a.height,
                    size=a.size,
                    url=a.url,
                    width=a.width,
                    thumbnail=a.thumbnail,
                    duration=a.duration,
                )
                for a in attachment_list.attachments
            ]
        except Exception:
            return []
    return []

# Lưu trạng thái chờ xác nhận từ người dùng (khi video không có transcript)
# key: (channel_id, sender_id) -> {"url": ..., "user_id": ..., "video_title": ...}
pending_confirmations: dict = {}


def get_or_create_user(message: api_pb2.ChannelMessage) -> int:
    import uuid
    sender_id_str = str(message.sender_id).strip()
    username_str = getattr(message, "username", None) or sender_id_str

    with Session(engine) as session:
        # 1. Tìm User theo mezon_id bất biến
        db_user = session.exec(
            select(User).where(User.mezon_id == sender_id_str)
        ).first()

        if not db_user:
            # Tạo username không trùng lặp
            base_username = username_str
            final_username = base_username
            while session.exec(
                select(User).where(User.username == final_username)
            ).first():
                final_username = f"{base_username}_{uuid.uuid4().hex[:4]}"

            # Tạo user mới với password hash ngẫu nhiên an toàn
            db_user = User(
                username=final_username,
                hashed_password=get_password_hash(uuid.uuid4().hex),
                display_name=username_str,
                mezon_id=sender_id_str,
                role="USER",
            )
            session.add(db_user)
            session.commit()
            session.refresh(db_user)

        return db_user.id


async def handle_message(message: api_pb2.ChannelMessage) -> None:
    # 1. Tránh vòng lặp vô tận từ tin nhắn của chính Bot
    if message.sender_id == client.client_id:
        return

    # Log incoming message
    await checklog(message=message)

    # 2. Extract message text an toàn từ JSON string hoặc Dict
    text = ""
    if hasattr(message, "content"):
        if isinstance(message.content, dict):
            text = message.content.get("t", "")
        elif isinstance(message.content, str):
            try:
                content_dict = json.loads(message.content)
                text = content_dict.get("t", "")
            except Exception:
                text = message.content

    text = text.strip()
    is_youtube_link = "youtube.com" in text.lower() or "youtu.be" in text.lower()

    # Check for file attachments (properly decode protobuf)
    attachments = extract_attachments(message)
    has_attachments = len(attachments) > 0

    # -----------------------------------------------------------------
    # PENDING CONFIRMATION HANDLER: xử lý "có"/"không" sau khi bot hỏi xác nhận
    # (chạy trước tất cả command check để không bị bỏ qua)
    # -----------------------------------------------------------------
    pending_key = (message.channel_id, message.sender_id)
    if pending_key in pending_confirmations and not is_youtube_link and not text.startswith(PREFIX):
        reply = text.lower().strip()
        if reply in ("có", "co", "yes", "y", "ừ", "ok", "được", "gen đi", "gen"):
            job = pending_confirmations.pop(pending_key)
            channel = await client.channels.fetch(message.channel_id)
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_status_embed("⏳ Đang tạo lộ trình", f"Từ video **'{job['video_title']}'** (tìm kiếm web)...")]
                )
            )
            asyncio.create_task(_run_youtube_pipeline(channel, job["url"], job["user_id"], job["video_title"]))
            return
        elif reply in ("không", "khong", "no", "n", "thôi", "bỏ", "bo", "cancel"):
            pending_confirmations.pop(pending_key)
            channel = await client.channels.fetch(message.channel_id)
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_status_embed("✅ Đã huỷ", "Không tạo lộ trình từ video này.")]
                )
            )
            return

    # -----------------------------------------------------------------
    # AUTO HANDLE FILE ATTACHMENTS: chỉ khi gửi file KHÔNG KÈM LỆNH
    # (text rỗng - chỉ thả file, không gõ gì thêm)
    # -----------------------------------------------------------------
    # Danh sách lệnh đã xử lý file riêng (tránh double-trigger)
    file_commands = ("/digest", "/roadmap", "/youtube", "/revise", "/folder", "/file")
    
    is_file_command = any(text.startswith(cmd) for cmd in file_commands)
    
    if has_attachments and not text and not is_youtube_link and not is_file_command:
        user_id = get_or_create_user(message)
        channel = await client.channels.fetch(message.channel_id)
        first_file = attachments[0]
        file_url = getattr(first_file, "url", None) or getattr(first_file, "file_url", "")
        filename = getattr(first_file, "filename", None) or getattr(first_file, "name", "file.pdf")

        if not file_url:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_error_embed("❌ Lỗi", "Không tìm thấy link tải của file đính kèm.")]
                )
            )
            return

        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("📰 Đã nhận file!", f"`{filename}` - Đang đọc, tóm tắt và phân loại...")]
            )
        )

        asyncio.create_task(
            _run_digest_pipeline(
                channel=channel,
                file_url=file_url,
                filename=filename,
                prompt=None,
                user_id=user_id,
            )
        )
        return

    if not text.startswith(PREFIX) and not is_youtube_link:
        return  # Bỏ qua nếu không phải tin nhắn dạng Command và không chứa link YouTube

    # Lấy sẵn channel object để phản hồi
    channel = await client.channels.fetch(message.channel_id)

    # -----------------------------------------------------------------
    # COMMAND 1: /roadmap <topic>
    # -----------------------------------------------------------------
    if text.startswith("/roadmap"):
        content = text[8:].strip()
        if not content:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu chủ đề!", "Cú pháp: `/roadmap [chủ đề]`\n*Ví dụ: `/roadmap Python`*")]
                )
            )
            return

        user_id = get_or_create_user(message)

        # Phản hồi tức thì cho người dùng
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("⏳ Đang khởi tạo lộ trình", f"Chủ đề: `{content}`... Vui lòng đợi!")]
            )
        )

        # Chạy background task
        asyncio.create_task(
            process_roadmap_task(
                channel_id=message.channel_id,
                content=content,
                user_id=user_id
            )
        )

    # -----------------------------------------------------------------
    # COMMAND 2: /listallfolders hoặc /folders
    # -----------------------------------------------------------------
    elif text.startswith("/listallfolders") or text.startswith("/folders"):
        user_id = get_or_create_user(message)
        embed = list_all_folder(user_id=user_id)
        await channel.send(content=ChannelMessageContent(t="", embed=[embed]))

    # -----------------------------------------------------------------
    # COMMAND 3: /folder-id <folder_id> hoặc /folder <folder_id>
    # -----------------------------------------------------------------
    elif text.startswith("/folder-id") or text.startswith("/folder"):
        # Tách chuỗi lấy Folder ID
        prefix_len = 10 if text.startswith("/folder-id") else 7
        folder_id = text[prefix_len:].strip()

        if not folder_id:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu Folder ID!", "Cú pháp: `/folder-id <id>`\n*Ví dụ: `/folder-id folder-a1b2c3d4`*")]
                )
            )
            return

        user_id = get_or_create_user(message)
        embed = get_folder_by_id(user_id=user_id, folder_id=folder_id)
        await channel.send(content=ChannelMessageContent(t="", embed=[embed]))

    # -----------------------------------------------------------------
    # COMMAND 4: /file-id <file_id> hoặc /file <file_id>
    # -----------------------------------------------------------------
    elif text.startswith("/file-id") or text.startswith("/file"):
        # Tách chuỗi lấy File ID
        prefix_len = 8 if text.startswith("/file-id") else 5
        file_id = text[prefix_len:].strip()

        if not file_id:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu File ID!", "Cú pháp: `/file-id <id>`\n*Ví dụ: `/file-id file-x1y2z3`*")]
                )
            )
            return

        embed = get_file_by_id(file_id=file_id)
        await channel.send(content=ChannelMessageContent(t="", embed=[embed]))

    # -----------------------------------------------------------------
    # COMMAND 5: /revise <prompt/topic>
    # -----------------------------------------------------------------
    elif text.startswith("/revise"):
        content = text[7:].strip()
        if not content:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu nội dung!", "Cú pháp: `/revise [chủ đề/file_id]`")]
                )
            )
            return

        # TODO: Hook service ôn tập / quiz tại đây
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("📝 Tính năng Ôn tập", f"Đang chuẩn bị bài tập cho `{content}`...")]
            )
        )

    # -----------------------------------------------------------------
    # COMMAND 6: /digest
    # -----------------------------------------------------------------
    elif text.startswith("/digest"):
        prompt = text[7:].strip()
        # Use already decoded attachments from extract_attachments()
        if not attachments:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu file!", "Vui lòng đính kèm file (.pdf, .docx, .txt) khi gõ `/digest`.")]
                )
            )
            return

        user_id = get_or_create_user(message)
        first_file = attachments[0]
        file_url = getattr(first_file, "url", None) or getattr(first_file, "file_url", "")
        filename = getattr(first_file, "filename", None) or getattr(first_file, "name", "file.pdf")

        if not file_url:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_error_embed("❌ Lỗi", "Không tìm thấy link tải của file đính kèm.")]
                )
            )
            return

        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("📰 Đã nhận file!", f"`{filename}` - Đang đọc, tóm tắt và phân loại...")]
            )
        )

        # Chạy background task để xử lý digest mà không làm nghẽn bot
        asyncio.create_task(
            _run_digest_pipeline(
                channel=channel,
                file_url=file_url,
                filename=filename,
                prompt=prompt,
                user_id=user_id,
            )
        )

    # -----------------------------------------------------------------
    # COMMAND 7: /youtube <url> hoặc trực tiếp gửi link YouTube
    # -----------------------------------------------------------------
    elif text.startswith("/youtube") or is_youtube_link:
        url = text[8:].strip() if text.startswith("/youtube") else text
        if not url:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu đường dẫn!", "Cú pháp: `/youtube <link_video>`")]
                )
            )
            return

        user_id = get_or_create_user(message)
        video_title = url  # Fallback to URL if actual title isn't retrieved yet

        # 1. Send initial status message
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("🎬 YouTube Summarizer", f"Đang phân tích video `{url}`...")]
            )
        )

        # 2. Dispatch the non-blocking task using helper function
        asyncio.create_task(_run_youtube_pipeline(channel, url, user_id, video_title))

    # -----------------------------------------------------------------
    # COMMAND 8: /share-chat <folder_id> [title] [description]
    # -----------------------------------------------------------------
    elif text.startswith("/share-chat"):
        parts = text[11:].strip().split(" ", 2)
        if not parts[0]:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu Folder ID!", "Cú pháp: `/share-chat <folder_id> [title] [description]`")]
                )
            )
            return
        
        folder_id = parts[0]
        title = parts[1] if len(parts) > 1 else ""
        description = parts[2] if len(parts) > 2 else ""
        
        user_id = get_or_create_user(message)
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("📤 Đang chia sẻ...", f"Thư mục: `{folder_id}`")]
            )
        )
        asyncio.create_task(share_chat_command(channel, user_id, folder_id, title, description))

    # -----------------------------------------------------------------
    # COMMAND 9: /import-chat <share_code> [new_folder_name]
    # -----------------------------------------------------------------
    elif text.startswith("/import-chat"):
        parts = text[12:].strip().split(" ", 1)
        if not parts[0]:
            await channel.send(
                content=ChannelMessageContent(
                    t="",
                    embed=[build_warning_embed("⚠️ Thiếu Share Code!", "Cú pháp: `/import-chat <share_code> [new_folder_name]`")]
                )
            )
            return
        
        share_code = parts[0]
        new_name = parts[1] if len(parts) > 1 else ""
        
        user_id = get_or_create_user(message)
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("📥 Đang nhập chat...", f"Code: `{share_code}`")]
            )
        )
        asyncio.create_task(import_chat_command(channel, user_id, share_code, new_name))

    # -----------------------------------------------------------------
    # COMMAND 10: /my-shared-chats
    # -----------------------------------------------------------------
    elif text.startswith("/my-shared-chats") or text.startswith("/shared-chats"):
        user_id = get_or_create_user(message)
        asyncio.create_task(list_shared_chats_command(channel, user_id))

    # -----------------------------------------------------------------
    # COMMAND 11: /browse-chats
    # -----------------------------------------------------------------
    elif text.startswith("/browse-chats") or text.startswith("/public-chats"):
        user_id = get_or_create_user(message)
        asyncio.create_task(browse_public_chats_command(channel, user_id))

    elif text.startswith("/help") or text.startswith("/start"):
        await channel.send(content=ChannelMessageContent(t="", embed=[build_help_embed()]))


async def _run_youtube_pipeline(channel, url: str, user_id: int, video_title: str):
    """Helper chạy full YouTube pipeline và gửi thông báo kết quả."""
    try:
        with Session(engine) as session:
            await process_youtube_native_pipeline(
                session=session,
                user_id=user_id,
                youtube_url=url,
                on_event=None
            )
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_status_embed("✅ Hoàn thành!", f"Lộ trình từ video **'{video_title}'** đã tạo xong!")]
            )
        )
    except Exception as e:
        print(f"[Mezon Bot Error]: {e}")
        await channel.send(
            content=ChannelMessageContent(
                t="",
                embed=[build_error_embed("❌ Lỗi", "Không thể xử lý video YouTube. Kiểm tra lại đường dẫn.")]
            )
        )


async def checklog(message: api_pb2.ChannelMessage):
    print(f"[BOT] Message received from sender: {message.sender_id}", flush=True)
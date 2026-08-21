import json
import asyncio
from sqlmodel import Session, select
from mezon_sdk.models import ChannelMessageContent
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

PREFIX = "/"



def get_or_create_user(message: dict) -> int:
    """Helper đệm xử lý lấy hoặc tạo mới User trong DB."""
    with Session(engine) as session:
        db_user = session.exec(
            select(User).where(
                (User.username == message.sender_id)
                | (User.mezon_id == message.sender_id)
            )
        ).first()

        if not db_user:
            # Tạo user mới nếu lần đầu tương tác với Bot
            db_user = User(
                username=message.username,
                hashed_password=get_password_hash("default_pass_123"),
                display_name=message.username,
                mezon_id=message.sender_id,
                role="USER",
            )
            session.add(db_user)
            session.commit()
            session.refresh(db_user)
        elif db_user.mezon_id != message.sender_id:
            # Link tài khoản Mezon cho user đã tồn tại
            db_user.mezon_id = message.sender_id
            session.add(db_user)
            session.commit()

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
    if not text.startswith(PREFIX):
        return  # Bỏ qua nếu không phải tin nhắn dạng Command

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
                    t="⚠️ **Thiếu chủ đề!** Cú pháp đúng: `/roadmap [chủ đề]`\n*Ví dụ: `/roadmap Python`*"
                )
            )
            return

        user_id = get_or_create_user(message)

        # Phản hồi tức thì cho người dùng
        await channel.send(
            content=ChannelMessageContent(
                t=f"⏳ **Đang khởi tạo lộ trình cho:** `{content}`... Vui lòng đợi trong giây lát!"
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
        response_msg = list_all_folder(user_id=user_id)
        await channel.send(content=ChannelMessageContent(t=response_msg))

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
                    t="⚠️ **Thiếu Folder ID!** Cú pháp đúng: `/folder-id <id>`\n*Ví dụ: `/folder-id folder-a1b2c3d4`*"
                )
            )
            return

        user_id = get_or_create_user(message)
        response_msg = get_folder_by_id(user_id=user_id, folder_id=folder_id)
        await channel.send(content=ChannelMessageContent(t=response_msg))

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
                    t="⚠️ **Thiếu File ID!** Cú pháp đúng: `/file-id <id>`\n*Ví dụ: `/file-id file-x1y2z3`*"
                )
            )
            return

        response_msg = get_file_by_id(file_id=file_id)
        await channel.send(content=ChannelMessageContent(t=response_msg))

    # -----------------------------------------------------------------
    # COMMAND 5: /revise <prompt/topic>
    # -----------------------------------------------------------------
    elif text.startswith("/revise"):
        content = text[7:].strip()
        if not content:
            await channel.send(
                content=ChannelMessageContent(
                    t="⚠️ **Thiếu nội dung ôn tập!** Cú pháp: `/revise [chủ đề/file_id]`"
                )
            )
            return
        
        # TODO: Hook service ôn tập / quiz tại đây
        await channel.send(
            content=ChannelMessageContent(
                t=f"📝 **Tính năng Ôn tập (Revise):** Đang chuẩn bị bài tập ôn tập cho `{content}`..."
            )
        )

    # -----------------------------------------------------------------
    # COMMAND 6: /digest
    # -----------------------------------------------------------------
    elif text.startswith("/digest"):
        content = text[7:].strip()
        # TODO: Implement digest logic
        await channel.send(
            content=ChannelMessageContent(
                t=f"📰 **Digest Summary:** Tính năng tóm tắt đang được xử lý..."
            )
        )

    # -----------------------------------------------------------------
    # COMMAND 7: /youtube <url>
    # -----------------------------------------------------------------
    elif text.startswith("/youtube"):
        url = text[8:].strip()
        if not url:
            await channel.send(
                content=ChannelMessageContent(
                    t="⚠️ **Thiếu đường dẫn YouTube!** Cú pháp: `/youtube <link_video>`"
                )
            )
            return

        # 1. Send initial status message
        await channel.send(
            content=ChannelMessageContent(
                t=f"🎬 **YouTube Summarizer:** Đang phân tích video `{url}`..."
            )
        )

        # 2. Define non-blocking background task
        async def run_youtube_processing():
            try:
                # Inject/Open your DB Session context here
                with Session(engine) as session:
                    await process_youtube_native_pipeline(
                        session=session,
                        user_id=sender_id,  # Pass the Mezon user/sender ID
                        youtube_url=url,
                        on_event=None
                    )

                # Send success notification back to Mezon channel
                await channel.send(
                    content=ChannelMessageContent(
                        t=f"✅ **Hoàn thành!** Lộ trình học tập từ video `{url}` đã được tạo thành công vào workspace của bạn!"
                    )
                )
            except Exception as e:
                print(f"❌ [Mezon Bot Error]: {e}")
                await channel.send(
                    content=ChannelMessageContent(
                        t=f"❌ **Lỗi:** Không thể xử lý video YouTube `{url}`. Vui lòng kiểm tra lại đường dẫn."
                    )
                )

        # 3. Create non-blocking task so bot stays responsive
        asyncio.create_task(run_youtube_processing())
       
    elif text.startswith("/help") or text.startswith("/start"):
        await channel.send(content=ChannelMessageContent(t=get_help_message()))


async def checklog(message: api_pb2.ChannelMessage):
    print(f"[BOT] Message received from sender: {message.sender_id}", flush=True)


# get help message
def get_help_message() -> str:
    """Trả về tin nhắn hướng dẫn sử dụng (Help Menu) đẹp mắt."""
    return (
        "🤖 **BẢNG HƯỚNG DẪN SỬ DỤNG MEZON KNOWLEDGE BOT**\n\n"
        "Chào mừng bạn! Dưới đây là danh sách các lệnh bạn có thể sử dụng:\n\n"
        "📌 **TẠO VÀ QUẢN LÝ LỘ TRÌNH HỌC TẬP:**\n"
        "• `/roadmap <chủ đề>` — *Tạo lộ trình học tập toàn diện từ cơ bản tới nâng cao*\n"
        "  └ *Ví dụ:* `/roadmap Lập trình Python cho người mới`\n\n"
        "• `/listallfolders` *(hoặc `/folders`)* — *Xem danh sách các thư mục lộ trình của bạn*\n\n"
        "• `/folder-id <id>` — *Xem cấu trúc và danh sách bài học của 1 thư mục*\n"
        "  └ *Ví dụ:* `/folder-id folder-a1b2c3d4`\n\n"
        "• `/file-id <id>` — *Đọc full nội dung bài học chi tiết*\n"
        "  └ *Ví dụ:* `/file-id file-x1y2z3a4`\n\n"
        "📌 **CÔNG CỤ HỌC TẬP BỔ TRỢ:**\n"
        "• `/revise <chủ đề/id>` — *Tạo bài tập ôn tập & kiểm tra kiến thức*\n"
        "  └ *Ví dụ:* `/revise Python biến và kiểu dữ liệu`\n\n"
        "• `/youtube <url>` — *Tóm tắt kiến thức & tạo ghi chú từ Video YouTube*\n"
        "  └ *Ví dụ:* `/youtube https://youtu.be/...`\n\n"
        "• `/digest` — *Tạo bản tóm tắt nội dung học tập tổng hợp*\n\n"
        "• `/help` — *Hiển thị lại bảng hướng dẫn này*\n\n"
        "💡 *Mẹo: Bạn có thể bấm thẳng vào các đường link Web UI trong tin nhắn của Bot để học bài trực quan hơn!*"
    )
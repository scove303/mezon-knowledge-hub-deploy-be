import re
from mezon_sdk.models import InteractiveMessageProps
from mezon_sdk.structures.interactive_message import InteractiveBuilder


def build_folder_list_embed(folders: list, base_web_url: str) -> InteractiveMessageProps:
    builder = InteractiveBuilder("📚 Danh sách Thư mục Học tập")
    builder.set_description(f"Bạn có **{len(folders)}** thư mục")
    builder.set_color("#00BFFF")

    for idx, folder in enumerate(folders, 1):
        web_ui_url = f"{base_web_url}/workspace/folders/{folder['id']}"
        builder.add_field(
            name=f"{idx}. 📁 {folder['name']}",
            value=f"📊 {folder['files_count']} bài học • [Mở Web]({web_ui_url})",
            inline=False
        )

    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_folder_detail_embed(folder_name: str, folder_id: str, files: list, base_web_url: str) -> InteractiveMessageProps:
    builder = InteractiveBuilder(f"📁 {folder_name}")
    web_ui_url = f"{base_web_url}/workspace/folders/{folder_id}"
    builder.set_description(f"**{len(files)} bài học** • [Mở Web UI]({web_ui_url})")
    builder.set_color("#00BFFF")

    def extract_file_number(file_info):
        name = file_info.get("name") or file_info.get("title") or ""
        match = re.search(r'\d+', str(name))
        return int(match.group()) if match else 9999

    sorted_files = sorted(files, key=extract_file_number)

    for i, item in enumerate(sorted_files[:15]):
        builder.add_field(
            name=f"📄 {item['name']}",
            value=f"ID: `{item['id']}`",
            inline=False
        )

    if len(sorted_files) > 15:
        builder.add_field(name="...", value=f"Và {len(sorted_files) - 15} bài khác", inline=False)

    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_file_embed(file_name: str, file_id: str, content: str, web_ui_url: str) -> InteractiveMessageProps:
    builder = InteractiveBuilder(f"📖 {file_name}")
    builder.set_description(f"ID: `{file_id}` • [Đọc trên Web]({web_ui_url})")
    builder.set_color("#00BFFF")

    MAX_CHAR_LIMIT = 1800
    if len(content) > MAX_CHAR_LIMIT:
        display_content = content[:MAX_CHAR_LIMIT] + "\n\n...\n⚠️ *Nội dung dài, [đọc tiếp trên Web]*"
    else:
        display_content = content

    builder.add_field(name="Nội dung", value=display_content, inline=False)
    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_digest_result_embed(folder_name: str, file_size: int, char_count: int, docs: list) -> InteractiveMessageProps:
    builder = InteractiveBuilder(f"✅ Tóm tắt & Phân loại thành công!")
    builder.set_description(f"📁 **Folder:** `{folder_name}`\n📊 **File:** {file_size} bytes ({char_count} ký tự)")
    builder.set_color("#00BFFF")

    for d in docs[:10]:
        builder.add_field(name=f"📄 {d['name']}", value=f"ID: `{d['id']}`", inline=False)

    if len(docs) > 10:
        builder.add_field(name="...", value=f"Và {len(docs) - 10} tài liệu khác", inline=False)

    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_status_embed(title: str, description: str, color: str = "#00BFFF") -> InteractiveMessageProps:
    builder = InteractiveBuilder(title)
    builder.set_description(description)
    builder.set_color(color)
    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_error_embed(title: str, description: str) -> InteractiveMessageProps:
    return build_status_embed(title, description, color="#FF0000")


def build_help_embed() -> InteractiveMessageProps:
    builder = InteractiveBuilder("🤖 Mezon Knowledge Bot — Hướng Dẫn")
    builder.set_description("Chào mừng! Dưới đây là danh sách lệnh bạn có thể sử dụng:")
    builder.set_color("#00BFFF")

    # Tạo & Quản lý lộ trình
    builder.add_field(
        name="📌 TẠO VÀ QUẢN LÝ LỘ TRÌNH HỌC TẬP",
        value=(
            "• `/roadmap <chủ đề>` — Tạo lộ trình từ cơ bản đến nâng cao\n"
            "  └ Ví dụ: `/roadmap Python cho người mới`\n\n"
            "• `/listallfolders` hoặc `/folders` — Xem danh sách thư mục của bạn\n\n"
            "• `/folder-id <id>` — Xem cấu trúc & bài học của 1 thư mục\n"
            "  └ Ví dụ: `/folder-id folder-a1b2c3d4`\n\n"
            "• `/file-id <id>` — Đọc full nội dung bài học chi tiết\n"
            "  └ Ví dụ: `/file-id file-x1y2z3a4`"
        ),
        inline=False
    )

    # Chia sẻ & Nhập chat
    builder.add_field(
        name="📌 CHIA SẺ & NHẬP CHAT (MỚI)",
        value=(
            "• `/share-chat <folder_id> [title] [desc]` — Chia sẻ thư mục + hội thoại thành link\n"
            "  └ Ví dụ: `/share-chat folder-a1b2c3d4 \"Python Chat\" \"Học Python\"`\n\n"
            "• `/import-chat <share_code> [new_name]` — Nhập chat chia sẻ vào tài khoản\n"
            "  └ Ví dụ: `/import-chat abc12345 \"Python của tôi\"`\n\n"
            "• `/my-shared-chats` — Xem chat bạn đã chia sẻ\n\n"
            "• `/browse-chats` — Duyệt chat công khai từ cộng đồng"
        ),
        inline=False
    )

    # Công cụ bổ trợ
    builder.add_field(
        name="📌 CÔNG CỤ HỌC TẬP BỔ TRỢ",
        value=(
            "• `/revise <chủ đề/id>` — Tạo bài tập ôn tập & kiểm tra kiến thức\n"
            "  └ Ví dụ: `/revise Python biến và kiểu dữ liệu`\n\n"
            "• `/youtube <url>` — Tóm tắt & tạo ghi chú từ Video YouTube\n"
            "  └ Ví dụ: `/youtube https://youtu.be/...`\n\n"
            "• `/digest` — Tạo bản tóm tắt nội dung học tập từ file (PDF, DOCX, TXT)\n\n"
            "• `/help` — Hiển thị lại bảng hướng dẫn này"
        ),
        inline=False
    )

    builder.add_field(
        name="💡 Mẹo",
        value="Bấm vào link Web UI trong tin nhắn Bot để học bài trực quan hơn!",
        inline=False
    )

    builder.set_footer(text="Mezon Knowledge Bot")
    return InteractiveMessageProps(**builder.build())


def build_warning_embed(title: str, description: str) -> InteractiveMessageProps:
    return build_status_embed(title, description, color="#FFA500")
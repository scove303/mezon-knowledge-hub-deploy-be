from sqlmodel import Session
from app.crud.file import get_file
from app.core.database import engine
from app.core.config import settings

def get_file_by_id(file_id: str) -> str:
    # 1. Query database lấy thông tin file
    with Session(engine) as session:
        file_obj = get_file(session=session, file_id=file_id)

    # 2. Xử lý trường hợp không tìm thấy file
    if not file_obj:
        return (
            f"❌ **Không tìm thấy bài học!**\n\n"
            f"Bài học có ID `{file_id}` không tồn tại hoặc đã bị xóa."
        )

    # 3. Lấy tên file, nội dung Markdown & Folder ID
    file_name = getattr(file_obj, "name", None) or getattr(file_obj, "title", "Untitled Lesson")
    folder_id = getattr(file_obj, "folder_id", "")
    markdown_content = getattr(file_obj, "markdown_content", "") or "*(Bài học này chưa có nội dung)*"

    # 4. Lấy base URL cho Web UI
    base_web_url = getattr(settings, "WEB_APP_URL", "https://your-app-domain.com")
    if folder_id:
        web_ui_url = f"{base_web_url}/workspace/folders/{folder_id}?fileId={file_obj.id}"
    else:
        web_ui_url = f"{base_web_url}/workspace/files/{file_obj.id}"

    # 5. Xử lý độ dài để render full bài học an toàn (Tránh tràn giới hạn tin nhắn Chat App)
    MAX_CHAR_LIMIT = 1800  # Ngưỡng an toàn cho tin nhắn Mezon
    
    if len(markdown_content) > MAX_CHAR_LIMIT:
        rendered_content = (
            f"{markdown_content[:MAX_CHAR_LIMIT]}\n\n"
            f"...\n"
            f"⚠️ *Nội dung bài học rất dài. [Bấm vào đây để đọc tiếp bản đầy đủ trên Web]({web_ui_url})*"
        )
    else:
        rendered_content = markdown_content

    # 6. Trả về toàn bộ nội dung bài học
    return (
        f"📖 **{file_name}**\n"
        f"🆔 `ID: {file_obj.id}`\n"
        f"🔗 **[Đọc trên Web UI]({web_ui_url})**\n\n"
        f"{"="*30}\n\n"
        f"{rendered_content}"
    )


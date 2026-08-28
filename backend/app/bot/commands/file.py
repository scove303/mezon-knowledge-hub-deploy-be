from sqlmodel import Session
from app.crud.file import get_file
from app.core.database import engine
from app.core.config import settings
from app.bot.utils.embeds import build_file_embed, build_error_embed
from mezon_sdk.models import InteractiveMessageProps


def get_file_by_id(file_id: str) -> InteractiveMessageProps:
    with Session(engine) as session:
        file_obj = get_file(session=session, file_id=file_id)

    if not file_obj:
        return build_error_embed(
            "❌ Không tìm thấy bài học!",
            f"Bài học `{file_id}` không tồn tại hoặc đã bị xóa."
        )

    file_name = getattr(file_obj, "name", None) or getattr(file_obj, "title", "Untitled Lesson")
    folder_id = getattr(file_obj, "folder_id", "")
    markdown_content = getattr(file_obj, "markdown_content", "") or "*(Bài học này chưa có nội dung)*"

    base_web_url = getattr(settings, "WEB_APP_URL", "https://your-app-domain.com")
    if folder_id:
        web_ui_url = f"{base_web_url}/workspace/folders/{folder_id}?fileId={file_obj.id}"
    else:
        web_ui_url = f"{base_web_url}/workspace/files/{file_obj.id}"

    return build_file_embed(file_name, file_obj.id, markdown_content, web_ui_url)


import asyncio
import httpx
from sqlmodel import Session

# Import các service & crud
from app.crud.folder import create_folder
from app.crud.file import create_file
from app.schemas.folder import FolderCreate
from app.schemas.file import FileCreate
from mezon_sdk.models import ChannelMessageContent
from app.core.database import engine

from app.services.document.extractor import (
    extract_text,
    UnsupportedFileTypeError,
    EmptyFileContentError,
)
from app.services.knowledge.summarize import (
    summarize_and_group,
    SummarizeGenerationError,
)

# Giới hạn dung lượng file trong Bot (20MB)
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


async def _run_digest_pipeline(channel, file_url: str, filename: str, prompt: str, user_id: int):
    """Background task xử lý file chuẩn theo luồng folder_crud & file_crud."""
    try:
        # 1. Tải file từ Mezon CDN
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as http_client:
            file_resp = await http_client.get(file_url, headers=headers)
            if file_resp.status_code != 200:
                await channel.send(
                    content=ChannelMessageContent(
                        t=f"❌ Không thể tải file `{filename}` từ hệ thống Mezon CDN (HTTP {file_resp.status_code})."
                    )
                )
                return
            file_bytes = file_resp.content

        # 2. Validate dung lượng file
        if len(file_bytes) == 0:
            await channel.send(content=ChannelMessageContent(t="⚠️ File rỗng, không có nội dung để xử lý."))
            return
            
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            await channel.send(
                content=ChannelMessageContent(
                    t=f"⚠️ File vượt quá dung lượng tối đa ({MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB)."
                )
            )
            return

        # 3. Crawl text từ file (dùng asyncio.to_thread để tránh block event loop với file nặng)
        extracted_text = await asyncio.to_thread(extract_text, filename, file_bytes)

        # 4. Gửi Gemini AI tóm tắt và phân loại
        structure = await summarize_and_group(
            extracted_text=extracted_text,
            filename=filename,
            user_prompt=prompt if prompt else None,
        )

        # 5. Dùng Session & CRUD để lưu Folder + Files chuẩn DB
        folder_title = f"Tổng hợp file {prompt}".strip() if prompt else f"Tổng hợp: {filename}"
        
        with Session(engine) as session:
            # Tạo Folder thông qua folder_crud
            folder_info = FolderCreate(name=folder_title, type="digest")
            folder = create_folder(session=session, data=folder_info, user_id=user_id)

            if not folder:
                await channel.send(content=ChannelMessageContent(t="❌ Không thể tạo thư mục lưu trữ trong DB."))
                return

            # Tạo danh sách File thông qua file_crud
            created_files = []
            for doc in structure["documents"]:
                new_file = create_file(
                    session=session,
                    folder_id=folder.id,
                    data=FileCreate(name=doc["title"], content=doc["content"]),
                )
                created_files.append(new_file)

            # Lấy thông tin phản hồi
            folder_id_display = folder.id
            folder_name_display = folder.name
            created_docs_summary = "\n".join(
                [f"• **{f.name}** (ID: `{f.id}`)" for f in created_files]
            )

        # 6. Thông báo kết quả cho người dùng qua Mezon Channel
        await channel.send(
            content=ChannelMessageContent(
                t=(
                    f"✅ **Tóm tắt & Phân loại file thành công!**\n\n"
                    f"📁 **Folder:** `{folder_name_display}` (ID: `{folder_id_display}`)\n"
                    f"📊 **Kích thước:** {len(file_bytes)} bytes ({len(extracted_text)} ký tự)\n\n"
                    f"📝 **Tài liệu học tập đã lưu:**\n{created_docs_summary}"
                )
            )
        )

    except UnsupportedFileTypeError as e:
        await channel.send(content=ChannelMessageContent(t=f"⚠️ **Định dạng file không hỗ trợ:** {str(e)}"))
    except EmptyFileContentError as e:
        await channel.send(content=ChannelMessageContent(t=f"⚠️ **Nội dung rỗng:** {str(e)}"))
    except SummarizeGenerationError as e:
        await channel.send(content=ChannelMessageContent(t=f"❌ **Lỗi khi gọi AI tóm tắt:** {str(e)}"))
    except Exception as e:
        print(f"[Digest Pipeline Error]: {e}", flush=True)
        await channel.send(content=ChannelMessageContent(t=f"⚠️ **Lỗi hệ thống khi xử lý file:** {str(e)}"))
import asyncio
import json
import httpx
from sqlmodel import Session, select

# SDK Mezon
from mezon_sdk.models import ChannelMessageContent
from mezon_sdk.protobuf.api import api_pb2

# Database & Models
from app.core.database import engine
from app.models.knowledge_file import KnowledgeFile
from app.models.folder import Folder
from app.models.user import User

# Extractor Service (Trích xuất text từ file)
from app.services.document.extractor import (
    extract_text,
    UnsupportedFileTypeError,
    EmptyFileContentError,
)

# Summarize Service (Gọi Gemini AI tóm tắt)
from app.services.knowledge.summarize import (
    summarize_and_group,
    SummarizeGenerationError,
)


async def _run_digest_pipeline(channel, file_url: str, filename: str, prompt: str, user_id: int):
    """Background helper để tải file từ Mezon CDN, crawl text, gọi AI tóm tắt và lưu vào DB."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        # 1. Tải file bytes từ Mezon CDN
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as http_client:
            file_resp = await http_client.get(file_url, headers=headers)
            
            # Log status code thực tế để dễ debug nếu vẫn lỗi
            if file_resp.status_code != 200:
                print(f"[Digest Download Failed] Status Code: {file_resp.status_code}, URL: {file_url}", flush=True)
                await channel.send(
                    content=ChannelMessageContent(
                        t=f"❌ Không thể tải file `{filename}` từ Mezon CDN (Mã lỗi HTTP: {file_resp.status_code})."
                    )
                )
                return
        file_bytes = file_resp.content

        # 2. Crawl toàn bộ text từ file dựa theo định dạng (.pdf, .docx, .txt)
        extracted_text = extract_text(filename=filename, file_bytes=file_bytes)

        # 3. Gọi service AI Gemini tóm tắt và nhóm tài liệu
        ai_result = await summarize_and_group(
            extracted_text=extracted_text,
            filename=filename,
            user_prompt=prompt if prompt else None,
        )

        folder_name = ai_result.get("folder_name", filename)
        documents = ai_result.get("documents", [])

        # 4. Lưu Folder & Documents vào Database
        created_docs = []
        with Session(engine) as session:
            # Tìm hoặc tạo mới Folder
            folder = session.exec(
                select(Folder).where(
                    (Folder.user_id == user_id) & (Folder.name == folder_name)
                )
            ).first()

            if not folder:
                folder = Folder(name=folder_name, user_id=user_id)
                session.add(folder)
                session.commit()
                session.refresh(folder)

            # Thêm các tài liệu tóm tắt được tạo ra vào Folder
            for doc in documents:
                db_file = KnowledgeFile(
                    name=doc["title"],
                    content=doc["content"],
                    folder_id=folder.id,
                    user_id=user_id,
                )
                session.add(db_file)
                session.commit()
                session.refresh(db_file)
                created_docs.append({"id": db_file.id, "name": db_file.name})

        # 5. Phản hồi kết quả tóm tắt lại cho channel Mezon
        docs_summary = "\n".join(
            [f"• **{d['name']}** (ID: `{d['id']}`)" for d in created_docs]
        )

        await channel.send(
            content=ChannelMessageContent(
                t=(
                    f"✅ **Tóm tắt & Phân loại file thành công!**\n\n"
                    f"📁 **Folder tạo ra:** `{folder_name}`\n"
                    f"📊 **Dung lượng file:** {len(file_bytes)} bytes ({len(extracted_text)} ký tự)\n\n"
                    f"📝 **Tài liệu học tập đã tạo:**\n{docs_summary}"
                )
            )
        )

    except UnsupportedFileTypeError as e:
        await channel.send(
            content=ChannelMessageContent(t=f"⚠️ **Định dạng file không hỗ trợ:** {str(e)}")
        )
    except EmptyFileContentError as e:
        await channel.send(
            content=ChannelMessageContent(t=f"⚠️ **Nội dung rỗng:** {str(e)}")
        )
    except SummarizeGenerationError as e:
        await channel.send(
            content=ChannelMessageContent(t=f"❌ **Lỗi khi gọi AI tóm tắt:** {str(e)}")
        )
    except Exception as e:
        print(f"[Digest Task Error]: {e}", flush=True)
        await channel.send(
            content=ChannelMessageContent(
                t=f"⚠️ **Lỗi hệ thống khi xử lý file:** {str(e)}"
            )
        )
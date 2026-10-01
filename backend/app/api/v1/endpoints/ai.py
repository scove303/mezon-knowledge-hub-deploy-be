import asyncio
import json
import uuid
from urllib.parse import urlparse
from app.crud import file as file_crud
from app.crud import folder as folder_crud
from app.schemas.file import FileCreate, FileMove, FileRename, FileUpdate
from app.schemas.folder import FolderCreate

from app.services.document.extractor import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    EmptyFileContentError,
    UnsupportedFileTypeError,
    extract_text,
)
from app.services.knowledge.summarize import (
    SummarizeGenerationError,
    summarize_and_group,
)

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from google.genai import types
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.api.deps import CurrentActor, SessionDep
from app.core.state import create_job, get_job_for_user, roadmap_jobs
from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile
from app.schemas.ai import RoadmapCreateRequest, RoadmapFollowUpRequest
from app.services.ai.domain_prompts import build_summarize_prompt, detect_domain
from app.services.document.parser import _generate_content_with_retry
from app.services.knowledge.roadmap import roadmap_service, revise_roadmap
from app.workers.tasks.youtube_task import process_youtube_native_pipeline
from app.core.database import get_session
from app.schemas.common import error_response, success_response

router = APIRouter()

MAX_CONCURRENT_JOBS_PER_USER = 10
HEARTBEAT_INTERVAL = 15.0


async def run_roadmap_job(job_id: str):
    """Chạy roadmap trong background và phát sự kiện qua job.queue."""
    from app.core.database import get_session as _get_session

    job = roadmap_jobs.get(job_id)
    if not job:
        return

    job.status = "running"

    try:
        with next(_get_session()) as session:
            folder = await roadmap_service(
                topic=job.topic,
                folder_name=job.folder_name,
                user_id=job.user_id,
                session=session,
                on_event=job.push,
            )

            job.folder_id = folder.id
            job.files = [
                {"file_id": f.id, "title": f.name}
                for f in getattr(folder, "files", [])
            ]

            job.status = "done"

            job.push(
                {
                    "type": "done",
                    "folder_id": folder.id,
                    "folder_name": folder.name,
                    "total_files": len(job.files),
                    "files": job.files,
                }
            )

    except Exception as e:
        job.status = "error"
        job.error = str(e)

        job.push(
            {
                "type": "error",
                "message": f"Error generating roadmap: {str(e)}",
            }
        )

        print(
            f"❌ [Job {job_id}] Thất bại: {e}",
            flush=True,
        )


def _event_to_sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/roadmap")
async def generate_roadmap(
    body: RoadmapCreateRequest,
    session: SessionDep,
    current_user: CurrentActor,
):
    # Giới hạn số job đồng thời mỗi user
    # (tránh lạm dụng), không chặn chạy song song
    user_jobs = sum(
        1
        for j in roadmap_jobs.values()
        if j.user_id == current_user.id
        and j.status in ("queued", "running")
    )

    if user_jobs >= MAX_CONCURRENT_JOBS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Bạn đang có quá nhiều lộ trình đang tạo. "
                "Vui lòng đợi một vài lộ trình hoàn tất!"
            ),
        )

    job = create_job(
        user_id=current_user.id,
        topic=body.topic,
        folder_name=body.folder_name,
    )

    job.push(
        {
            "type": "status",
            "message": "Đã nhận yêu cầu, đang chuẩn bị...",
        }
    )

    asyncio.create_task(
        run_roadmap_job(job.id)
    )

    return success_response(
        message="Yêu cầu tạo lộ trình đã được chấp nhận",
        data={
            "job_id": job.id,
            "status": "queued",
        },
    )


@router.get("/roadmap/{job_id}/stream")
async def stream_roadmap(
    job_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    job = get_job_for_user(
        job_id,
        current_user.id,
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Không tìm thấy job này "
                "(có thể đã hết hạn sau khi server khởi động lại)"
            ),
        )

    async def event_generator():
        # Replay các sự kiện đã xảy ra trước khi client kết nối
        replayed_ids = set()

        for event in job.events:
            yield _event_to_sse(event)

            replayed_ids.add(id(event))

            if event.get("type") in ("done", "error"):
                return

        while True:
            try:
                event = await asyncio.wait_for(
                    job.queue.get(),
                    timeout=HEARTBEAT_INTERVAL,
                )

            except asyncio.TimeoutError:
                # Heartbeat giữ kết nối sống khi chưa có sự kiện mới
                yield ": ping\n\n"
                continue

            # Sự kiện push đã được replay phía trên
            # (cùng object) → bỏ qua
            if id(event) in replayed_ids:
                continue

            yield _event_to_sse(event)

            if event.get("type") in ("done", "error"):
                return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/roadmap/{job_id}")
async def get_roadmap_status(
    job_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    job = get_job_for_user(
        job_id,
        current_user.id,
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy job này",
        )

    return success_response(
        message="Trạng thái job",
        data={
            "job_id": job.id,
            "status": job.status,
            "error": job.error,
            "folder_id": job.folder_id,
            "files": job.files,
            "last_event": (
                job.events[-1]
                if job.events
                else None
            ),
        },
    )


# =====================================================================
# FOLLOW-UP PROMPT: HỎI TIẾP / CHỈNH SỬA NỘI DUNG CŨ
# =====================================================================

def _load_owned_folder(
    session,
    folder_id: str,
    user_id: int,
) -> Folder:
    """Load folder kèm files, kiểm tra quyền sở hữu của user."""
    statement = (
        select(Folder)
        .where(
            Folder.id == folder_id,
            Folder.user_id == user_id,
        )
        .options(
            selectinload(Folder.files)
        )
    )

    folder = session.exec(statement).first()
    if folder:
        # Load immediate children
        children_stmt = (
            select(Folder)
            .where(Folder.parent_id == folder_id, Folder.user_id == user_id)
            .options(selectinload(Folder.files))
            .order_by(Folder.order_index, Folder.created_at)
        )
        children = list(session.exec(children_stmt).all())
        for child in children:
            child.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
        folder.children = children
    return folder


async def run_followup_job(job_id: str):
    """Chạy follow-up prompt trong background và phát sự kiện qua job.queue."""
    from app.core.database import get_session as _get_session

    job = roadmap_jobs.get(job_id)

    if not job:
        return

    job.status = "running"

    try:
        with next(_get_session()) as session:
            folder = _load_owned_folder(
                session,
                job.conversation_id,
                job.user_id,
            )

            if not folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        "Không tìm thấy folder/hội thoại này "
                        "(có thể đã bị xóa hoặc không thuộc quyền của bạn)"
                    ),
                )

            result = await revise_roadmap(
                topic=job.topic,
                folder=folder,
                session=session,
                on_event=job.push,
            )

            if result.get("action") == "edit":
                job.push(
                    {
                        "type": "edit",
                        "file_id": result["file_id"],
                        "title": result["title"],
                        "content": result["content"],
                    }
                )

                job.folder_id = folder.id
                job.files = [
                    {
                        "file_id": f.id,
                        "title": f.name,
                    }
                    for f in folder.files
                ]

            elif result.get("action") == "create_subfolder":
                job.push(
                    {
                        "type": "create_subfolder",
                        "subfolder_id": result["subfolder_id"],
                        "subfolder_name": result["subfolder_name"],
                        "subfolder_type": result["subfolder_type"],
                        "files": result.get("files", []),
                    }
                )

                job.folder_id = folder.id
                job.files = [
                    {
                        "file_id": f.id,
                        "title": f.name,
                    }
                    for f in folder.files
                ]

            else:
                job.push(
                    {
                        "type": "answer",
                        "text": result.get("text", ""),
                    }
                )

            job.status = "done"

            job.push(
                {
                    "type": "done",
                    "conversation_id": folder.id,
                    "folder_id": folder.id,
                    "action": result.get("action"),
                    "file_id": result.get("file_id"),
                    "title": result.get("title"),
                }
            )

    except Exception as e:
        job.status = "error"
        job.error = str(e)

        job.push(
            {
                "type": "error",
                "message": (
                    f"Lỗi xử lý prompt tiếp theo: {str(e)}"
                ),
            }
        )

        print(
            f"❌ [FollowUpJob {job_id}] Thất bại: {e}",
            flush=True,
        )


@router.post("/roadmap/followup")
async def followup_roadmap(
    body: RoadmapFollowUpRequest,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Prompt hỏi tiếp / chỉnh sửa nội dung cũ — giữ nguyên conversation_id (folder_id)."""

    folder = _load_owned_folder(
        session,
        body.conversation_id,
        current_user.id,
    )

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Không tìm thấy hội thoại/lộ trình này. "
                "Vui lòng tạo lộ trình trước hoặc kiểm tra lại ID."
            ),
        )

    job = create_job(
        user_id=current_user.id,
        topic=body.topic,
        folder_name=body.folder_name or folder.name,
        conversation_id=folder.id,
    )

    job.push(
        {
            "type": "status",
            "message": "Đã nhận yêu cầu, đang chuẩn bị...",
        }
    )

    asyncio.create_task(
        run_followup_job(job.id)
    )

    return success_response(
        message="Yêu cầu hỏi tiếp / chỉnh sửa đã được chấp nhận",
        data={
            "job_id": job.id,
            "status": "queued",
            "conversation_id": folder.id,
        },
    )


@router.post("/files/{file_id}/summarize")
async def summarize_file(
    file_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Tóm tắt nội dung một bài học (file markdown) bằng Gemini."""

    file = session.exec(
        select(KnowledgeFile).where(
            KnowledgeFile.id == file_id
        )
    ).first()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài liệu này",
        )

    folder = session.exec(
        select(Folder).where(
            Folder.id == file.folder_id
        )
    ).first()

    if not folder or folder.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập tài liệu này",
        )

    content = (
        getattr(
            file,
            "markdown_content",
            "",
        )
        or ""
    ).strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài liệu này chưa có nội dung để tóm tắt",
        )

    if len(content) > 20000:
        content = (
            content[:20000]
            + "\n...(bị cắt gọn)"
        )

    prompt = build_summarize_prompt(content)

    try:
        response = await _generate_content_with_retry(
            prompt,
            types.GenerateContentConfig(
                temperature=0.3,
            ),
        )

    except Exception as e:
        print(
            f"❌ [Summarize {file_id}] Lỗi gọi Gemini: {e}",
            flush=True,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Không thể gọi AI để tóm tắt: {e}",
        )

    return success_response(
        message="Đã tóm tắt xong",
        data={
            "file_id": file_id,
            "summary": (
                response.text or ""
            ).strip(),
        },
    )


@router.post("/digest")
async def digest_document(
    session: SessionDep,
    current_user: CurrentActor,
    file: UploadFile = File(...),
    prompt: str | None = Form(
        default=None,
        description="Yêu cầu tùy chỉnh của người dùng, sẽ được ghép cùng nội dung file thành 1 prompt gửi cho model",
    ),
):

    initial_folder_name = f"Tổng hợp: {prompt}" if prompt else f"Tổng hợp: {file.filename or 'Tài liệu'}"
    folder_info = FolderCreate(name=initial_folder_name, type="digest")
    folder = folder_crud.create_folder(session=session, data=folder_info, user_id=current_user.id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response("Không tìm thấy folder"),
        )

    # 2. Validate phần mở rộng file trước khi đọc để fail sớm, đỡ tốn I/O
    filename = file.filename or ""
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"Định dạng file không được hỗ trợ. Chỉ chấp nhận: "
                f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # 3. Đọc nội dung file & giới hạn dung lượng
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("File rỗng, không có nội dung để xử lý"),
        )
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"File vượt quá dung lượng tối đa cho phép "
                f"({MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB)"
            ),
        )

    # 4. Crawl text bằng pypdf / python-docx / plain text
    try:
        extracted_text = extract_text(filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=error_response(str(e))
        )
    except EmptyFileContentError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(str(e)),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(f"Lỗi khi xử lý file: {str(e)}"),
        )

    # 5. Gửi context (text đã crawl + prompt tùy chỉnh nếu có) cho Gemini
    #    để tóm tắt và tự động nhóm thành cấu trúc tài liệu
    try:
        structure = await summarize_and_group(
            extracted_text=extracted_text,
            filename=filename,
            user_prompt=prompt,
        )
    except SummarizeGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(f"Lỗi khi tóm tắt bằng AI: {str(e)}"),
        )

    # 6. Lưu các tài liệu (KnowledgeFile) sinh ra vào folder đã chỉ định
    created_files = [
        file_crud.create_file(
            session=session,
            folder_id=folder.id,
            data=FileCreate(name=doc["title"], content=doc["content"]),
        )
        for doc in structure["documents"]
    ]

    return success_response(
        message="Đã tiếp nhận file, tóm tắt và lưu tài liệu vào folder thành công",
        data={
            "folder_id": folder.id,
            "filename": filename,
            "file_size_bytes": len(file_bytes),
            "char_count": len(extracted_text),
            "suggested_folder_name": structure["folder_name"],
            "documents_created": [
                {"id": f.id, "name": f.name} for f in created_files
            ],
        },
    )


async def _run_youtube_task(user_id: int, youtube_url: str, folder_id: str = None):
    from app.core.database import get_session as _get_session
    with next(_get_session()) as session:
        await process_youtube_native_pipeline(
            session=session,
            user_id=user_id,
            youtube_url=youtube_url,
            on_event=None,
            folder_id=folder_id,
        )


from urllib.parse import urlparse


# ... existing code ...


def _validate_youtube_url(url: str) -> bool:
    """
    Validate that the URL is a legitimate YouTube URL by parsing and checking hostname.
    Prevents SSRF by ensuring the URL's actual domain is youtube.com, www.youtube.com, or youtu.be.
    """
    try:
        parsed = urlparse(url)
        # Must have a scheme and netloc
        if not parsed.scheme or not parsed.netloc:
            return False
        # Normalize hostname (lowercase, strip www.)
        hostname = parsed.netloc.lower()
        if hostname.startswith("www."):
            hostname = hostname[4:]
        # Check exact hostname match (not substring)
        return hostname in ("youtube.com", "youtu.be")
    except Exception:
        return False


@router.post("/youtube")
async def summarize_youtube(
    url: str,
    session: SessionDep,
    current_user: CurrentActor,
    background_tasks: BackgroundTasks,
    folder_id: str = None,
):
    if not _validate_youtube_url(url):
        raise HTTPException(
            status_code=400,
            detail="URL YouTube không hợp lệ! Chỉ chấp nhận youtube.com hoặc youtu.be",
        )

    # Capture folder_id explicitly before background task
    target_folder_id = folder_id
    
    # Offload processing & DB saving to background task
    background_tasks.add_task(
        _run_youtube_task,
        user_id=current_user.id,
        youtube_url=url,
        folder_id=target_folder_id,
    )

    if target_folder_id:
        message = "Đang phân tích video và tóm tắt vào thư mục hiện tại..."
    else:
        message = "Đang phân tích video và tạo lộ trình học tập mới..."
    return success_response(
        message=message,
        data={
            "status": "processing",
            "user_id": current_user.id,
            "folder_id": target_folder_id,
        },
    )
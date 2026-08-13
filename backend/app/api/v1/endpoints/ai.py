import asyncio
import json
import uuid

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.core.state import create_job, get_job_for_user, roadmap_jobs
from app.schemas.common import success_response
from app.api.deps import SessionDep, CurrentActor
from app.services.knowledge.roadmap import roadmap_service, revise_roadmap
from app.schemas.ai import RoadmapCreateRequest, RoadmapFollowUpRequest
from app.models.folder import Folder

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
            job.push({
                "type": "done",
                "folder_id": folder.id,
                "folder_name": folder.name,
                "total_files": len(job.files),
                "files": job.files,
            })
    except Exception as e:
        job.status = "error"
        job.error = str(e)
        job.push({"type": "error", "message": f"Error generating roadmap: {str(e)}"})
        print(f"❌ [Job {job_id}] Thất bại: {e}", flush=True)


def _event_to_sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/roadmap")
async def generate_roadmap(
    body: RoadmapCreateRequest,
    session: SessionDep,
    current_user: CurrentActor,
):
    # Giới hạn số job đồng thời mỗi user (tránh lạm dụng), không chặn chạy song song
    user_jobs = sum(
        1
        for j in roadmap_jobs.values()
        if j.user_id == current_user.id and j.status in ("queued", "running")
    )
    if user_jobs >= MAX_CONCURRENT_JOBS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Bạn đang có quá nhiều lộ trình đang tạo. Vui lòng đợi một vài lộ trình hoàn tất!",
        )

    job = create_job(
        user_id=current_user.id,
        topic=body.topic,
        folder_name=body.folder_name,
    )
    job.push({"type": "status", "message": "Đã nhận yêu cầu, đang chuẩn bị..."})
    asyncio.create_task(run_roadmap_job(job.id))

    return success_response(
        message="Yêu cầu tạo lộ trình đã được chấp nhận",
        data={"job_id": job.id, "status": "queued"},
    )


@router.get("/roadmap/{job_id}/stream")
async def stream_roadmap(
    job_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    job = get_job_for_user(job_id, current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy job này (có thể đã hết hạn sau khi server khởi động lại)",
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
                event = await asyncio.wait_for(job.queue.get(), timeout=HEARTBEAT_INTERVAL)
            except asyncio.TimeoutError:
                # Heartbeat giữ kết nối sống khi chưa có sự kiện mới
                yield ": ping\n\n"
                continue

            # Sự kiện push đã được replay phía trên (cùng object) → bỏ qua
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
    job = get_job_for_user(job_id, current_user.id)
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
            "last_event": job.events[-1] if job.events else None,
        },
    )


# =====================================================================
# FOLLOW-UP PROMPT: HỎI TIẾP / CHỈNH SỬA NỘI DUNG CŨ
# =====================================================================
def _load_owned_folder(session, folder_id: str, user_id: int) -> Folder:
    """Load folder kèm files, kiểm tra quyền sở hữu của user."""
    statement = (
        select(Folder)
        .where(Folder.id == folder_id, Folder.user_id == user_id)
        .options(selectinload(Folder.files))
    )
    return session.exec(statement).first()


async def run_followup_job(job_id: str):
    """Chạy follow-up prompt trong background và phát sự kiện qua job.queue."""
    from app.core.database import get_session as _get_session

    job = roadmap_jobs.get(job_id)
    if not job:
        return

    job.status = "running"
    try:
        with next(_get_session()) as session:
            folder = _load_owned_folder(session, job.conversation_id, job.user_id)
            if not folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy folder/hội thoại này (có thể đã bị xóa hoặc không thuộc quyền của bạn)",
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
                    {"file_id": f.id, "title": f.name}
                    for f in folder.files
                ]
            else:
                job.push({"type": "answer", "text": result.get("text", "")})

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
        job.push({"type": "error", "message": f"Lỗi xử lý prompt tiếp theo: {str(e)}"})
        print(f"❌ [FollowUpJob {job_id}] Thất bại: {e}", flush=True)


@router.post("/roadmap/followup")
async def followup_roadmap(
    body: RoadmapFollowUpRequest,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Prompt hỏi tiếp / chỉnh sửa nội dung cũ — giữ nguyên conversation_id (folder_id)."""
    folder = _load_owned_folder(session, body.conversation_id, current_user.id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại/lộ trình này. Vui lòng tạo lộ trình trước hoặc kiểm tra lại ID.",
        )

    job = create_job(
        user_id=current_user.id,
        topic=body.topic,
        folder_name=body.folder_name or folder.name,
        conversation_id=folder.id,
    )
    job.push({"type": "status", "message": "Đã nhận yêu cầu, đang chuẩn bị..."})
    asyncio.create_task(run_followup_job(job.id))

    return success_response(
        message="Yêu cầu hỏi tiếp / chỉnh sửa đã được chấp nhận",
        data={"job_id": job.id, "status": "queued", "conversation_id": folder.id},
    )


@router.post("/digest")
async def digest_document(
    session: SessionDep,
    current_user: CurrentActor,
    folder_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Bóc tách và tóm tắt tài liệu PDF/DOCX.
    TODO: Tích hợp PDFPlumber / python-docx + Gemini summarization
    """
    return success_response(
        message="Đã bóc tách tài liệu thành công",
        data={"folder_id": folder_id, "filename": file.filename, "files_created": []},
    )


@router.post("/youtube")
async def summarize_youtube(
    url: str,
    folder_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    """
    Tóm tắt video YouTube + trích xuất timestamps.
    TODO: Tích hợp youtube-transcript-api + Gemini summarization
    """
    file_id = f"file-{uuid.uuid4().hex[:8]}"
    return success_response(
        message="Đang lấy phụ đề và tóm tắt video...",
        data={"file_id": file_id, "name": "Video_Summary.md", "folder_id": folder_id},
    )

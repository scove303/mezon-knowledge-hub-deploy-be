import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, BackgroundTasks
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentUser
from app.schemas.common import success_response

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


def process_heavy_job(job_id: str, payload: dict):
    # Giả lập xử lý ngầm
    import time
    print(f"[WORKER] Bắt đầu xử lý Job {job_id} với payload: {payload}")
    time.sleep(5)
    print(f"[WORKER] Hoàn tất Job {job_id}")


@router.post("/roadmap")
async def generate_roadmap(
    topic: str,
    folder_name: str,
    session: SessionDep,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    """
    Tạo lộ trình học tập tự động từ Internet.
    """
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    background_tasks.add_task(process_heavy_job, job_id, {"topic": topic, "folder_name": folder_name})
    
    return success_response(
        message="Đang tổng hợp lộ trình học tập, vui lòng kiểm tra lại sau vài giây",
        data={"job_id": job_id, "folder_name": folder_name, "topic": topic},
    )


@router.post("/digest")
async def digest_document(
    session: SessionDep,
    current_user: CurrentUser,
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
    current_user: CurrentUser,
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

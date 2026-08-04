import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, BackgroundTasks
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentActor
from app.schemas.common import success_response
from fastapi import APIRouter, HTTPException, status
from app.api.deps import SessionDep, CurrentActor
from app.core.state import active_roadmap_users
from app.services.knowledge.roadmap import roadmap_service
from app.schemas.common import success_response
from app.schemas.ai import RoadmapCreateRequest

router = APIRouter()



def process_heavy_job(job_id: str, payload: dict):
    # Giả lập xử lý ngầm
    import time
    print(f"[WORKER] Bắt đầu xử lý Job {job_id} với payload: {payload}")
    time.sleep(5)
    print(f"[WORKER] Hoàn tất Job {job_id}")


@router.post("/roadmap")
async def generate_roadmap(
    body: RoadmapCreateRequest,
    session: SessionDep,
    current_user: CurrentActor,
):

    user_id = current_user.id

    # 1. Anti-Spam Check: Ensure user is not currently running another job
    if user_id in active_roadmap_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is currently generating another roadmap for you. Please wait for it to complete!"
        )

    try:
        #  Lock user state
        active_roadmap_users.add(user_id)

        #  Execute synchronous roadmap generation using Pydantic fields
        folder = await roadmap_service(
            topic=body.topic,
            folder_name=body.folder_name,
            user_id=user_id,
            session=session
        )

        #  Return full JSON response when complete
        return success_response(
            message="Roadmap generated successfully!",
            data={
                "folder_id": folder.id,
                "folder_name": folder.name,
                "total_files": len(folder.files),
                "files": [
                    {
                        "file_id": f.id,
                        "title": f.name,
                        "markdown_content": f.markdown_content
                    }
                    for f in folder.files
                ]
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating roadmap: {str(e)}"
        )

    finally:
        # Always release the active task lock
        active_roadmap_users.discard(user_id)


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

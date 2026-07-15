from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentUser
from app.crud import file as file_crud
from app.schemas.common import error_response, success_response
from app.schemas.file import FileUpdate

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/{file_id}")
def get_file(file_id: str, session: SessionDep, current_user: CurrentUser):
    file = file_crud.get_file(session, file_id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Lấy chi tiết file thành công",
        data={
            "id": file.id,
            "name": file.name,
            "content": file.markdown_content,
            "video_url": file.video_url,
            "timestamps": file.timestamps_json,
            "created_at": file.created_at,
            "updated_at": file.updated_at,
        },
    )


@router.put("/{file_id}")
def update_file(
    file_id: str, data: FileUpdate, session: SessionDep, current_user: CurrentUser
):
    file = file_crud.update_file(session, file_id, data)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Đã cập nhật nội dung tài liệu",
        data={"id": file.id, "updated_at": file.updated_at},
    )


@router.delete("/{file_id}")
def delete_file(file_id: str, session: SessionDep, current_user: CurrentUser):
    deleted = file_crud.delete_file(session, file_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(message="Xóa file thành công")

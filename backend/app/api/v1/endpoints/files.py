from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.deps import CurrentActor
from app.crud import file as file_crud
from app.models.folder import Folder
from app.schemas.common import error_response, success_response
from app.schemas.file import FileCreate, FileMove, FileRename, FileUpdate

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("", status_code=201)
async def upload_file(
    folder_id: Annotated[str, Form()],
    file: Annotated[UploadFile, File(...)],
    session: SessionDep,
    current_user: CurrentActor,
):
    """Tạo file thủ công (upload .md/.txt) vào folder của user hiện tại."""
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == current_user.id)
    ).first()
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=error_response("File quá lớn (tối đa 5MB)"),
        )

    name = (file.filename or "document.md").strip() or "document.md"
    if not name.lower().endswith((".md", ".markdown", ".txt")):
        name += ".md"

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("utf-8", errors="replace")

    created = file_crud.create_file(
        session, folder_id, FileCreate(name=name, content=content)
    )
    return success_response(
        message="Đã tải lên tài liệu",
        data={
            "id": created.id,
            "name": created.name,
            "folder_id": created.folder_id,
            "updated_at": created.updated_at,
        },
    )


@router.get("/{file_id}/revisions")
def list_file_revisions(
    file_id: str, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.get_file(session, file_id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    revisions = file_crud.list_revisions(session, file_id)
    return success_response(
        message="Lấy lịch sử phiên bản thành công",
        data=[
            {
                "id": rev.id,
                "created_at": rev.created_at,
                "content": rev.content,
            }
            for rev in revisions
        ],
    )


@router.post("/{file_id}/revisions/{revision_id}/restore")
def restore_file_revision(
    file_id: str, revision_id: str, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.restore_revision(session, file_id, revision_id)
    if not file:
        raise HTTPException(
            status_code=404,
            detail=error_response("Không tìm thấy file hoặc phiên bản"),
        )
    return success_response(
        message="Đã khôi phục phiên bản",
        data={
            "id": file.id,
            "updated_at": file.updated_at,
            "content": file.markdown_content,
        },
    )


@router.get("/{file_id}")
def get_file(file_id: str, session: SessionDep, current_user: CurrentActor):
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
            "summary": getattr(file, "summary", ""),
            "content": file.markdown_content,
            "video_url": file.video_url,
            "timestamps": file.timestamps_json,
            "created_at": file.created_at,
            "updated_at": file.updated_at,
        },
    )


@router.put("/{file_id}")
def update_file(
    file_id: str, data: FileUpdate, session: SessionDep, current_user: CurrentActor
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


@router.put("/{file_id}/rename")
def rename_file(
    file_id: str, data: FileRename, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.rename_file(session, file_id, data.name)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Đã cập nhật tên tài liệu",
        data={"id": file.id, "name": file.name, "updated_at": file.updated_at},
    )


@router.put("/{file_id}/move")
def move_file(
    file_id: str, data: FileMove, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.move_file(session, file_id, data.folder_id, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file hoặc thư mục đích")
        )
    return success_response(
        message="Đã di chuyển tài liệu",
        data={"id": file.id, "folder_id": file.folder_id},
    )


@router.delete("/{file_id}")
def delete_file(file_id: str, session: SessionDep, current_user: CurrentActor):
    deleted = file_crud.delete_file(session, file_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(message="Xóa file thành công")

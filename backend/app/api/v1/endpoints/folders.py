from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentUser
from app.crud import folder as folder_crud
from app.schemas.common import error_response, success_response
from app.schemas.folder import FolderCreate

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("")
def get_folders(session: SessionDep, current_user: CurrentUser):
    folders = folder_crud.get_folders_by_user(session, current_user.id)
    result = [
        {
            "id": f.id,
            "name": f.name,
            "type": f.type,
            "created_at": f.created_at,
            "files": [
                {"id": file.id, "name": file.name, "created_at": file.created_at}
                for file in f.files
            ],
        }
        for f in folders
    ]
    return success_response(message="Lấy danh sách thư mục thành công", data=result)


@router.post("", status_code=201)
def create_folder(
    data: FolderCreate, session: SessionDep, current_user: CurrentUser
):
    folder = folder_crud.create_folder(session, data, current_user.id)
    return success_response(
        message="Tạo thư mục thành công",
        data={
            "id": folder.id,
            "name": folder.name,
            "type": folder.type,
            "created_at": folder.created_at,
            "files": [],
        },
    )


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str, session: SessionDep, current_user: CurrentUser
):
    deleted = folder_crud.delete_folder(session, folder_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )
    return success_response(message="Đã xóa thư mục và các file liên quan thành công")

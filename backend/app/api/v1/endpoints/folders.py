from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentActor
from app.crud import folder as folder_crud
from app.crud import file as file_crud
from app.schemas.common import error_response, success_response
from app.schemas.folder import FolderCreate, SubfolderCreate
from app.services.ai.mindmap_generator import generate_concept_mindmap
from datetime import datetime, timezone

import json

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("")
def get_folders(session: SessionDep, current_user: CurrentActor):
    folders = folder_crud.get_folders_by_user(session, current_user.id)
    def folder_to_dict(f, depth=0):
        if depth > 4:  # Max depth limit
            return {
                "id": f.id,
                "name": f.name,
                "type": f.type,
                "created_at": f.created_at,
                "parent_id": f.parent_id,
                "depth": f.depth,
                "order_index": f.order_index,
                "files": [
                    {"id": file.id, "name": file.name, "created_at": file.created_at}
                    for file in f.files
                ],
                "children": [],
            }
        return {
            "id": f.id,
            "name": f.name,
            "type": f.type,
            "created_at": f.created_at,
            "parent_id": f.parent_id,
            "depth": f.depth,
            "order_index": f.order_index,
            "files": [
                {"id": file.id, "name": file.name, "created_at": file.created_at}
                for file in f.files
            ],
            "children": [folder_to_dict(c, depth + 1) for c in (f.children or [])],
        }
    result = [folder_to_dict(f) for f in folders]
    return success_response(message="Lấy danh sách thư mục thành công", data=result)


@router.post("", status_code=201)
def create_folder(
    data: FolderCreate, session: SessionDep, current_user: CurrentActor
):
    folder = folder_crud.create_folder(session, data, current_user.id)
    folder_root = folder_crud.create_folder_root(session=session,user_id=current_user.id,folder_id=folder.id)
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


@router.post("/{folder_id}/subfolders", status_code=201)
def create_subfolder(
    folder_id: str,
    data: SubfolderCreate,
    session: SessionDep,
    current_user: CurrentActor
):
    """Create a subfolder under the specified folder."""
    try:
        subfolder = folder_crud.create_subfolder(session, folder_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=error_response(str(e)),
        )
    
    return success_response(
        message="Tạo thư mục con thành công",
        data={
            "id": subfolder.id,
            "name": subfolder.name,
            "type": subfolder.type,
            "parent_id": subfolder.parent_id,
            "depth": subfolder.depth,
            "created_at": subfolder.created_at,
            "files": [],
        },
    )


# ── Mindmap endpoints (PHẢI đặt TRƯỚC /{folder_id}) ──────────────────────

@router.get("/{folder_id}/mindmap")
async def get_mindmap(
    folder_id: str, session: SessionDep, current_user: CurrentActor
):
    """Lấy mindmap concept-based. Trả cache nếu có, nếu không thì sinh mới."""
    folder = folder_crud.get_folder(session, folder_id, current_user.id)
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )

    # Trả cache nếu đã có
    if folder.mindmap_json:
        try:
            cached = json.loads(folder.mindmap_json)
            return success_response(
                message="Lấy mindmap từ cache thành công",
                data=cached,
            )
        except (json.JSONDecodeError, TypeError):
            pass  # Cache bị lỗi → sinh lại

    # Sinh mới bằng AI
    files = folder.files or []
    if not files:
        return success_response(
            message="Folder chưa có nội dung",
            data={"root": {"label": folder.name, "description": "Chưa có bài học", "children": []}},
        )

    content_parts = []
    for f in files:
        content = f.markdown_content or ""
        # Lấy tối đa 2000 ký tự mỗi file để tránh quá dài
        truncated = content[:2000] if len(content) > 2000 else content
        content_parts.append(f"--- BÀI HỌC FILE_ID: \"{f.id}\" | TÊN: \"{f.name}\" ---\n{truncated}")

    combined = "\n\n".join(content_parts)
    mindmap_data = await generate_concept_mindmap(folder.name, combined)

    # Cache vào DB
    try:
        folder.mindmap_json = json.dumps(mindmap_data, ensure_ascii=False)
        session.add(folder)
        session.commit()
    except Exception as e:
        print(f"⚠️ [Mindmap cache save error]: {e}")

    return success_response(
        message="Tạo mindmap thành công",
        data=mindmap_data,
    )


@router.post("/{folder_id}/mindmap/regenerate")
async def regenerate_mindmap(
    folder_id: str, session: SessionDep, current_user: CurrentActor
):
    """Xóa cache và sinh lại mindmap bằng AI."""
    folder = folder_crud.get_folder(session, folder_id, current_user.id)
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )

    # 1. Kiểm tra Cooldown
    now = datetime.now(timezone.utc)
    if folder.last_mindmap_generated_at:
        # Tự động chuyển đổi dạng timezone-aware nếu từ DB trả về chưa có tzinfo
        last_gen = folder.last_mindmap_generated_at
        if last_gen.tzinfo is None:
            last_gen = last_gen.replace(tzinfo=timezone.utc)
            
        elapsed = (now - last_gen).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=429, 
                detail=error_response(f"Vui lòng chờ {remaining} giây trước khi yêu cầu tạo lại mindmap.")
            )

    files = folder.files or []
    if not files:
        return success_response(
            message="Folder chưa có nội dung",
            data={"root": {"label": folder.name, "description": "Chưa có bài học", "children": []}},
        )

    content_parts = []
    for f in files:
        content = f.markdown_content or ""
        truncated = content[:2000] if len(content) > 2000 else content
        content_parts.append(f"--- BÀI HỌC FILE_ID: \"{f.id}\" | TÊN: \"{f.name}\" ---\n{truncated}")

    combined = "\n\n".join(content_parts)
    mindmap_data = await generate_concept_mindmap(folder.name, combined)

    # 2. Cập nhật cache và thời gian Cooldown
    try:
        folder.mindmap_json = json.dumps(mindmap_data, ensure_ascii=False)
        folder.last_mindmap_generated_at = now
        session.add(folder)
        session.commit()
    except Exception as e:
        print(f"⚠️️ [Mindmap cache save error]: {e}")

    return success_response(
        message="Đã tạo lại mindmap thành công",
        data=mindmap_data,
    )


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str, session: SessionDep, current_user: CurrentActor
):
    deleted = folder_crud.delete_folder(session, folder_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )
    return success_response(message="Đã xóa thư mục và các file liên quan thành công")


class FolderName(BaseModel):
    name: str = Field(max_length=255)

    @field_validator("name")
    @classmethod
    def strip_control_chars(cls, v: str) -> str:
        """Strip non-printable control characters from folder name."""
        if not isinstance(v, str):
            return v
        # Remove null bytes, zero-width spaces, and other control characters
        return "".join(ch for ch in v if ch.isprintable() or ch in ("\t", "\n", "\r"))


class FolderReorder(BaseModel):
    folder_ids: List[str]


@router.put("/reorder")
def reorder_folders(
    data: FolderReorder, session: SessionDep, current_user: CurrentActor
):
    folders = folder_crud.reorder_folders(session, data.folder_ids, current_user.id)
    return success_response(
        message="Đã cập nhật thứ tự thư mục",
        data=[{"id": f.id, "order_index": f.order_index} for f in folders],
    )


@router.put("/{folder_id}")
def rename_folder(
    folder_id: str, folder_name: FolderName, session: SessionDep, current_user: CurrentActor
):
    folder = folder_crud.rename_folder(session, folder_id, current_user.id, folder_name.name)
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy folder")
        )
    return success_response(
        message="Đã cập nhật tên folder",
        data={"id": folder.id, "updated_at": folder.updated_at},
    )


# =====================================================================
# Chat History Endpoints
# =====================================================================

class ChatHistoryRequest(BaseModel):
    messages: List[dict]


@router.get("/{folder_id}/chat-history")
def get_chat_history(
    folder_id: str, session: SessionDep, current_user: CurrentActor
):
    """Get chat history for a folder."""
    history = folder_crud.get_folder_chat_history(session, folder_id, current_user.id)
    return success_response(message="Lấy lịch sử chat thành công", data=history)


@router.put("/{folder_id}/chat-history")
def save_chat_history(
    folder_id: str, data: ChatHistoryRequest, session: SessionDep, current_user: CurrentActor
):
    """Save chat history for a folder."""
    folder = folder_crud.save_folder_chat_history(session, folder_id, current_user.id, data.messages)
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )
    return success_response(message="Lưu lịch sử chat thành công", data=folder.conversation_history)
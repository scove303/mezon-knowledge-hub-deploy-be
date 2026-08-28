from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session

from app.core.database import get_session
from app.api.deps import CurrentActor
from app.crud.shared_chat import (
    create_shared_chat,
    get_shared_chat_by_code,
    get_shared_chat_by_id,
    get_user_shared_chats,
    get_public_shared_chats,
    increment_view_count,
    import_shared_chat,
    delete_shared_chat,
    build_share_url,
)
from app.schemas.shared_chat import (
    SharedChatCreate,
    SharedChatResponse,
    SharedChatDetail,
    ImportChatRequest,
    ImportChatResponse,
)
from app.schemas.common import error_response, success_response
from app.core.config import settings

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


@router.post("", status_code=201)
def share_chat(
    data: SharedChatCreate,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Share a folder + conversation as a chat."""
    try:
        shared_chat = create_shared_chat(session, current_user.id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(str(e)),
        )
    
    share_url = build_share_url(shared_chat.share_code, settings.FRONTEND_URL)
    
    return success_response(
        message="Chat shared successfully",
        data={
            "id": shared_chat.id,
            "share_code": shared_chat.share_code,
            "share_url": share_url,
            "title": shared_chat.title,
        },
    )


@router.get("/public")
def list_public_chats(
    session: SessionDep,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """Browse publicly shared chats."""
    chats = get_public_shared_chats(session, limit, offset)
    
    result = []
    for chat in chats:
        result.append(SharedChatResponse(
            id=chat.id,
            share_code=chat.share_code,
            title=chat.title,
            description=chat.description,
            topic=chat.topic,
            creator_username=chat.creator.username if chat.creator else "Unknown",
            creator_display_name=chat.creator.display_name if chat.creator else None,
            is_public=chat.is_public,
            import_count=chat.import_count,
            view_count=chat.view_count,
            created_at=chat.created_at,
            expires_at=chat.expires_at,
            share_url=build_share_url(chat.share_code, settings.FRONTEND_URL),
        ))
    
    return success_response(
        message="Public chats retrieved",
        data=result,
    )


@router.get("/my")
def list_my_shared_chats(
    session: SessionDep,
    current_user: CurrentActor,
):
    """List current user's shared chats."""
    chats = get_user_shared_chats(session, current_user.id)
    
    result = []
    for chat in chats:
        result.append(SharedChatResponse(
            id=chat.id,
            share_code=chat.share_code,
            title=chat.title,
            description=chat.description,
            topic=chat.topic,
            creator_username=chat.creator.username if chat.creator else "Unknown",
            creator_display_name=chat.creator.display_name if chat.creator else None,
            is_public=chat.is_public,
            import_count=chat.import_count,
            view_count=chat.view_count,
            created_at=chat.created_at,
            expires_at=chat.expires_at,
            share_url=build_share_url(chat.share_code, settings.FRONTEND_URL),
        ))
    
    return success_response(
        message="Your shared chats retrieved",
        data=result,
    )


@router.get("/{share_code}")
def get_shared_chat(
    share_code: str,
    session: SessionDep,
):
    """Get shared chat detail (public access)."""
    chat = get_shared_chat_by_code(session, share_code)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response("Shared chat not found or expired"),
        )
    
    increment_view_count(session, chat.id)
    
    return success_response(
        message="Shared chat retrieved",
        data=SharedChatDetail(
            id=chat.id,
            share_code=chat.share_code,
            title=chat.title,
            description=chat.description,
            topic=chat.topic,
            creator_username=chat.creator.username if chat.creator else "Unknown",
            creator_display_name=chat.creator.display_name if chat.creator else None,
            is_public=chat.is_public,
            import_count=chat.import_count,
            view_count=chat.view_count,
            created_at=chat.created_at,
            expires_at=chat.expires_at,
            share_url=build_share_url(chat.share_code, settings.FRONTEND_URL),
            folder_snapshot=chat.folder_snapshot,
            conversation_history=chat.conversation_history,
        ),
    )


@router.post("/import")
def import_chat(
    data: ImportChatRequest,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Import a shared chat to user's account."""
    try:
        folder, chat_import = import_shared_chat(session, current_user.id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(str(e)),
        )
    
    return success_response(
        message="Chat imported successfully",
        data=ImportChatResponse(
            folder_id=folder.id,
            folder_name=folder.name,
            files_count=len(folder.files),
            message=f"Imported to folder '{folder.name}' with {len(folder.files)} files",
        ),
    )


@router.delete("/{chat_id}")
def delete_shared_chat_endpoint(
    chat_id: str,
    session: SessionDep,
    current_user: CurrentActor,
):
    """Delete own shared chat."""
    success = delete_shared_chat(session, chat_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response("Shared chat not found or access denied"),
        )
    return success_response(message="Shared chat deleted")
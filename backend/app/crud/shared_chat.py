import uuid
from typing import Optional, List
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.models.shared_chat import SharedChat, ChatImport
from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile
from app.schemas.shared_chat import SharedChatCreate, ImportChatRequest


def create_shared_chat(session: Session, user_id: int, data: SharedChatCreate) -> SharedChat:
    # Get folder with files
    folder = session.get(Folder, data.folder_id)
    if not folder or folder.user_id != user_id:
        raise ValueError("Folder not found or access denied")
    
    # Build folder snapshot
    files_data = []
    for f in folder.files:
        files_data.append({
            "id": f.id,
            "name": f.name,
            "markdown_content": f.markdown_content,
            "summary": f.summary,
            "video_url": f.video_url,
            "timestamps_json": f.timestamps_json,
            "order_index": f.order_index,
        })
    
    folder_snapshot = {
        "name": folder.name,
        "type": folder.type,
        "files": files_data,
    }
    
    # Calculate expiration
    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)
    
    shared_chat = SharedChat(
        creator_id=user_id,
        folder_snapshot=folder_snapshot,
        conversation_history=data.conversation_history,
        title=data.title,
        description=data.description,
        topic=data.topic,
        is_public=data.is_public,
        expires_at=expires_at,
    )
    
    session.add(shared_chat)
    session.commit()
    session.refresh(shared_chat)
    return shared_chat


def get_shared_chat_by_code(session: Session, share_code: str) -> Optional[SharedChat]:
    chat = session.exec(
        select(SharedChat).where(SharedChat.share_code == share_code)
    ).first()
    
    if not chat:
        return None
    
    # Check expiration
    if chat.expires_at and chat.expires_at < datetime.utcnow():
        return None
    
    return chat


def get_shared_chat_by_id(session: Session, chat_id: str) -> Optional[SharedChat]:
    return session.get(SharedChat, chat_id)


def get_user_shared_chats(session: Session, user_id: int) -> List[SharedChat]:
    return session.exec(
        select(SharedChat)
        .where(SharedChat.creator_id == user_id)
        .order_by(SharedChat.created_at.desc())
    ).all()


def get_public_shared_chats(session: Session, limit: int = 20, offset: int = 0) -> List[SharedChat]:
    return session.exec(
        select(SharedChat)
        .where(SharedChat.is_public == True)
        .where(
            (SharedChat.expires_at.is_(None)) | (SharedChat.expires_at > datetime.utcnow())
        )
        .order_by(SharedChat.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()


def increment_view_count(session: Session, chat_id: str) -> None:
    chat = session.get(SharedChat, chat_id)
    if chat:
        chat.view_count += 1
        session.add(chat)
        session.commit()


def import_shared_chat(session: Session, user_id: int, data: ImportChatRequest) -> tuple[Folder, ChatImport]:
    shared_chat = get_shared_chat_by_code(session, data.share_code)
    if not shared_chat:
        raise ValueError("Shared chat not found or expired")
    
    # Check if already imported
    existing = session.exec(
        select(ChatImport).where(
            ChatImport.shared_chat_id == shared_chat.id,
            ChatImport.importer_id == user_id
        )
    ).first()
    if existing:
        raise ValueError("Already imported this chat")
    
    # Clone folder from snapshot
    folder_name = data.new_folder_name or shared_chat.folder_snapshot.get("name", "Imported Chat")
    base_name = folder_name
    counter = 1
    while session.exec(select(Folder).where(Folder.name == folder_name, Folder.user_id == user_id)).first():
        folder_name = f"{base_name} ({counter})"
        counter += 1
    
    folder = Folder(
        name=folder_name,
        type="shared_import",
        user_id=user_id,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    
    # Clone files
    files_snapshot = shared_chat.folder_snapshot.get("files", [])
    for idx, f_data in enumerate(files_snapshot):
        file = KnowledgeFile(
            id=f"file-{uuid.uuid4().hex[:8]}",
            name=f_data.get("name", "Untitled"),
            markdown_content=f_data.get("markdown_content", ""),
            summary=f_data.get("summary", ""),
            video_url=f_data.get("video_url"),
            timestamps_json=f_data.get("timestamps_json"),
            order_index=idx,
            folder_id=folder.id,
            user_id=user_id,
        )
        session.add(file)
    
    # Record import
    chat_import = ChatImport(
        shared_chat_id=shared_chat.id,
        importer_id=user_id,
        folder_id=folder.id,
    )
    session.add(chat_import)
    
    # Update stats
    shared_chat.import_count += 1
    session.add(shared_chat)
    
    session.commit()
    session.refresh(folder)
    session.refresh(chat_import)
    
    return folder, chat_import


def delete_shared_chat(session: Session, chat_id: str, user_id: int) -> bool:
    chat = session.get(SharedChat, chat_id)
    if not chat or chat.creator_id != user_id:
        return False
    session.delete(chat)
    session.commit()
    return True


def build_share_url(share_code: str, base_url: str = "https://mezon.ai") -> str:
    return f"{base_url}/shared/chat/{share_code}"
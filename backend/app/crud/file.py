import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Session

from app.models.knowledge_file import KnowledgeFile
from app.schemas.file import FileCreate, FileUpdate


def get_file(session: Session, file_id: str) -> Optional[KnowledgeFile]:
    return session.get(KnowledgeFile, file_id)


def create_file(session: Session, folder_id: str, data: FileCreate) -> KnowledgeFile:
    file = KnowledgeFile(
        id=f"file-{uuid.uuid4().hex[:8]}",
        folder_id=folder_id,
        name=data.name,
        markdown_content=data.content,
    )
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def update_file(
    session: Session, file_id: str, data: FileUpdate
) -> Optional[KnowledgeFile]:
    file = get_file(session, file_id)
    if not file:
        return None
    file.markdown_content = data.content
    file.updated_at = datetime.utcnow()
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def delete_file(session: Session, file_id: str) -> bool:
    file = get_file(session, file_id)
    if not file:
        return False
    session.delete(file)
    session.commit()
    return True

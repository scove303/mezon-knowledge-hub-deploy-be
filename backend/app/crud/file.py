import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.folder import Folder
from app.models.knowledge_file import FileRevision, KnowledgeFile
from app.schemas.file import FileCreate, FileUpdate


def get_file(session: Session, file_id: str, user_id: Optional[int] = None) -> Optional[KnowledgeFile]:
    if user_id is not None:
        return session.exec(
            select(KnowledgeFile)
            .join(Folder, KnowledgeFile.folder_id == Folder.id)
            .where(KnowledgeFile.id == file_id, Folder.user_id == user_id)
        ).first()
    return session.get(KnowledgeFile, file_id)


def create_file(session: Session, folder_id: str, data: FileCreate) -> KnowledgeFile:
    max_order = session.exec(
        select(func.max(KnowledgeFile.order_index)).where(
            KnowledgeFile.folder_id == folder_id
        )
    ).one()
    file = KnowledgeFile(
        id=f"file-{uuid.uuid4().hex[:8]}",
        folder_id=folder_id,
        name=data.name,
        markdown_content=data.content,
        order_index=(max_order or -1) + 1,
    )
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def update_file(
    session: Session, file_id: str, data: FileUpdate, user_id: Optional[int] = None
) -> Optional[KnowledgeFile]:
    file = get_file(session, file_id, user_id)
    if not file:
        return None
    # Lưu snapshot bản hiện tại trước khi ghi đè (version history)
    if file.markdown_content != data.content:
        session.add(
            FileRevision(
                id=f"rev-{uuid.uuid4().hex[:8]}",
                file_id=file.id,
                content=file.markdown_content,
            )
        )
    file.markdown_content = data.content
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def rename_file(session: Session, file_id: str, name: str, user_id: Optional[int] = None) -> Optional[KnowledgeFile]:
    file = get_file(session, file_id, user_id)
    if not file:
        return None
    file.name = name
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def move_file(
    session: Session, file_id: str, folder_id: str, user_id: int
) -> Optional[KnowledgeFile]:
    file = get_file(session, file_id, user_id)
    if not file:
        return None

    # Chỉ cho phép di chuyển vào folder thuộc về user hiện tại
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
    ).first()
    if not folder:
        return None

    max_order = session.exec(
        select(func.max(KnowledgeFile.order_index)).where(
            KnowledgeFile.folder_id == folder_id
        )
    ).one()
    file.folder_id = folder_id
    file.order_index = (max_order or -1) + 1
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()
    session.refresh(file)
    return file


def delete_file(session: Session, file_id: str, user_id: Optional[int] = None) -> bool:
    file = get_file(session, file_id, user_id)
    if not file:
        return False
    # Xóa revisions trước để không vi phạm khóa ngoại file_revisions.file_id
    for rev in list_revisions(session, file_id, user_id):
        session.delete(rev)
    session.delete(file)
    session.commit()
    return True


def list_revisions(session: Session, file_id: str, user_id: Optional[int] = None) -> List[FileRevision]:
    file = get_file(session, file_id, user_id)
    if not file:
        return []
    return list(session.exec(
        select(FileRevision)
        .where(FileRevision.file_id == file_id)
        .order_by(FileRevision.created_at.desc())
    ).all())


def restore_revision(
    session: Session, file_id: str, revision_id: str, user_id: Optional[int] = None
) -> Optional[KnowledgeFile]:
    file = get_file(session, file_id, user_id)
    if not file:
        return None
    revision = session.get(FileRevision, revision_id)
    if not revision or revision.file_id != file_id:
        return None
    # Snapshot bản hiện tại trước khi khôi phục để không mất dữ liệu
    session.add(
        FileRevision(
            id=f"rev-{uuid.uuid4().hex[:8]}",
            file_id=file.id,
            content=file.markdown_content,
        )
    )
    file.markdown_content = revision.content
    file.updated_at = datetime.now(timezone.utc)
    session.add(file)
    session.commit()
    session.refresh(file)
    return file

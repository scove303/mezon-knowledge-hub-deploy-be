import uuid
from typing import Optional

from sqlmodel import Session, select

from app.models.folder import Folder, FolderRoot
from app.schemas.folder import FolderCreate
from sqlalchemy.orm import selectinload


def get_folders_by_user(session: Session, user_id: int) -> list[Folder]:
    statement = (
        select(Folder)
        .where(Folder.user_id == user_id)
        .options(selectinload(Folder.files))
        .order_by(Folder.created_at)
    )
    folders = list(session.exec(statement).all())
    for folder in folders:
        folder.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
    return folders


def get_folder(session: Session, folder_id: str, user_id: int) -> Optional[Folder]:
    statement = select(Folder).where(
        Folder.id == folder_id, Folder.user_id == user_id
    )
    return session.exec(statement).first()


def create_folder(session: Session, data: FolderCreate, user_id: int) -> Folder:
    folder = Folder(
        id=f"folder-{uuid.uuid4().hex[:8]}",
        name=data.name,
        type=data.type,
        user_id=user_id,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder


def delete_folder(session: Session, folder_id: str, user_id: int) -> bool:
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return False
    # Xóa tay các file (kèm revisions) và folder_root để tránh vi phạm khóa ngoại
    from app.models.knowledge_file import KnowledgeFile, FileRevision

    for f in session.exec(
        select(KnowledgeFile).where(KnowledgeFile.folder_id == folder_id)
    ).all():
        for rev in session.exec(
            select(FileRevision).where(FileRevision.file_id == f.id)
        ).all():
            session.delete(rev)
        session.delete(f)
    for root in session.exec(
        select(FolderRoot).where(FolderRoot.folder_id == folder_id)
    ).all():
        session.delete(root)
    session.delete(folder)
    session.commit()
    return True


def create_folder_root(session: Session, user_id: int, folder_id: str) -> FolderRoot:

    existing_root = session.exec(
        select(FolderRoot).where(FolderRoot.user_id == user_id)
    ).first()

    if existing_root:
        return existing_root

    folder_root = FolderRoot(
        user_id=user_id,
        folder_id=folder_id,
    )
    session.add(folder_root)
    session.commit()
    session.refresh(folder_root)

    return folder_root


def rename_folder(
    session: Session, folder_id: str, user_id: int, new_name: str
) -> Optional[Folder]:
    # 1. Tìm folder theo ID và user_id
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return None

    # 2. Cập nhật tên mới
    folder.name = new_name
    
    # 3. Lưu vào DB & refresh lại data
    session.add(folder)
    session.commit()
    session.refresh(folder)
    
    return folder
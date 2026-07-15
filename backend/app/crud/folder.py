import uuid
from typing import Optional

from sqlmodel import Session, select

from app.models.folder import Folder
from app.schemas.folder import FolderCreate


def get_folders_by_user(session: Session, user_id: int) -> list[Folder]:
    statement = select(Folder).where(Folder.user_id == user_id)
    return list(session.exec(statement).all())


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
    session.delete(folder)
    session.commit()
    return True

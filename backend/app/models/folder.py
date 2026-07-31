from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.knowledge_file import KnowledgeFile


class Folder(SQLModel, table=True):
    __tablename__ = "folders"

    id: str = Field(default_factory=lambda: f"folder-{uuid.uuid4().hex[:8]}", primary_key=True)
    name: str = Field(max_length=255)
    type: str = Field(default="general", max_length=20)
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="folders")
    files: List["KnowledgeFile"] = Relationship(back_populates="folder")
    root_entry: Optional["FolderRoot"] = Relationship(back_populates="folder")

class FolderRoot(SQLModel,table = True):
    __tablename__ = "folder_roots"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    folder_id: str = Field(foreign_key="folders.id", unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="root_link")
    folder: Optional[Folder] = Relationship(back_populates="root_entry")

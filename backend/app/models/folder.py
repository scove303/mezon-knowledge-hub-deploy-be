from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel, Relationship, JSON
from sqlalchemy import CheckConstraint, Column

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.knowledge_file import KnowledgeFile


class Folder(SQLModel, table=True):
    __tablename__ = "folders"
    __table_args__ = (
        CheckConstraint("depth >= 0 AND depth <= 4", name="ck_folder_depth"),
    )

    id: str = Field(default_factory=lambda: f"folder-{uuid.uuid4().hex[:8]}", primary_key=True)
    name: str = Field(max_length=255)
    type: str = Field(default="general", max_length=20)
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    order_index: int = Field(default=0)
    last_mindmap_generated_at: Optional[datetime] = Field(default=None)

    # Hierarchical structure
    parent_id: Optional[str] = Field(foreign_key="folders.id", index=True, default=None)
    depth: int = Field(default=0)  # 0=root, 1=category, 2=subtopic, 3=detail, 4=max

    user: Optional["User"] = Relationship(back_populates="folders")
    files: List["KnowledgeFile"] = Relationship(back_populates="folder", cascade_delete=True)
    root_entry: Optional["FolderRoot"] = Relationship(back_populates="folder", cascade_delete=True)
    prompt_embedding: Optional[str] = Field(default=None, sa_type=JSON)
    mindmap_json: Optional[str] = Field(default=None)  # Cached AI-generated concept mindmap
    conversation_history: Optional[List[dict]] = Field(default=None, sa_column=Column(JSON))

    # Hierarchical relationships
    parent: Optional["Folder"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Folder.id", "foreign_keys": "Folder.parent_id"},
    )
    children: List["Folder"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"foreign_keys": "Folder.parent_id"},
    )

class FolderRoot(SQLModel, table=True):
    __tablename__ = "folder_roots"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    folder_id: str = Field(foreign_key="folders.id", unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="root_link")
    folder: Optional[Folder] = Relationship(back_populates="root_entry")

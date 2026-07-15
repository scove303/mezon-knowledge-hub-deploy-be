from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.knowledge_file import KnowledgeFile


class Folder(SQLModel, table=True):
    __tablename__ = "folders"

    id: str = Field(primary_key=True, max_length=50)
    name: str = Field(max_length=255)
    type: str = Field(default="general", max_length=20)  # roadmap | document | video | general
    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="folders")
    files: List["KnowledgeFile"] = Relationship(back_populates="folder")

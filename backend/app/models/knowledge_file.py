from typing import Optional, Any, TYPE_CHECKING
from datetime import datetime

from sqlalchemy import JSON, Text
from sqlmodel import Field, SQLModel, Relationship, Column

if TYPE_CHECKING:
    from app.models.folder import Folder


class KnowledgeFile(SQLModel, table=True):
    __tablename__ = "knowledge_files"

    id: str = Field(primary_key=True, max_length=50)
    folder_id: str = Field(foreign_key="folders.id", index=True,ondelete="CASCADE")
    name: str = Field(max_length=255)
    summary: Optional[str] = Field(default="", max_length=500)
    markdown_content: str = Field(sa_column=Column(Text, nullable=False, default=""))
    video_url: Optional[str] = Field(default=None, max_length=500)
    timestamps_json: Optional[Any] = Field(default=None, sa_column=Column(JSON))
    order_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    folder: Optional["Folder"] = Relationship(back_populates="files")

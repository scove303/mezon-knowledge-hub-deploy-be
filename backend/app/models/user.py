from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.folder import Folder, FolderRoot
    from app.models.shared_chat import SharedChat, ChatImport


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    display_name: Optional[str] = None
    email: Optional[str] = Field(default=None, unique=True)
    avatar_url: Optional[str] = None
    mezon_id: Optional[str] = Field(default=None, unique=True, index=True)
    hashed_password: str
    role: str = Field(default="USER")
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    root_link: Optional["FolderRoot"] = Relationship(back_populates="user")
    
    folders: List["Folder"] = Relationship(back_populates="user")
    shared_chats: List["SharedChat"] = Relationship(back_populates="creator")
    chat_imports: List["ChatImport"] = Relationship(back_populates="importer")
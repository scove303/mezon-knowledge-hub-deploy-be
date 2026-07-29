from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.folder import Folder,FolderRoot


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    display_name: Optional[str] = None
    hashed_password: str
    role: str = Field(default="USER")
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    email: str | None = Field(default=None, unique=True)
    avatar_url: str | None = Field(default=None)
    root_link: Optional["FolderRoot"] = Relationship(back_populates="user")
    
    folders: List["Folder"] = Relationship(back_populates="user")
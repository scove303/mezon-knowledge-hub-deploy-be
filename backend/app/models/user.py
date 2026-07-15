from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.folder import Folder


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=100, unique=True, index=True)
    display_name: Optional[str] = Field(default=None, max_length=100)
    hashed_password: str
    role: str = Field(default="USER", max_length=20)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    folders: List["Folder"] = Relationship(back_populates="user")

from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid
import json

from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from sqlalchemy import Text

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.folder import Folder


class SharedChat(SQLModel, table=True):
    """Shareable chat session containing roadmap conversation + folder snapshot."""
    __tablename__ = "shared_chats"

    id: str = Field(default_factory=lambda: f"chat-{uuid.uuid4().hex[:10]}", primary_key=True)
    
    # Original creator
    creator_id: int = Field(foreign_key="users.id", index=True)
    
    # Shared folder snapshot (cloned on import)
    folder_snapshot: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    # Conversation history (Q&A during roadmap generation)
    conversation_history: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    
    # Metadata
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    topic: str = Field(max_length=500)
    
    # Share settings
    is_public: bool = Field(default=True)
    share_code: str = Field(default_factory=lambda: uuid.uuid4().hex[:8], unique=True, index=True)
    
    # Stats
    import_count: int = Field(default=0)
    view_count: int = Field(default=0)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)

    creator: Optional["User"] = Relationship(back_populates="shared_chats")
    imports: List["ChatImport"] = Relationship(back_populates="shared_chat", cascade_delete=True)


class ChatImport(SQLModel, table=True):
    """Track when a user imports a shared chat."""
    __tablename__ = "chat_imports"

    id: Optional[int] = Field(default=None, primary_key=True)
    shared_chat_id: str = Field(foreign_key="shared_chats.id", index=True)
    importer_id: int = Field(foreign_key="users.id", index=True)
    folder_id: str = Field(foreign_key="folders.id", index=True)  # The cloned folder
    imported_at: datetime = Field(default_factory=datetime.utcnow)

    shared_chat: Optional["SharedChat"] = Relationship(back_populates="imports")
    importer: Optional["User"] = Relationship()
    folder: Optional["Folder"] = Relationship()


# Add to User model relationships
# User.shared_chats: List[SharedChat] = Relationship(back_populates="creator")
# User.chat_imports: List[ChatImport] = Relationship(back_populates="importer")
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SharedChatCreate(BaseModel):
    folder_id: str = Field(..., description="Folder to share")
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    topic: str = Field(..., max_length=500)
    conversation_history: List[dict] = Field(default_factory=list)
    is_public: bool = True
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class SharedChatResponse(BaseModel):
    id: str
    share_code: str
    title: str
    description: Optional[str]
    topic: str
    creator_username: str
    creator_display_name: Optional[str]
    is_public: bool
    import_count: int
    view_count: int
    created_at: datetime
    expires_at: Optional[datetime]
    share_url: str


class SharedChatDetail(SharedChatResponse):
    folder_snapshot: dict
    conversation_history: List[dict]


class ImportChatRequest(BaseModel):
    share_code: str
    new_folder_name: Optional[str] = None


class ImportChatResponse(BaseModel):
    folder_id: str
    folder_name: str
    files_count: int
    message: str
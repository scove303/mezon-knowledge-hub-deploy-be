from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import json


class SharedChatCreate(BaseModel):
    folder_id: str = Field(..., description="Folder to share")
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    topic: str = Field(..., max_length=500)
    conversation_history: List[dict] = Field(default_factory=list)
    is_public: bool = True
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)

    @field_validator("conversation_history")
    @classmethod
    def validate_conversation_history(cls, v: List[dict]) -> List[dict]:
        """Validate conversation history size and content."""
        # Limit total size to ~500KB (500 * 1024 characters approx)
        total_size = len(json.dumps(v, ensure_ascii=False))
        max_size = 500 * 1024  # 500 KB
        if total_size > max_size:
            raise ValueError(f"conversation_history too large ({total_size} bytes). Max: {max_size} bytes")
        
        # Limit number of messages
        max_messages = 1000
        if len(v) > max_messages:
            raise ValueError(f"Too many messages ({len(v)}). Max: {max_messages}")
        
        return v

    @field_validator("conversation_history")
    @classmethod
    def sanitize_messages(cls, v: List[dict]) -> List[dict]:
        """Sanitize message content to strip control characters."""
        sanitized = []
        for msg in v:
            if not isinstance(msg, dict):
                continue
            sanitized_msg = {}
            for key, value in msg.items():
                if isinstance(value, str):
                    # Strip control characters but preserve newlines/tabs
                    sanitized_msg[key] = "".join(
                        ch for ch in value if ch.isprintable() or ch in ("\t", "\n", "\r")
                    )
                else:
                    sanitized_msg[key] = value
            sanitized.append(sanitized_msg)
        return sanitized


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
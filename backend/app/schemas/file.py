from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel


class TimestampItem(BaseModel):
    time: str
    seconds: int
    text: str


class FileCreate(BaseModel):
    name: str
    content: str = ""


class FileUpdate(BaseModel):
    content: str


class FileRead(BaseModel):
    id: str
    name: str
    content: str
    video_url: Optional[str] = None
    timestamps: Optional[List[TimestampItem]] = None
    created_at: datetime
    model_config = {"from_attributes": True}

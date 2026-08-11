# app/schemas/roadmap.py
from pydantic import BaseModel, Field
from typing import Optional

class RoadmapCreateRequest(BaseModel):
    topic: str = Field(
        ..., 
        description="Target topic for the roadmap",
        example="Mastering FastAPI and Microservices"
    )
    folder_name: Optional[str] = Field(
        None, 
        description="Optional custom folder name",
        example="FastAPI Masterclass 2026"
    )


class RoadmapFollowUpRequest(BaseModel):
    conversation_id: str = Field(
        ...,
        description="Folder ID of the existing roadmap (conversation) to continue",
        example="folder-a1b2c3d4",
    )
    topic: str = Field(
        ...,
        description="Follow-up prompt: ask a question or request to edit old content",
        example="Viết thêm ví dụ thực tế cho bài 3",
    )
    folder_name: Optional[str] = Field(
        None,
        description="Optional new folder name",
        example="FastAPI Masterclass 2026 (nâng cao)",
    )
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
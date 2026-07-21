from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from file import FileItem


class FileInFolder(BaseModel):
    id: str
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}


class FolderCreate(BaseModel):
    name: str
    type: str = "general"


class FolderRead(BaseModel):
    id: str
    name: str
    type: str
    created_at: datetime
    files: List[FileInFolder] = []
    model_config = {"from_attributes": True}

class RoadmapResponse(BaseModel):
    folder_name: str
    files: List[FileItem]

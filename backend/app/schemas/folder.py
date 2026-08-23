from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.schemas.file import FileItem


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


# Hierarchical folder schemas
class SubfolderCreate(BaseModel):
    name: str
    type: str = "general"


class FolderTreeNode(BaseModel):
    id: str
    name: str
    type: str
    depth: int
    created_at: datetime
    files: List[FileInFolder] = []
    children: List["FolderTreeNode"] = []
    model_config = {"from_attributes": True}


class BreadcrumbItem(BaseModel):
    id: str
    name: str
    type: str
    model_config = {"from_attributes": True}


class MoveFolderRequest(BaseModel):
    new_parent_id: Optional[str] = None


# File linking schemas
class FileLinkCreate(BaseModel):
    source_file_id: str
    target_file_id: str
    link_type: str = "reference"


class FileLinkRead(BaseModel):
    source_file_id: str
    target_file_id: str
    link_type: str
    created_at: datetime
    model_config = {"from_attributes": True}


class DeepDiveRequest(BaseModel):
    topic: str
    context: Optional[str] = None  # Selected text or chat context
    parent_files: Optional[List[str]] = None  # File IDs to reference


class DeepDiveResponse(BaseModel):
    subfolder_name: str
    subfolder_summary: str
    key_concepts: List[str]
    parent_files_to_reference: List[str]


# Update forward references
FolderTreeNode.model_rebuild()

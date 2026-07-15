from typing import Optional, Any
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON
from datetime import datetime

class ProcessingJob(SQLModel, table=True):
    __tablename__ = "processing_jobs"

    id: str = Field(primary_key=True, max_length=50)
    job_type: str = Field(max_length=50)  # e.g., 'roadmap', 'digest', 'youtube'
    status: str = Field(default="pending", max_length=20)  # pending, processing, done, failed
    result_data: Optional[Any] = Field(default=None, sa_column=Column(JSON))
    error_message: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

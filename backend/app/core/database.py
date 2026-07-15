from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

# Import models for create_all to detect them
from app.models.user import User
from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile
from app.models.processing_job import ProcessingJob

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

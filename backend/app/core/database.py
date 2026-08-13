from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy import text, inspect

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


def run_migrations() -> None:
    """Migration nhẹ chạy khi khởi động (hỗ trợ cả MySQL và SQLite)."""
    inspector = inspect(engine)
    if "knowledge_files" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("knowledge_files")}
    if "summary" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE knowledge_files "
                    "ADD COLUMN summary VARCHAR(500) NOT NULL DEFAULT ''"
                )
            )


def get_session():
    with Session(engine) as session:
        yield session

import uuid
from sqlmodel import Session
from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile
from app.schemas.folder import FolderCreate
from app.crud.folder import create_folder

def store_folder_structure_roadmap(session: Session, user_id: int, roadmap_data: dict) -> Folder:
    folder_in = FolderCreate(
        name=roadmap_data.get("folder_name", "Lộ trình học tập mới"),
        type="roadmap"
    )

    new_folder = create_folder(session=session, data=folder_in, user_id=user_id)

    files_to_create = []
    for file_info in roadmap_data.get("files", []):
        new_file = KnowledgeFile(
            id=f"file-{uuid.uuid4().hex[:8]}",
            name=file_info.get("title", "Bài học không tên"),
            markdown_content=file_info.get("text_content", ""),
            folder_id=new_folder.id
        )
        files_to_create.append(new_file)

    if files_to_create:
        session.add_all(files_to_create)
        session.commit()
        session.refresh(new_folder)

    return new_folder
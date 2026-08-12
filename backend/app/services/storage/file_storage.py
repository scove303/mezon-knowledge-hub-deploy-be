import uuid
from sqlmodel import Session, select
from app.models.folder import Folder, FolderRoot

from app.models.knowledge_file import KnowledgeFile
from app.schemas.folder import FolderCreate
from app.crud.folder import create_folder


def store_folder_structure_roadmap(session: Session, user_id: int, roadmap_data: dict) -> Folder:
    # 1. Tạo Folder Lộ trình mới bằng CRUD
    folder_in = FolderCreate(
        name=roadmap_data.get("folder_name", "Lộ trình học tập mới"),
        type="roadmap"
    )
    new_folder = create_folder(session=session, data=folder_in, user_id=user_id)

    # 2. implement FOLDER ROOT
    statement = select(FolderRoot).where(FolderRoot.user_id == user_id)
    existing_root = session.exec(statement).first()

    
    if not existing_root:
        new_root = FolderRoot(
            user_id=user_id,
            folder_id=new_folder.id
        )
        session.add(new_root)

    # 3. Tạo danh sách bài học (KnowledgeFile)
    files_to_create = []
    for index, file_info in enumerate(roadmap_data.get("files", [])):
        new_file = KnowledgeFile(
            id=f"file-{uuid.uuid4().hex[:8]}",
            name=file_info.get("title", "Bài học không tên"),
            summary=file_info.get("summary", ""),
            markdown_content=file_info.get("text_content", ""),
            folder_id=new_folder.id,
            order_index=index
        )
        files_to_create.append(new_file)

    # 4. insert lession list và Commit 1 lần cho tối ưu DB
    if files_to_create:
        session.add_all(files_to_create)

    # Commit chung cho cả FolderRoot (nếu có) và Files
    session.commit()
    session.refresh(new_folder)

    return new_folder
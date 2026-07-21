from crud.file import *
from crud.folder import *

async def store_folder_structure_roadmap(session:Session,user_id: int, roadmap_data:dict) -> Folder:
    folder_in = FolderCreate(
        name=roadmap_data.get("folder_name", "Lộ trình học tập mới"),
        type="roadmap"  # Hoặc gemini_data.get("folder_type", "roadmap")
    )

    # 2. DÙNG CHÍNH HÀM CRUD CỦA ÔNG ĐỂ TẠO FOLDER
    new_folder = create_folder(session=session, data=folder_in, user_id=user_id)

    # 3. Tạo các bài viết con (KnowledgeFile) thuộc Folder vừa tạo
    files_to_create = []
    for file_info in roadmap_data.get("files", []):
        new_file = KnowledgeFile(
            id=f"file-{uuid.uuid4().hex[:8]}", # Hoặc UUID ngẫu nhiên theo cách của ông
            title=file_info.get("title", "Bài học không tên"),
            text_content=file_info.get("text_content", ""),
            folder_id=new_folder.id  # Đính khóa ngoại folder_id vừa tạo
        )
        files_to_create.append(new_file)

    # 4. Lưu tất cả bài viết vào Session cùng lúc
    if files_to_create:
        session.add_all(files_to_create)
        session.commit()
        session.refresh(new_folder)

    return new_folder

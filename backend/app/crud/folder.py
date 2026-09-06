import uuid
from typing import Optional, List
from collections import deque

from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.models.folder import Folder, FolderRoot
from app.models.knowledge_file import KnowledgeFile, FileLink, FileRevision
from app.schemas.folder import FolderCreate
from sqlalchemy.orm import selectinload
from sqlalchemy import func


def get_folders_by_user(session: Session, user_id: int) -> list[Folder]:
    all_folders_stmt = (
        select(Folder)
        .where(Folder.user_id == user_id)
        .options(selectinload(Folder.files), selectinload(Folder.children))
        .order_by(Folder.order_index, Folder.created_at)
    )
    all_folders = list(session.exec(all_folders_stmt).all())
    for folder in all_folders:
        folder.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
        folder.children.sort(key=lambda f: (f.order_index, f.created_at, f.id))
    return [f for f in all_folders if f.depth == 0 or not f.parent_id]



def get_folder(session: Session, folder_id: str, user_id: int) -> Optional[Folder]:
    # Load folder with files only, then load children separately if needed
    statement = (
        select(Folder)
        .where(Folder.id == folder_id, Folder.user_id == user_id)
        .options(selectinload(Folder.files))
    )
    folder = session.exec(statement).first()
    if folder:
        folder.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
        # Load immediate children
        children_stmt = (
            select(Folder)
            .where(Folder.parent_id == folder_id, Folder.user_id == user_id)
            .options(selectinload(Folder.files))
            .order_by(Folder.order_index, Folder.created_at)
        )
        children = list(session.exec(children_stmt).all())
        for child in children:
            child.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
        folder.children = children
    return folder


def create_folder(session: Session, data: FolderCreate, user_id: int, parent_id: Optional[str] = None) -> Folder:
    depth = 0
    if parent_id:
        parent = session.get(Folder, parent_id)
        if parent:
            depth = parent.depth + 1
    
    print(f"🔧 [create_folder] parent_id={parent_id}, calculated_depth={depth}")
    
    folder = Folder(
        id=f"folder-{uuid.uuid4().hex[:8]}",
        name=data.name,
        type=data.type,
        user_id=user_id,
        parent_id=parent_id,
        depth=depth,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    
    print(f"🔍 [create_folder] After commit: folder.id={folder.id}, folder.parent_id={folder.parent_id}, folder.depth={folder.depth}")
    return folder


def create_subfolder(session: Session, parent_folder_id: str, data: FolderCreate, user_id: int) -> Folder:
    """Create a subfolder under a parent folder."""
    parent = session.get(Folder, parent_folder_id)
    if not parent or parent.user_id != user_id:
        raise ValueError("Parent folder not found or access denied")
    
    if parent.depth >= 4:
        raise ValueError("Cannot create subfolder: maximum depth (4) reached")
    
    print(f"🔧 [create_subfolder] parent.id={parent.id}, parent.depth={parent.depth}, parent_folder_id={parent_folder_id}")
    
    subfolder = create_folder(session, data, user_id, parent_folder_id)
    
    # Verify parent_id is correctly persisted
    session.refresh(subfolder)
    print(f"🔍 [create_subfolder] After create_folder: subfolder.id={subfolder.id}, subfolder.parent_id={subfolder.parent_id}, subfolder.depth={subfolder.depth}")
    
    if subfolder.parent_id != parent_folder_id:
        print(f"⚠️ [create_subfolder] parent_id mismatch! Expected: {parent_folder_id}, Got: {subfolder.parent_id}")
        subfolder.parent_id = parent_folder_id
        subfolder.depth = parent.depth + 1
        session.add(subfolder)
        session.commit()
        session.refresh(subfolder)
        print(f"🔧 [create_subfolder] Fixed: subfolder.parent_id={subfolder.parent_id}, subfolder.depth={subfolder.depth}")
    
    print(f"✅ [create_subfolder] Created subfolder '{subfolder.name}' (id={subfolder.id}) under parent {parent_folder_id}, depth={subfolder.depth}")
    return subfolder


def delete_folder(session: Session, folder_id: str, user_id: int) -> bool:
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return False
    # Xóa tay các file (kèm revisions) và folder_root để tránh vi phạm khóa ngoại
    from app.models.knowledge_file import KnowledgeFile, FileRevision

    for f in session.exec(
        select(KnowledgeFile).where(KnowledgeFile.folder_id == folder_id)
    ).all():
        for rev in session.exec(
            select(FileRevision).where(FileRevision.file_id == f.id)
        ).all():
            session.delete(rev)
        session.delete(f)
    for root in session.exec(
        select(FolderRoot).where(FolderRoot.folder_id == folder_id)
    ).all():
        session.delete(root)
    session.delete(folder)
    session.commit()
    return True


def create_folder_root(session: Session, user_id: int, folder_id: str) -> FolderRoot:

    existing_root = session.exec(
        select(FolderRoot).where(FolderRoot.user_id == user_id)
    ).first()

    if existing_root:
        return existing_root

    folder_root = FolderRoot(
        user_id=user_id,
        folder_id=folder_id,
    )
    session.add(folder_root)
    session.commit()
    session.refresh(folder_root)

    return folder_root


def rename_folder(
    session: Session, folder_id: str, user_id: int, new_name: str
) -> Optional[Folder]:
    # 1. Tìm folder theo ID và user_id
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return None

    # 2. Cập nhật tên mới và thời gian sửa
    from datetime import datetime, timezone
    folder.name = new_name
    folder.updated_at = datetime.now(timezone.utc)
    
    # 3. Lưu vào DB & refresh lại data
    session.add(folder)
    session.commit()
    session.refresh(folder)
    
    return folder


def reorder_folders(
    session: Session, folder_ids: list[str], user_id: int
) -> list[Folder]:
    """Cập nhật order_index cho các folder theo thứ tự mới."""
    folders = session.exec(
        select(Folder).where(Folder.id.in_(folder_ids), Folder.user_id == user_id)
    ).all()
    
    folder_map = {f.id: f for f in folders}
    
    for index, folder_id in enumerate(folder_ids):
        if folder_id in folder_map:
            folder_map[folder_id].order_index = index
            session.add(folder_map[folder_id])
    
    session.commit()
    
    # Return folders in new order
    return [folder_map[fid] for fid in folder_ids if fid in folder_map]


# =====================================================================
# Hierarchical Folder Operations
# =====================================================================

def create_subfolder(
    session: Session, 
    parent_id: str, 
    data: FolderCreate, 
    user_id: int
) -> Optional[Folder]:
    """Tạo subfolder dưới folder cha."""
    parent = get_folder(session, parent_id, user_id)
    if not parent:
        return None
    
    # Validate depth constraint
    if parent.depth >= 4:
        return None
    
    subfolder = Folder(
        id=f"folder-{uuid.uuid4().hex[:8]}",
        name=data.name,
        type=data.type,
        user_id=user_id,
        parent_id=parent.id,
        depth=parent.depth + 1,
    )
    session.add(subfolder)
    session.commit()
    session.refresh(subfolder)
    return subfolder


def get_folder_tree(
    session: Session, 
    folder_id: str, 
    user_id: int,
    max_depth: int = 4
) -> Optional[Folder]:
    """Lấy cây thư mục đệ quy đến độ sâu max_depth."""
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return None
    
    # Load children recursively
    _load_children(session, folder, user_id, max_depth, 0)
    return folder


def _load_children(
    session: Session, 
    folder: Folder, 
    user_id: int, 
    max_depth: int, 
    current_depth: int
) -> None:
    """Đệ quy load children của folder."""
    if current_depth >= max_depth:
        return
    
    children = session.exec(
        select(Folder)
        .where(Folder.parent_id == folder.id, Folder.user_id == user_id)
        .options(selectinload(Folder.files))
        .order_by(Folder.created_at)
    ).all()
    
    folder.children = children
    
    for child in children:
        child.files.sort(key=lambda f: (f.order_index, f.created_at, f.id))
        _load_children(session, child, user_id, max_depth, current_depth + 1)


def get_breadcrumb_path(session: Session, folder_id: str, user_id: int) -> List[Folder]:
    """Lấy đường dẫn từ root đến folder hiện tại (breadcrumb)."""
    path = []
    current_id = folder_id
    
    while current_id:
        folder = get_folder(session, current_id, user_id)
        if not folder:
            break
        path.insert(0, folder)
        current_id = folder.parent_id
    
    return path


def get_max_descendant_depth(session: Session, folder_id: str, user_id: int) -> int:
    """Lấy độ sâu lớn nhất của các con cháu (để validate move)."""
    max_depth = 0
    
    def _check_depth(folder_id: str, current_depth: int) -> int:
        children = session.exec(
            select(Folder).where(Folder.parent_id == folder_id, Folder.user_id == user_id)
        ).all()
        if not children:
            return current_depth
        max_child = current_depth
        for child in children:
            child_depth = _check_depth(child.id, current_depth + 1)
            max_child = max(max_child, child_depth)
        return max_child
    
    return _check_depth(folder_id, 0)


def move_folder(
    session: Session,
    folder_id: str,
    new_parent_id: Optional[str],
    user_id: int
) -> Optional[Folder]:
    """Di chuyển folder sang parent mới (validate depth <= 4)."""
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return None
    
    # Validate: không được move vào chính mình hoặc con cháu
    if new_parent_id == folder_id:
        return None
    
    # Kiểm tra circular reference
    if new_parent_id:
        current = new_parent_id
        while current:
            if current == folder_id:
                return None  # Circular reference
            parent = get_folder(session, current, user_id)
            current = parent.parent_id if parent else None
    
    new_parent = None
    if new_parent_id:
        new_parent = get_folder(session, new_parent_id, user_id)
        if not new_parent:
            return None
        
        # Validate depth
        max_descendant = get_max_descendant_depth(session, folder_id, user_id)
        if new_parent.depth + 1 + get_max_descendant_depth(session, folder_id, user_id) > 4:
            return None
    
    # Cập nhật parent_id và depth
    old_parent_id = folder.parent_id
    old_depth = folder.depth
    folder.parent_id = new_parent.id if new_parent else None
    folder.depth = new_parent.depth + 1 if new_parent else 0
    
    # Cập nhật depth cho con cháu
    def _update_children_depth(folder_id: str, new_depth: int):
        children = session.exec(
            select(Folder).where(Folder.parent_id == folder_id, Folder.user_id == user_id)
        ).all()
        for child in children:
            child.depth = new_depth
            session.add(child)
            _update_children_depth(child.id, new_depth + 1)
    
    _update_children_depth(folder_id, folder.depth + 1)
    
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder


# =====================================================================
# File Linking Operations (Obsidian-style)
# =====================================================================

def create_file_link(
    session: Session,
    source_file_id: str,
    target_file_id: str,
    user_id: int,
    link_type: str = "reference"
) -> Optional[FileLink]:
    """Tạo link hai chiều giữa 2 file (Obsidian-style)."""
    # Verify both files belong to user
    from app.models.knowledge_file import KnowledgeFile
    
    source = session.exec(
        select(KnowledgeFile)
        .where(KnowledgeFile.id == source_file_id)
        .join(Folder, KnowledgeFile.folder_id == Folder.id)
        .where(Folder.user_id == user_id)
    ).first()
    
    target = session.exec(
        select(KnowledgeFile)
        .where(KnowledgeFile.id == target_file_id)
        .join(Folder, KnowledgeFile.folder_id == Folder.id)
        .where(Folder.user_id == user_id)
    ).first()
    
    if not source or not target:
        return None
    
    if source_file_id == target_file_id:
        return None
    
    # Create bidirectional links
    link1 = FileLink(
        source_file_id=source_file_id,
        target_file_id=target_file_id,
        link_type=link_type,
    )
    link2 = FileLink(
        source_file_id=target_file_id,
        target_file_id=source_file_id,
        link_type=link_type,
    )
    
    session.add(link1)
    session.add(link2)
    session.commit()
    session.refresh(link1)
    return link1


def remove_file_link(
    session: Session,
    source_file_id: str,
    target_file_id: str,
    user_id: int
) -> bool:
    """Xóa link giữa 2 file (cả 2 chiều)."""
    links = session.exec(
        select(FileLink).where(
            ((FileLink.source_file_id == source_file_id) & (FileLink.target_file_id == target_file_id)) |
            ((FileLink.source_file_id == target_file_id) & (FileLink.target_file_id == source_file_id))
        )
    ).all()
    
    if not links:
        return False
    
    for link in links:
        session.delete(link)
    session.commit()
    return True


def get_file_links(
    session: Session,
    file_id: str,
    user_id: int
) -> List[FileLink]:
    """Lấy tất cả outgoing links của file."""
    from app.models.knowledge_file import KnowledgeFile
    
    # Verify ownership
    file = session.exec(
        select(KnowledgeFile)
        .where(KnowledgeFile.id == file_id)
        .join(Folder, KnowledgeFile.folder_id == Folder.id)
        .where(Folder.user_id == user_id)
    ).first()
    
    if not file:
        return []
    
    return session.exec(
        select(FileLink).where(FileLink.source_file_id == file_id)
    ).all()


def get_file_backlinks(
    session: Session,
    file_id: str,
    user_id: int
) -> List[FileLink]:
    """Lấy tất cả incoming links (backlinks) của file."""
    from app.models.knowledge_file import KnowledgeFile
    
    # Verify ownership
    file = session.exec(
        select(KnowledgeFile)
        .where(KnowledgeFile.id == file_id)
        .join(Folder, KnowledgeFile.folder_id == Folder.id)
        .where(Folder.user_id == user_id)
    ).first()
    
    if not file:
        return []
    
    return session.exec(
        select(FileLink).where(FileLink.target_file_id == file_id)
    ).all()


# =====================================================================
# Chat History Operations
# =====================================================================

def get_folder_chat_history(session: Session, folder_id: str, user_id: int) -> List[dict]:
    """Get chat history for a folder."""
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return []
    return folder.conversation_history or []


def save_folder_chat_history(session: Session, folder_id: str, user_id: int, messages: List[dict]) -> Optional[Folder]:
    """Save chat history for a folder. Only saves user/bot messages, filters out status messages."""
    folder = get_folder(session, folder_id, user_id)
    if not folder:
        return None
    
    # Filter out status messages and keep only user/bot messages
    filtered_messages = [
        {"role": m.get("role"), "content": m.get("content"), "timestamp": m.get("timestamp")}
        for m in messages
        if m.get("role") in ("user", "bot") and not m.get("isStatus")
    ]
    
    # Limit to last 50 messages to avoid large payloads
    if len(filtered_messages) > 50:
        filtered_messages = filtered_messages[-50:]
    
    folder.conversation_history = filtered_messages
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder
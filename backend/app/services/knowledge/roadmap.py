import json
import uuid
from typing import Optional, List
from sqlmodel import Session, select

from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile  # Adjust import path to your actual File model
from app.services.document.parser import parse_context_to_structure
from app.services.search.tavily import tavily_search
from app.services.storage.file_storage import store_folder_structure_roadmap
from app.utils.similarity_checker import get_embedding,cosine_similarity
import asyncio

def _get_folders_sync(sess):
    return sess.exec(select(Folder).where(Folder.type == "roadmap")).all()

def clone_folder_for_user(
    cached_folder: Folder, 
    new_user_id: int, 
    new_folder_name: str, 
    new_embedding: list[float], 
    session: Session
) -> Folder:
    """
    Clones an existing roadmap folder and all its files for a new user.
    """
    # 1. Create cloned Folder record for the new user
    cloned_folder = Folder(
        id=f"folder-{uuid.uuid4().hex[:8]}",
        name=new_folder_name or cached_folder.name,
        type="roadmap",
        user_id=new_user_id,
        prompt_embedding=json.dumps(new_embedding)
    )
    session.add(cloned_folder)
    session.commit()
    session.refresh(cloned_folder)

    # 2. Duplicate all files inside the cached folder
    cloned_files = []
    for original_file in getattr(cached_folder, "files", []):
        cloned_files.append(
            KnowledgeFile(
                id=f"file-{uuid.uuid4().hex[:8]}",
                folder_id=cloned_folder.id,
                name=original_file.name,
                markdown_content=getattr(original_file, "markdown_content", ""),
                video_url=getattr(original_file, "video_url", None),
                timestamps_json=getattr(original_file, "timestamps_json", None)
            )
        )

    if cloned_files:
        session.add_all(cloned_files)
        session.commit()

    session.refresh(cloned_folder)
    return cloned_folder


async def roadmap_service(
    topic: str, 
    user_id: int, 
    session: Session, 
    folder_name: str,
    similarity_threshold: float = 0.88,
    on_event: callable = None,
) -> Folder:
    # ---------------------------------------------------------
    # STEP 1: Generate Vector Embedding for incoming prompt
    # ---------------------------------------------------------
    new_embedding = await get_embedding(topic)

    # ---------------------------------------------------------
    # STEP 2: Check Semantic Cache across existing roadmap folders
    # ---------------------------------------------------------

    existing_folders = await asyncio.to_thread(_get_folders_sync, session)

    if new_embedding:
        for cached_folder in existing_folders:
            if cached_folder.prompt_embedding:
                # Parse stored JSON string to list of floats
                cached_embedding = (
                    json.loads(cached_folder.prompt_embedding)
                    if isinstance(cached_folder.prompt_embedding, str)
                    else cached_folder.prompt_embedding
                )
                score = cosine_similarity(new_embedding, cached_embedding)

                # === CACHE HIT ===
                if score >= similarity_threshold:
                    print(f"⚡ [CACHE HIT] Match found! Reusing folder '{cached_folder.name}' (Score: {score:.2f})")

                    # If user already owns this folder, return directly
                    if cached_folder.user_id == user_id:
                        return cached_folder

                    # Otherwise, clone the folder for the requesting user
                    return await asyncio.to_thread(
                        clone_folder_for_user,
                        cached_folder=cached_folder,
                        new_user_id=user_id,
                        new_folder_name=folder_name,
                        new_embedding=new_embedding,
                        session=session
                    )

    # ---------------------------------------------------------
    # STEP 3: CACHE MISS — Crawl & Call Gemini AI
    # ---------------------------------------------------------
    print(f"🤖 [CACHE MISS] Calling Tavily & AI to generate new roadmap for: '{topic}'")
    if on_event:
        on_event({"type": "status", "message": "Đang tìm kiếm tài liệu trên Internet..."})
    
    tavily_context = ""
    try:
        tavily_context = await tavily_search(topic)
    except Exception as e:
        print(f"  ---> [Tavily] Không lấy được ngữ cảnh Internet, tiếp tục với context trống: {e}")

    roadmap_data = await parse_context_to_structure(topic, tavily_context, folder_name=folder_name, on_event=on_event)

    # ---------------------------------------------------------
    # STEP 4: Store New Folder in DB + Save Prompt Embedding
    # ---------------------------------------------------------
    new_folder = await asyncio.to_thread(
        store_folder_structure_roadmap,
        session=session,
        user_id=user_id,
        roadmap_data=roadmap_data
    )

    # Save prompt vector to DB for future semantic cache matches
    new_folder.prompt_embedding = json.dumps(new_embedding)
    session.add(new_folder)
    session.commit()
    session.refresh(new_folder)

    return new_folder
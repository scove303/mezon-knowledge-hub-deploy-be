import asyncio
import json
import re
import uuid
from typing import List

from sqlmodel import Session, select

from app.models.folder import Folder
from app.models.knowledge_file import KnowledgeFile
from app.schemas.folder import FolderCreate
from app.crud import folder as folder_crud
from app.services.document.parser import parse_context_to_structure, _generate_content_with_retry
from app.services.ai.domain_prompts import build_revise_prompt, detect_domain
from app.services.search.tavily import tavily_search
from app.services.storage.file_storage import store_folder_structure_roadmap
from app.utils.similarity_checker import get_embedding, cosine_similarity
from google.genai import types


def _get_folders_sync(sess):
    return sess.exec(
        select(Folder).where(Folder.type == "roadmap")
    ).all()


def clone_folder_for_user(
    cached_folder: Folder,
    new_user_id: int,
    new_folder_name: str,
    new_embedding: list[float],
    session: Session,
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
        prompt_embedding=json.dumps(new_embedding),
    )
    session.add(cloned_folder)
    session.commit()
    session.refresh(cloned_folder)

    # 2. Duplicate all files inside the cached folder
    cloned_files = []
    for index, original_file in enumerate(
        sorted(
            getattr(cached_folder, "files", []),
            key=lambda f: (f.order_index, f.created_at),
        )
    ):
        cloned_files.append(
            KnowledgeFile(
                id=f"file-{uuid.uuid4().hex[:8]}",
                folder_id=cloned_folder.id,
                name=original_file.name,
                summary=getattr(original_file, "summary", ""),
                markdown_content=getattr(
                    original_file,
                    "markdown_content",
                    "",
                ),
                video_url=getattr(
                    original_file,
                    "video_url",
                    None,
                ),
                timestamps_json=getattr(
                    original_file,
                    "timestamps_json",
                    None,
                ),
                order_index=index,
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
    existing_folders = await asyncio.to_thread(
        _get_folders_sync,
        session,
    )

    if new_embedding:
        for cached_folder in existing_folders:
            if cached_folder.prompt_embedding:
                cached_embedding = (
                    json.loads(cached_folder.prompt_embedding)
                    if isinstance(
                        cached_folder.prompt_embedding,
                        str,
                    )
                    else cached_folder.prompt_embedding
                )

                score = cosine_similarity(
                    new_embedding,
                    cached_embedding,
                )

                # === CACHE HIT ===
                if score >= similarity_threshold:
                    print(
                        f"⚡ [CACHE HIT] Match found! "
                        f"Reusing folder '{cached_folder.name}' "
                        f"(Score: {score:.2f})"
                    )

                    # If user already owns this folder, return directly
                    if cached_folder.user_id == user_id:
                        return cached_folder

                    # Otherwise, clone the folder
                    return await asyncio.to_thread(
                        clone_folder_for_user,
                        cached_folder=cached_folder,
                        new_user_id=user_id,
                        new_folder_name=folder_name,
                        new_embedding=new_embedding,
                        session=session,
                    )

    # ---------------------------------------------------------
    # STEP 3: CACHE MISS — Crawl & Call Gemini AI
    # ---------------------------------------------------------
    print(
        f"🤖 [CACHE MISS] Calling Tavily & AI "
        f"to generate new roadmap for: '{topic}'"
    )

    if on_event:
        on_event(
            {
                "type": "status",
                "message": "Đang tìm kiếm tài liệu trên Internet...",
            }
        )

    tavily_context = ""

    try:
        tavily_context = await tavily_search(topic)
    except Exception as e:
        print(
            "  ---> [Tavily] Không lấy được ngữ cảnh Internet, "
            f"tiếp tục với context trống: {e}"
        )

    roadmap_data = await parse_context_to_structure(
        topic,
        tavily_context,
        folder_name=folder_name,
        on_event=on_event,
    )

    new_folder = await asyncio.to_thread(
        store_folder_structure_roadmap,
        session=session,
        user_id=user_id,
        roadmap_data=roadmap_data,
        type="roadmap"
    )

    # Save prompt vector to DB for future semantic cache matches
    new_folder.prompt_embedding = json.dumps(new_embedding)
    session.add(new_folder)
    session.commit()
    session.refresh(new_folder)

    return new_folder


# =====================================================================
# FOLLOW-UP PROMPT: HỎI TIẾP / CHỈNH SỬA NỘI DUNG CŨ
# =====================================================================


def _tokenize(text: str) -> set:
    """Tách từ (hỗ trợ tiếng Việt) để dùng cho keyword matching."""
    return set(
        re.findall(
            r"[a-zA-Z0-9_À-ỹ]+",
            text.lower(),
        )
    )


def search_folder_documents(
    folder: Folder,
    query: str,
    top_k: int = 3,
    max_chars: int = 2500,
) -> List[dict]:
    """
    Tìm kiếm nội dung liên quan trong folder tài liệu (các file bài học)
    dựa trên keyword overlap giữa query và (title + markdown_content).
    Hoạt động kể cả khi không có embedding model (sentence-transformers).
    """
    query_terms = _tokenize(query)

    scored = []

    for f in getattr(folder, "files", []):
        title = getattr(f, "name", "") or ""
        content = getattr(
            f,
            "markdown_content",
            "",
        ) or ""

        haystack = f"{title}\n{content}".lower()

        if not query_terms:
            score = 0
        else:
            hit = 0

            for term in query_terms:
                if term in haystack:
                    hit += 1

            score = hit / len(query_terms)

        scored.append((score, f))

    scored.sort(
        key=lambda x: x[0],
        reverse=True,
    )

    results = []

    for score, f in scored[:top_k]:
        if score <= 0:
            continue

        content = (
            getattr(
                f,
                "markdown_content",
                "",
            )
            or ""
        )[:max_chars]

        results.append(
            {
                "file_id": f.id,
                "title": getattr(
                    f,
                    "name",
                    "",
                )
                or "Untitled",
                "score": round(score, 3),
                "excerpt": content,
            }
        )

    return results


async def revise_roadmap(
    topic: str,
    folder: Folder,
    session: Session,
    on_event: callable = None,
) -> dict:
    """
    Xử lý prompt hỏi tiếp / yêu cầu chỉnh sửa nội dung cũ:

    1. Tìm kiếm tài liệu liên quan trong folder
    2. Gọi Gemini quyết định: trả lời (answer) hoặc chỉnh sửa bài học (edit)
    3. Nếu edit: cập nhật markdown_content của KnowledgeFile trong DB
    """

    if on_event:
        on_event(
            {
                "type": "status",
                "message": (
                    "Đang tìm kiếm tài liệu liên quan trong folder..."
                ),
            }
        )

    docs = search_folder_documents(
        folder,
        topic,
    )

    if docs:
        doc_block = "\n\n".join(
            f"--- FILE: {d['title']} "
            f"(file_id: {d['file_id']}) ---\n"
            f"{d['excerpt']}"
            for d in docs
        )
    else:
        titles = [
            getattr(
                f,
                "name",
                "Untitled",
            )
            for f in getattr(
                folder,
                "files",
                [],
            )
        ]

        doc_block = (
            "Không có trích đoạn khớp với truy vấn. "
            "Danh sách bài học hiện có trong folder:\n"
            + "\n".join(
                f"- {t}"
                for t in titles
            )
            + "\n\n(Lưu ý: Dù không có tài liệu khớp, nếu người dùng yêu cầu tạo thư mục con mới, hãy dùng action create_subfolder)"
        )

    if on_event:
        on_event(
            {
                "type": "status",
                "message": "Đang xử lý với AI...",
            }
        )

    prompt = build_revise_prompt(
        topic=topic,
        folder_name=folder.name,
        user_query=topic,
        relevant_docs=docs,
        domain=None,  # auto-detect
    )

    response = await _generate_content_with_retry(
        prompt,
        types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )

    raw = response.text or "{}"

    print("[revise_roadmap] Raw AI response length:", len(raw))
    print("[revise_roadmap] Raw AI response (first 200 chars):", raw[:200])

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        print("[revise_roadmap] JSON decode error:", e)
        print("[revise_roadmap] Attempting to extract JSON from response...")
        import re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                print("[revise_roadmap] Extracted JSON keys:", list(parsed.keys()))
            except json.JSONDecodeError:
                parsed = {"action": "answer", "text": raw}
        else:
            parsed = {"action": "answer", "text": raw}

    action = parsed.get("action", "answer")
    
    print("[revise_roadmap] Parsed action:", action, "keys:", list(parsed.keys()) if isinstance(parsed, dict) else "N/A")

    # =========================================================
    # CHỈNH SỬA NỘI DUNG CŨ
    # =========================================================
    if action == "edit":
        files = list(
            getattr(
                folder,
                "files",
                [],
            )
        )

        target = next(
            (
                f
                for f in files
                if f.id == parsed.get("file_id")
            ),
            None,
        )

        if target:
            new_content = parsed.get(
                "content",
                "",
            )

            target.markdown_content = new_content
            session.add(target)
            session.commit()
            session.refresh(target)

            return {
                "action": "edit",
                "file_id": target.id,
                "title": (
                    parsed.get("title")
                    or target.name
                ),
                "content": new_content,
            }

        # file_id trỏ tới bài không tồn tại hoặc "new"
        # → tạo bài học mới
        max_order = max(
            (
                f.order_index
                for f in files
            ),
            default=-1,
        )

        new_file = KnowledgeFile(
            id=f"file-{uuid.uuid4().hex[:8]}",
            folder_id=folder.id,
            name=(
                parsed.get("title")
                or topic[:80]
            ),
            summary="",
            markdown_content=parsed.get(
                "content",
                "",
            ),
            order_index=max_order + 1,
        )

        session.add(new_file)
        session.commit()
        session.refresh(new_file)

        return {
            "action": "edit",
            "file_id": new_file.id,
            "title": new_file.name,
            "content": new_file.markdown_content,
        }

    # =========================================================
    # TẠO THƯ MỤC CON (SUBFOLDER)
    # =========================================================
    if action == "create_subfolder":
        subfolder_name = parsed.get("name") or "Thư mục con mới"
        subfolder_type = parsed.get("type") or "document"
        files_data = parsed.get("files", [])

        print(f"🔧 [revise_roadmap] Creating subfolder '{subfolder_name}' under parent folder {folder.id} (depth={folder.depth})")
        
        # Create subfolder
        subfolder_data = FolderCreate(name=subfolder_name, type=subfolder_type)
        subfolder = folder_crud.create_subfolder(session, folder.id, subfolder_data, folder.user_id)

        # Verify subfolder was created with correct parent_id
        print(f"🔍 [revise_roadmap] After create_subfolder: subfolder.id={subfolder.id}, subfolder.parent_id={subfolder.parent_id}, subfolder.depth={subfolder.depth}")
        
        # Re-load to verify persistence
        session.refresh(subfolder)
        print(f"🔍 [revise_roadmap] After refresh: subfolder.parent_id={subfolder.parent_id}, subfolder.depth={subfolder.depth}")

        # Create files in subfolder
        created_files = []
        for idx, f_data in enumerate(files_data):
            new_file = KnowledgeFile(
                id=f"file-{uuid.uuid4().hex[:8]}",
                folder_id=subfolder.id,
                name=f_data.get("title", f"File {idx + 1}"),
                summary="",
                markdown_content=f_data.get("content", ""),
                order_index=idx,
                user_id=folder.user_id,
            )
            session.add(new_file)
            created_files.append({
                "id": new_file.id,
                "name": new_file.name,
            })

        session.commit()
        session.refresh(subfolder)

        print(f"✅ [revise_roadmap] Subfolder committed: id={subfolder.id}, parent_id={subfolder.parent_id}, depth={subfolder.depth}")

        return {
            "action": "create_subfolder",
            "subfolder_id": subfolder.id,
            "subfolder_name": subfolder.name,
            "subfolder_type": subfolder.type,
            "files": created_files,
        }

    # =========================================================
    # TRẢ LỜI CÂU HỎI
    # =========================================================
    return {
        "action": "answer",
        "text": parsed.get(
            "text",
            raw,
        ),
    }
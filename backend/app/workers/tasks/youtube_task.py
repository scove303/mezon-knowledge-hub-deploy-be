import json
import traceback
import inspect
import asyncio
from sqlmodel import Session, select
from app.models.folder import Folder
from app.services.knowledge.youtube import YouTubeNativeService, extract_video_id
from app.services.document.parser import parse_context_to_structure
from app.services.storage.file_storage import store_folder_structure_roadmap, add_files_to_existing_folder
from app.utils.similarity_checker import get_embedding, cosine_similarity

async def send_status_event(on_event: callable, message: str) -> None:
    """Safely dispatches event messages whether callback is sync or async."""
    if not on_event:
        return
    try:
        event_payload = {"type": "status", "message": message}
        if inspect.iscoroutinefunction(on_event):
            await on_event(event_payload)
        else:
            on_event(event_payload)
    except Exception as evt_err:
        print(f"⚠️ [Worker Event Warning] Could not dispatch event: {evt_err}")


# SỬA TẠI ĐÂY: Dùng def thay vì async def để asyncio.to_thread hoạt động đúng
def _get_folders_sync(session: Session):
    return session.exec(select(Folder).where(Folder.type == "roadmap")).all()


async def _check_semantic_cache(
    session: Session,
    user_id: int,
    topic: str,
    folder_name: str,
    similarity_threshold: float = 0.88,
) -> Folder | None:
    """Check if a similar roadmap exists in cache."""
    new_embedding = await get_embedding(topic)
    if not new_embedding:
        return None

    # Bây giờ _get_folders_sync là hàm sync nên asyncio.to_thread sẽ trả về list danh sách folder thực tế
    existing_folders = await asyncio.to_thread(_get_folders_sync, session)

    for cached_folder in existing_folders:
        if cached_folder.prompt_embedding:
            cached_embedding = (
                json.loads(cached_folder.prompt_embedding)
                if isinstance(cached_folder.prompt_embedding, str)
                else cached_folder.prompt_embedding
            )

            score = cosine_similarity(new_embedding, cached_embedding)

            if score >= similarity_threshold:
                print(
                    f"⚡ [CACHE HIT] Match found! "
                    f"Reusing folder '{cached_folder.name}' "
                    f"(Score: {score:.2f})"
                )

                if cached_folder.user_id == user_id:
                    return cached_folder

                # Clone for new user
                from app.services.knowledge.roadmap import clone_folder_for_user
                return await asyncio.to_thread(
                    clone_folder_for_user,
                    cached_folder=cached_folder,
                    new_user_id=user_id,
                    new_folder_name=folder_name,
                    new_embedding=new_embedding,
                    session=session,
                )
    return None


async def process_youtube_native_pipeline(
    session: Session,
    user_id: int,
    youtube_url: str,
    on_event: callable = None,
    folder_id: str = None
) -> None:
    try:
        await send_status_event(on_event, "Đang phân tích thông tin từ YouTube...")

        # 1. Fetch transcript or metadata outline
        context_text, outline_data = await YouTubeNativeService.get_roadmap_outline_from_transcript(youtube_url)
        
        if not context_text or not context_text.strip():
            raise ValueError("Không thể lấy dữ liệu phụ đề hoặc thông tin nội dung từ video này.")

        # Extract video_id directly from URL as primary source
        extracted_video_id = extract_video_id(youtube_url)
        video_id = outline_data.get("video_id") or extracted_video_id

        # Ưu tiên: dùng tên folder từ AI nếu hợp lý, không thì dùng tiêu đề video thực
        video_title = outline_data.get("video_title", "")
        ai_folder_name = outline_data.get("folder_name", "")
        transcript = outline_data.get("transcript", [])
        has_transcript = outline_data.get("has_transcript", bool(transcript))
        lessons = outline_data.get("lessons", [])
        generic_names = {"youtube summary", "tìm hiểu về youtube", "youtube", "tóm tắt youtube"}

        if ai_folder_name and ai_folder_name.lower() not in generic_names and len(ai_folder_name) > 5:
            folder_name = ai_folder_name
        elif video_title:
            folder_name = video_title
        else:
            folder_name = "Lộ trình từ Video YouTube"

        # Check semantic cache
        cached_folder = await _check_semantic_cache(session, user_id, folder_name, folder_name)
        if cached_folder:
            await send_status_event(on_event, f"⚡ Đã tìm thấy lộ trình tương tự, đang tải...")
            return cached_folder

        # Include context info for AI parser
        context = f"""Nguồn Video YouTube: {youtube_url}
Video ID: {video_id}
Tiêu đề video: {video_title}
Có phụ đề (Transcript Available): {has_transcript}

CẤU TRÚC BÀI HỌC DỰ KIẾN:
{json.dumps(lessons, ensure_ascii=False, indent=2)}

NỘI DUNG NGUỒN (TRANSCRIPT HOẶC METADATA):
{context_text[:25000]}

⚠️ QUAN TRỌNG: 
1. AI dựa vào NỘI DUNG NGUỒN để tạo các file bài học chi tiết.
2. Nếu có phụ đề (Có phụ đề: True), hãy đính kèm link Anchor Timestamp theo dạng: https://www.youtube.com/watch?v={video_id}&t={{start_seconds}}s.
3. Nếu không có phụ đề (Có phụ đề: False), hãy xây dựng nội dung bài học chi tiết dựa trên thông tin tiêu đề và mô tả video."""

        roadmap_data = await parse_context_to_structure(
            topic=folder_name,
            tavily_context=context,
            folder_name=folder_name,
            on_event=on_event,
            video_id=video_id
        )

        if folder_id:
            # Add files to existing folder
            add_files_to_existing_folder(
                session=session,
                folder_id=folder_id,
                files_data=roadmap_data.get("files", [])
            )
        else:
            # Create new folder (original behavior)
            new_folder = store_folder_structure_roadmap(
                session=session,
                user_id=user_id,
                roadmap_data=roadmap_data
            )

            # Save embedding for future cache hits
            new_embedding = await get_embedding(folder_name)
            if new_embedding:
                new_folder.prompt_embedding = json.dumps(new_embedding)
                session.add(new_folder)
                session.commit()
                session.refresh(new_folder)

            return new_folder

    except Exception as e:
        print(f"❌ [Worker Error] Process YouTube failed: {e}")
        traceback.print_exc()
        await send_status_event(on_event, f"❌ Lỗi xử lý YouTube: {str(e)}")
        raise e
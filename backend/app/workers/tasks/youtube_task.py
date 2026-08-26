import json
import traceback
import inspect
import asyncio
from sqlmodel import Session
from app.services.knowledge.youtube import YouTubeNativeService, extract_video_id
from app.services.document.parser import parse_context_to_structure
from app.services.storage.file_storage import store_folder_structure_roadmap, add_files_to_existing_folder

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

async def process_youtube_native_pipeline(
    session: Session,
    user_id: int,
    youtube_url: str,
    on_event: callable = None,
    folder_id: str = None
) -> None:
    try:
        await send_status_event(on_event, "Đang lấy phụ đề từ YouTube...")

        # 1. Fetch real subtitles & generate outline
        transcript_text, outline_data = await YouTubeNativeService.get_roadmap_outline_from_transcript(youtube_url)
        
        if not transcript_text or not transcript_text.strip():
            raise ValueError("Không tìm thấy nội dung phụ đề cho video này.")

        folder_name = outline_data.get("folder_name", "Lộ Trình YouTube")

        # Extract video_id directly from URL as primary source (fallback if AI fails)
        extracted_video_id = extract_video_id(youtube_url)
        
        outline_data = await YouTubeNativeService.get_roadmap_outline_from_transcript(youtube_url)

        # Ưu tiên: dùng tên folder từ AI nếu hợp lý, không thì dùng tiêu đề video thực
        video_title = outline_data.get("video_title", "")
        ai_folder_name = outline_data.get("folder_name", "")
        video_id = outline_data.get("video_id", "")
        transcript = outline_data.get("transcript", [])
        generic_names = {"youtube summary", "tìm hiểu về youtube", "youtube", "tóm tắt youtube", "youtube summary"}

        if ai_folder_name and ai_folder_name.lower() not in generic_names and len(ai_folder_name) > 5:
            folder_name = ai_folder_name
        elif video_title:
            folder_name = video_title
        else:
            folder_name = "Lộ trình từ Video YouTube"

        # Include transcript data in context for AI to generate timestamp links
        transcript_json = json.dumps(transcript, ensure_ascii=False)
        context = f"""Nguồn Video YouTube: {youtube_url}
Video ID: {video_id}
Tiêu đề video: {video_title}
Có phụ đề: {bool(transcript)}
Cấu trúc tóm tắt nội dung video: {json.dumps(outline_data, ensure_ascii=False)}
PHỤ ĐỀ CÓ TIMESTAMP (dùng để tạo link):
{transcript_json}

⚠️ QUAN TRỌNG: AI PHẢI DỰA TRÊN PHỤ ĐỀ (TRANSCRIPT) TRÊN ĐỂ VIẾT NỘI DUNG. KHÔNG ĐƯỢC TỰ BIẠT ĐẶT NỘI DUNG KHÔNG CÓ TRONG PHỤ ĐỀ."""

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
            store_folder_structure_roadmap(
                session=session,
                user_id=user_id,
                roadmap_data=roadmap_data
            )

    except Exception as e:
        print(f"❌ [Worker Error] Process YouTube failed: {e}")
        traceback.print_exc()
        await send_status_event(on_event, f"❌ Lỗi xử lý YouTube: {str(e)}")
        raise e
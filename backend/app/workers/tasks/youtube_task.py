import traceback
import inspect
import asyncio
from sqlmodel import Session
from app.services.knowledge.youtube import YouTubeTranscriptService
from app.services.document.parser import parse_context_to_structure
from app.services.storage.file_storage import store_folder_structure_roadmap

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
    on_event: callable = None
) -> None:
    try:
        await send_status_event(on_event, "Đang lấy phụ đề từ YouTube...")

        # 1. Fetch real subtitles & generate outline
        transcript_text, outline_data = await YouTubeTranscriptService.get_roadmap_outline_from_transcript(youtube_url)
        
        if not transcript_text or not transcript_text.strip():
            raise ValueError("Không tìm thấy nội dung phụ đề cho video này.")

        folder_name = outline_data.get("folder_name", "Lộ Trình YouTube")

        await send_status_event(
            on_event, 
            f"Đã lấy phụ đề! Đang viết nội dung lộ trình '{folder_name}'..."
        )

        # 2. Feed transcript content (capped safely at 20,000 chars) into lesson generator
        truncated_transcript = transcript_text[:20000]
        context_payload = (
            f"Nguồn Video: {youtube_url}\n"
            f"Transcript Video:\n{truncated_transcript}"
        )

        roadmap_data = await parse_context_to_structure(
            topic=f"YouTube: {folder_name}",
            tavily_context=context_payload,
            folder_name=folder_name,
            on_event=on_event
        )

        if not roadmap_data:
            raise ValueError("Không thể tạo cấu trúc lộ trình từ dữ liệu video.")

        # 3. Store in database
        store_folder_structure_roadmap(
            session=session,
            user_id=user_id,
            roadmap_data=roadmap_data
        )

        await send_status_event(on_event, "✅ Đã lưu xong lộ trình vào cơ sở dữ liệu!")

    except Exception as e:
        print(f"❌ [Worker Error] Process YouTube failed: {e}")
        traceback.print_exc()
        await send_status_event(on_event, f"❌ Lỗi xử lý YouTube: {str(e)}")
        raise e
import traceback
from sqlmodel import Session
from app.services.knowledge.youtube import YouTubeNativeService
from app.services.document.parser import parse_context_to_structure
from app.services.storage.file_storage import store_folder_structure_roadmap  

async def process_youtube_native_pipeline(
    session: Session,
    user_id: int,
    youtube_url: str,
    on_event: callable = None
) -> None:
    try:
        if on_event:
            on_event({"type": "status", "message": "Gemini đang trực tiếp phân tích Video YouTube..."})

        outline_data = await YouTubeNativeService.extract_outline_from_youtube_url(youtube_url)
        folder_name = outline_data.get("folder_name", "YouTube Summary")

        roadmap_data = await parse_context_to_structure(
            topic=f"YouTube: {folder_name}",
            tavily_context=f"Nguồn Video: {youtube_url}\nTóm tắt sơ bộ: {outline_data}",
            folder_name=folder_name,
            on_event=on_event
        )

        store_folder_structure_roadmap(
            session=session,
            user_id=user_id,
            roadmap_data=roadmap_data
        )

    except Exception as e:
        print(f"❌ [Worker Error] Process YouTube failed: {e}")
        traceback.print_exc()
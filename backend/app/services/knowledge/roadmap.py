# app/services/knowledge/roadmap.py
from app.services.document.parser import parse_context_to_structure
from app.services.search.tavily import tavily_search
from app.services.storage.file_storage import store_folder_structure_roadmap
from sqlmodel import Session


async def roadmap_service(topic: str, user_id: int, session: Session, folder_name):
    # 1. crawl data and gemini
    tavily_context = ""
    try:
        tavily_context = await tavily_search(topic)
    except Exception as e:
        print(f"  ---> [Tavily] Không lấy được ngữ cảnh Internet, tiếp tục với context trống: {e}")
    roadmap_data = await parse_context_to_structure(topic, tavily_context, folder_name=folder_name)

    # 2. store in DB
    new_folder = store_folder_structure_roadmap(
        session=session,
        user_id=user_id,
        roadmap_data=roadmap_data
    )
    return new_folder
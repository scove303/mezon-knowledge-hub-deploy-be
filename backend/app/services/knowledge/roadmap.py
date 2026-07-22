from app.services.document.parser import *
from app.services.search.tavily import *
from app.core.database import *
from app.services.storage.file_storage import *
import asyncio



async def roadmap_service(topic: str,user_id:int):
    tavilyContext = await tavily_search(topic)
    roadmapData = await parse_context_to_structure(topic,tavilyContext)

    print(roadmapData)



    # store in database 
    with Session(engine) as session:
        new_folder = store_folder_structure_roadmap(
            session=session,
            user_id=user_id,
            roadmap_data=roadmapData
        )
    return new_folder
    

asyncio.run(roadmap_service("tổng hợp kiến thức python từ cơ bản đến nâng cao",1))




    


from app.services.knowledge.roadmap import roadmap_service
from sqlmodel import Session
from app.schemas.common import success_response


async def run_roadmap_service(topic: str, user_id: int, session: Session, folder_name:str):

    folder = await roadmap_service(topic,user_id,session=session,folder_name = folder_name)

    return success_response(
            message="Roadmap generated successfully!",
            data={
                "folder_id": folder.id,
                "folder_name": folder.name,
                "total_files": len(folder.files),
                "files": [
                    {
                        "file_id": f.id,
                        "title": f.name,
                    }
                    for f in folder.files
                ]
            }
        )




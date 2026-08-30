import asyncio
from app.core.database import get_session
from app.services.knowledge.roadmap import revise_roadmap
from app.models.folder import Folder
from sqlmodel import select
from sqlalchemy.orm import selectinload

async def test():
    session = next(get_session())
    
    # Get a folder to test with
    folder = session.exec(select(Folder).where(Folder.id == "folder-7580baac")).first()
    if not folder:
        print("Folder not found")
        return
    
    print(f"Testing with folder: {folder.name} (id={folder.id})")
    print(f"Folder files: {len(folder.files)}")
    
    # Test the AI call
    result = await revise_roadmap(
        topic="tách thành thư mục riêng make a file about the backroom and its levels",
        folder=folder,
        session=session,
    )
    print(f"Result: {result}")

asyncio.run(test())
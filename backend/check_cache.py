from app.core.database import engine
from sqlmodel import Session, select
from app.models.folder import Folder

with Session(engine) as session:
    folders = session.exec(select(Folder).where(Folder.type == 'roadmap')).all()
    for f in folders:
        if 'tpQZLCel_kg' in f.name or 'youtube' in f.name.lower():
            emb = 'Y' if f.prompt_embedding else 'N'
            print(f"  - {f.id}: {f.name[:80]} | emb: {emb} | user: {f.user_id}")
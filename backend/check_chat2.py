import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text
import json

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, share_code, folder_snapshot, conversation_history FROM shared_chats WHERE share_code = '7ed3721d'"))
    for row in result:
        fs = json.loads(row[2]) if row[2] else {}
        ch = json.loads(row[3]) if row[3] else []
        print(f'files: {len(fs.get("files", []))}')
        print(f'conversation_history: {len(ch)}')
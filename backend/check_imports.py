import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text
import json

with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM chat_imports WHERE shared_chat_id = 'chat-16d9433b32'"))
    for row in result:
        print(f'chat_import: {row}')
    
    result2 = conn.execute(text("SELECT * FROM shared_chats WHERE share_code = '7ed3721d'"))
    for row in result2:
        print(f'shared_chat: id={row[0]}, import_count={row[11]}')
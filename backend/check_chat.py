import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, share_code, folder_snapshot, conversation_history FROM shared_chats WHERE share_code = '7ed3721d'"))
    for row in result:
        with open('chat_check.txt', 'w', encoding='utf-8') as f:
            f.write(f"id={row[0]}, share_code={row[1]}, folder_snapshot={row[2]}, conversation_history={row[3]}")
    print("Done")
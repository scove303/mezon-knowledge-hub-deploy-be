import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, share_code, import_count, view_count, created_at FROM shared_chats WHERE share_code = '7ed3721d'"))
    for row in result:
        print(f'id={row[0]}, share_code={row[1]}, import_count={row[2]}, view_count={row[3]}, created_at={row[4]}')
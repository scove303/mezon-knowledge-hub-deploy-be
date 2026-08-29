import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT id, name, conversation_history FROM folders LIMIT 5'))
    with open('db_check.txt', 'w', encoding='utf-8') as f:
        for row in result:
            f.write(f"id={row[0]}, name={row[1]}, history={row[2]}\n")
    print("Done")
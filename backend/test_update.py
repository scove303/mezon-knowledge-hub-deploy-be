import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Try to update a folder
    conn.execute(text("UPDATE folders SET conversation_history = '[{\"role\": \"user\", \"content\": \"test\"}]' WHERE id = 'folder-021a0f18'"))
    conn.commit()
    print('Update done')
    # Verify
    result = conn.execute(text("SELECT conversation_history FROM folders WHERE id = 'folder-021a0f18'"))
    for row in result:
        print(f'history: {row[0]}')
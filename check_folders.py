from app.core.database import get_session
from sqlalchemy import text
session = next(get_session())
result = session.execute(text("SELECT id, name, parent_id, depth FROM folders WHERE id IN ('folder-7580baac', 'folder-68011b33', 'folder-8404a196')")).fetchall()
for row in result:
    print(row)
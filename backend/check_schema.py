import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import inspect

insp = inspect(engine)
cols = insp.get_columns('shared_chats')
for c in cols:
    print(c['name'], c['type'], c['nullable'], c['default'])
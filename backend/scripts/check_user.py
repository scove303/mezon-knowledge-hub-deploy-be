import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.user import User

def check():
    try:
        with Session(engine) as session:
            statement = select(User)
            users = session.exec(statement).all()
            print(f"Found {len(users)} users in database:")
            for u in users:
                print(f"- ID: {u.id}, Username: {u.username}, Display Name: {u.display_name}")
    except Exception as e:
        print("Database connection error:", e)

if __name__ == "__main__":
    check()

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.user import User
from app.core.security import verify_password

def test():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            print("Admin user not found")
            return
        
        print("Hashed password in DB:", user.hashed_password)
        try:
            res = verify_password("password123", user.hashed_password)
            print("Verify password123:", res)
        except Exception as e:
            print("Verify failed with error:", e)

if __name__ == "__main__":
    test()

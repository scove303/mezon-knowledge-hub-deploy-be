import sys
import os
import bcrypt

# Thêm thư mục backend vào python path để import được app
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select
from app.core.database import engine
from app.models.user import User

def get_hash_manually(password: str) -> str:
    # Mã hóa mật khẩu bằng thư viện bcrypt trực tiếp để tránh lỗi của passlib trên các phiên bản mới
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def seed_user():
    with Session(engine) as session:
        # Kiểm tra xem tài khoản admin đã tồn tại chưa
        statement = select(User).where(User.username == "admin")
        user = session.exec(statement).first()
        if user:
            print("Tài khoản admin đã tồn tại sẵn trong cơ sở dữ liệu.")
            return

        # Tạo mới tài khoản admin mặc định để test
        new_user = User(
            username="admin",
            display_name="Administrator",
            hashed_password=get_hash_manually("password123"),
            role="ADMIN"
        )
        session.add(new_user)
        session.commit()
        print("Tạo tài khoản admin mặc định thành công!")
        print(">> Username: admin")
        print(">> Password: password123")

if __name__ == "__main__":
    seed_user()

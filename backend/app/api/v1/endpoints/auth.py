import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import JWTError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    get_password_hash,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    GoogleLoginRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.common import error_response, success_response

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


# =============================================================
# 1. ĐĂNG NHẬP USERNAME / PASSWORD (JWT)
# =============================================================
@router.post("/login")
def login(data: LoginRequest, session: SessionDep):
    user = session.exec(select(User).where(User.username == data.username)).first()
    
    if not user or not user.hashed_password or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response("Tên đăng nhập hoặc mật khẩu không đúng"),
        )
    
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return success_response(
        message="Đăng nhập thành công",
        data={
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "display_name": user.display_name or user.username,
                "email": user.email,
                "avatar_url": user.avatar_url,
            },
        },
    )


# =============================================================
# 2. ĐĂNG NHẬP GOOGLE OAUTH2
# =============================================================
@router.post("/google")
def login_with_google(data: GoogleLoginRequest, session: SessionDep):
    # 1. Verify id_token với Google Server
    try:
        id_info = id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("Google Token không hợp lệ hoặc đã hết hạn"),
        )

    google_email = id_info.get("email")
    google_name = id_info.get("name", "")
    google_picture = id_info.get("picture", "")

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("Không lấy được email từ tài khoản Google"),
        )

    # 2. Tìm user theo email thu được từ Google
    user = session.exec(select(User).where(User.email == google_email)).first()
    
    # 3. Nếu chưa có tài khoản trong DB thì tự động tạo mới
    if not user:
        base_username = google_email.split("@")[0]
        username = base_username
        
        # Xử lý tránh trùng lặp UNIQUE username
        existing_username = session.exec(select(User).where(User.username == username)).first()
        if existing_username:
            username = f"{base_username}_{uuid.uuid4().hex[:4]}"

        user = User(
            username=username,
            email=google_email,
            display_name=google_name,
            avatar_url=google_picture,
            hashed_password="",  # Login qua Google không dùng password nội bộ
            role="USER"
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        # Cập nhật thông tin mới nhất từ Google nếu có thay đổi
        updated = False
        if google_picture and user.avatar_url != google_picture:
            user.avatar_url = google_picture
            updated = True
        if google_name and not user.display_name:
            user.display_name = google_name
            updated = True
        if updated:
            session.add(user)
            session.commit()
            session.refresh(user)

    # 4. Cấp cặp JWT Token nội bộ
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return success_response(
        message="Đăng nhập Google thành công",
        data={
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "display_name": user.display_name or user.username,
                "email": user.email,
                "avatar_url": user.avatar_url,
            },
        },
    )


# =============================================================
# 3. LÀM MỚI TOKEN (REFRESH TOKEN)
# =============================================================
@router.post("/refresh")
def refresh_token(data: RefreshRequest, session: SessionDep):
    try:
        payload = decode_token(data.refreshToken)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response("Token không hợp lệ"),
            )
        user_id = int(payload["sub"])
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response("Người dùng không tồn tại"),
            )
        
        new_access = create_access_token(user.id)
        new_refresh = create_refresh_token(user.id)
        
        return success_response(
            message="Làm mới token thành công",
            data={
                "accessToken": new_access,
                "refreshToken": new_refresh,
            },
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response("Token không hợp lệ hoặc đã hết hạn"),
        )


# =============================================================
# 4. ĐĂNG KÝ TÀI KHOẢN
# =============================================================
@router.post("/register")
def register(data: RegisterRequest, session: SessionDep):
    # 1. Kiểm tra xem username đã tồn tại chưa
    existing_user = session.exec(select(User).where(User.username == data.username)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("Tên đăng nhập đã tồn tại"),
        )
    
    # 2. Kiểm tra email (nếu người dùng có nhập)
    if data.email:
        existing_email = session.exec(select(User).where(User.email == data.email)).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response("Email đã được sử dụng"),
            )

    # 3. Băm mật khẩu và tạo user mới
    new_user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        display_name=data.display_name or data.username,
        role="USER"
    )
    
    # 4. Lưu vào MySQL
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # 5. Tự động cấp Token đăng nhập
    access_token = create_access_token(new_user.id)
    refresh_token = create_refresh_token(new_user.id)

    return success_response(
        message="Đăng ký tài khoản thành công",
        data={
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "role": new_user.role,
                "display_name": new_user.display_name,
                "avatar_url": new_user.avatar_url,
            },
        },
    )
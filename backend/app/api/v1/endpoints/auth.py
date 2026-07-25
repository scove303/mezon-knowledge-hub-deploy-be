import uuid
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
    get_password_hash,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    GoogleLoginRequest,
    RefreshRequest,
    RegisterRequest,
)
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
# 1. ĐĂNG NHẬP USERNAME / PASSWORD
# =============================================================
@router.post("/login")
def login(data: LoginRequest, session: SessionDep):
    user = session.exec(select(User).where(User.username == data.username)).first()
    
    if not user or not verify_password(data.password, user.hashed_password):
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
            },
        },
    )


# =============================================================
# 2. ĐĂNG NHẬP GOOGLE OAUTH2
# =============================================================
@router.post("/google")
def login_with_google(data: GoogleLoginRequest, session: SessionDep):
    # 1. Xác thực id_token với Google Server
    try:
        id_info = id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
    except Exception as e:
        # In chi tiết lỗi gốc ra terminal của uvicorn để dễ debug
        import traceback
        traceback.print_exc()
        print(f"--- GOOGLE VERIFY ERROR DETAIL: {str(e)} ---")
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(f"Google Token không hợp lệ: {str(e)}"),
        )

    google_email = id_info.get("email")
    google_name = id_info.get("name", "")

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("Không lấy được email từ tài khoản Google"),
        )

    # 2. Tạo username dựa trên prefix email Google
    base_username = google_email.split("@")[0]
    
    # Tìm user theo username
    user = session.exec(select(User).where(User.username == base_username)).first()
    
    # 3. Nếu chưa có tài khoản thì tự động tạo mới
    if not user:
        username = base_username
        
        # Xử lý nếu username trùng lặp
        existing_user = session.exec(select(User).where(User.username == username)).first()
        if existing_user:
            username = f"{base_username}_{uuid.uuid4().hex[:4]}"

        # Tạo password ngẫu nhiên và băm lại (để thỏa mãn NOT NULL của DB)
        random_dummy_pass = uuid.uuid4().hex
        
        user = User(
            username=username,
            display_name=google_name or username,
            hashed_password=get_password_hash(random_dummy_pass),
            role="USER"
        )
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

    # 2. Băm mật khẩu và tạo user mới trong DB
    new_user = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        display_name=data.display_name or data.username,
        role="USER"
    )
    
    # 3. Lưu vào MySQL
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # 4. Tự động cấp Token đăng nhập
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
                "role": new_user.role,
                "display_name": new_user.display_name,
            },
        },
    )
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest
from app.schemas.common import error_response, success_response

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


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
                "display_name": user.display_name,
            },
        },
    )


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
            data={"accessToken": new_access, "refreshToken": new_refresh},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response("Token không hợp lệ hoặc đã hết hạn"),
        )

import secrets
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
)
from app.models.token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    MezonLoginRequest,
    RefreshRequest,
)
from app.schemas.common import error_response, success_response


router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]

# ------------------------------------------------------------------
# Lưu state Mezon OAuth đã phát hành (in-memory, TTL 10 phút, bounded)
# ------------------------------------------------------------------
MEZON_STATE_TTL_SECONDS = 600
MAX_MEZON_STATES = 1000
_mezon_states: dict[str, float] = {}


def _cleanup_mezon_states() -> None:
    now = time.time()
    expired = [
        s for s, issued_at in _mezon_states.items()
        if now - issued_at > MEZON_STATE_TTL_SECONDS
    ]
    for s in expired:
        _mezon_states.pop(s, None)

    # Nếu vẫn vượt quá MAX_MEZON_STATES, xóa các state cũ nhất
    if len(_mezon_states) > MAX_MEZON_STATES:
        oldest = sorted(_mezon_states.items(), key=lambda item: item[1])
        for s, _ in oldest[: len(_mezon_states) - MAX_MEZON_STATES]:
            _mezon_states.pop(s, None)


def _issue_mezon_state() -> str:
    """Sinh state 11 ký tự chữ-số theo yêu cầu của Mezon và lưu lại."""
    _cleanup_mezon_states()
    chars = string.ascii_letters + string.digits
    state = "".join(secrets.choice(chars) for _ in range(11))
    _mezon_states[state] = time.time()
    return state


def _validate_mezon_state(state: str) -> None:
    """Kiểm tra state do chính server phát hành (chống CSRF), xóa sau khi dùng."""
    _cleanup_mezon_states()
    if not state or state not in _mezon_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("State không hợp lệ hoặc đã hết hạn, vui lòng thử lại"),
        )
    issued_at = _mezon_states.pop(state)
    if time.time() - issued_at > MEZON_STATE_TTL_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("Phiên đăng nhập Mezon đã hết hạn, vui lòng thử lại"),
        )


# =============================================================
# 1. MEZON OAUTH2 - TẠO URL ĐĂNG NHẬP
# =============================================================
@router.get("/mezon/authorize")
def mezon_authorize():
    state = _issue_mezon_state()

    params = {
        "client_id": settings.MEZON_CLIENT_ID,
        "redirect_uri": settings.MEZON_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid offline",
        "state": state,
        "prompt": "login",
    }

    authorize_url = (
        "https://oauth2.mezon.ai/oauth2/auth?"
        + urlencode(params)
    )

    return success_response(
        message="Tạo Mezon OAuth2 URL thành công",
        data={
            "authorizeUrl": authorize_url,
            "state": state,
        },
    )


# =============================================================
# 2. MEZON OAUTH2 CALLBACK - NHẬN CODE RỒI CHUYỂN VỀ FRONTEND
# =============================================================
@router.get("/mezon/callback")
def mezon_callback(
    code: str = Query(""),
    state: str = Query(""),
    error: str = Query(""),
):
    base_url = settings.FRONTEND_URL.rstrip("/")
    login_url = f"{base_url}/login"

    if error:
        redirect_url = f"{login_url}?{urlencode({'error': error})}"
    elif code and state:
        redirect_url = f"{login_url}?code={code}&state={state}"
    else:
        redirect_url = f"{login_url}?{urlencode({'error': 'missing_code'})}"
    return RedirectResponse(url=redirect_url)


# =============================================================
# 3. MEZON OAUTH2 - ĐỔI CODE LẤY ACCESS TOKEN + TẠO TÀI KHOẢN
# =============================================================
@router.post("/mezon")
def login_with_mezon(
    data: MezonLoginRequest,
    session: SessionDep,
    response: Response = None,
):

    # ---------------------------------------------------------
    # 1. Validate state (chống CSRF)
    # ---------------------------------------------------------
    _validate_mezon_state(data.state)

    # ---------------------------------------------------------
    # 2. Đổi authorization code -> access token
    # ---------------------------------------------------------
    token_endpoint = "https://oauth2.mezon.ai/oauth2/token"

    payload = {
        "grant_type": "authorization_code",
        "code": data.code,
        "state": data.state,
        "client_id": settings.MEZON_CLIENT_ID,
        "client_secret": settings.MEZON_CLIENT_SECRET,
        "redirect_uri": settings.MEZON_REDIRECT_URI,
    }

    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }

    try:
        oauth_resp = requests.post(
            token_endpoint,
            data=payload,
            headers=headers,
            timeout=15,
        )
        oauth_resp.raise_for_status()
        token_data = oauth_resp.json()
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Xác thực với Mezon thất bại. Vui lòng thử lại sau."
            ),
        )

    mezon_access_token = token_data.get("access_token")
    if not mezon_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Không nhận được access_token từ Mezon"
            ),
        )

    # ---------------------------------------------------------
    # 3. Lấy thông tin user từ Mezon
    # ---------------------------------------------------------
    userinfo_endpoint = "https://oauth2.mezon.ai/userinfo"
    userinfo_headers = {
        "Authorization": f"Bearer {mezon_access_token}"
    }

    try:
        userinfo_res = requests.get(
            userinfo_endpoint,
            headers=userinfo_headers,
            timeout=15,
        )
        userinfo_res.raise_for_status()
        user_info = userinfo_res.json()
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Không lấy được thông tin tài khoản Mezon"
            ),
        )

    # ---------------------------------------------------------
    # 4. Map thông tin user (defensive: Mezon không document đầy đủ)
    # ---------------------------------------------------------
    if isinstance(user_info, dict) and isinstance(user_info.get("data"), dict):
        user_info = user_info["data"]

    mezon_id = (
        user_info.get("id")
        or user_info.get("user_id")
        or user_info.get("userId")
        or user_info.get("sub")
        or ""
    )
    mezon_username = (
        user_info.get("username")
        or user_info.get("login")
        or ""
    )
    mezon_name = (
        user_info.get("display_name")
        or user_info.get("name")
        or user_info.get("full_name")
        or mezon_username
        or "Mezon User"
    )
    mezon_picture = (
        user_info.get("avartar")
        or user_info.get("avatar")
        or user_info.get("avatar_url")
        or user_info.get("picture")
        or ""
    )
    mezon_email = user_info.get("email") or None

    if not mezon_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Không lấy được định danh tài khoản Mezon"
            ),
        )

    # ---------------------------------------------------------
    # 5. Tìm user theo mezon_id bất biến (chống account takeover)
    # ---------------------------------------------------------
    user = session.exec(
        select(User).where(User.mezon_id == mezon_id)
    ).first()

    # Fallback chỉ theo email nếu có (không match theo username tùy ý)
    if not user and mezon_email:
        user = session.exec(
            select(User).where(User.email == mezon_email)
        ).first()

    # ---------------------------------------------------------
    # 6. Tạo user nếu chưa tồn tại
    # ---------------------------------------------------------
    if not user:
        base_username = mezon_username or (
            mezon_email.split("@")[0] if mezon_email else mezon_id
        )
        username = base_username
        while session.exec(
            select(User).where(User.username == username)
        ).first():
            username = f"{base_username}_{uuid.uuid4().hex[:4]}"

        user = User(
            username=username,
            display_name=mezon_name,
            email=mezon_email,
            avatar_url=mezon_picture,
            mezon_id=mezon_id,
            hashed_password=get_password_hash(uuid.uuid4().hex),
            role="USER",
        )

        session.add(user)
        session.commit()
        session.refresh(user)

    # ---------------------------------------------------------
    # 7. Cập nhật thông tin mới nhất từ Mezon
    # ---------------------------------------------------------
    else:
        updated = False

        if not user.mezon_id and mezon_id:
            user.mezon_id = mezon_id
            updated = True
        if mezon_picture and user.avatar_url != mezon_picture:
            user.avatar_url = mezon_picture
            updated = True
        if mezon_email and user.email != mezon_email:
            user.email = mezon_email
            updated = True
        if mezon_name and user.display_name != mezon_name:
            user.display_name = mezon_name
            updated = True

        if updated:
            session.add(user)
            session.commit()
            session.refresh(user)

    # ---------------------------------------------------------
    # 8. Tạo JWT nội bộ, lưu Refresh Token vào DB & Set Cookie
    # ---------------------------------------------------------
    access_token = create_access_token(user.id)
    refresh_token_val, jti = create_refresh_token(user.id)

    # Lưu RefreshToken vào database để endpoint /refresh có thể xác thực và xoay vòng (rotate)
    db_refresh_token = RefreshToken(
        jti=jti,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(db_refresh_token)
    session.commit()

    if response is not None:
        response.set_cookie(
            key="refreshToken",
            value=refresh_token_val,
            httponly=True,
            secure=False if settings.DEBUG else True,
            samesite="lax",
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            path="/",
        )

    return success_response(
        message="Đăng nhập Mezon thành công",
        data={
            "accessToken": access_token,
            "refreshToken": refresh_token_val,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "display_name": (
                    user.display_name
                    or user.username
                ),
                "email": user.email,
                "avatar_url": user.avatar_url,
            },
        },
    )


# =============================================================
# 4. LÀM MỚI TOKEN
# =============================================================
@router.post("/refresh")
def refresh_token(
    data: RefreshRequest,
    session: SessionDep,
    response: Response = None,
):
    try:
        token_str = data.refreshToken
        payload = decode_token(token_str)

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail=error_response("Token không hợp lệ"))

        user_id = int(payload["sub"])
        jti = payload.get("jti")

        if not jti:
            raise HTTPException(status_code=401, detail=error_response("Token thiếu định danh jti"))

        # Tìm token trong database
        db_token = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()

        # 🚨 REPLAY ATTACK DETECTION: Nếu token đã bị revoke mà kẻ xấu cố xài lại
        if db_token and db_token.is_revoked:
            # Thu hồi TOÀN BỘ phiên đăng nhập của user này để phòng vệ
            user_tokens = session.exec(select(RefreshToken).where(RefreshToken.user_id == user_id)).all()
            for t in user_tokens:
                t.is_revoked = True
            session.commit()

            raise HTTPException(
                status_code=401,
                detail=error_response("Phát hiện nguy cơ bảo mật. Tất cả phiên đăng nhập đã bị thu hồi.")
            )

        if not db_token:
            raise HTTPException(status_code=401, detail=error_response("Token không tồn tại hoặc đã hết hạn"))

        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail=error_response("Người dùng không tồn tại"))

        # 1. HỦY TOKEN CŨ (Rotation)
        db_token.is_revoked = True
        session.add(db_token)

        # 2. SINH CẶP TOKEN MỚI
        new_access = create_access_token(user.id)
        new_refresh, new_jti = create_refresh_token(user.id)

        # 3. LƯU TOKEN MỚI VÀO DB
        new_db_token = RefreshToken(
            jti=new_jti,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        session.add(new_db_token)
        session.commit()

        if response is not None:
            response.set_cookie(
                key="refreshToken",
                value=new_refresh,
                httponly=True,
                secure=not settings.DEBUG,
                samesite="lax",
                max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
                path="/",
            )

        return success_response(
            message="Làm mới token thành công",
            data={"accessToken": new_access, "refreshToken": new_refresh},
        )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail=error_response("Token không hợp lệ hoặc đã hết hạn"),
        )
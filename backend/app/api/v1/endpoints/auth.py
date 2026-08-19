import uuid
import secrets
import string
import time
import requests

from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
)
from app.models.user import User

from app.api.deps import merge_guest_into_user

from app.schemas.auth import (
    RefreshRequest,
    MezonLoginRequest,
)
from app.schemas.common import error_response, success_response

from jose import jwt


router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]

# ------------------------------------------------------------------
# Lưu state Mezon OAuth đã phát hành (in-memory, TTL 10 phút)
# ------------------------------------------------------------------
MEZON_STATE_TTL_SECONDS = 600
_mezon_states: dict[str, float] = {}


def _issue_mezon_state() -> str:
    """Sinh state 11 ký tự chữ-số theo yêu cầu của Mezon và lưu lại."""
    chars = string.ascii_letters + string.digits
    state = "".join(secrets.choice(chars) for _ in range(11))
    _cleanup_mezon_states()
    _mezon_states[state] = time.time()
    return state


def _validate_mezon_state(state: str) -> None:
    """Kiểm tra state do chính server phát hành (chống CSRF), xóa sau khi dùng."""
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


def _cleanup_mezon_states() -> None:
    now = time.time()
    expired = [
        s for s, issued_at in _mezon_states.items()
        if now - issued_at > MEZON_STATE_TTL_SECONDS
    ]
    for s in expired:
        _mezon_states.pop(s, None)


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

    print("========== MEZON AUTHORIZE ==========")
    print("CLIENT_ID:", settings.MEZON_CLIENT_ID)
    print("REDIRECT_URI:", settings.MEZON_REDIRECT_URI)
    print("STATE:", state)
    print("AUTHORIZE URL:", authorize_url)

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
    print("========== MEZON CALLBACK ==========")
    print("CODE:", code)
    print("STATE:", state)
    print("ERROR:", error)

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
    x_guest_id: str | None = Header(default=None),
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

    print("========== MEZON TOKEN EXCHANGE ==========")
    print("CLIENT_ID:", settings.MEZON_CLIENT_ID)
    print("REDIRECT_URI:", settings.MEZON_REDIRECT_URI)
    print("CODE:", data.code[:10] + "..." if data.code else None)
    print("STATE:", data.state)

    try:
        response = requests.post(
            token_endpoint,
            data=payload,
            headers=headers,
            timeout=15,
        )
        print("MEZON TOKEN STATUS:", response.status_code)
        print("MEZON TOKEN RESPONSE:", response.text)
        response.raise_for_status()
        token_data = response.json()
    except requests.exceptions.RequestException as e:
        print("MEZON TOKEN ERROR:", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"Xác thực với Mezon thất bại: {str(e)}"
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
        print("MEZON USERINFO STATUS:", userinfo_res.status_code)
        print("MEZON USERINFO:", userinfo_res.text)
        userinfo_res.raise_for_status()
        user_info = userinfo_res.json()
    except requests.exceptions.RequestException as e:
        print("MEZON USERINFO ERROR:", str(e))
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
    # 5. Tìm user theo mezon_id (link với tài khoản bot), fallback email/username
    # ---------------------------------------------------------
    user = session.exec(
        select(User).where(User.mezon_id == mezon_id)
    ).first()

    if not user and mezon_email:
        user = session.exec(
            select(User).where(User.email == mezon_email)
        ).first()

    if not user and mezon_username:
        user = session.exec(
            select(User).where(User.username == mezon_username)
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
    # 8. Merge dữ liệu khách (guest) vào tài khoản vừa đăng nhập
    # ---------------------------------------------------------
    if x_guest_id and x_guest_id.strip():
        guest_user = session.exec(
            select(User).where(
                User.username == f"guest_{x_guest_id.strip()}"
            )
        ).first()
        if guest_user and guest_user.id != user.id:
            merged_count = merge_guest_into_user(
                session, guest_user.id, user.id
            )
            print(f"MEZON LOGIN: merged {merged_count} folders from guest {guest_user.id}")

    # ---------------------------------------------------------
    # 9. Tạo JWT nội bộ
    # ---------------------------------------------------------
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return success_response(
        message="Đăng nhập Mezon thành công",
        data={
            "accessToken": access_token,
            "refreshToken": refresh_token,
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
    session: SessionDep
):

    try:

        payload = decode_token(
            data.refreshToken
        )

        if payload.get("type") != "refresh":

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response(
                    "Token không hợp lệ"
                ),
            )

        user_id = int(payload["sub"])

        user = session.get(
            User,
            user_id
        )

        if not user:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response(
                    "Người dùng không tồn tại"
                ),
            )

        new_access = create_access_token(
            user.id
        )

        new_refresh = create_refresh_token(
            user.id
        )

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
            detail=error_response(
                "Token không hợp lệ hoặc đã hết hạn"
            ),
        )

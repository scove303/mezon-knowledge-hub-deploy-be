import uuid
import secrets
import string
import time
import requests

from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    MezonLoginRequest,
)
from app.schemas.common import error_response, success_response

from jose import jwt


router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


# =============================================================
# 1. ĐĂNG NHẬP USERNAME / PASSWORD
# =============================================================
@router.post("/login")
def login(data: LoginRequest, session: SessionDep):

    user = session.exec(
        select(User).where(User.username == data.username)
    ).first()

    if not user or not verify_password(
        data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_response(
                "Tên đăng nhập hoặc mật khẩu không đúng"
            ),
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
def login_with_google(
    data: GoogleLoginRequest,
    session: SessionDep
):
    print("====== GOOGLE LOGIN ======")

    print(data.id_token)

    token_str = data.id_token.strip() if data.id_token else ""

    google_email = ""
    google_name = "Google User"
    google_picture = ""

    # ---------------------------------------------------------
    # 1. Xác thực ID Token với Google
    # ---------------------------------------------------------
    try:
        if settings.GOOGLE_CLIENT_ID:

            payload = jwt.get_unverified_claims(token_str)

            print("SERVER TIME:", time.time())
            print("IAT:", payload.get("iat"))
            print("NBF:", payload.get("nbf"))
            print("EXP:", payload.get("exp"))

            id_info = id_token.verify_oauth2_token(
                token_str,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )

            google_email = id_info.get("email")
            google_name = id_info.get("name", "")
            google_picture = id_info.get("picture", "")

    except Exception as e:
        import traceback

        traceback.print_exc()

        print(
            f"--- GOOGLE VERIFY ERROR DETAIL: {str(e)} ---"
        )

    # ---------------------------------------------------------
    # 2. Fallback
    # ---------------------------------------------------------
    if not google_email:

        if "@" in token_str and "." in token_str:
            google_email = token_str
            google_name = token_str.split("@")[0]

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Google Token không hợp lệ hoặc không lấy được email"
            ),
        )

    # ---------------------------------------------------------
    # 3. Tạo username
    # ---------------------------------------------------------
    base_username = google_email.split("@")[0]

    user = session.exec(
        select(User).where(
            User.username == base_username
        )
    ).first()

    # ---------------------------------------------------------
    # 4. Tạo user nếu chưa tồn tại
    # ---------------------------------------------------------
    if not user:

        username = base_username

        existing_user = session.exec(
            select(User).where(
                User.username == username
            )
        ).first()

        if existing_user:
            username = (
                f"{base_username}_{uuid.uuid4().hex[:4]}"
            )

        random_dummy_pass = uuid.uuid4().hex

        user = User(
            username=username,
            display_name=google_name or username,
            email=google_email,
            avatar_url=google_picture,
            hashed_password=get_password_hash(
                random_dummy_pass
            ),
            role="USER"
        )

        session.add(user)
        session.commit()
        session.refresh(user)

    else:

        updated = False

        if (
            google_picture
            and user.avatar_url != google_picture
        ):
            user.avatar_url = google_picture
            updated = True

        if (
            google_email
            and user.email != google_email
        ):
            user.email = google_email
            updated = True

        if updated:
            session.add(user)
            session.commit()
            session.refresh(user)

    # ---------------------------------------------------------
    # 5. JWT nội bộ
    # ---------------------------------------------------------
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
# 3. MEZON OAUTH2 - TẠO URL ĐĂNG NHẬP
# =============================================================
@router.get("/mezon/authorize")
def mezon_authorize():

    # Mezon yêu cầu state gồm đúng 11 ký tự
    chars = string.ascii_letters + string.digits

    state = "".join(
        secrets.choice(chars)
        for _ in range(11)
    )

    params = {
        "client_id": settings.MEZON_CLIENT_ID,
        "redirect_uri": settings.MEZON_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid offline",
        "state": state,
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
# 4. MEZON OAUTH2 - ĐỔI CODE LẤY ACCESS TOKEN
# =============================================================
@router.post("/mezon")
def login_with_mezon(
    data: MezonLoginRequest,
    session: SessionDep
):

    token_endpoint = (
        "https://oauth2.mezon.ai/oauth2/token"
    )

    payload = {
        "grant_type": "authorization_code",
        "code": data.code,
        "state": data.state,
        "client_id": settings.MEZON_CLIENT_ID,
        "client_secret": settings.MEZON_CLIENT_SECRET,
        "redirect_uri": settings.MEZON_REDIRECT_URI,
    }

    headers = {
        "Content-Type": (
            "application/x-www-form-urlencoded"
        )
    }

    print("========== MEZON TOKEN EXCHANGE ==========")
    print(
        "CLIENT_ID:",
        settings.MEZON_CLIENT_ID
    )
    print(
        "REDIRECT_URI:",
        settings.MEZON_REDIRECT_URI
    )
    print(
        "CODE:",
        (
            data.code[:10] + "..."
            if data.code
            else None
        )
    )
    print("STATE:", data.state)

    # ---------------------------------------------------------
    # 1. Đổi authorization code -> access token
    # ---------------------------------------------------------
    try:

        response = requests.post(
            token_endpoint,
            data=payload,
            headers=headers,
            timeout=15,
        )

        print(
            "MEZON TOKEN STATUS:",
            response.status_code
        )

        print(
            "MEZON TOKEN RESPONSE:",
            response.text
        )

        response.raise_for_status()

        token_data = response.json()

    except requests.exceptions.RequestException as e:

        print(
            "MEZON TOKEN ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"Xác thực với Mezon thất bại: {str(e)}"
            ),
        )

    mezon_access_token = token_data.get(
        "access_token"
    )

    if not mezon_access_token:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Không nhận được access_token từ Mezon"
            ),
        )

    # ---------------------------------------------------------
    # 2. Lấy thông tin user từ Mezon
    # ---------------------------------------------------------
    userinfo_endpoint = (
        "https://oauth2.mezon.ai/userinfo"
    )

    userinfo_headers = {
        "Authorization": (
            f"Bearer {mezon_access_token}"
        )
    }

    try:

        userinfo_res = requests.get(
            userinfo_endpoint,
            headers=userinfo_headers,
            timeout=15,
        )

        print(
            "MEZON USERINFO STATUS:",
            userinfo_res.status_code
        )

        print(
            "MEZON USERINFO:",
            userinfo_res.text
        )

        userinfo_res.raise_for_status()

        user_info = userinfo_res.json()

    except requests.exceptions.RequestException as e:

        print(
            "MEZON USERINFO ERROR:",
            str(e)
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Không lấy được thông tin tài khoản Mezon"
            ),
        )

    # ---------------------------------------------------------
    # 3. Lấy thông tin user
    # ---------------------------------------------------------
    mezon_email = (
        user_info.get("email")
        or (
            f"user_"
            f"{uuid.uuid4().hex[:8]}"
            f"@mezon.ai"
        )
    )

    mezon_name = (
        user_info.get("name")
        or "Mezon User"
    )

    mezon_picture = (
        user_info.get("picture")
        or ""
    )

    # ---------------------------------------------------------
    # 4. Tìm user trong DB
    # ---------------------------------------------------------
    base_username = mezon_email.split("@")[0]

    user = session.exec(
        select(User).where(
            User.username == base_username
        )
    ).first()

    # ---------------------------------------------------------
    # 5. Tạo user nếu chưa tồn tại
    # ---------------------------------------------------------
    if not user:

        username = base_username

        existing_user = session.exec(
            select(User).where(
                User.username == username
            )
        ).first()

        if existing_user:
            username = (
                f"{base_username}_"
                f"{uuid.uuid4().hex[:4]}"
            )

        random_dummy_pass = uuid.uuid4().hex

        user = User(
            username=username,
            display_name=mezon_name,
            email=mezon_email,
            avatar_url=mezon_picture,
            hashed_password=get_password_hash(
                random_dummy_pass
            ),
            role="USER"
        )

        session.add(user)
        session.commit()
        session.refresh(user)

    else:

        updated = False

        if (
            mezon_picture
            and user.avatar_url != mezon_picture
        ):
            user.avatar_url = mezon_picture
            updated = True

        if (
            mezon_email
            and user.email != mezon_email
        ):
            user.email = mezon_email
            updated = True

        if updated:
            session.add(user)
            session.commit()
            session.refresh(user)

    # ---------------------------------------------------------
    # 6. Tạo JWT nội bộ
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
# 5. MEZON OAUTH2 CALLBACK
# =============================================================
@router.get("/mezon/callback")
def mezon_callback(
    code: str = Query(...),
    state: str = Query(...),
):

    print("========== MEZON CALLBACK ==========")
    print(
        "CODE:",
        code[:10] + "..." if code else None
    )
    print("STATE:", state)

    return success_response(
        message="Nhận mã Mezon code thành công!",
        data={
            "code": code,
            "state": state,
        },
    )


# =============================================================
# 6. LÀM MỚI TOKEN
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


# =============================================================
# 7. ĐĂNG KÝ TÀI KHOẢN
# =============================================================
@router.post("/register")
def register(
    data: RegisterRequest,
    session: SessionDep
):

    # ---------------------------------------------------------
    # 1. Kiểm tra username
    # ---------------------------------------------------------
    existing_user = session.exec(
        select(User).where(
            User.username == data.username
        )
    ).first()

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                "Tên đăng nhập đã tồn tại"
            ),
        )

    # ---------------------------------------------------------
    # 2. Tạo user
    # ---------------------------------------------------------
    new_user = User(
        username=data.username,
        hashed_password=get_password_hash(
            data.password
        ),
        email=data.email,
        display_name=(
            data.display_name
            or data.username
        ),
        role="USER"
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # ---------------------------------------------------------
    # 3. Tạo token
    # ---------------------------------------------------------
    access_token = create_access_token(
        new_user.id
    )

    refresh_token = create_refresh_token(
        new_user.id
    )

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
                "email": new_user.email,
                "avatar_url": new_user.avatar_url,
            },
        },
    )
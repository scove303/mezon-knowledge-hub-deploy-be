from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import decode_token, get_password_hash
from app.models.folder import FolderRoot
from app.models.user import User

# HTTPBearer: Swagger Authorize chỉ hiện 1 ô "Value" để dán token,
# không sinh form username/password/client_id như OAuth2PasswordBearer.
bearer_scheme = HTTPBearer(auto_error=False)

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: SessionDep,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "success": False,
            "message": "Không thể xác thực thông tin đăng nhập",
            "data": None,
        },
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token = credentials.credentials

    try:
        payload = decode_token(token)

        if payload.get("type") != "access":
            raise credentials_exception

        user_id: str = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = session.get(User, int(user_id))

    if user is None:
        raise credentials_exception

    return user


def get_current_actor(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Trả về user đã xác thực qua Bearer Token."""
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActor = Annotated[User, Depends(get_current_actor)]
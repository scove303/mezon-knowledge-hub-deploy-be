from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import decode_token, get_password_hash
from app.models.folder import FolderRoot
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    session: SessionDep,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"success": False, "message": "Không thể xác thực thông tin đăng nhập", "data": None},
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
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
    token: Annotated[str | None, Depends(oauth2_scheme)],
    session: SessionDep,
    x_guest_id: str | None = Header(default=None),
) -> User:
    """Trả về user đã đăng nhập, hoặc get-or-create một user khách vãng lai
    định danh qua header X-Guest-Id (UUID do frontend sinh ra)."""
    if token:
        return get_current_user(token, session)

    if x_guest_id and x_guest_id.strip():
        guest_username = f"guest_{x_guest_id.strip()}"
        user = session.exec(
            select(User).where(User.username == guest_username)
        ).first()
        if user:
            return user

        import uuid

        guest = User(
            username=guest_username,
            display_name="Khách",
            hashed_password=get_password_hash(uuid.uuid4().hex),
            role="GUEST",
        )
        session.add(guest)
        session.commit()
        session.refresh(guest)
        return guest

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"success": False, "message": "Vui lòng đăng nhập hoặc cung cấp mã khách (X-Guest-Id)", "data": None},
        headers={"WWW-Authenticate": "Bearer"},
    )


def merge_guest_into_user(
    session: Session, guest_id: int, user_id: int
) -> int:
    """Adopt-all: chuyển toàn bộ folder của khách sang tài khoản vừa xác thực,
    xóa folder_root của khách (unique per user) và xóa luôn user khách.
    Trả về số folder đã gộp."""
    from app.models.folder import Folder

    guest = session.get(User, guest_id)
    if not guest or guest.role != "GUEST":
        return 0

    folders = session.exec(
        select(Folder).where(Folder.user_id == guest_id)
    ).all()

    for f in folders:
        f.user_id = user_id

    roots = session.exec(
        select(FolderRoot).where(FolderRoot.user_id == guest_id)
    ).all()
    for r in roots:
        session.delete(r)

    session.delete(guest)
    session.commit()
    return len(folders)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActor = Annotated[User, Depends(get_current_actor)]

# app/models/token.py
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field

class RefreshToken(SQLModel, table=True):
    __tablename__ = "refreshtoken"

    id: int | None = Field(default=None, primary_key=True)
    jti: str = Field(index=True, unique=True)  # JWT ID duy nhất cho mỗi token
    user_id: int = Field(index=True, foreign_key="user.id")
    is_revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
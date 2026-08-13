from typing import Optional
from pydantic import BaseModel, Field


# --- 1. SCHEMAS CHO MEZON OAUTH2 ---
class MezonLoginRequest(BaseModel):
    code: str
    state: str = Field(..., description="State do server phát hành khi tạo authorize URL")


# --- 2. SCHEMAS CHO REFRESH TOKEN ---
class RefreshRequest(BaseModel):
    refreshToken: str


class RefreshResponse(BaseModel):
    accessToken: str
    refreshToken: str

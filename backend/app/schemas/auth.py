from typing import Optional
from pydantic import BaseModel, Field


# --- 1. SCHEMAS CHO ĐĂNG NHẬP USERNAME / PASSWORD ---
class LoginRequest(BaseModel):
    username: str
    password: str


# --- 2. SCHEMAS CHO ĐĂNG NHẬP GOOGLE OAUTH2 ---
class GoogleLoginRequest(BaseModel):
    id_token: str  # Token gửi từ Google SDK ở Frontend


# --- 3. SCHEMAS DÙNG CHUNG CHO USER INFO & RESPONSE ---
class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: UserInfo


# --- 4. SCHEMAS CHO REFRESH TOKEN ---
class RefreshRequest(BaseModel):
    refreshToken: str


class RefreshResponse(BaseModel):
    accessToken: str
    refreshToken: str


# --- 5. SCHEMAS CHO ĐĂNG KÝ TÀI KHOẢN ---
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập từ 3-50 ký tự")
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    display_name: Optional[str] = Field(None, max_length=100)
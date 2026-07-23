from typing import Optional
from pydantic import BaseModel


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
    email: Optional[str] = None        
    avatar_url: Optional[str] = None


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
    username: str
    password: str
    email: Optional[str] = None         # ✅ Đã đổi từ Optional[EmailStr] sang Optional[str]
    display_name: Optional[str] = None
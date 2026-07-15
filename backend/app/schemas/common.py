from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool
    message: str
    data: Optional[T] = None


def success_response(data: Any = None, message: str = "Thao tác thành công") -> dict:
    return {"success": True, "message": message, "data": data}


def error_response(message: str) -> dict:
    return {"success": False, "message": message, "data": None}

from fastapi import APIRouter

from app.api.v1.endpoints import auth, folders, files, ai

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Services"])

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.errors import AppException
from app.database.database import get_db
from app.schemas.auth import AuthRequest, AuthResponse, UserPublic
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest, db: Session = Depends(get_db)):
    return AuthService(db).register(payload.email, payload.password)


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthRequest, db: Session = Depends(get_db)):
    return AuthService(db).login(payload.email, payload.password)


@router.get("/me", response_model=UserPublic)
def get_current_user(db: Session = Depends(get_db)):
    owner_id = db.info.get("owner_id")
    if not owner_id:
        raise AppException("Please sign in to continue.", code="UNAUTHENTICATED", status_code=401)
    return AuthService(db).get_user(owner_id)

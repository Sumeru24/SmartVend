from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.database.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Sign in as an administrator or operator",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled.",
        )
    token = create_access_token(str(user.id), user.role, {"email": user.email})
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut, summary="Get the signed-in user")
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)

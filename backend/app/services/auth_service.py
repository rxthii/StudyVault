import base64
import hashlib
import hmac
import os
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.auth_tokens import TOKEN_TTL_SECONDS, create_access_token
from app.core.config import Settings, get_settings
from app.core.errors import AppException
from app.models.user import User


PBKDF2_ITERATIONS = 600_000


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(derived).decode()}"


def _verify_password(password: str, encoded_hash: str) -> bool:
    try:
        scheme, iterations, salt_text, hash_text = encoded_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(hash_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


class AuthService:
    def __init__(self, db: Session, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    def _response(self, user: User) -> dict:
        return {
            "access_token": create_access_token(user.id, self.settings.AUTH_SECRET_KEY),
            "token_type": "bearer",
            "expires_in": TOKEN_TTL_SECONDS,
            "user": user,
        }

    def register(self, email: str, password: str) -> dict:
        normalized_email = email.strip().lower()
        existing = self.db.query(User).filter(User.email == normalized_email).first()
        if existing:
            raise AppException("An account with this email already exists. Please sign in.", code="EMAIL_IN_USE", status_code=409)

        user = User(email=normalized_email, password_hash=_hash_password(password))
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise AppException("Could not create the account. Please try again.", code="ACCOUNT_CREATION_FAILED", status_code=409)
        self.db.refresh(user)
        return self._response(user)

    def login(self, email: str, password: str) -> dict:
        normalized_email = email.strip().lower()
        user = self.db.query(User).filter(User.email == normalized_email).first()
        if not user or not _verify_password(password, user.password_hash):
            raise AppException("Email or password is incorrect.", code="INVALID_CREDENTIALS", status_code=401)
        return self._response(user)

    def get_user(self, user_id: str) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise AppException("Your session is no longer valid. Please sign in again.", code="INVALID_SESSION", status_code=401)
        return user

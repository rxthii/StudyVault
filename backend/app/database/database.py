from datetime import datetime, timezone
import os
from fastapi import Request
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

# For SQLite, check same thread is False
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db(request: Request):
    """FastAPI dependency yielding a database session."""
    db: Session = SessionLocal()
    db.info["owner_id"] = getattr(request.state, "owner_id", None) or "local"
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes database tables on application startup."""
    from app.models.document import Document, DocumentChunk
    from app.models.conversation import Conversation, Message
    from app.models.flashcard import FlashcardSet, Flashcard
    from app.models.quiz import Quiz
    from app.models.user import User
    
    # Ensure local directory exists if sqlite file
    if settings.DATABASE_URL.startswith("sqlite:///"):
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
    # Add ownership columns to databases created by earlier single-user builds.
    # Existing rows remain NULL-owned and are never exposed to new accounts.
    existing_tables = set(inspect(engine).get_table_names())
    ownership_tables = ("documents", "conversations", "quizzes", "flashcard_sets")
    for table_name in ownership_tables:
        if table_name in existing_tables:
            columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
            if "owner_id" not in columns:
                with engine.begin() as connection:
                    connection.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN owner_id VARCHAR(36)'))

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

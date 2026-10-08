from datetime import datetime, timezone
import os
from sqlalchemy import create_engine
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


def get_db():
    """FastAPI dependency yielding a database session."""
    db: Session = SessionLocal()
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
    
    # Ensure local directory exists if sqlite file
    if settings.DATABASE_URL.startswith("sqlite:///"):
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

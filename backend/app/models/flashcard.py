from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    difficulty = Column(String(50), default="medium", nullable=False)
    count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    cards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    set_id = Column(String(36), ForeignKey("flashcard_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    document_id = Column(String(36), nullable=True)
    document_name = Column(String(255), nullable=True)
    page_number = Column(Integer, nullable=True)
    source_chunk_id = Column(String(100), nullable=True)
    review_status = Column(String(50), default="unreviewed", nullable=False)  # unreviewed, known, review_again
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    flashcard_set = relationship("FlashcardSet", back_populates="cards")

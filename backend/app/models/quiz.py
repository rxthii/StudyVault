from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from app.database.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=True)
    difficulty = Column(String(50), default="medium", nullable=False)
    question_count = Column(Integer, default=5, nullable=False)
    questions_json = Column(Text, nullable=False)  # Serialized JSON list of questions
    score = Column(Integer, nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

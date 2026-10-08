from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

DifficultyLevel = Literal["easy", "medium", "hard"]


class QuizQuestionItem(BaseModel):
    question_id: int
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    document_name: Optional[str] = None
    page_number: Optional[int] = None
    source_snippet: Optional[str] = None


class QuizQuestionStudentView(BaseModel):
    question_id: int
    question: str
    options: List[str]


class Quiz(BaseModel):
    id: str
    title: Optional[str] = None
    difficulty: str
    question_count: int
    questions: List[QuizQuestionStudentView]
    completed: bool
    score: Optional[int] = None
    created_at: datetime


class QuizGenerationRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(
        default=None,
        examples=[None],
        description="Optional list of document IDs to generate quiz from. Leave empty or null to use all active linked documents."
    )
    question_count: int = Field(default=5, ge=1, le=25, description="Number of questions (e.g., 5, 10)")
    difficulty: DifficultyLevel = Field(default="medium", description="Difficulty: easy, medium, hard")


class QuizSubmitRequest(BaseModel):
    answers: Dict[str, str] = Field(..., description="Mapping of question index or question ID string to user's selected option")


class QuizEvaluationDetail(BaseModel):
    question_id: int
    question: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    source_reference: Optional[Dict[str, Any]] = None


class QuizSubmitResult(BaseModel):
    quiz_id: str
    score: int
    total_questions: int
    percentage: float
    results: List[QuizEvaluationDetail]

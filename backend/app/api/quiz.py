from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.quiz import (
    Quiz as QuizSchema,
    QuizGenerationRequest,
    QuizSubmitRequest,
    QuizSubmitResult,
)
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/quiz", tags=["Quiz"])


@router.post(
    "/generate",
    response_model=QuizSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Grounded Quiz"
)
def generate_quiz(
    payload: QuizGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an exam multiple-choice quiz strictly grounded in active or specified documents.
    """
    svc = QuizService(db)
    return svc.generate_quiz(payload)


@router.get(
    "/{quiz_id}",
    response_model=QuizSchema,
    summary="Get Quiz"
)
def get_quiz(
    quiz_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve quiz questions for taking the assessment.
    """
    svc = QuizService(db)
    return svc.get_quiz(quiz_id)


@router.post(
    "/{quiz_id}/submit",
    response_model=QuizSubmitResult,
    summary="Submit and Grade Quiz"
)
def submit_quiz(
    quiz_id: str,
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Submit answers for evaluation. Returns calculated score, percentage, correct answers,
    detailed explanations, and direct document source citations.
    """
    svc = QuizService(db)
    return svc.submit_quiz(quiz_id, payload)

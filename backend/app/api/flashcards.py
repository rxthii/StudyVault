from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.flashcard import (
    FlashcardGenerationRequest,
    FlashcardSet as FlashcardSetSchema,
    FlashcardReviewRequest,
    FlashcardReviewResponse,
)
from app.schemas.common import BaseMessageResponse
from app.services.flashcard_service import FlashcardService

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])


@router.post(
    "/generate",
    response_model=FlashcardSetSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Grounded Flashcard Deck"
)
def generate_flashcards(
    payload: FlashcardGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an active-recall flashcard set strictly grounded in active or specified documents.
    Supports easy, medium, and hard difficulty tiers.
    """
    svc = FlashcardService(db)
    return svc.generate_flashcards(payload)


@router.get(
    "",
    response_model=List[FlashcardSetSchema],
    summary="List Flashcard Decks"
)
def list_flashcard_sets(
    db: Session = Depends(get_db)
):
    """
    List all generated flashcard sets.
    """
    svc = FlashcardService(db)
    return svc.list_flashcard_sets()


@router.get(
    "/{flashcard_set_id}",
    response_model=FlashcardSetSchema,
    summary="Get Flashcard Deck"
)
def get_flashcard_set(
    flashcard_set_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve all flashcards for a specific deck.
    """
    svc = FlashcardService(db)
    return svc.get_flashcard_set(flashcard_set_id)


@router.delete(
    "/{flashcard_set_id}",
    response_model=BaseMessageResponse,
    summary="Delete Flashcard Deck"
)
def delete_flashcard_set(
    flashcard_set_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a generated flashcard set and its cards.
    """
    svc = FlashcardService(db)
    svc.delete_flashcard_set(flashcard_set_id)
    return BaseMessageResponse(
        message=f"Flashcard set '{flashcard_set_id}' deleted successfully."
    )


@router.post(
    "/{flashcard_id}/review",
    response_model=FlashcardReviewResponse,
    summary="Update Flashcard Review State"
)
def review_flashcard(
    flashcard_id: str,
    payload: FlashcardReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Record student review progress for a flashcard ('known', 'review_again', 'unreviewed').
    """
    svc = FlashcardService(db)
    return svc.review_card(flashcard_id, payload.status)

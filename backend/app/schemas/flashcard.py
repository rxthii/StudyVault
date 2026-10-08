from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

DifficultyLevel = Literal["easy", "medium", "hard"]
ReviewStatus = Literal["known", "review_again", "unreviewed"]


class FlashcardItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    set_id: str
    question: str
    answer: str
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    page_number: Optional[int] = None
    source_chunk_id: Optional[str] = None
    review_status: str
    created_at: datetime


class FlashcardSet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: Optional[str] = None
    difficulty: str
    count: int
    created_at: datetime
    cards: List[FlashcardItem] = Field(default_factory=list)


class FlashcardGenerationRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(
        default=None,
        examples=[None],
        description="Optional list of document IDs to generate from. Leave empty or null to use all active linked documents."
    )
    count: int = Field(default=5, ge=1, le=50, description="Number of cards (e.g., 5, 10, 20)")
    difficulty: DifficultyLevel = Field(default="medium", description="Difficulty: easy, medium, hard")


class FlashcardReviewRequest(BaseModel):
    status: ReviewStatus = Field(..., description="Review status: known or review_again")


class FlashcardReviewResponse(BaseModel):
    card_id: str
    review_status: str
    message: str

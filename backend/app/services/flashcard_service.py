from typing import List, Optional
from sqlalchemy.orm import Session
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import DocumentNotFoundError, AppException
from app.database.repositories import FlashcardRepository, DocumentRepository
from app.ai.openrouter import get_llm
from app.ai.generators import StructuredGenerators
from app.services.context_selection import select_representative_chunks
from app.schemas.flashcard import (
    FlashcardGenerationRequest,
    FlashcardSet as FlashcardSetSchema,
    FlashcardItem,
    FlashcardReviewResponse
)


class FlashcardService:
    def __init__(
        self,
        db: Session,
        settings: Optional[Settings] = None,
        llm: Optional[BaseChatModel] = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.repo = FlashcardRepository(db)
        self.doc_repo = DocumentRepository(db)
        self._llm_override = llm

    def generate_flashcards(self, request: FlashcardGenerationRequest) -> FlashcardSetSchema:
        """
        Generates active-recall flashcard deck grounded in active/selected documents.
        """
        # Determine source documents
        active_ids = self.doc_repo.get_linked_document_ids()
        if not active_ids:
            raise AppException(
                "No linked or ready documents available to generate flashcards from. Please upload a document or link an existing one.",
                code="NO_DOCUMENTS_AVAILABLE",
                status_code=400
            )

        clean_ids = [
            d.strip() for d in (request.document_ids or [])
            if d and d.strip().lower() not in ["string", "null", "none"]
        ]

        if not clean_ids:
            target_ids = active_ids
        else:
            target_ids = [d for d in clean_ids if d in active_ids]
            if not target_ids:
                for d in clean_ids:
                    doc = self.doc_repo.get_by_id(d)
                    if doc and not doc.linked:
                        raise AppException(
                            f"Document '{doc.filename}' ({doc.id}) is currently unlinked. Please link it using PATCH /api/documents/{doc.id}/link before generating.",
                            code="DOCUMENT_UNLINKED",
                            status_code=400,
                            details={"unlinked_document_id": doc.id}
                        )
                raise AppException(
                    f"None of the requested documents {clean_ids} exist or are currently linked in your library. Available active documents: {active_ids}",
                    code="NO_ACTIVE_DOCUMENTS",
                    status_code=400,
                    details={"requested_ids": clean_ids, "available_linked_ids": active_ids}
                )

        # Collect chunks from target documents
        all_chunks = []
        for doc_id in target_ids:
            doc = self.doc_repo.get_by_id(doc_id)
            chunks = self.doc_repo.get_all_chunks(doc_id)
            for c in chunks:
                all_chunks.append({
                    "document_id": doc_id,
                    "filename": doc.filename if doc else "Document",
                    "page_number": c.page_number,
                    "chunk_id": c.chunk_id,
                    "snippet": c.text
                })

        if not all_chunks:
            raise AppException("No content chunks found in selected documents.", code="EMPTY_DOCUMENTS", status_code=400)

        # Sample or take top chunks
        selected_snippets = select_representative_chunks(
            all_chunks,
            min(len(all_chunks), min(30, max(8, request.count * 2)))
        )

        generation_llm = self._llm_override or get_llm(
            self.settings,
            temperature=0.2,
            max_tokens=min(5000, max(1200, request.count * 160)),
        )

        # Call StructuredGenerator
        gen_data = StructuredGenerators.generate_flashcards_content(
            llm=generation_llm,
            snippets=selected_snippets,
            count=request.count,
            difficulty=request.difficulty
        )

        cards = gen_data.get("cards", [])
        title = gen_data.get("title", f"StudyVault Flashcards ({request.difficulty.capitalize()})")

        # Persist to SQLite
        fc_set = self.repo.create_set(
            title=title,
            difficulty=request.difficulty,
            count=len(cards),
            cards_data=cards
        )

        return FlashcardSetSchema.model_validate(fc_set)

    def list_flashcard_sets(self) -> List[FlashcardSetSchema]:
        sets = self.repo.list_sets()
        return [FlashcardSetSchema.model_validate(s) for s in sets]

    def get_flashcard_set(self, set_id: str) -> FlashcardSetSchema:
        s = self.repo.get_set_by_id(set_id)
        if not s:
            raise AppException(f"Flashcard set '{set_id}' not found.", code="NOT_FOUND", status_code=404)
        return FlashcardSetSchema.model_validate(s)

    def delete_flashcard_set(self, set_id: str) -> bool:
        s = self.repo.get_set_by_id(set_id)
        if not s:
            raise AppException(f"Flashcard set '{set_id}' not found.", code="NOT_FOUND", status_code=404)
        return self.repo.delete_set(set_id)

    def review_card(self, card_id: str, status: str) -> FlashcardReviewResponse:
        card = self.repo.update_card_status(card_id, status)
        if not card:
            raise AppException(f"Flashcard '{card_id}' not found.", code="NOT_FOUND", status_code=404)
        return FlashcardReviewResponse(
            card_id=card.id,
            review_status=card.review_status,
            message=f"Flashcard status updated to '{status}'."
        )

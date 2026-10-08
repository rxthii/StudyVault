from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.document import Document, DocumentChunk
from app.models.conversation import Conversation, Message
from app.models.flashcard import FlashcardSet, Flashcard
from app.models.quiz import Quiz


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, doc_data: dict) -> Document:
        doc = Document(**doc_data)
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def get_by_id(self, doc_id: str) -> Optional[Document]:
        return self.db.query(Document).filter(Document.id == doc_id).first()

    def list_documents(
        self,
        linked: Optional[bool] = None,
        status: Optional[str] = None
    ) -> List[Document]:
        query = self.db.query(Document)
        if linked is not None:
            query = query.filter(Document.linked == linked)
        if status is not None:
            query = query.filter(Document.status == status)
        return query.order_by(desc(Document.created_at)).all()

    def update_status(
        self,
        doc_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> Optional[Document]:
        doc = self.get_by_id(doc_id)
        if doc:
            doc.status = status
            doc.error_message = error_message
            self.db.commit()
            self.db.refresh(doc)
        return doc

    def set_linked(self, doc_id: str, linked: bool) -> Optional[Document]:
        doc = self.get_by_id(doc_id)
        if doc:
            doc.linked = linked
            self.db.commit()
            self.db.refresh(doc)
        return doc

    def delete(self, doc_id: str) -> bool:
        doc = self.get_by_id(doc_id)
        if doc:
            self.db.delete(doc)
            self.db.commit()
            return True
        return False

    def add_chunks(self, chunks_data: List[dict]) -> List[DocumentChunk]:
        chunks = [DocumentChunk(**chunk) for chunk in chunks_data]
        self.db.add_all(chunks)
        self.db.commit()
        return chunks

    def get_chunk(self, doc_id: str, chunk_id: str) -> Optional[DocumentChunk]:
        return (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc_id, DocumentChunk.chunk_id == chunk_id)
            .first()
        )

    def get_chunks_by_page(self, doc_id: str, page_number: int) -> List[DocumentChunk]:
        return (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc_id, DocumentChunk.page_number == page_number)
            .order_by(DocumentChunk.chunk_id)
            .all()
        )

    def get_all_chunks(self, doc_id: str) -> List[DocumentChunk]:
        return (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc_id)
            .order_by(DocumentChunk.page_number, DocumentChunk.chunk_id)
            .all()
        )

    def get_linked_document_ids(self) -> List[str]:
        results = (
            self.db.query(Document.id)
            .filter(Document.linked == True, Document.status == "ready")
            .all()
        )
        return [r[0] for r in results]


class ConversationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, conv_id: Optional[str] = None, title: Optional[str] = None) -> Conversation:
        if conv_id:
            conv = self.db.query(Conversation).filter(Conversation.id == conv_id).first()
            if conv:
                return conv
        conv = Conversation(id=conv_id, title=title) if conv_id else Conversation(title=title)
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def get_by_id(self, conv_id: str) -> Optional[Conversation]:
        return self.db.query(Conversation).filter(Conversation.id == conv_id).first()

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        mode: str = "ask",
        source_mode: str = "documents_only",
        sources_json: Optional[str] = None
    ) -> Message:
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            mode=mode,
            source_mode=source_mode,
            sources_json=sources_json
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def get_history(self, conv_id: str, limit: int = 20) -> List[Message]:
        return (
            self.db.query(Message)
            .filter(Message.conversation_id == conv_id)
            .order_by(Message.created_at)
            .limit(limit)
            .all()
        )

    def delete(self, conv_id: str) -> bool:
        conv = self.get_by_id(conv_id)
        if conv:
            self.db.delete(conv)
            self.db.commit()
            return True
        return False


class FlashcardRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_set(
        self,
        difficulty: str,
        count: int,
        cards_data: List[dict],
        title: Optional[str] = None
    ) -> FlashcardSet:
        fc_set = FlashcardSet(title=title, difficulty=difficulty, count=count)
        self.db.add(fc_set)
        self.db.commit()
        self.db.refresh(fc_set)

        cards = [
            Flashcard(
                set_id=fc_set.id,
                question=c.get("question"),
                answer=c.get("answer"),
                document_id=c.get("document_id"),
                document_name=c.get("document_name"),
                page_number=c.get("page_number"),
                source_chunk_id=c.get("source_chunk_id"),
                review_status="unreviewed"
            )
            for c in cards_data
        ]
        self.db.add_all(cards)
        self.db.commit()
        self.db.refresh(fc_set)
        return fc_set

    def list_sets(self) -> List[FlashcardSet]:
        return self.db.query(FlashcardSet).order_by(desc(FlashcardSet.created_at)).all()

    def get_set_by_id(self, set_id: str) -> Optional[FlashcardSet]:
        return self.db.query(FlashcardSet).filter(FlashcardSet.id == set_id).first()

    def delete_set(self, set_id: str) -> bool:
        fc_set = self.get_set_by_id(set_id)
        if fc_set:
            self.db.delete(fc_set)
            self.db.commit()
            return True
        return False

    def update_card_status(self, card_id: str, status: str) -> Optional[Flashcard]:
        card = self.db.query(Flashcard).filter(Flashcard.id == card_id).first()
        if card:
            card.review_status = status
            self.db.commit()
            self.db.refresh(card)
        return card


class QuizRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_quiz(
        self,
        title: Optional[str],
        difficulty: str,
        question_count: int,
        questions_json: str
    ) -> Quiz:
        quiz = Quiz(
            title=title,
            difficulty=difficulty,
            question_count=question_count,
            questions_json=questions_json,
            completed=False
        )
        self.db.add(quiz)
        self.db.commit()
        self.db.refresh(quiz)
        return quiz

    def get_by_id(self, quiz_id: str) -> Optional[Quiz]:
        return self.db.query(Quiz).filter(Quiz.id == quiz_id).first()

    def submit_score(self, quiz_id: str, score: int) -> Optional[Quiz]:
        quiz = self.get_by_id(quiz_id)
        if quiz:
            quiz.score = score
            quiz.completed = True
            self.db.commit()
            self.db.refresh(quiz)
        return quiz

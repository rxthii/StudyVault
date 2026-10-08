import json
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import AppException
from app.database.repositories import QuizRepository, DocumentRepository
from app.ai.openrouter import get_llm
from app.ai.generators import StructuredGenerators
from app.services.context_selection import select_representative_chunks
from app.schemas.quiz import (
    Quiz as QuizSchema,
    QuizGenerationRequest,
    QuizQuestionStudentView,
    QuizSubmitRequest,
    QuizSubmitResult,
    QuizEvaluationDetail,
)


class QuizService:
    def __init__(
        self,
        db: Session,
        settings: Optional[Settings] = None,
        llm: Optional[BaseChatModel] = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.repo = QuizRepository(db)
        self.doc_repo = DocumentRepository(db)
        self._llm_override = llm

    def generate_quiz(self, request: QuizGenerationRequest) -> QuizSchema:
        """
        Generates an exam quiz strictly grounded in active/selected documents.
        """
        active_ids = self.doc_repo.get_linked_document_ids()
        if not active_ids:
            raise AppException(
                "No linked or ready documents available to generate quiz from. Please upload a document or link an existing one.",
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

        # Sample across the selected documents instead of overusing the first pages.
        selected_snippets = select_representative_chunks(
            all_chunks,
            min(len(all_chunks), min(30, max(8, request.question_count * 2)))
        )

        generation_llm = self._llm_override or get_llm(
            self.settings,
            temperature=0.2,
            max_tokens=min(6000, max(1600, request.question_count * 220)),
        )

        gen_data = StructuredGenerators.generate_quiz_content(
            llm=generation_llm,
            snippets=selected_snippets,
            question_count=request.question_count,
            difficulty=request.difficulty
        )

        questions = gen_data.get("questions", [])
        title = gen_data.get("title", f"StudyVault Grounded Quiz ({request.difficulty.capitalize()})")

        quiz = self.repo.create_quiz(
            title=title,
            difficulty=request.difficulty,
            question_count=len(questions),
            questions_json=json.dumps(questions)
        )

        # Return student view
        student_questions = [
            QuizQuestionStudentView(
                question_id=q.get("question_id", idx),
                question=q.get("question", ""),
                options=q.get("options", [])
            )
            for idx, q in enumerate(questions, 1)
        ]

        return QuizSchema(
            id=quiz.id,
            title=quiz.title,
            difficulty=quiz.difficulty,
            question_count=quiz.question_count,
            questions=student_questions,
            completed=quiz.completed,
            score=quiz.score,
            created_at=quiz.created_at
        )

    def get_quiz(self, quiz_id: str) -> QuizSchema:
        quiz = self.repo.get_by_id(quiz_id)
        if not quiz:
            raise AppException(f"Quiz '{quiz_id}' not found.", code="NOT_FOUND", status_code=404)

        questions = json.loads(quiz.questions_json)
        student_questions = [
            QuizQuestionStudentView(
                question_id=q.get("question_id", idx),
                question=q.get("question", ""),
                options=q.get("options", [])
            )
            for idx, q in enumerate(questions, 1)
        ]

        return QuizSchema(
            id=quiz.id,
            title=quiz.title,
            difficulty=quiz.difficulty,
            question_count=quiz.question_count,
            questions=student_questions,
            completed=quiz.completed,
            score=quiz.score,
            created_at=quiz.created_at
        )

    def submit_quiz(self, quiz_id: str, request: QuizSubmitRequest) -> QuizSubmitResult:
        quiz = self.repo.get_by_id(quiz_id)
        if not quiz:
            raise AppException(f"Quiz '{quiz_id}' not found.", code="NOT_FOUND", status_code=404)

        questions = json.loads(quiz.questions_json)
        score = 0
        details: List[QuizEvaluationDetail] = []

        for idx, q in enumerate(questions, 1):
            qid_str = str(q.get("question_id", idx))
            user_ans = request.answers.get(qid_str, "").strip()
            correct_ans = q.get("correct_answer", "").strip()

            # Compare normalized (e.g. check prefix "A)" or matching text)
            is_correct = False
            if user_ans:
                u_norm = user_ans.lower()
                c_norm = correct_ans.lower()
                if u_norm == c_norm or (len(u_norm) == 1 and c_norm.startswith(u_norm + ")")):
                    is_correct = True
                elif u_norm.startswith(c_norm[:2]):
                    is_correct = True

            if is_correct:
                score += 1

            details.append(QuizEvaluationDetail(
                question_id=int(qid_str),
                question=q.get("question", ""),
                user_answer=user_ans or "No answer provided",
                correct_answer=correct_ans,
                is_correct=is_correct,
                explanation=q.get("explanation", ""),
                source_reference={
                    "document": q.get("document_name"),
                    "page": q.get("page_number"),
                    "snippet": q.get("source_snippet")
                }
            ))

        total = len(questions)
        pct = round((score / total) * 100, 1) if total > 0 else 0.0
        self.repo.submit_score(quiz_id, score)

        return QuizSubmitResult(
            quiz_id=quiz_id,
            score=score,
            total_questions=total,
            percentage=pct,
            results=details
        )

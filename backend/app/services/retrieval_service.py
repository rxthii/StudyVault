from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.database.repositories import DocumentRepository
from app.vectorstore.retriever import PineconeDocumentRetriever
from app.vectorstore.pinecone_client import get_pinecone_manager
from app.schemas.retrieval import SourceReference, RetrievalResult, RetrievalStatsResponse


class RetrievalService:
    def __init__(
        self,
        db: Session,
        settings: Optional[Settings] = None,
        retriever: Optional[PineconeDocumentRetriever] = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.repo = DocumentRepository(db)
        # Embedding initialization is only needed for searches. In particular,
        # the stats endpoint must remain usable when the embedding provider is
        # unavailable or misconfigured.
        self._retriever = retriever

    @property
    def retriever(self) -> PineconeDocumentRetriever:
        if self._retriever is None:
            self._retriever = PineconeDocumentRetriever(settings=self.settings)
        return self._retriever

    def get_effective_document_ids(self, requested_doc_ids: Optional[List[str]] = None) -> List[str]:
        """
        Determines the effective list of document IDs allowed in retrieval.
        CRITICAL: All unlinked documents are strictly excluded.
        """
        linked_ids = set(self.repo.get_linked_document_ids())
        if not linked_ids:
            logger.info("No documents are currently linked or ready.")
            return []

        clean_requested = [
            d.strip() for d in (requested_doc_ids or [])
            if d and d.strip().lower() not in ["string", "null", "none"]
        ]

        if clean_requested:
            # Filter user requested IDs against currently linked/ready documents
            effective = [doc_id for doc_id in clean_requested if doc_id in linked_ids]
            logger.info(f"Filtered {len(clean_requested)} requested documents to {len(effective)} active linked documents.")
            return effective

        # Default to all linked/ready documents
        return list(linked_ids)

    def search(
        self,
        query: str,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None
    ) -> RetrievalResult:
        """
        Performs semantic vector search over Pinecone respecting active-document boundaries.
        """
        effective_doc_ids = self.get_effective_document_ids(document_ids)
        if not effective_doc_ids:
            return RetrievalResult(
                query=query,
                results=[],
                total_found=0,
                active_documents_count=0
            )

        k = top_k or self.settings.TOP_K
        results = self.retriever.retrieve(
            query=query,
            allowed_document_ids=effective_doc_ids,
            top_k=k,
            similarity_threshold=similarity_threshold
        )

        return RetrievalResult(
            query=query,
            results=results,
            total_found=len(results),
            active_documents_count=len(effective_doc_ids)
        )

    def get_stats(self) -> RetrievalStatsResponse:
        """Returns vector index and database document status metrics."""
        pinecone_mgr = (
            self._retriever.pinecone_mgr
            if self._retriever is not None
            else get_pinecone_manager()
        )
        stats = pinecone_mgr.get_stats()
        all_docs = self.repo.list_documents()
        linked_docs = [d for d in all_docs if d.linked and d.status == "ready"]

        return RetrievalStatsResponse(
            index_name=stats.get("index_name", self.settings.PINECONE_INDEX_NAME),
            dimension=stats.get("dimension", self.settings.EMBEDDING_DIMENSION),
            total_vector_count=stats.get("total_vector_count", 0),
            namespaces=stats.get("namespaces", {}),
            linked_documents_count=len(linked_docs),
            total_documents_count=len(all_docs)
        )
